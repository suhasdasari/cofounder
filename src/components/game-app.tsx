import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/profile-card";
import { SplitSlider } from "@/components/split-slider";
import {
  challengeFounder,
  claimRank,
  createDuel,
  getBoard,
  getDuel,
  getToday,
  joinDuel,
  submitCase,
  submitRun,
  type ProfileRow,
  type TodayPayload,
} from "@/lib/game/actions";
import type { PublicCase } from "@/lib/game/cases";
import { getFingerprint } from "@/lib/fingerprint";
import { cn } from "@/lib/utils";

type Screen = "home" | "play" | "result";
type BoardTab = "round" | "daily" | "allTime";

type Result = Extract<Awaited<ReturnType<typeof submitRun>>, { ok: true }>;
type DuelCompare = Extract<Awaited<ReturnType<typeof joinDuel>>, { ok: true }>;

function formatRemain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}

export function GameApp({
  duelId,
  initialToday,
  initialBoard,
}: {
  duelId?: string;
  initialToday: TodayPayload;
  initialBoard: {
    roundKey: string;
    dayKey: string;
    endsAt: string;
    round: ProfileRow[];
    daily: ProfileRow[];
    allTime: ProfileRow[];
  };
}) {
  const qc = useQueryClient();
  const today = useQuery({
    queryKey: ["today"],
    queryFn: () => getToday(),
    initialData: initialToday,
  });
  const board = useQuery({
    queryKey: ["board"],
    queryFn: () => getBoard(),
    initialData: initialBoard,
  });

  const [activeDuelId, setActiveDuelId] = useState(duelId);
  const duel = useQuery({
    queryKey: ["duel", activeDuelId],
    queryFn: () => getDuel({ data: { id: activeDuelId! } }),
    enabled: Boolean(activeDuelId),
  });

  const [screen, setScreen] = useState<Screen>("home");
  const [index, setIndex] = useState(0);
  const [split, setSplit] = useState(50);
  const [locked, setLocked] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [duelResult, setDuelResult] = useState<DuelCompare | null>(null);
  const [claimName, setClaimName] = useState("");
  const [claimHandle, setClaimHandle] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [claimLogo, setClaimLogo] = useState("");
  const [claimBio, setClaimBio] = useState("");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [showCase, setShowCase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<BoardTab>("round");

  const cases = today.data?.cases ?? [];
  const current: PublicCase | undefined = cases[index];

  const finishRef = useRef(false);
  const lockedRef = useRef(locked);
  const splitRef = useRef(split);
  const casesRef = useRef(cases);
  const startedAtRef = useRef(startedAt);
  const roundKeyRef = useRef(today.data?.roundKey ?? "");
  const duelIdRef = useRef(activeDuelId);
  const claimNameRef = useRef(claimName);
  lockedRef.current = locked;
  splitRef.current = split;
  casesRef.current = cases;
  startedAtRef.current = startedAt;
  roundKeyRef.current = today.data?.roundKey ?? "";
  duelIdRef.current = activeDuelId;
  claimNameRef.current = claimName;

  useEffect(() => {
    if (screen !== "play") return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [screen]);

  const [clockOn, setClockOn] = useState(false);

  useEffect(() => {
    setClockOn(true);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const ends = today.data?.endsAt ? Date.parse(today.data.endsAt) : 0;
    if (!ends) return;
    const wait = ends - Date.now() + 400;
    if (wait <= 0) {
      void qc.invalidateQueries({ queryKey: ["today"] });
      void qc.invalidateQueries({ queryKey: ["board"] });
      return;
    }
    const t = window.setTimeout(() => {
      void qc.invalidateQueries({ queryKey: ["today"] });
      void qc.invalidateQueries({ queryKey: ["board"] });
    }, wait);
    return () => window.clearTimeout(t);
  }, [today.data?.endsAt, qc]);

  const remaining = Math.max(0, 45 - Math.floor((now - startedAt) / 1000));
  const roundLeft = today.data?.endsAt
    ? Math.max(0, Date.parse(today.data.endsAt) - now)
    : 0;

  const runMut = useMutation({
    mutationFn: submitRun,
    onSuccess: (res) => {
      if (!res.ok) {
        finishRef.current = false;
        setSubmitError(res.error);
        return;
      }
      setResult(res);
      setScreen("result");
      void qc.invalidateQueries({ queryKey: ["today"] });
      void qc.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (err) => {
      finishRef.current = false;
      setSubmitError(err instanceof Error ? err.message : "Could not score this run.");
    },
  });

  const claimMut = useMutation({
    mutationFn: claimRank,
    onSuccess: (res) => {
      setClaimMsg(res.ok ? `Card live · rank #${res.rank}` : res.error);
      if (res.ok) {
        void qc.invalidateQueries({ queryKey: ["today"] });
        void qc.invalidateQueries({ queryKey: ["board"] });
      }
    },
  });

  const duelMut = useMutation({ mutationFn: createDuel });
  const challengeMut = useMutation({
    mutationFn: challengeFounder,
    onSuccess: (res) => {
      if (!res.ok) {
        setNotice(res.error);
        return;
      }
      setNotice(null);
      setActiveDuelId(res.id);
      start();
    },
  });

  const joinMut = useMutation({
    mutationFn: joinDuel,
    onSuccess: (res) => {
      if (res.ok) setDuelResult(res);
    },
  });

  function submitSplits(next: number[]) {
    if (finishRef.current) return;
    if (next.length !== casesRef.current.length) return;
    finishRef.current = true;
    setSubmitError(null);
    const timeMs = Math.max(1, Date.now() - startedAtRef.current);
    const fp = getFingerprint();
    runMut.mutate({
      data: {
        fingerprint: fp,
        splits: next,
        timeMs,
        roundKey: roundKeyRef.current,
      },
    });
    if (duelIdRef.current) {
      joinMut.mutate({
        data: {
          id: duelIdRef.current,
          fingerprint: fp,
          name: claimNameRef.current || undefined,
          splits: next,
        },
      });
    }
  }

  function start() {
    if (!casesRef.current.length && !cases.length) return;
    finishRef.current = false;
    setIndex(0);
    setSplit(50);
    setLocked([]);
    setResult(null);
    setDuelResult(null);
    setSubmitError(null);
    setClaimMsg(null);
    setCopied(false);
    setStartedAt(Date.now());
    setNow(Date.now());
    setScreen("play");
  }

  function lock() {
    if (!current || finishRef.current) return;
    const next = [...locked, split];
    if (next.length >= cases.length) {
      submitSplits(next);
      return;
    }
    setLocked(next);
    setIndex((i) => i + 1);
    setSplit(50);
  }

  useEffect(() => {
    if (screen !== "play") return;
    if (remaining > 0) return;
    const total = casesRef.current.length;
    const done = [...lockedRef.current, splitRef.current];
    while (done.length < total) done.push(50);
    submitSplits(done.slice(0, total));
  }, [remaining, screen]);

  useEffect(() => {
    if (screen !== "play") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSplit((s) => Math.max(0, s - (e.shiftKey ? 5 : 1)));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSplit((s) => Math.min(100, s + (e.shiftKey ? 5 : 1)));
      } else if (e.key === "Enter") {
        e.preventDefault();
        lock();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, current, locked, split, cases.length]);

  const shareText = useMemo(() => {
    if (!result) return "";
    return `I split five cofounder fights on cofounder.lol.\n${result.archetype.title}. Fairness ${result.fairness}.\n"${result.archetype.line}"\nBeat my split — new five every 3 hours.`;
  }, [result]);

  if (today.isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-muted">
        Loading this round…
      </main>
    );
  }

  if (today.isError || !today.data) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center text-muted">
        Could not load this round. Refresh and try again.
      </main>
    );
  }

  const rows =
    tab === "daily"
      ? (board.data?.daily ?? today.data.daily)
      : tab === "allTime"
        ? (board.data?.allTime ?? today.data.allTime)
        : (board.data?.round ?? today.data.featured);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-5">
        <button
          type="button"
          className="inline-flex items-center gap-2 font-display text-xl tracking-tight"
          onClick={() => setScreen("home")}
        >
          <Scale className="size-4 text-stamp" strokeWidth={1.75} />
          cofounder.lol
        </button>
        <span className="text-xs uppercase tracking-widest text-muted">
          {clockOn ? `${formatRemain(roundLeft)} left` : "this round"}
        </span>
      </header>

      {screen === "home" ? (
        <Home
          data={today.data}
          roundLeft={roundLeft}
          clockOn={clockOn}
          tab={tab}
          setTab={setTab}
          rows={rows}
          duelHost={
            duel.data?.ok && !duel.data.expired
              ? (duel.data.hostName ?? "Your cofounder")
              : null
          }
          onStart={start}
          onOpenCase={() => setShowCase(true)}
          onChallenge={(rank) =>
            challengeMut.mutate({
              data: { fingerprint: getFingerprint(), rank },
            })
          }
          onRandom={() =>
            challengeMut.mutate({
              data: { fingerprint: getFingerprint(), random: true },
            })
          }
          challengeBusy={challengeMut.isPending}
          notice={notice}
        />
      ) : null}

      {screen === "play" && current ? (
        <Play
          current={current}
          index={index}
          total={cases.length}
          remaining={remaining}
          split={split}
          onSplit={setSplit}
          onLock={lock}
          locking={runMut.isPending || finishRef.current}
          error={submitError}
        />
      ) : null}

      {screen === "result" && result ? (
        <Result
          result={result}
          shareText={shareText}
          copied={copied}
          onCopy={async () => {
            await navigator.clipboard.writeText(
              `${shareText}\n${window.location.origin}`,
            );
            setCopied(true);
          }}
          claimName={claimName}
          claimHandle={claimHandle}
          claimUrl={claimUrl}
          claimLogo={claimLogo}
          claimBio={claimBio}
          setClaimName={setClaimName}
          setClaimHandle={setClaimHandle}
          setClaimUrl={setClaimUrl}
          setClaimLogo={setClaimLogo}
          setClaimBio={setClaimBio}
          onClaim={() =>
            claimMut.mutate({
              data: {
                fingerprint: getFingerprint(),
                displayName: claimName,
                handle: claimHandle || undefined,
                url: claimUrl || undefined,
                logoUrl: claimLogo || undefined,
                bio: claimBio || undefined,
              },
            })
          }
          claimPending={claimMut.isPending}
          claimMsg={claimMsg}
          onDuel={() =>
            duelMut.mutate({
              data: {
                fingerprint: getFingerprint(),
                name: claimName || undefined,
              },
            })
          }
          duelLink={
            duelMut.data && duelMut.data.ok
              ? `${window.location.origin}/?duel=${duelMut.data.id}`
              : null
          }
          onReplay={start}
          onRandom={() =>
            challengeMut.mutate({
              data: { fingerprint: getFingerprint(), random: true },
            })
          }
          duelResult={duelResult}
        />
      ) : null}

      {showCase ? (
        <CaseModal
          onClose={() => setShowCase(false)}
          onSubmit={async (payload) => {
            const res = await submitCase({ data: payload });
            if (res.ok) void qc.invalidateQueries({ queryKey: ["today"] });
            return res.ok;
          }}
        />
      ) : null}

      <footer className="mx-auto max-w-lg px-5 py-10 text-center text-xs leading-relaxed text-subtle">
        Satire. Not affiliated with, sponsored by, or connected to cofounder.co
        or its parent entities. Rank is earned by how you split — it cannot be
        bought.
      </footer>
    </div>
  );
}

