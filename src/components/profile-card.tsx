import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProfileRow } from "@/lib/game/actions";

function hostLabel(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Logo({
  name,
  src,
  size,
}: {
  name: string;
  src: string | null;
  size: "lg" | "sm";
}) {
  const [broken, setBroken] = useState(false);
  const letter = (name.trim()[0] || "?").toUpperCase();
  const box = size === "lg" ? "size-12" : "size-10";
  if (!src || broken) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md font-display",
          size === "lg"
            ? "border border-ink/15 bg-ink/5 text-xl text-stamp"
            : "border border-border bg-bg text-sm text-stamp",
          box,
        )}
        aria-hidden="true"
      >
        {letter}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={cn("shrink-0 rounded-md object-cover", box, size === "lg" ? "border border-ink/15" : "border border-border")}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

export function ProfileCard({
  row,
  size = "sm",
  onChallenge,
}: {
  row: ProfileRow;
  size?: "lg" | "sm";
  onChallenge?: () => void;
}) {
  const name = row.displayName ?? "anonymous";
  const site = hostLabel(row.url);
  const large = size === "lg";

  if (large) {
    return (
      <article className="rounded-xl bg-paper p-4 text-ink">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stamp">
          Won this round
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="font-display text-3xl leading-none tracking-tight">#{row.rank}</p>
          <p className="font-display text-2xl tabular-nums leading-none">{row.fairness}</p>
        </div>
        <div className="mt-3 flex gap-3">
          <Logo name={name} src={row.logoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {row.url ? (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-ink/20 underline-offset-4"
                >
                  {name}
                </a>
              ) : (
                name
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink/55">
              {row.handle ? `@${row.handle}` : row.archetype}
              {site ? ` · ${site}` : ""}
            </p>
            {row.bio ? (
              <p className="mt-2 text-sm leading-snug text-ink/70">{row.bio}</p>
            ) : null}
            {onChallenge ? (
              <button
                type="button"
                className="mt-2 text-xs text-stamp underline decoration-ink/20 underline-offset-4"
                onClick={onChallenge}
              >
                Challenge this rank
              </button>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Logo name={name} src={row.logoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium">
            <span className="mr-2 tabular-nums text-subtle">#{row.rank}</span>
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-border underline-offset-4 hover:text-fg"
              >
                {name}
              </a>
            ) : (
              name
            )}
          </p>
          <p className="shrink-0 font-display tabular-nums text-fg">{row.fairness}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {row.handle ? `@${row.handle}` : row.archetype}
          {site ? ` · ${site}` : ""}
          {onChallenge ? (
            <>
              {" · "}
              <button type="button" className="underline decoration-border underline-offset-2" onClick={onChallenge}>
                Challenge
              </button>
            </>
          ) : null}
        </p>
      </div>
    </article>
  );
}
