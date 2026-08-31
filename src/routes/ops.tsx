import { createFileRoute } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOps } from "@/lib/game/actions";

export const Route = createFileRoute("/ops")({
  loader: () => getOps(),
  component: Ops,
});

function Ops() {
  const data = Route.useLoaderData();
  const live = data.source === "neon";
  const roundPlays =
    data.rounds.find((d) => d.round_key === data.roundKey)?.plays ?? 0;

  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cofounder-ops-${data.roundKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <a
          href="/"
          className="inline-flex items-center gap-2 font-display text-xl tracking-tight"
        >
          <Scale className="size-4 text-stamp" strokeWidth={1.75} />
          cofounder.lol
        </a>
        <span className="text-xs uppercase tracking-widest text-muted">
          Owner desk
        </span>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 pb-16">
        <section className="flex flex-col gap-3">
          <h1 className="font-display text-3xl tracking-tight">Stored data</h1>
          <p className="max-w-xl text-sm text-muted">
            Scores, claimed names, cofounder fights, and duel links. This page
            is unlisted — bookmark it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs uppercase tracking-widest text-muted">
              {live ? "Live Postgres" : "Preview store (resets)"}
            </span>
            <span className="text-sm text-muted">
              {roundPlays} {roundPlays === 1 ? "run" : "runs"} this round
            </span>
            <Button variant="outline" onClick={download}>
              Download JSON
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium">Rounds</h2>
          {data.rounds.length === 0 ? (
            <Empty text="No scored runs yet." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.rounds.map((d) => (
                <li
                  key={d.round_key}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="tabular-nums">{d.round_key}</span>
                  <span className="text-muted">{d.plays} plays</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium">Runs</h2>
          {data.runs.length === 0 ? (
            <Empty text="Nobody has split yet." />
          ) : (
            <ol className="flex flex-col gap-3">
              {data.runs.map((row, i) => (
                <li
                  key={`${row.roundKey}-${row.createdAt}-${i}`}
                  className="border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      {row.displayName ?? "unclaimed"}
                      {row.handle ? (
                        <span className="text-subtle"> @{row.handle}</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-muted">
                      {row.fairness} · {row.archetype}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    {row.roundKey}
                    {row.url ? ` · ${row.url}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium">Queued founder fights</h2>
          {data.queue.length === 0 ? (
            <Empty text="No product fights submitted." />
          ) : (
            <ul className="flex flex-col gap-4">
              {data.queue.map((q) => (
                <li key={q.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="text-sm font-medium">{q.productName}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {q.founderA} vs {q.founderB}
                    {q.handle ? ` · @${q.handle}` : ""}
                    {q.usedRound ? ` · played ${q.usedRound}` : " · waiting"}
                  </p>
                  <p className="mt-2 text-sm text-muted">{q.story}</p>
                  {q.url ? (
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs underline decoration-border underline-offset-4"
                    >
                      {q.url}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium">Duels</h2>
          {data.duels.length === 0 ? (
            <Empty text="No challenges created." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.duels.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <span className="font-mono text-xs text-muted">{d.id}</span>
                  <span>
                    {d.hostName ?? "host"}
                    {d.guestName ? ` vs ${d.guestName}` : " (open)"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}
