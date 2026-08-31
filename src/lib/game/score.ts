export type Archetype = {
  id: string;
  title: string;
  line: string;
  tag: string;
};

const ARCHETYPES: Record<string, Archetype> = {
  pushover: {
    id: "pushover",
    title: "The Pushover",
    line: "Gave away the company to keep the peace.",
    tag: "Too nice to last",
  },
  idealist: {
    id: "idealist",
    title: "The Idealist",
    line: "Splits like a manifesto, not a cap table.",
    tag: "Soft on the loud one",
  },
  pragmatist: {
    id: "pragmatist",
    title: "Balanced Pragmatist",
    line: "Pays who actually moved the company.",
    tag: "Fair, with a lean",
  },
  wildcard: {
    id: "wildcard",
    title: "The Wildcard",
    line: "No pattern. A coin flip in a blazer.",
    tag: "Unpredictable",
  },
  moderate: {
    id: "moderate",
    title: "The Moderate Splitter",
    line: "Close to the house line, no drama.",
    tag: "Reasonable",
  },
  mediator: {
    id: "mediator",
    title: "Master Mediator",
    line: "The split a decent lawyer would write.",
    tag: "Today's fairest",
  },
  hoarder: {
    id: "hoarder",
    title: "Equity Hoarder",
    line: "Gave the builder a hoodie and a rounding error.",
    tag: "Dangerous partner",
  },
  titan: {
    id: "titan",
    title: "Sweat Equity Titan",
    line: "Pays the person who stayed in the chair.",
    tag: "Builder-first",
  },
};

export function scoreCase(playerA: number, fairA: number): number {
  const err = Math.abs(playerA - fairA);
  return Math.max(0, 100 - 2 * err);
}

export function sessionScore(playerSplits: number[], fairSplits: number[]) {
  const per = playerSplits.map((p, i) => scoreCase(p, fairSplits[i] ?? 50));
  const fairness = Math.round(per.reduce((a, b) => a + b, 0) / per.length);
  const bias = Math.round(
    playerSplits.reduce((a, p, i) => a + (p - (fairSplits[i] ?? 50)), 0) /
      playerSplits.length,
  );
  return { fairness, bias, per };
}

export function pickArchetype(fairness: number, bias: number): Archetype {
  const band = fairness >= 80 ? "high" : fairness >= 55 ? "mid" : "low";
  if (bias < -10) {
    if (band === "low") return ARCHETYPES.pushover!;
    if (band === "mid") return ARCHETYPES.idealist!;
    return ARCHETYPES.pragmatist!;
  }
  if (bias > 10) {
    if (band === "low") return ARCHETYPES.hoarder!;
    if (band === "mid") return ARCHETYPES.titan!;
    return ARCHETYPES.titan!;
  }
  if (band === "low") return ARCHETYPES.wildcard!;
  if (band === "mid") return ARCHETYPES.moderate!;
  return ARCHETYPES.mediator!;
}
