export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

/** Dollars from N+C+M. LLM never picks the amount. */
export function valuationFromScores(n: number, c: number, m: number): number {
  const s = clampScore(n) + clampScore(c) + clampScore(m);
  const table: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 1000,
    5: 2500,
    6: 4500,
    7: 6500,
    8: 8000,
    9: 12000,
    10: 22000,
    11: 40000,
    12: 65000,
    13: 95000,
    14: 130000,
    15: 180000,
    16: 250000,
    17: 400000,
    18: 650000,
    19: 950000,
    20: 1400000,
    21: 1800000,
    22: 2200000,
    23: 3000000,
    24: 4000000,
    25: 5200000,
    26: 6500000,
    27: 8000000,
    28: 9000000,
    29: 9500000,
    30: 10000000,
  };
  return table[s] ?? 0;
}

export function archetypeFromSum(s: number): string {
  if (s <= 8) return "Zombie Wrapper";
  if (s <= 15) return "Side-Hustle";
  if (s <= 22) return "Contender";
  if (s <= 27) return "Unicorn Anomaly";
  return "Unicorn Anomaly";
}

export function formatUsd(n: number): string {
  if (n <= 0) return "$0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}M`;
  }
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return `$${n}`;
}

export const PILLS = [
  "We have revenue",
  "You're just a model",
  "I'll take 49%",
  "Watch Product Hunt",
] as const;
