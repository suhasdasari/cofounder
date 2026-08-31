import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { PRICE } from "@/lib/pay/config";
import { confirmPayment } from "@/lib/pay/verify";
import { grokRoast, grokScore } from "./grok";
import { detectUrl, scrapePage } from "./scrape";
import { roundEndsAt, utcDayKey, utcRoundKey } from "./time";
import {
  archetypeFromSum,
  valuationFromScores,
} from "./valuation";

const fpSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[a-z0-9]+$/i);

function nid(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanHandle(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const h = raw.trim().replace(/^@/, "").slice(0, 32);
  return /^[A-Za-z0-9_]{1,32}$/.test(h) ? h : null;
}

function cleanUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return detectUrl(raw);
}

function cleanName(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const n = raw.trim().slice(0, 32);
  return n.length ? n : null;
}

export type BoardRow = {
  id: string;
  rank: number;
  kind: string;
  pitch: string;
  url: string | null;
  roast: string;
  clapback: string;
  valuation: number;
  sortValue: number;
  archetype: string;
  quote: string | null;
  displayName: string | null;
  handle: string | null;
  logoUrl: string | null;
  bio: string | null;
  verified: boolean;
  house: boolean;
  defendUsed: boolean;
  crowdValuation: number | null;
  crowdHandle: string | null;
  crowdClapback: string | null;
  crowdScar: boolean;
  mine: boolean;
};

function mapRow(r: Record<string, unknown>, rank: number, fp: string): BoardRow {
  const valuation = Number(r.valuation) || 0;
  const crowd = r.crowd_valuation == null ? null : Number(r.crowd_valuation);
  return {
    id: String(r.id),
    rank,
    kind: String(r.kind),
    pitch: String(r.pitch),
    url: (r.url as string) || null,
    roast: String(r.roast),
    clapback: String(r.clapback),
    valuation,
    sortValue: Math.max(valuation, crowd ?? 0),
    archetype: String(r.archetype),
    quote: (r.quote as string) || null,
    displayName: (r.display_name as string) || null,
    handle: (r.handle as string) || null,
    logoUrl: (r.logo_url as string) || null,
    bio: (r.bio as string) || null,
    verified: Boolean(r.verified),
    house: Boolean(r.house),
    defendUsed: Boolean(r.defend_used),
    crowdValuation: crowd,
    crowdHandle: (r.crowd_handle as string) || null,
    crowdClapback: (r.crowd_clapback as string) || null,
    crowdScar: Boolean(r.crowd_scar),
    mine: String(r.fingerprint) === fp,
  };
}

const HOUSE: {
  id: string;
  pitch: string;
  url: string;
  roast: string;
  clapback: string;
  n: number;
  c: number;
  m: number;
  handle: string;
  name: string;
}[] = [
  {
    id: "house-dogwalk",
    pitch: "DogWalkerDAO — crypto payments for neighborhood dog walkers",
    url: "https://example.com/dogwalk",
    roast: "Uber for dogs with a token nobody asked to hold. You financialized a leash.",
    clapback: "Walkers settle in USDC so tips clear before the dog does.",
    n: 2,
    c: 5,
    m: 3,
    handle: "house",
    name: "DogWalkerDAO",
  },
  {
    id: "house-mail",
    pitch: "Mailblast.ai — AI emails for Shopify stores in five seconds",
    url: "https://example.com/mailblast",
    roast: "A spam cannon with a hero video. You wrapped Claude and called it a company.",
    clapback: "Stores that use it send fewer emails and make more money. Weird.",
    n: 3,
    c: 6,
    m: 6,
    handle: "house",
    name: "Mailblast",
  },
  {
    id: "house-vibes",
    pitch: "ProofOfVibes — onchain mood ring for group chats",
    url: "https://example.com/vibes",
    roast: "You put feelings on a chain that charges gas to be sad. This is not a product.",
    clapback: "It's a joke and the joke is the go-to-market.",
    n: 4,
    c: 4,
    m: 1,
    handle: "house",
    name: "ProofOfVibes",
  },
  {
    id: "house-payroll",
    pitch: "AgentPayroll — pay AI agents in USDC when they finish a job",
    url: "https://example.com/agentpayroll",
    roast: "Escrow with a chatbot glued on. Agents don't have bank accounts because they aren't people.",
    clapback: "They have wallets. That's the whole point of this week.",
    n: 5,
    c: 7,
    m: 6,
    handle: "house",
    name: "AgentPayroll",
  },
  {
    id: "house-fork",
    pitch: "ForkThisWallet — another account-abstraction wallet for hackathon demos",
    url: "https://example.com/forkwallet",
    roast: "The twelfth smart wallet this weekend. You forked a tutorial and shipped the README.",
    clapback: "Fine. It's a template. Steal a better one.",
    n: 1,
    c: 3,
    m: 4,
    handle: "house",
    name: "ForkThisWallet",
  },
];

