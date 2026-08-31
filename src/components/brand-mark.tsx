import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden="true">
      <rect x="5" y="6" width="9" height="20" rx="1.8" fill="var(--color-paper)" />
      <rect x="18" y="6" width="9" height="20" rx="1.8" fill="var(--color-paper)" />
      <rect x="14.4" y="13" width="3.2" height="6" fill="var(--color-stamp)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark className="size-8" />
      <p className="truncate font-sans text-lg font-medium tracking-tight">
        cofounder<span className="text-stamp">.lol</span>
      </p>
    </div>
  );
}