function Home({
  data,
  roundLeft,
  clockOn,
  tab,
  setTab,
  rows,
  duelHost,
  onStart,
  onOpenCase,
  onChallenge,
  onRandom,
  challengeBusy,
  notice,
}: {
  data: TodayPayload;
  roundLeft: number;
  clockOn: boolean;
  tab: BoardTab;
  setTab: (t: BoardTab) => void;
  rows: ProfileRow[];
  duelHost: string | null;
  onStart: () => void;
  onOpenCase: () => void;
  onChallenge: (rank: number) => void;
  onRandom: () => void;
  challengeBusy: boolean;
  notice: string | null;
}) {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8 px-5 pb-8">
      <section className="flex flex-col gap-4 pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Equity splitter · 3 hour rounds
        </p>
        <h1 className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          Five fights.
          <br />
          One slider.
        </h1>
        <p className="max-w-md text-pretty text-muted">
          Same five splits for everyone until this round flips. Drag who gets
          the company. Score is a hidden house line — bots cannot move it.
        </p>
        {duelHost ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            Challenge from {duelHost}. Play the same five, then compare.
          </p>
        ) : null}
        <Button size="lg" onClick={onStart} className="mt-2 w-full sm:w-auto">
          Split the company
        </Button>
        <p className="text-xs text-subtle">
          {data.plays} scored {data.plays === 1 ? "run" : "runs"} this round.
          New five in {clockOn ? formatRemain(roundLeft) : "this round"}. About 45 seconds. No
          account.
        </p>
        {notice ? <p className="text-sm text-stamp">{notice}</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-subtle">
          This round's docket
        </p>
        <ol className="flex flex-col gap-3">
          {data.cases.map((c, i) => (
            <li key={c.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <span className="tabular-nums text-sm text-subtle">0{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.title}</p>
                {c.listedBy ? (
                  <p className="mt-0.5 truncate text-xs text-stamp">
                    Listed by {c.listedBy.productName}
                    {c.listedBy.handle ? ` · @${c.listedBy.handle}` : ""}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Leaderboards</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRandom}
            disabled={challengeBusy || rows.length === 0}
          >
            Random challenge
          </Button>
        </div>
        <div className="flex rounded-lg border border-border p-1">
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
                tab === id ? "bg-surface text-fg" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No splits yet. First fair take sits here.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.slice(0, 10).map((row) => (
              <ProfileCard
                key={`${tab}-${row.rank}-${row.displayName ?? "anon"}`}
                row={row}
                size={row.rank <= 3 ? "lg" : "sm"}
                onChallenge={tab === "round" ? () => onChallenge(row.rank) : undefined}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-subtle">
          Play this round, then pin a logo, name, site, and one-line pitch on
          your card.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">List your fight</h2>
        <p className="mt-2 text-sm text-muted">
          Founders queue a real equity dispute. The next free slot becomes case
          01 of a round — logo, name, and site on the docket thousands play.
        </p>
        {data.queuePreview.length ? (
          <ul className="mt-3 flex flex-col gap-2">
            {data.queuePreview.map((q) => (
              <li key={q.productName} className="flex items-center gap-2 text-sm">
                <span className="size-2 shrink-0 rounded-full bg-stamp" />
                <span className="truncate">{q.productName}</span>
                {q.handle ? (
                  <span className="truncate text-subtle">@{q.handle}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-subtle">Queue is empty. Yours can be next.</p>
        )}
        <Button variant="outline" className="mt-4 w-full" onClick={onOpenCase}>
          Submit a fight
        </Button>
      </section>

      <section className="text-sm leading-relaxed text-muted">
        <h2 className="mb-2 text-sm font-medium text-fg">How scoring works</h2>
        <p>
          Each case has a hidden house split. You lose two points per percentage
          point off that line. One official run per browser per 3-hour round.
          Practice after that. Anyone who plays can pin a profile card.
        </p>
      </section>
    </main>
  );
}

function Play({
  current,
  index,
  total,
  remaining,
  split,
  onSplit,
  onLock,
  locking,
  error,
}: {
  current: PublicCase;
  index: number;
  total: number;
  remaining: number;
  split: number;
  onSplit: (n: number) => void;
  onLock: () => void;
  locking: boolean;
  error: string | null;
}) {
  const listed = current.listedBy;
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8 px-5 pb-16">
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted">
        <span>
          Case {index + 1} / {total}
        </span>
        <span className={cn("tabular-nums", remaining <= 8 && "text-stamp")}>
          {remaining}s
        </span>
      </div>
      {listed ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
          {listed.logoUrl ? (
            <img
              src={listed.logoUrl}
              alt=""
              className="size-10 rounded-md object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="inline-flex size-10 items-center justify-center rounded-md border border-border font-display text-stamp">
              {(listed.productName[0] || "?").toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{listed.productName}</p>
            <p className="truncate text-xs text-muted">
              {listed.description || "Listed founder fight"}
              {listed.handle ? ` · @${listed.handle}` : ""}
            </p>
          </div>
        </div>
      ) : null}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
          {current.title}
        </p>
        <h2 className="font-display text-2xl leading-snug sm:text-3xl">
          {current.story}
        </h2>
      </div>
      <SplitSlider
        value={split}
        onChange={onSplit}
        aName={`${current.aName} · ${current.aLabel}`}
        bName={`${current.bName} · ${current.bLabel}`}
      />
      <Button size="lg" onClick={onLock} disabled={locking} className="w-full">
        {index + 1 === total ? (locking ? "Scoring…" : "Lock final split") : "Lock split"}
      </Button>
      {error ? <p className="text-sm text-stamp">{error}</p> : null}
    </main>
  );
}

function Result({
  result,
  shareText,
  copied,
  onCopy,
  claimName,
  claimHandle,
  claimUrl,
  claimLogo,
  claimBio,
  setClaimName,
  setClaimHandle,
  setClaimUrl,
  setClaimLogo,
  setClaimBio,
  onClaim,
  claimPending,
  claimMsg,
  onDuel,
  duelLink,
  onReplay,
  onRandom,
  duelResult,
}: {
  result: Result;
  shareText: string;
  copied: boolean;
  onCopy: () => void;
  claimName: string;
  claimHandle: string;
  claimUrl: string;
  claimLogo: string;
  claimBio: string;
  setClaimName: (v: string) => void;
  setClaimHandle: (v: string) => void;
  setClaimUrl: (v: string) => void;
  setClaimLogo: (v: string) => void;
  setClaimBio: (v: string) => void;
  onClaim: () => void;
  claimPending: boolean;
  claimMsg: string | null;
  onDuel: () => void;
  duelLink: string | null;
  onReplay: () => void;
  onRandom: () => void;
  duelResult: DuelCompare | null;
}) {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8 px-5 pb-16">
      <article className="rounded-xl bg-paper px-6 py-8 text-ink shadow-[0_20px_50px_-30px_rgba(0,0,0,0.6)]">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-stamp">
          cofounder.lol certificate
        </p>
        <h2 className="mt-4 font-display text-3xl leading-tight">
          {result.archetype.title}
        </h2>
        <p className="mt-2 text-sm italic text-ink/70">{result.archetype.line}</p>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink/10 pt-5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/50">
              Fairness
            </p>
            <p className="font-display text-3xl tabular-nums">{result.fairness}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/50">
              Rank this round
            </p>
            <p className="font-display text-3xl tabular-nums">
              {result.counted ? `#${result.rank}` : "practice"}
            </p>
          </div>
        </div>
        {!result.counted ? (
          <p className="mt-4 text-xs text-ink/50">
            Official score already locked for this browser this round. This run
            was practice. Next five in under three hours.
          </p>
        ) : null}
      </article>

      {duelResult ? (
        <section className="rounded-lg border border-border bg-surface p-4 text-sm">
          <h3 className="font-medium">Cofounder duel</h3>
          <p className="mt-1 text-muted">
            Average gap vs {duelResult.hostName}: {duelResult.gap} points.
            {duelResult.gap >= 20
              ? " You two would fight this in a real company."
              : " Close enough to stay in the same room."}
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">House line vs you</h3>
        {result.breakdown.map((row) => (
          <div
            key={row.id}
            className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm"
          >
            <span className="min-w-0 truncate text-muted">{row.title}</span>
            <span className="shrink-0 tabular-nums text-fg">
              you {row.you}% · house {row.house}%
            </span>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={onCopy}>
          {copied ? "Copied" : "Copy card text"}
        </Button>
        <Button variant="outline" className="flex-1" onClick={onReplay}>
          Play again
        </Button>
      </div>
      <p className="hidden">{shareText}</p>

      {result.counted ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-medium">
            {result.inPromo ? "Top 10 this round — pin your card" : "Pin your founder card"}
          </h3>
          <p className="text-sm text-muted">
            Logo, name, site, and a one-line pitch. Lives on the round, daily,
            and all-time boards.
          </p>
          <input
            className="h-11 rounded-md border border-border bg-bg px-3 text-sm"
            placeholder="Display name"
            value={claimName}
            onChange={(e) => setClaimName(e.target.value)}
          />
          <input
            className="h-11 rounded-md border border-border bg-bg px-3 text-sm"
            placeholder="X handle"
            value={claimHandle}
            onChange={(e) => setClaimHandle(e.target.value)}
          />
          <input
            className="h-11 rounded-md border border-border bg-bg px-3 text-sm"
            placeholder="https://yourproduct.com"
            value={claimUrl}
            onChange={(e) => setClaimUrl(e.target.value)}
          />
          <input
            className="h-11 rounded-md border border-border bg-bg px-3 text-sm"
            placeholder="Logo URL"
            value={claimLogo}
            onChange={(e) => setClaimLogo(e.target.value)}
          />
          <input
            className="h-11 rounded-md border border-border bg-bg px-3 text-sm"
            placeholder="One-line pitch"
            value={claimBio}
            maxLength={80}
            onChange={(e) => setClaimBio(e.target.value)}
          />
          <Button onClick={onClaim} disabled={claimPending}>
            Publish card
          </Button>
          {claimMsg ? <p className="text-xs text-muted">{claimMsg}</p> : null}
        </section>
      ) : (
        <p className="text-sm text-muted">
          Rank #{result.rank} is already locked. Wait for the next round to
          post an official score.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button variant="ghost" onClick={onDuel}>
          Challenge your cofounder
        </Button>
        <Button variant="ghost" onClick={onRandom}>
          Challenge a random founder
        </Button>
        {duelLink ? (
          <p className="mt-2 break-all text-xs text-muted">{duelLink}</p>
        ) : null}
      </div>
    </main>
  );
}

function CaseModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (p: {
    productName: string;
    url?: string;
    handle?: string;
    logoUrl?: string;
    description?: string;
    founderA: string;
    founderB: string;
    aLabel?: string;
    bLabel?: string;
    story: string;
  }) => Promise<boolean>;
}) {
  const [productName, setProductName] = useState("");
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [founderA, setFounderA] = useState("");
  const [founderB, setFounderB] = useState("");
  const [aLabel, setALabel] = useState("");
  const [bLabel, setBLabel] = useState("");
  const [story, setStory] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/70 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">List your fight</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          Oldest unplayed listing becomes case 01 of a 3-hour round. Your logo
          and site sit on the docket while people split it.
        </p>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const ok = await onSubmit({
                productName,
                url: url || undefined,
                handle: handle || undefined,
                logoUrl: logoUrl || undefined,
                description: description || undefined,
                founderA,
                founderB,
                aLabel: aLabel || undefined,
                bLabel: bLabel || undefined,
                story,
              });
              setStatus(ok ? "Queued. It will land as case 01 of a coming round." : "Could not save.");
            } catch {
              setStatus("Could not save.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Product" value={productName} onChange={setProductName} required />
          <Field label="Website" value={url} onChange={setUrl} />
          <Field label="Handle" value={handle} onChange={setHandle} />
          <Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} />
          <Field label="One-line pitch" value={description} onChange={setDescription} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Founder A" value={founderA} onChange={setFounderA} required />
            <Field label="Founder B" value={founderB} onChange={setFounderB} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="A did" value={aLabel} onChange={setALabel} />
            <Field label="B did" value={bLabel} onChange={setBLabel} />
          </div>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted">
            The fight
            <textarea
              required
              minLength={20}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              className="min-h-24 rounded-md border border-border bg-bg px-3 py-2 text-sm font-sans normal-case tracking-normal text-fg"
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Queue the case"}
          </Button>
        </form>
        {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-muted">
      {label}
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border border-border bg-bg px-3 text-sm font-sans normal-case tracking-normal text-fg"
      />
    </label>
  );
}