async function ensureHouse(sql: Awaited<ReturnType<typeof getSql>>) {
  const day = utcDayKey();
  const round = utcRoundKey();
  for (const h of HOUSE) {
    const s = h.n + h.c + h.m;
    const valuation = valuationFromScores(h.n, h.c, h.m);
    await sql`
      insert into pitches (
        id, fingerprint, kind, pitch, url, roast, clapback,
        n, c, m, valuation, archetype, quote, display_name, handle,
        verified, paid, house, round_key, day_key
      ) values (
        ${h.id}, ${"house000000000000"}, ${"house"}, ${h.pitch}, ${h.url},
        ${h.roast}, ${h.clapback}, ${h.n}, ${h.c}, ${h.m}, ${valuation},
        ${archetypeFromSum(s)}, ${h.roast}, ${h.name}, ${h.handle},
        ${false}, ${false}, ${true}, ${round}, ${day}
      )
      on conflict (id) do update set
        round_key = excluded.round_key,
        day_key = excluded.day_key
    `;
  }
}

function sortKey(r: Record<string, unknown>): number {
  const v = Number(r.valuation) || 0;
  const c = r.crowd_valuation == null ? 0 : Number(r.crowd_valuation);
  return Math.max(v, c);
}

export type ArenaPayload = {
  roundKey: string;
  dayKey: string;
  endsAt: string;
  round: BoardRow[];
  daily: BoardRow[];
  allTime: BoardRow[];
  spotlight: BoardRow[];
  usage: { joke: number; steal: number };
};

async function loadBoard(
  sql: Awaited<ReturnType<typeof getSql>>,
  fingerprint: string,
): Promise<ArenaPayload> {
  await ensureHouse(sql);
  const day = utcDayKey();
  const round = utcRoundKey();
  const all = await sql`select * from pitches`;
  const ranked = [...all].sort((a, b) => sortKey(b) - sortKey(a) || 0);
  const toRows = (list: Record<string, unknown>[]) =>
    list.map((r, i) => mapRow(r, i + 1, fingerprint));
  const roundRows = ranked.filter((r) => r.round_key === round);
  const dayRows = ranked.filter((r) => r.day_key === day);
  const spotlight = ranked.filter((r) => r.verified || r.paid).slice(0, 8);
  const usageRows = await sql`
    select joke_count, steal_count from usage_day
    where fingerprint = ${fingerprint} and day_key = ${day}
  `;
  return {
    roundKey: round,
    dayKey: day,
    endsAt: roundEndsAt(round),
    round: toRows(roundRows),
    daily: toRows(dayRows),
    allTime: toRows(ranked.slice(0, 40)),
    spotlight: toRows(spotlight),
    usage: {
      joke: Number(usageRows[0]?.joke_count) || 0,
      steal: Number(usageRows[0]?.steal_count) || 0,
    },
  };
}

