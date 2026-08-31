export type ListedBy = {
  productName: string;
  url: string | null;
  handle: string | null;
  logoUrl: string | null;
  description: string | null;
};

export type Case = {
  id: string;
  title: string;
  story: string;
  aName: string;
  aLabel: string;
  bName: string;
  bLabel: string;
  /** Hidden house split: percent to Founder A. Never sent to the client. */
  fairA: number;
  listedBy?: ListedBy;
};

export type PublicCase = Omit<Case, "fairA">;

export const ROUND_MS = 3 * 60 * 60 * 1000;

export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** UTC bucket: 2026-08-31T06 (hour 00/03/06/09/12/15/18/21). */
export function utcRoundKey(date = new Date()): string {
  const floored = Math.floor(date.getTime() / ROUND_MS) * ROUND_MS;
  return new Date(floored).toISOString().slice(0, 13);
}

export function roundStartMs(roundKey: string): number {
  const iso = roundKey.length === 13 ? `${roundKey}:00:00.000Z` : `${roundKey}T00:00:00.000Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Math.floor(Date.now() / ROUND_MS) * ROUND_MS;
}

export function roundEndsAt(roundKey: string): Date {
  return new Date(roundStartMs(roundKey) + ROUND_MS);
}

export const CASE_BANK: Case[] = [
  {
    id: "hackathon",
    title: "The weekend MVP",
    story:
      "Alex coded the entire v1 in 72 hours. Sam spent six months on market research and registered the domain.",
    aName: "Alex",
    aLabel: "built it",
    bName: "Sam",
    bLabel: "research + domain",
    fairA: 75,
  },
  {
    id: "deck",
    title: "Hackathon vs pitch deck",
    story:
      "Riley built the production backend in a weekend hackathon. Jordan wrote the pitch deck and landed a YC interview.",
    aName: "Riley",
    aLabel: "built backend",
    bName: "Jordan",
    bLabel: "deck + YC intro",
    fairA: 60,
  },
  {
    id: "wrapper",
    title: "The prompt engineer",
    story:
      "Casey wrote a 200-line wrapper around a public model API. Morgan did branding, design, and the launch thread that actually got users.",
    aName: "Casey",
    aLabel: "wrote the wrapper",
    bName: "Morgan",
    bLabel: "brand + launch",
    fairA: 40,
  },
  {
    id: "late",
    title: "The late arrival",
    story:
      "Avery spent 12 months building alone with almost no traction. Quinn joined as Co-CEO and closed $20k MRR in enterprise deals in 30 days.",
    aName: "Avery",
    aLabel: "12 months solo",
    bName: "Quinn",
    bLabel: "closed $20k MRR",
    fairA: 55,
  },
  {
    id: "rewrite",
    title: "The rewrite",
    story:
      "Drew shipped v1, but it could not scale and was thrown away. Taylor rewrote 100% of the codebase from scratch.",
    aName: "Drew",
    aLabel: "original v1",
    bName: "Taylor",
    bLabel: "full rewrite",
    fairA: 25,
  },
  {
    id: "presales",
    title: "Sold before it existed",
    story:
      "Jamie built a complex B2B platform. Cameron closed five annual enterprise contracts before the product launched.",
    aName: "Jamie",
    aLabel: "built the product",
    bName: "Cameron",
    bLabel: "sold it first",
    fairA: 50,
  },
  {
    id: "domain",
    title: "The domain hoarder",
    story:
      "Sage bought the exact .com for $5,000 out of pocket. Rowan wrote all the code and got the first 1,000 users.",
    aName: "Sage",
    aLabel: "paid for .com",
    bName: "Rowan",
    bLabel: "code + first 1k users",
    fairA: 20,
  },
  {
    id: "patent",
    title: "The patent",
    story:
      "Elliot filed a utility patent before incorporation. Parker built the consumer app on top of that patent.",
    aName: "Elliot",
    aLabel: "filed the patent",
    bName: "Parker",
    bLabel: "built the app",
    fairA: 35,
  },
  {
    id: "license",
    title: "The license",
    story:
      "Harper holds the legal license the fintech app cannot operate without. Quinn wrote the software.",
    aName: "Harper",
    aLabel: "required license",
    bName: "Quinn",
    bLabel: "wrote the software",
    fairA: 45,
  },
  {
    id: "community",
    title: "The community",
    story:
      "Noah spent two years building a 50,000-person developer community. Skyler built the product sold into that group.",
    aName: "Noah",
    aLabel: "built the community",
    bName: "Skyler",
    bLabel: "built the product",
    fairA: 50,
  },
  {
    id: "uncle",
    title: "Uncle's angel check",
    story:
      "Reese works full-time with zero salary. Blake works five hours a week but brought a $100k check from family.",
    aName: "Reese",
    aLabel: "full-time unpaid",
    bName: "Blake",
    bLabel: "$100k, 5 hrs/week",
    fairA: 70,
  },
  {
    id: "gpu",
    title: "The cloud bill",
    story:
      "Finley ran $15,000 of personal credit-card debt to cover GPU bills. Hayden handled product design and research.",
    aName: "Finley",
    aLabel: "paid the GPUs",
    bName: "Hayden",
    bLabel: "design + research",
    fairA: 55,
  },
  {
    id: "grant",
    title: "The grant",
    story:
      "Dakota won a $150k non-dilutive research grant. River turned that research into a commercial product.",
    aName: "Dakota",
    aLabel: "won the grant",
    bName: "River",
    bLabel: "commercialized it",
    fairA: 45,
  },
  {
    id: "prestige",
    title: "The FAANG leave",
    story:
      "Phoenix left an $800k L7 role to build full-time. Remy is a second-time founder who previously sold a company for $2M.",
    aName: "Phoenix",
    aLabel: "quit $800k to build",
    bName: "Remy",
    bLabel: "prior $2M exit",
    fairA: 50,
  },
  {
    id: "solo",
    title: "Co-CEO at seed",
    story:
      "Eden ran the company solo for two years. Marlow joined as Co-founder and COO right before a $2M seed.",
    aName: "Eden",
    aLabel: "two years solo",
    bName: "Marlow",
    bLabel: "joined before seed",
    fairA: 80,
  },
  {
    id: "parttime",
    title: "Keeps the day job",
    story:
      "Shawn quit to build full-time. Kai keeps a day job to pay servers until a seed round lands.",
    aName: "Shawn",
    aLabel: "full-time builder",
    bName: "Kai",
    bLabel: "day job + servers",
    fairA: 65,
  },
  {
    id: "quit",
    title: "Stepped back",
    story:
      "Logan worked full-time for six months, then became an advisor. Peyton kept building solo for three years.",
    aName: "Logan",
    aLabel: "six months, then left",
    bName: "Peyton",
    bLabel: "three years solo",
    fairA: 15,
  },
  {
    id: "tweet",
    title: "One tweet",
    story:
      "Charlie spent eight months on a hard developer tool. Frankie tweeted once and drove 50,000 signups.",
    aName: "Charlie",
    aLabel: "eight months building",
    bName: "Frankie",
    bLabel: "one viral tweet",
    fairA: 70,
  },
  {
    id: "growth",
    title: "The messaging change",
    story:
      "Spencer spent four months shipping features nobody used. Sutton joined, changed the copy, and drove 10x users in two weeks.",
    aName: "Spencer",
    aLabel: "built unused features",
    bName: "Sutton",
    bLabel: "10x in 14 days",
    fairA: 35,
  },
  {
    id: "stabilize",
    title: "The crash loop",
    story:
      "Micah shipped a fragile MVP that fell over under load. Robin spent six months making it stay up.",
    aName: "Micah",
    aLabel: "shipped the MVP",
    bName: "Robin",
    bLabel: "kept it alive",
    fairA: 30,
  },
];

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function houseCasesForRound(roundKey: string, count: number): Case[] {
  const rng = mulberry32(hashString(`cofounder:${roundKey}`));
  const copy = [...CASE_BANK];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j]!;
    copy[j] = tmp!;
  }
  return copy.slice(0, count);
}

export function casesForRound(roundKey: string, listed: Case | null): Case[] {
  if (listed) return [listed, ...houseCasesForRound(roundKey, 4)];
  return houseCasesForRound(roundKey, 5);
}

export function fairAFromStory(story: string): number {
  return 35 + (hashString(story) % 31);
}

export function toPublicCase(c: Case): PublicCase {
  const { fairA: _fairA, ...rest } = c;
  return rest;
}
