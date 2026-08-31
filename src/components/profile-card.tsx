import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const box = size === "lg" ? "size-14" : "size-10";
  if (!src || broken) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-bg font-display text-stamp",
          size === "lg" ? "text-xl" : "text-sm",
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
      className={cn("shrink-0 rounded-md border border-border object-cover", box)}
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

  return (
    <article
      className={cn(
        "flex gap-3 rounded-xl border border-border bg-surface",
        large ? "p-4" : "items-center px-3 py-2.5",
      )}
    >
      <Logo name={name} src={row.logoUrl} size={size} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate font-medium", large && "text-base")}>
            <span className="mr-2 tabular-nums text-subtle">{row.rank}</span>
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
          <p className="shrink-0 font-display tabular-nums text-fg">
            {row.fairness}
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {row.handle ? `@${row.handle}` : row.archetype}
          {site ? ` · ${site}` : ""}
        </p>
        {large && row.bio ? (
          <p className="mt-2 text-sm leading-snug text-muted">{row.bio}</p>
        ) : null}
        {onChallenge ? (
          <div className={cn(large ? "mt-3" : "mt-1")}>
            <Button type="button" variant="ghost" size="sm" onClick={onChallenge}>
              Challenge
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
