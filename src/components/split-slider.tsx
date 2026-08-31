import { cn } from "@/lib/utils";

type Props = {
  value: number;
  onChange: (n: number) => void;
  aName: string;
  bName: string;
};

export function SplitSlider({ value, onChange, aName, bName }: Props) {
  const a = value;
  const b = 100 - value;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {aName}
          </p>
          <p className="font-display text-3xl tabular-nums leading-none text-fg">
            {a}
            <span className="text-lg text-muted">%</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {bName}
          </p>
          <p className="font-display text-3xl tabular-nums leading-none text-fg">
            {b}
            <span className="text-lg text-muted">%</span>
          </p>
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-surface">
        <div
          className="absolute inset-y-0 left-0 bg-fg transition-[width] duration-[var(--motion-quick)] ease-[var(--ease-out)]"
          style={{ width: `${a}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={a}
        aria-label={`Equity for ${aName}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-11 w-full cursor-pointer appearance-none bg-transparent",
          "[&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-paper",
          "[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--color-bg)]",
          "[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-paper",
        )}
      />
    </div>
  );
}