export const getArena = createServerFn({ method: "GET" })
  .validator((input: { fingerprint?: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    return loadBoard(sql, data.fingerprint || "anon00000000000000");
  });

export const startRoast = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        fingerprint: fpSchema,
        pitch: z.string().trim().min(8).max(280),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const url = detectUrl(data.pitch);
    const bits = url ? await scrapePage(url) : { title: null, description: null, h1: null };
    const roast = await grokRoast({
      pitch: data.pitch,
      url,
      title: bits.title,
      description: bits.description,
      h1: bits.h1,
    });
    if (!roast.ok) return roast;
    return {
      ok: true as const,
      roast: roast.roast,
      url,
      title: bits.title,
      description: bits.description,
      scraped: Boolean(bits.title || bits.description),
    };
  });

export const submitPitch = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        fingerprint: fpSchema,
        pitch: z.string().trim().min(8).max(280),
        roast: z.string().min(8).max(480),
        clapback: z.string().trim().min(2).max(280),
        url: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        paid: z.boolean().optional(),
        txHash: z
          .string()
          .regex(/^0x[a-fA-F0-9]{64}$/)
          .nullable()
          .optional(),
        displayName: z.string().optional(),
        handle: z.string().optional(),
        logoUrl: z.string().optional(),
        bio: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const day = utcDayKey();
    const round = utcRoundKey();
    const url = cleanUrl(data.url ?? null);
    const paid = Boolean(data.paid && url);
    if (paid) {
      const pay = await confirmPayment({
        fingerprint: data.fingerprint,
        txHash: data.txHash,
        amountUsd: PRICE.pitchUsd,
        kind: "pitch",
      });
      if (!pay.ok) return pay;
    }
    if (!paid) {
      const u = await sql`
        select joke_count from usage_day where fingerprint = ${data.fingerprint} and day_key = ${day}
      `;
      const jokes = Number(u[0]?.joke_count) || 0;
      if (jokes >= 3) {
        return { ok: false as const, error: "Three free pitches today. Steal, or list a real product for $5." };
      }
    }
    const scored = await grokScore({
      pitch: data.pitch,
      roast: data.roast,
      clapback: data.clapback,
      url,
      title: data.title ?? null,
    });
    if (!scored.ok) return scored;
    const { n, c, m, quote, line } = scored.score;
    const valuation = valuationFromScores(n, c, m);
    const archetype = archetypeFromSum(n + c + m);
    const id = nid();
    await sql`
      insert into pitches (
        id, fingerprint, kind, pitch, url, page_title, roast, clapback,
        n, c, m, valuation, archetype, quote, display_name, handle, logo_url, bio,
        verified, paid, house, round_key, day_key
      ) values (
        ${id}, ${data.fingerprint}, ${paid ? "paid" : "joke"}, ${data.pitch},
        ${url}, ${data.title ?? null}, ${data.roast}, ${data.clapback},
        ${n}, ${c}, ${m}, ${valuation}, ${archetype}, ${quote || line},
        ${cleanName(data.displayName)}, ${cleanHandle(data.handle)},
        ${cleanUrl(data.logoUrl)}, ${data.bio?.trim().slice(0, 80) || null},
        ${paid}, ${paid}, ${false}, ${round}, ${day}
      )
    `;
    if (!paid) {
      await sql`
        insert into usage_day (fingerprint, day_key, joke_count, steal_count)
        values (${data.fingerprint}, ${day}, 1, 0)
        on conflict (fingerprint, day_key)
        do update set joke_count = usage_day.joke_count + 1
      `;
    }
    return {
      ok: true as const,
      id,
      n,
      c,
      m,
      valuation,
      archetype,
      quote: quote || line,
      paid,
    };
  });

