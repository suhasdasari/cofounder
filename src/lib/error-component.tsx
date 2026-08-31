import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-stamp" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={1.75} />
      </span>
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "An unexpected error occurred. Try reloading the page."}
      </p>
    </main>
  );
}

export function AppNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg px-6 text-center text-fg">
      <p className="font-display text-3xl">Not a case.</p>
      <a href="/" className="text-sm text-muted underline decoration-border underline-offset-4">
        Back to this round
      </a>
    </main>
  );
}
