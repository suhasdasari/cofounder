import { createFileRoute } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { getOpsArena } from "@/lib/game/arena";
import { formatUsd } from "@/lib/game/valuation";

export const Route = createFileRoute("/ops")({
  loader: () => getOpsArena(),
  component: Ops,
});

function Ops() {
  const data = Route.useLoaderData();
  const live = data.source === "neon";

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
        <a href="/" className="inline-flex items-center">
          <Wordmark />
        </a>
        <span className="text-xs uppercase tracking-widest text-muted">Owner desk</span>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <p className="text-sm text-muted">
          {live ? "Neon" : "Preview store"} · {data.roundKey} · {data.pitches.length} pitches
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={download}>
            Export JSON
          </Button>
          <Button variant="outline" asChild>
            <a href="/cofounder-lol-brand.zip" download="cofounder-lol-brand.zip">
              Brand kit
            </a>
          </Button>
        </div>
        <ul className="mt-6 space-y-2">
          {data.pitches.map((p) => (
            <li key={String(p.id)} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <span className="text-muted">{String(p.kind)}</span>{" "}
              {String(p.display_name || p.pitch).slice(0, 60)}{" "}
              <span className="tabular-nums">{formatUsd(Number(p.valuation) || 0)}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
