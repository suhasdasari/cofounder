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
import type { ListedBy, PublicCase } from "@/lib/game/cases";
import { getFingerprint } from "@/lib/fingerprint";
import { cn } from "@/lib/utils";

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
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<BoardTab>("round");
  const [listing, setListing] = useState(false);
  const [clockOn, setClockOn] = useState(false);

  const cases = today.data?.cases ?? [];
  const current: PublicCase | undefined = cases[index];
  const inPlay = startedAt > 0 && !result;

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
    setClockOn(true);
    const t = window.setInterval(() => setNow(Date.now()), inPlay ? 250 : 1000);
    return () => window.clearInterval(t);
  }, [inPlay]);

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

  const remaining = startedAt
    ? Math.max(0, 45 - Math.floor((now - startedAt) / 1000))
    : 45;
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
      resetPlay();
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

  function resetPlay() {
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
  }

  function beginIfNeeded() {
    if (startedAtRef.current) return;
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    startedAtRef.current = t;
  }

  function lock() {
    if (!current || finishRef.current || result) return;
    beginIfNeeded();
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
    if (!inPlay) return;
    if (remaining > 0) return;
    const total = casesRef.current.length;
    const done = [...lockedRef.current, splitRef.current];
    while (done.length < total) done.push(50);
    submitSplits(done.slice(0, total));
  }, [remaining, inPlay]);

  useEffect(() => {
    if (result) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        beginIfNeeded();
        setSplit((s) => Math.max(0, s - (e.shiftKey ? 5 : 1)));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        beginIfNeeded();
        setSplit((s) => Math.min(100, s + (e.shiftKey ? 5 : 1)));
      } else if (e.key === "Enter") {
        e.preventDefault();
        lock();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, current, locked, split, cases.length]);

  const shareText = useMemo(() => {
    if (!result) return "";
    return `I split five cofounder fights on cofounder.lol.\n${result.archetype.title}. Fairness ${result.fairness}.\n"${result.archetype.line}"\nBeat my split — new five every 3 hours.`;
  }, [result]);

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

  const duelHost =
    duel.data?.ok && !duel.data.expired
      ? (duel.data.hostName ?? "Your cofounder")
      : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Scale className="size-4 shrink-0 text-stamp" strokeWidth={1.75} />
          <p className="font-display text-lg tracking-tight">cofounder.lol</p>
          <span className="hidden truncate text-xs text-muted sm:inline">
            Five fights. One slider. 3h rounds.
          </span>
        </div>
        <p className="shrink-0 text-xs uppercase tracking-widest text-muted">
          {clockOn ? `${formatRemain(roundLeft)} left` : "this round"}
          <span className="ml-2 tabular-nums text-subtle">
            {today.data.plays} runs
          </span>
        </p>
      </header>
      <p className="flex shrink-0 gap-x-4 gap-y-1 overflow-x-auto border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted lg:px-6">
        <span>5 fights</span>
        <span>45 seconds</span>
        <span>hidden house line</span>
        <span>−2 pts per % off</span>
        <span>1 scored run / 3h</span>
        <span className="text-stamp">$5 lists case 01</span>
      </p>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_min(44vh,26rem)] lg:grid-cols-2 lg:grid-rows-1">
        <section className="flex min-h-0 flex-col overflow-y-auto border-b border-border px-4 py-4 lg:border-b-0 lg:border-r lg:px-6 lg:py-5">
          {result ? (
            <ResultPane
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
              onReplay={resetPlay}
              onRandom={() =>
                challengeMut.mutate({
                  data: { fingerprint: getFingerprint(), random: true },
                })
              }
              duelResult={duelResult}
            />
          ) : current ? (
            <PlayPane
              cases={cases}
              current={current}
              index={index}
              remaining={remaining}
              started={startedAt > 0}
              split={split}
              onSplit={(n) => {
                beginIfNeeded();
                setSplit(n);
              }}
              onLock={lock}
              locking={runMut.isPending || finishRef.current}
              error={submitError}
              duelHost={duelHost}
            />
          ) : (
            <p className="text-sm text-muted">Loading this round…</p>
          )}
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden px-4 py-4 lg:px-6 lg:py-5">
          <FeaturedSlot
            listed={today.data.cases.find((c) => c.listedBy)?.listedBy ?? null}
            onList={() => setListing(true)}
          />
          <div className="mb-3 mt-3 flex items-center justify-between gap-2">
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
                    "h-9 min-w-16 rounded-md px-3 text-xs font-medium",
                    tab === id ? "bg-surface text-fg" : "text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                challengeMut.mutate({
                  data: { fingerprint: getFingerprint(), random: true },
                })
              }
              disabled={challengeMut.isPending || rows.length === 0}
            >
              Random
            </Button>
          </div>
          {notice ? <p className="mb-2 text-xs text-stamp">{notice}</p> : null}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="text-sm text-muted">No splits yet. Yours lands here.</p>
            ) : (
              rows.slice(0, 10).map((row) => (
                <ProfileCard
                  key={`${tab}-${row.rank}-${row.displayName ?? "anon"}`}
                  row={row}
                  size={row.rank === 1 ? "lg" : "sm"}
                  onChallenge={
                    tab === "round"
                      ? () =>
                          challengeMut.mutate({
                            data: { fingerprint: getFingerprint(), rank: row.rank },
                          })
                      : undefined
                  }
                />
              ))
            )}
          </div>
          <div className="mt-3 shrink-0 border-t border-border pt-3">
            {listing ? (
              <ListForm
                onCancel={() => setListing(false)}
                onSubmit={async (payload) => {
                  const res = await submitCase({ data: payload });
                  if (res.ok) void qc.invalidateQueries({ queryKey: ["today"] });
                  return res.ok;
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setListing(true)}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3 text-left text-ink"
              >
                <span>
                  <span className="block font-display text-lg leading-tight">
                    List your fight · $5
                  </span>
                  <span className="mt-0.5 block text-xs text-ink/60">
                    {today.data.queuePreview.length
                      ? `Queue: ${today.data.queuePreview.map((q) => q.productName).join(" · ")}`
                      : "Your logo, name, and site become case 01."}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-stamp">
                  Claim
                </span>
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function FeaturedSlot({
  listed,
  onList,
}: {
  listed: ListedBy | null;
  onList: () => void;
}) {
  if (listed) {
    const site = (() => {
      if (!listed.url) return null;
      try {
        return new URL(listed.url).host.replace(/^www\./, "");
      } catch {
        return listed.url;
      }
    })();
    return (
      <article className="shrink-0 rounded-xl bg-paper p-4 text-ink">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stamp">
          Live on this docket · $5
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="font-display text-3xl leading-none">#01</p>
          {listed.logoUrl ? (
            <img
              src={listed.logoUrl}
              alt=""
              className="size-12 rounded-md border border-ink/15 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
        </div>
        <p className="mt-2 font-display text-xl leading-tight">{listed.productName}</p>
        {listed.description ? (
          <p className="mt-1 text-sm text-ink/70">{listed.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-ink/55">
          {listed.handle ? `@${listed.handle}` : "listed fight"}
          {site ? ` · ${site}` : ""}
        </p>
        {listed.url ? (
          <a
            href={listed.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs underline decoration-ink/20 underline-offset-4"
          >
            Open product
          </a>
        ) : null}
      </article>
    );
  }
  return (
    <button
      type="button"
      onClick={onList}
      className="shrink-0 rounded-xl bg-paper p-4 text-left text-ink"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stamp">
        Featured slot · $5
      </p>
      <p className="mt-2 font-display text-3xl leading-none">#01</p>
      <p className="mt-2 font-display text-xl leading-tight">This docket is open</p>
      <p className="mt-1 text-sm text-ink/70">
        Your product becomes case 01. Logo, name, and site sit here while every
        player splits your fight.
      </p>
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-stamp">
        Claim this rank
      </p>
    </button>
  );
}

function PlayPane({
  cases,
  current,
  index,
  remaining,
  started,
  split,
  onSplit,
  onLock,
  locking,
  error,
  duelHost,
}: {
  cases: PublicCase[];
  current: PublicCase;
  index: number;
  remaining: number;
  started: boolean;
  split: number;
  onSplit: (n: number) => void;
  onLock: () => void;
  locking: boolean;
  error: string | null;
  duelHost: string | null;
}) {
  const listed = current.listedBy;
  return (
    <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <ol className="flex gap-1">
          {cases.map((c, i) => (
            <li
              key={c.id}
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-xs tabular-nums",
                i === index
                  ? "bg-paper text-ink"
                  : i < index
                    ? "bg-surface text-muted"
                    : "border border-border text-subtle",
              )}
              title={c.title}
            >
              {i + 1}
            </li>
          ))}
        </ol>
        <p
          className={cn(
            "text-xs uppercase tracking-widest tabular-nums",
            started && remaining <= 8 ? "text-stamp" : "text-muted",
          )}
        >
          {started ? `${remaining}s` : "45s on lock"}
        </p>
      </div>
      {duelHost ? (
        <p className="mt-2 shrink-0 text-xs text-muted">Duel vs {duelHost} — same five.</p>
      ) : null}
      {listed ? (
        <div className="mt-2 flex shrink-0 items-center gap-3 rounded-xl bg-paper px-3 py-2 text-ink">
          <p className="font-display text-xl leading-none">#01</p>
          {listed.logoUrl ? (
            <img
              src={listed.logoUrl}
              alt=""
              className="size-9 rounded-md object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{listed.productName}</p>
            <p className="truncate text-xs text-ink/55">
              {listed.description || "Listed founder fight"}
              {listed.handle ? ` · @${listed.handle}` : ""}
            </p>
          </div>
        </div>
      ) : null}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
          {current.title}
        </p>
        <h1 className="font-display text-lg leading-snug sm:text-xl lg:text-3xl">
          {current.story}
        </h1>
      </div>
      <div className="mt-3 shrink-0">
      <SplitSlider
        value={split}
        onChange={onSplit}
        aName={`${current.aName} · ${current.aLabel}`}
        bName={`${current.bName} · ${current.bLabel}`}
      />
      <Button size="lg" onClick={onLock} disabled={locking} className="mt-3 w-full">
        {index + 1 === cases.length
          ? locking
            ? "Scoring…"
            : "Lock final split"
          : "Lock split"}
      </Button>
      {error ? <p className="mt-2 text-sm text-stamp">{error}</p> : null}
      </div>
    </div>
  );
}

function ResultPane({
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <article className="rounded-xl bg-paper px-5 py-5 text-ink">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-stamp">
          cofounder.lol
        </p>
        <h2 className="mt-2 font-display text-2xl leading-tight">
          {result.archetype.title}
        </h2>
        <p className="mt-1 text-sm italic text-ink/70">{result.archetype.line}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink/10 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/50">Fairness</p>
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
      </article>
      {duelResult ? (
        <p className="text-sm text-muted">
          Gap vs {duelResult.hostName}: {duelResult.gap} pts.
          {duelResult.gap >= 20 ? " You two would fight." : " Close enough."}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {result.breakdown.map((row) => (
          <p key={row.id} className="truncate text-muted">
            {row.title}{" "}
            <span className="tabular-nums text-fg">
              {row.you}/{row.house}
            </span>
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="outline" className="flex-1" onClick={onReplay}>
          Again
        </Button>
        <Button variant="ghost" onClick={onRandom}>
          Random
        </Button>
      </div>
      <p className="hidden">{shareText}</p>
      {result.counted ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
            placeholder="Name"
            value={claimName}
            onChange={(e) => setClaimName(e.target.value)}
          />
          <input
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
            placeholder="@handle"
            value={claimHandle}
            onChange={(e) => setClaimHandle(e.target.value)}
          />
          <input
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
            placeholder="yourproduct.com"
            value={claimUrl}
            onChange={(e) => setClaimUrl(e.target.value)}
          />
          <input
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
            placeholder="Logo URL"
            value={claimLogo}
            onChange={(e) => setClaimLogo(e.target.value)}
          />
          <input
            className="col-span-2 h-11 rounded-md border border-border bg-surface px-3 text-sm"
            placeholder="One-line pitch"
            value={claimBio}
            maxLength={80}
            onChange={(e) => setClaimBio(e.target.value)}
          />
          <Button className="col-span-2" onClick={onClaim} disabled={claimPending}>
            Publish card
          </Button>
          {claimMsg ? (
            <p className="col-span-2 text-xs text-muted">{claimMsg}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted">
          Official score already locked this round. Next five in under 3 hours.
        </p>
      )}
      <div>
        <button type="button" className="text-xs text-muted underline decoration-border underline-offset-4" onClick={onDuel}>
          Challenge a cofounder
        </button>
        {duelLink ? (
          <p className="mt-1 break-all text-xs text-subtle">{duelLink}</p>
        ) : null}
      </div>
    </div>
  );
}

function ListForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
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
    <form
      className="grid grid-cols-2 gap-2"
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
          setStatus(ok ? "Queued for case 01 of a coming round." : "Could not save.");
        } catch {
          setStatus("Could not save.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input required className={field} placeholder="Product" value={productName} onChange={(e) => setProductName(e.target.value)} />
      <input className={field} placeholder="Website" value={url} onChange={(e) => setUrl(e.target.value)} />
      <input className={field} placeholder="Handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
      <input className={field} placeholder="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
      <input className={cn(field, "col-span-2")} placeholder="Pitch" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input required className={field} placeholder="Founder A" value={founderA} onChange={(e) => setFounderA(e.target.value)} />
      <input required className={field} placeholder="Founder B" value={founderB} onChange={(e) => setFounderB(e.target.value)} />
      <input className={field} placeholder="A did" value={aLabel} onChange={(e) => setALabel(e.target.value)} />
      <input className={field} placeholder="B did" value={bLabel} onChange={(e) => setBLabel(e.target.value)} />
      <textarea
        required
        minLength={20}
        className="col-span-2 min-h-16 rounded-md border border-border bg-surface px-3 py-2 text-sm"
        placeholder="The fight"
        value={story}
        onChange={(e) => setStory(e.target.value)}
      />
      <Button type="submit" disabled={busy} className="col-span-2">
        {busy ? "Sending…" : "Claim case 01 · $5"}
      </Button>
      <Button type="button" variant="ghost" className="col-span-2" onClick={onCancel}>
        Cancel
      </Button>
      {status ? <p className="col-span-2 text-xs text-muted">{status}</p> : null}
    </form>
  );
}

const field =
  "h-11 rounded-md border border-border bg-surface px-3 text-sm text-fg";
