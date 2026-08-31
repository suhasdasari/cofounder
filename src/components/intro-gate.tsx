import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Wordmark } from "@/components/brand-mark";
import { IntroStage } from "@/components/intro-stage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function IntroGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);

  function enter() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 280);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        enter();
      }
      if (e.key === "Escape") enter();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = rootRef.current;
    if (!el) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    el.style.setProperty("--mx", x.toFixed(3));
    el.style.setProperty("--my", y.toFixed(3));
  }

  function onUp() {
    enter();
  }

  if (!open) return <>{children}</>;

  return (
    <div
      ref={rootRef}
      className={cn("intro-root", leaving && "intro-root--out")}
      onPointerUp={onUp}
      onPointerMove={onMove}
    >
      <IntroStage />
      <div className="intro-vignette" />

      <div className="intro-center">
        <div className="intro-title-block">
          <Wordmark className="intro-lockup" />
          <p className="intro-kicker">Two founders. One deal.</p>
          <h1 className="intro-title font-display">
            Pitch a startup.
            <br />
            <span className="italic text-stamp">Get roasted.</span>
          </h1>
          <p className="intro-lede">
            A toxic AI cofounder scores your clapback. Rank is valuation. Steal the line, never the URL.
          </p>
          <Button
            size="lg"
            className="relative z-10 min-h-12"
            onPointerUp={(e) => {
              e.stopPropagation();
              enter();
            }}
          >
            Enter the arena
          </Button>
          <p className="intro-hint">Click anywhere or press Enter</p>
        </div>
      </div>
    </div>
  );
}
