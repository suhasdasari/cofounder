import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark, Wordmark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { PaySheet, type PayKind } from "@/components/pay-sheet";
import {
  claimPitch,
  defendPitch,
  getArena,
  startRoast,
  stealPitch,
  submitPitch,
  type ArenaPayload,
  type BoardRow,
} from "@/lib/game/arena";
import { getFingerprint } from "@/lib/fingerprint";
import { formatUsd, PILLS } from "@/lib/game/valuation";
import { PRICE } from "@/lib/pay/config";
import { cn } from "@/lib/utils";

type Tab = "round" | "daily" | "allTime";
type Phase = "idle" | "roast" | "clap" | "card";

type CardState = {
  valuation: number;
  archetype: string;
  quote: string;
  roast: string;
  clapback: string;
  pitch: string;
  paid: boolean;
  id?: string;
  beat?: boolean;
  need?: number;
  founderVal?: number;
  handle?: string | null;
  url?: string | null;
  steal?: boolean;
  defendWin?: boolean;
};

function remain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export function ArenaApp({ initial }: { initial: ArenaPayload }) {
  const qc = useQueryClient();
  const fp = useMemo(() => getFingerprint(), []);
  const arena = useQuery({
    queryKey: ["arena", fp],
    queryFn: () => getArena({ data: { fingerprint: fp } }),
    initialData: initial,
  });
  const [now, setNow] = useState(() => Date.now());
  const [clockOn, setClockOn] = useState(false);
  const [mobileTab, setMobileTab] = useState<"fight" | "board">("fight");
  const [tab, setTab] = useState<Tab>("round");
  const [phase, setPhase] = useState<Phase>("idle");
  const [pitch, setPitch] = useState("");
  const [roast, setRoast] = useState("");
  const [shownRoast, setShownRoast] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [scraped, setScraped] = useState(false);
  const [clap, setClap] = useState("");
  const [left, setLeft] = useState(15);
  const [stealTarget, setStealTarget] = useState<BoardRow | null>(null);
  const [defendTarget, setDefendTarget] = useState<BoardRow | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [site, setSite] = useState("");
  const [logo, setLogo] = useState("");
  const [bio, setBio] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [payKind, setPayKind] = useState<PayKind | null>(null);
  const [copied, setCopied] = useState(false);
  const lockedRef = useRef(false);
  const clapRef = useRef("");
  const paidRef = useRef(false);
  const payTxRef = useRef<string | null>(null);

  useEffect(() => {
    setClockOn(true);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (phase !== "roast" || !roast) return;
    setShownRoast("");
    let i = 0;
    const t = window.setInterval(() => {
      i += 2;
      setShownRoast(roast.slice(0, i));
      if (i >= roast.length) {
        window.clearInterval(t);
        setPhase("clap");
        setLeft(15);
      }
    }, 16);
    return () => window.clearInterval(t);
  }, [phase, roast]);

  useEffect(() => {
    clapRef.current = clap;
  }, [clap]);

  useEffect(() => {
    if (phase !== "clap") return;
    if (left <= 0) {
      void lockClap(clapRef.current || PILLS[1]);
      return;
    }
    const t = window.setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, left]);

  const data = arena.data;
  const roundLeft = data?.endsAt ? Math.max(0, Date.parse(data.endsAt) - now) : 0;
  const rows =
    tab === "daily" ? data?.daily ?? [] : tab === "allTime" ? data?.allTime ?? [] : data?.round ?? [];

  const roastMut = useMutation({
    mutationFn: startRoast,
    onSuccess: (res) => {
      if (!res.ok) {
        setNotice(res.error);
        setPhase("idle");
        return;
      }
      setRoast(res.roast);
      setUrl(res.url);
      setTitle(res.title);
      setScraped(res.scraped);
      setPhase("roast");
      setNotice(null);
    },
    onError: () => {
      setNotice("Could not roast that. Try again.");
      setPhase("idle");
      lockedRef.current = false;
    },
  });

  const pitchMut = useMutation({
    mutationFn: submitPitch,
    onSuccess: (res) => {
      if (!res.ok) {
        lockedRef.current = false;
        setNotice(res.error);
        return;
      }
      setCard({
        valuation: res.valuation,
        archetype: res.archetype,
        quote: res.quote,
        roast,
        clapback: clap,
        pitch,
        paid: res.paid,
        id: res.id,
      });
      setPhase("card");
      void qc.invalidateQueries({ queryKey: ["arena"] });
    },
  });

  const stealMut = useMutation({
    mutationFn: stealPitch,
    onSuccess: (res) => {
      if (!res.ok) {
        lockedRef.current = false;
        setNotice(res.error);
        if ("needPay" in res && res.needPay) setPayKind("steal");
        return;
      }
      setCard({
        valuation: res.valuation,
        archetype: res.beat ? "Crowd Champ" : "Scar",
        quote: res.quote,
        roast: res.roast,
        clapback: clap,
        pitch: res.pitch,
        paid: false,
        beat: res.beat,
        need: res.need,
        founderVal: res.founderVal,
        handle: res.handle,
        url: res.url,
        steal: true,
      });
      setPhase("card");
      setStealTarget(null);
      void qc.invalidateQueries({ queryKey: ["arena"] });
    },
  });

  const defendMut = useMutation({
    mutationFn: defendPitch,
    onSuccess: (res) => {
      if (!res.ok) {
        lockedRef.current = false;
        setNotice(res.error);
        return;
      }
      setCard({
        valuation: res.valuation,
        archetype: res.archetype,
        quote: res.quote,
        roast,
        clapback: clap,
        pitch,
        paid: true,
        defendWin: res.win,
      });
      setPhase("card");
      setDefendTarget(null);
      void qc.invalidateQueries({ queryKey: ["arena"] });
    },
  });

  function beginRoast(paid: boolean) {
    const text = pitch.trim();
    if (text.length < 8) {
      setNotice("Write a real one-liner or paste a URL.");
      return;
    }
    if (paid && !detectLocal(text)) {
      setNotice("A $5 listing needs a product URL.");
      return;
    }
    setNotice(null);
    setClap("");
    setCard(null);
    setStealTarget(null);
    setDefendTarget(null);
    lockedRef.current = false;
    if (paid) {
      setPayKind("pitch");
      return;
    }
    paidRef.current = false;
    payTxRef.current = null;
    roastMut.mutate({ data: { fingerprint: fp, pitch: text } });
  }

  function lockClap(text: string) {
    const line = text.trim();
    if (!line) return;
    if (lockedRef.current) return;
    lockedRef.current = true;
    setClap(line);
    const txHash = payTxRef.current;
    if (stealTarget) {
      stealMut.mutate({
        data: {
          fingerprint: fp,
          pitchId: stealTarget.id,
          clapback: line,
          handle: handle || undefined,
          paid: paidRef.current,
          txHash: txHash || undefined,
        },
      });
      return;
    }
    if (defendTarget) {
      defendMut.mutate({
        data: { fingerprint: fp, pitchId: defendTarget.id, clapback: line },
      });
      return;
    }
    pitchMut.mutate({
      data: {
        fingerprint: fp,
        pitch,
        roast,
        clapback: line,
        url,
        title,
        paid: paidRef.current,
        txHash: txHash || undefined,
        displayName: name || undefined,
        handle: handle || undefined,
        logoUrl: logo || undefined,
        bio: bio || undefined,
      },
    });
  }

  function startSteal(row: BoardRow) {
    setStealTarget(row);
    setDefendTarget(null);
    setRoast(row.roast);
    setShownRoast(row.roast);
    setPitch(row.pitch);
    setUrl(row.url);
    setPhase("clap");
    setLeft(15);
    setClap("");
    setCard(null);
    setMobileTab("fight");
    setPayKind(null);
    lockedRef.current = false;
    paidRef.current = false;
    payTxRef.current = null;
  }

  function startDefend(row: BoardRow) {
    setDefendTarget(row);
    setStealTarget(null);
    setRoast(row.roast);
    setShownRoast(row.roast);
    setPitch(row.pitch);
    setPhase("clap");
    setLeft(15);
    setClap("");
    setMobileTab("fight");
    lockedRef.current = false;
  }

  const shareText = useMemo(() => {
    if (!card) return "";
    if (card.steal && card.beat && card.handle) {
      return `I just dropped a ${formatUsd(card.valuation)} crowd champ on @${card.handle} at cofounder.lol. One defend.`;
    }
    return `I forced the toxic AI cofounder to ${formatUsd(card.valuation)} at cofounder.lol.\n${card.archetype}.\n"${card.quote}"`;
  }, [card]);

  const busy = roastMut.isPending || pitchMut.isPending || stealMut.isPending || defendMut.isPending;

  function onPaySuccess(txHash: string | "preview") {
    const hash = txHash === "preview" ? null : txHash;
    paidRef.current = true;
    payTxRef.current = hash;
    const kind = payKind;
    setPayKind(null);
    setNotice(null);
    if (kind === "pitch") {
      setPhase("roast");
      setRoast("");
      setShownRoast("");
      roastMut.mutate({ data: { fingerprint: fp, pitch: pitch.trim() } });
      return;
    }
    if (kind === "steal" && stealTarget) {
      lockedRef.current = false;
      const line = clapRef.current.trim() || clap.trim();
      if (line) lockClap(line);
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 lg:px-6">
        <Wordmark />
        <p className="shrink-0 text-xs uppercase tracking-widest text-muted">
          {clockOn ? `${remain(roundLeft)} left` : "round"}
        </p>
      </header>
      <p className="flex shrink-0 gap-x-4 overflow-x-auto border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted lg:px-6">
        <span>Pitch $5</span>
        <span>3 free steals / day</span>
        <span>Rank is $</span>
        <span className="text-stamp">URL never moves</span>
      </p>
      {(data?.spotlight.length ?? 0) > 0 ? (
        <div className="flex shrink-0 gap-3 overflow-x-auto border-b border-border px-4 py-2 lg:px-6">
          {data!.spotlight.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => startSteal(s)}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-paper px-3 py-1.5 text-ink"
            >
              <span className="rounded-sm bg-stamp px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-paper">
                Verified
              </span>
              <span className="max-w-40 truncate text-sm">{s.displayName || s.pitch}</span>
              <span className="font-display text-sm tabular-nums">{formatUsd(s.sortValue)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex shrink-0 gap-1 border-b border-border px-4 py-2 lg:hidden">
        {(["fight", "board"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={cn(
              "h-9 flex-1 rounded-md text-xs font-medium uppercase tracking-wider",
              mobileTab === id ? "bg-paper text-ink" : "text-muted",
            )}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-1 lg:grid-cols-2">
        <section
          className={cn(
            "min-h-0 overflow-y-auto border-border px-4 py-4 lg:block lg:border-r lg:px-6 lg:py-5",
            mobileTab === "fight" ? "block" : "hidden lg:block",
          )}
        >
          {payKind ? (
            <div className="mx-auto w-full max-w-xl">
              <PaySheet
                kind={payKind}
                stealVerified={Boolean(stealTarget?.verified)}
                onSuccess={onPaySuccess}
                onCancel={() => setPayKind(null)}
              />
            </div>
          ) : (
          <FightPane
            phase={phase}
            pitch={pitch}
            setPitch={setPitch}
            shownRoast={shownRoast}
            scraped={scraped}
            title={title}
            clap={clap}
            setClap={setClap}
            left={left}
            onRoast={() => beginRoast(false)}
            onPaid={() => beginRoast(true)}
            onLock={() => lockClap(clap)}
            onPill={(p) => {
              setClap(p);
              void lockClap(p);
            }}
            busy={busy}
            notice={notice}
            stealTarget={stealTarget}
            defendTarget={defendTarget}
            card={card}
            shareText={shareText}
            copied={copied}
            onCopy={async () => {
              await navigator.clipboard.writeText(`${shareText}\n${window.location.origin}`);
              setCopied(true);
            }}
            name={name}
            handle={handle}
            site={site}
            logo={logo}
            bio={bio}
            setName={setName}
            setHandle={setHandle}
            setSite={setSite}
            setLogo={setLogo}
            setBio={setBio}
            onClaim={() => {
              if (!card?.id) return;
              void claimPitch({
                data: {
                  fingerprint: fp,
                  pitchId: card.id,
                  displayName: name,
                  handle: handle || undefined,
                  url: site || undefined,
                  logoUrl: logo || undefined,
                  bio: bio || undefined,
                },
              }).then(() => void qc.invalidateQueries({ queryKey: ["arena"] }));
            }}
            onAgain={() => {
              setPhase("idle");
              setCard(null);
              setStealTarget(null);
              setDefendTarget(null);
              setRoast("");
              setShownRoast("");
              setClap("");
              setPayKind(null);
              setCopied(false);
              lockedRef.current = false;
              paidRef.current = false;
              payTxRef.current = null;
            }}
            usage={data?.usage}
          />
          )}
        </section>
        <aside
          className={cn(
            "flex min-h-0 flex-col overflow-hidden px-4 py-4 lg:flex lg:px-6 lg:py-5",
            mobileTab === "board" ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="mb-3 flex rounded-lg border border-border p-1">
            {(
              [
                ["round", "Round"],
                ["daily", "Daily"],
                ["allTime", "All-time"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "h-9 flex-1 rounded-md text-xs font-medium",
                  tab === id ? "bg-paper text-ink" : "text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="text-sm text-muted">Board is empty this round.</p>
            ) : (
              rows.slice(0, 20).map((row) => (
                <BoardCard
                  key={row.id}
                  row={row}
                  onSteal={() => startSteal(row)}
                  onDefend={() => startDefend(row)}
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function detectLocal(text: string): boolean {
  return /https?:\/\//i.test(text) || /\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(text);
}

function FightPane(props: {
  phase: Phase;
  pitch: string;
  setPitch: (s: string) => void;
  shownRoast: string;
  scraped: boolean;
  title: string | null;
  clap: string;
  setClap: (s: string) => void;
  left: number;
  onRoast: () => void;
  onPaid: () => void;
  onLock: () => void;
  onPill: (p: string) => void;
  busy: boolean;
  notice: string | null;
  stealTarget: BoardRow | null;
  defendTarget: BoardRow | null;
  card: CardState | null;
  shareText: string;
  copied: boolean;
  onCopy: () => void;
  name: string;
  handle: string;
  site: string;
  logo: string;
  bio: string;
  setName: (s: string) => void;
  setHandle: (s: string) => void;
  setSite: (s: string) => void;
  setLogo: (s: string) => void;
  setBio: (s: string) => void;
  onClaim: () => void;
  onAgain: () => void;
  usage?: { joke: number; steal: number };
}) {
  if (props.card && props.phase === "card") {
    const c = props.card;
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <article className="relative overflow-hidden rounded-xl bg-paper px-5 py-5 text-ink">
          <BrandMark className="pointer-events-none absolute -right-3 -top-3 size-20 opacity-[0.18]" />
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-stamp">
            cofounder.lol{c.paid ? " · verified" : ""}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wider text-ink/50">Pitched</p>
          <p className="font-medium">{c.pitch}</p>
          <p className="mt-3 text-xs uppercase tracking-wider text-ink/50">AI roast</p>
          <p className="text-sm italic">{c.roast}</p>
          <p className="mt-3 text-xs uppercase tracking-wider text-ink/50">Clapback</p>
          <p className="text-sm">{c.clapback}</p>
          <div className="mt-4 border-t border-ink/10 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-ink/50">Valuation</p>
            <p className="font-display text-3xl tabular-nums">{formatUsd(c.valuation)}</p>
            <p className="mt-1 text-sm text-ink/70">{c.archetype}</p>
            {c.quote ? <p className="mt-1 text-sm italic text-ink/60">“{c.quote}”</p> : null}
            {c.steal ? (
              <p className="mt-2 text-sm">
                {c.beat
                  ? `Crowd champ. Needed ${formatUsd(c.need ?? 0)} vs ${formatUsd(c.founderVal ?? 0)}.`
                  : `Scar. Needed ${formatUsd(c.need ?? 0)}.`}
              </p>
            ) : null}
            {c.defendWin === true ? <p className="mt-2 text-sm">Defend held. They stay a scar.</p> : null}
            {c.defendWin === false ? <p className="mt-2 text-sm">Defend failed. Crowd champ stays.</p> : null}
          </div>
        </article>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={props.onCopy}>
            {props.copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={props.onAgain}>
            Again
          </Button>
        </div>
        {!c.steal && c.id ? (
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="Name" value={props.name} onChange={(e) => props.setName(e.target.value)} />
            <input className={field} placeholder="@handle" value={props.handle} onChange={(e) => props.setHandle(e.target.value)} />
            <input className={cn(field, "col-span-2")} placeholder="yourproduct.com" value={props.site} onChange={(e) => props.setSite(e.target.value)} />
            <input className={cn(field, "col-span-2")} placeholder="Logo URL" value={props.logo} onChange={(e) => props.setLogo(e.target.value)} />
            <Button className="col-span-2" variant="outline" onClick={props.onClaim}>
              Put this on the board
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (props.phase === "roast" || props.phase === "clap") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <p className="text-[10px] uppercase tracking-wider text-muted">
          {props.defendTarget ? "Defend" : props.stealTarget ? "Steal" : "Roast"}
          {props.title ? ` · ${props.title}` : ""}
          {props.scraped ? " · read the page" : props.stealTarget ? "" : " · text only"}
        </p>
        <h1 className="font-display text-2xl leading-snug lg:text-3xl">{props.shownRoast || "…"}</h1>
        {props.phase === "clap" ? (
          <>
            <p className={cn("text-xs uppercase tracking-widest tabular-nums", props.left <= 5 ? "text-stamp" : "text-muted")}>
              {props.left}s
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PILLS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => props.onPill(p)}
                  className="h-11 rounded-md border border-border bg-surface px-3 text-left text-xs transition-colors duration-[var(--motion-quick)] hover:border-stamp/50"
                >
                  {p}
                </button>
              ))}
            </div>
            <textarea
              className="min-h-20 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Or type your clapback"
              value={props.clap}
              maxLength={280}
              onChange={(e) => props.setClap(e.target.value)}
            />
            <Button size="lg" onClick={props.onLock} disabled={props.busy || !props.clap.trim()}>
              {props.busy ? "Scoring…" : "Lock clapback"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">Listening…</p>
        )}
        {props.notice ? <p className="text-sm text-stamp">{props.notice}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="font-display text-2xl leading-tight lg:text-4xl">
        Pitch a startup. <span className="italic text-stamp">Get roasted.</span> Clap back.
      </h1>
      <p className="text-sm text-muted">
        Rank is valuation. $5 lists a real product on Base USDC. Steal is free three times a day.
        {props.usage ? ` You have ${Math.max(0, 3 - props.usage.steal)} steals left today.` : ""}
      </p>
      <textarea
        className="min-h-24 rounded-xl border border-border bg-surface px-3 py-3 text-base"
        placeholder="One sentence, or paste your URL"
        value={props.pitch}
        maxLength={280}
        onChange={(e) => props.setPitch(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={props.onRoast} disabled={props.busy}>
          {props.busy ? "…" : "Roast me"}
        </Button>
        <Button size="lg" variant="paper" onClick={props.onPaid} disabled={props.busy}>
          Pitch · ${PRICE.pitchUsd}
        </Button>
      </div>
      {props.notice ? <p className="text-sm text-stamp">{props.notice}</p> : null}
    </div>
  );
}

function BoardCard({
  row,
  onSteal,
  onDefend,
}: {
  row: BoardRow;
  onSteal: () => void;
  onDefend: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-surface p-3",
        row.rank === 1 && "border-transparent bg-paper text-ink",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-medium">
          <span className="mr-2 tabular-nums text-subtle">#{row.rank}</span>
          {row.url ? (
            <a href={row.url} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-4">
              {row.displayName || row.pitch}
            </a>
          ) : (
            row.displayName || row.pitch
          )}
        </p>
        <p className="shrink-0 font-display tabular-nums">{formatUsd(row.sortValue)}</p>
      </div>
      <p className={cn("mt-1 truncate text-xs", row.rank === 1 ? "text-ink/55" : "text-muted")}>
        {row.verified ? "Verified · " : row.house ? "House · " : ""}
        {row.handle ? `@${row.handle}` : row.archetype}
        {row.crowdValuation != null
          ? ` · crowd ${formatUsd(row.crowdValuation)}${row.crowdScar ? " scar" : " champ"}`
          : ""}
      </p>
      <p className={cn("mt-2 line-clamp-2 text-sm italic", row.rank === 1 ? "text-ink/70" : "text-muted")}>{row.roast}</p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          className="text-xs font-medium text-stamp underline decoration-stamp/30 underline-offset-4"
          onClick={onSteal}
        >
          Steal
        </button>
        {row.mine && row.verified && !row.defendUsed && row.crowdValuation != null && row.crowdValuation > row.valuation ? (
          <button type="button" className="text-xs underline decoration-border underline-offset-4" onClick={onDefend}>
            Defend
          </button>
        ) : null}
      </div>
    </article>
  );
}

const field = "h-11 rounded-md border border-border bg-surface px-3 text-sm text-fg";