export const stealPitch = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        fingerprint: fpSchema,
        pitchId: z.string().min(4).max(64),
        clapback: z.string().trim().min(2).max(280),
        handle: z.string().optional(),
        paid: z.boolean().optional(),
        txHash: z
          .string()
          .regex(/^0x[a-fA-F0-9]{64}$/)
          .nullable()
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const day = utcDayKey();
    const round = utcRoundKey();
    const rows = await sql`select * from pitches where id = ${data.pitchId}`;
    const p = rows[0];
    if (!p) return { ok: false as const, error: "That fight is gone." };
    if (String(p.fingerprint) === data.fingerprint) {
      return { ok: false as const, error: "You can't steal your own row." };
    }
    const usage = await sql`
      select steal_count from usage_day where fingerprint = ${data.fingerprint} and day_key = ${day}
    `;
    const steals = Number(usage[0]?.steal_count) || 0;
    const needPay = steals >= 3;
    const verified = Boolean(p.verified);
    if (needPay) {
      if (!data.paid) {
        return {
          ok: false as const,
          error: verified
            ? "Three free steals used. $1 USDC to steal a verified row."
            : "Three free steals used. $0.50 USDC to steal this row.",
          needPay: true,
          amount: verified ? PRICE.stealVerifiedUsd : PRICE.stealFreeRowUsd,
        };
      }
      const pay = await confirmPayment({
        fingerprint: data.fingerprint,
        txHash: data.txHash,
        amountUsd: verified ? PRICE.stealVerifiedUsd : PRICE.stealFreeRowUsd,
        kind: "steal",
      });
      if (!pay.ok) return pay;
    }
    const scored = await grokScore({
      pitch: String(p.pitch),
      roast: String(p.roast),
      clapback: data.clapback,
      url: (p.url as string) || null,
      title: (p.page_title as string) || null,
    });
    if (!scored.ok) return scored;
    const { n, c, m, quote } = scored.score;
    const valuation = valuationFromScores(n, c, m);
    const founderVal = Number(p.valuation) || 0;
    const need = verified ? Math.ceil(founderVal * 1.25) : founderVal + 1;
    const beat = valuation >= need && founderVal >= 0;
    const id = nid();
    await sql`
      insert into steals (
        id, pitch_id, fingerprint, clapback, n, c, m, valuation, beat, scar, paid, round_key, day_key
      ) values (
        ${id}, ${data.pitchId}, ${data.fingerprint}, ${data.clapback},
        ${n}, ${c}, ${m}, ${valuation}, ${beat}, ${!beat}, ${Boolean(data.paid)}, ${round}, ${day}
      )
    `;
    await sql`
      insert into usage_day (fingerprint, day_key, joke_count, steal_count)
      values (${data.fingerprint}, ${day}, 0, 1)
      on conflict (fingerprint, day_key)
      do update set steal_count = usage_day.steal_count + 1
    `;
    const handle = cleanHandle(data.handle);
    if (beat) {
      await sql`
        update pitches set
          crowd_valuation = ${valuation},
          crowd_handle = ${handle},
          crowd_fp = ${data.fingerprint},
          crowd_clapback = ${data.clapback},
          crowd_scar = ${false}
        where id = ${data.pitchId}
      `;
    } else {
      const existing = p.crowd_valuation == null ? 0 : Number(p.crowd_valuation);
      if (valuation > existing) {
        await sql`
          update pitches set
            crowd_valuation = ${valuation},
            crowd_handle = ${handle},
            crowd_fp = ${data.fingerprint},
            crowd_clapback = ${data.clapback},
            crowd_scar = ${true}
          where id = ${data.pitchId}
        `;
      }
    }
    return {
      ok: true as const,
      id,
      n,
      c,
      m,
      valuation,
      beat,
      need,
      founderVal,
      quote,
      verified,
      handle: p.handle as string | null,
      pitch: String(p.pitch),
      roast: String(p.roast),
      url: (p.url as string) || null,
    };
  });

export const defendPitch = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        fingerprint: fpSchema,
        pitchId: z.string().min(4).max(64),
        clapback: z.string().trim().min(2).max(280),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql`select * from pitches where id = ${data.pitchId}`;
    const p = rows[0];
    if (!p) return { ok: false as const, error: "Gone." };
    if (String(p.fingerprint) !== data.fingerprint) {
      return { ok: false as const, error: "Only the founder defends." };
    }
    if (!p.verified) return { ok: false as const, error: "Defend is for verified rows." };
    if (p.defend_used) return { ok: false as const, error: "You already used your defend." };
    if (p.crowd_valuation == null) return { ok: false as const, error: "Nobody to defend against." };
    const scored = await grokScore({
      pitch: String(p.pitch),
      roast: String(p.roast),
      clapback: String(p.clapback),
      url: (p.url as string) || null,
      title: (p.page_title as string) || null,
      steal: {
        clapback: String(p.crowd_clapback ?? ""),
        valuation: Number(p.crowd_valuation),
      },
      defend: data.clapback,
    });
    if (!scored.ok) return scored;
    const { n, c, m, quote } = scored.score;
    const valuation = valuationFromScores(n, c, m);
    const champ = Number(p.crowd_valuation);
    const win = valuation >= champ;
    if (win) {
      await sql`
        update pitches set
          n = ${n}, c = ${c}, m = ${m}, valuation = ${valuation},
          clapback = ${data.clapback}, quote = ${quote},
          defend_used = ${true}, crowd_scar = ${true}
        where id = ${data.pitchId}
      `;
    } else {
      await sql`
        update pitches set defend_used = ${true}, crowd_scar = ${false}
        where id = ${data.pitchId}
      `;
    }
    return {
      ok: true as const,
      valuation,
      champ,
      win,
      n,
      c,
      m,
      quote,
      archetype: archetypeFromSum(n + c + m),
    };
  });

export const claimPitch = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        fingerprint: fpSchema,
        pitchId: z.string().min(4).max(64),
        displayName: z.string().min(1).max(32),
        handle: z.string().optional(),
        url: z.string().optional(),
        logoUrl: z.string().optional(),
        bio: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql`select fingerprint from pitches where id = ${data.pitchId}`;
    if (!rows[0] || String(rows[0].fingerprint) !== data.fingerprint) {
      return { ok: false as const, error: "That's not your row." };
    }
    await sql`
      update pitches set
        display_name = ${cleanName(data.displayName)},
        handle = ${cleanHandle(data.handle)},
        url = coalesce(${cleanUrl(data.url)}, url),
        logo_url = ${cleanUrl(data.logoUrl)},
        bio = ${data.bio?.trim().slice(0, 80) || null}
      where id = ${data.pitchId}
    `;
    return { ok: true as const };
  });

export const getOpsArena = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureHouse(sql);
  const pitches = await sql`
    select id, kind, display_name, handle, url, valuation, crowd_valuation, verified, house, created_at, pitch
    from pitches order by created_at desc limit 80
  `;
  const steals = await sql`
    select id, pitch_id, valuation, beat, created_at from steals
    order by created_at desc limit 40
  `;
  return {
    source: dbSource,
    dayKey: utcDayKey(),
    roundKey: utcRoundKey(),
    pitches: pitches.map((p) => ({
      id: String(p.id),
      kind: String(p.kind),
      display_name: p.display_name == null ? null : String(p.display_name),
      handle: p.handle == null ? null : String(p.handle),
      url: p.url == null ? null : String(p.url),
      valuation: Number(p.valuation) || 0,
      crowd_valuation: p.crowd_valuation == null ? null : Number(p.crowd_valuation),
      verified: Boolean(p.verified),
      house: Boolean(p.house),
      created_at: String(p.created_at),
      pitch: String(p.pitch),
    })),
    steals: steals.map((s) => ({
      id: String(s.id),
      pitch_id: String(s.pitch_id),
      valuation: Number(s.valuation) || 0,
      beat: Boolean(s.beat),
      created_at: String(s.created_at),
    })),
  };
});
