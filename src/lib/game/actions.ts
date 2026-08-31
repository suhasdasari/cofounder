import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import {
  casesForDay,
  toPublicCase,
  utcDayKey,
  type PublicCase,
} from "./cases";
import { pickArchetype, sessionScore } from "./score";

const fpSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[a-z0-9]+$/i);

function cleanHandle(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const h = raw.trim().replace(/^@/, "").slice(0, 32);
  if (!/^[A-Za-z0-9_]{1,32}$/.test(h)) return null;
  return h;
}

function cleanUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href.slice(0, 200);
  } catch {
    return null;
  }
}

function cleanName(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const n = raw.trim().slice(0, 24);
  return n.length ? n : null;
}

/** PGLite + node-pg both accept `{1,2,3}` as integer[]. */
function toPgIntArray(xs: number[]): string {
  return `{${xs.map((n) => Math.trunc(n)).join(",")}}`;
}

function fromPgIntArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map((n) => Number(n));
  if (typeof v === "string") {
    const s = v.trim().replace(/^\[|\]$|^\{|\}$/g, "");
    if (!s) return [];
    return s
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}

export type FeaturedRow = {
  rank: number;
  displayName: string | null;
  handle: string | null;
  url: string | null;
  fairness: number;
  archetype: string;
};

export type TodayPayload = {
  dayKey: string;
  cases: PublicCase[];
  featured: FeaturedRow[];
  plays: number;
};

export const getToday = createServerFn({ method: "GET" }).handler(
  async (): Promise<TodayPayload> => {
    const dayKey = utcDayKey();
    const cases = casesForDay(dayKey).map(toPublicCase);
    const sql = await getSql();
    const countRows = await sql<{ n: number }>`
      select count(*)::int as n from runs where day_key = ${dayKey}
    `;
    const board = await sql<{
      display_name: string | null;
      handle: string | null;
      url: string | null;
      fairness: number;
      archetype: string;
    }>`
      select display_name, handle, url, fairness, archetype
      from runs
      where day_key = ${dayKey}
      order by fairness desc, time_ms asc
      limit 10
    `;
    return {
      dayKey,
      cases,
      plays: countRows[0]?.n ?? 0,
      featured: board.map((row, i) => ({
        rank: i + 1,
        displayName: row.display_name,
        handle: row.handle,
        url: row.url,
        fairness: row.fairness,
        archetype: row.archetype,
      })),
    };
  },
);

export const getBoard = createServerFn({ method: "GET" }).handler(async () => {
  const dayKey = utcDayKey();
  const sql = await getSql();
  const rows = await sql<{
    display_name: string | null;
    handle: string | null;
    url: string | null;
    fairness: number;
    archetype: string;
    time_ms: number;
  }>`
    select display_name, handle, url, fairness, archetype, time_ms
    from runs
    where day_key = ${dayKey}
    order by fairness desc, time_ms asc
    limit 50
  `;
  return {
    dayKey,
    rows: rows.map((row, i) => ({
      rank: i + 1,
      displayName: row.display_name,
      handle: row.handle,
      url: row.url,
      fairness: row.fairness,
      archetype: row.archetype,
      timeMs: row.time_ms,
    })),
  };
});

const submitSchema = z.object({
  fingerprint: fpSchema,
  splits: z.array(z.number().int().min(0).max(100)).length(5),
  timeMs: z.number().int().min(1).max(600000),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const submitRun = createServerFn({ method: "POST" })
  .validator(submitSchema)
  .handler(async ({ data }) => {
    const dayKey = utcDayKey();
    if (data.dayKey !== dayKey) {
      return { ok: false as const, error: "This day's five already closed." };
    }
    const hidden = casesForDay(dayKey);
    const fairSplits = hidden.map((c) => c.fairA);
    const { fairness, bias, per } = sessionScore(data.splits, fairSplits);
    const archetype = pickArchetype(fairness, bias);
    const sql = await getSql();
    const splitsLiteral = toPgIntArray(data.splits);

    const existing = await sql<{ id: number }>`
      select id from runs
      where day_key = ${dayKey} and fingerprint = ${data.fingerprint}
    `;
    const counted = existing.length === 0;
    if (counted) {
      await sql`
        insert into runs (
          day_key, fingerprint, splits, fairness, bias, archetype, time_ms
        ) values (
          ${dayKey},
          ${data.fingerprint},
          ${splitsLiteral}::integer[],
          ${fairness},
          ${bias},
          ${archetype.title},
          ${data.timeMs}
        )
      `;
    }

    const rankRows = await sql<{ n: number }>`
      select count(*)::int as n from runs
      where day_key = ${dayKey}
        and (fairness > ${fairness}
          or (fairness = ${fairness} and time_ms < ${data.timeMs}))
    `;
    const rank = (rankRows[0]?.n ?? 0) + 1;

    const breakdown = hidden.map((c, i) => ({
      id: c.id,
      title: c.title,
      aName: c.aName,
      bName: c.bName,
      you: data.splits[i] ?? 50,
      house: c.fairA,
      score: per[i] ?? 0,
    }));

    return {
      ok: true as const,
      counted,
      fairness,
      bias,
      archetype,
      rank,
      breakdown,
      inPromo: rank <= 10 && counted,
    };
  });

const claimSchema = z.object({
  fingerprint: fpSchema,
  displayName: z.string().max(24),
  handle: z.string().max(40).optional(),
  url: z.string().max(200).optional(),
});

export const claimRank = createServerFn({ method: "POST" })
  .validator(claimSchema)
  .handler(async ({ data }) => {
    const dayKey = utcDayKey();
    const sql = await getSql();
    const mine = await sql<{ id: number; fairness: number; time_ms: number }>`
      select id, fairness, time_ms from runs
      where day_key = ${dayKey} and fingerprint = ${data.fingerprint}
    `;
    if (!mine[0]) return { ok: false as const, error: "Play today's five first." };
    const ahead = await sql<{ n: number }>`
      select count(*)::int as n from runs
      where day_key = ${dayKey}
        and (fairness > ${mine[0].fairness}
          or (fairness = ${mine[0].fairness} and time_ms < ${mine[0].time_ms}))
    `;
    const rank = (ahead[0]?.n ?? 0) + 1;
    if (rank > 10) {
      return { ok: false as const, error: "Promo slots are top 10 today only." };
    }
    const displayName = cleanName(data.displayName);
    if (!displayName) return { ok: false as const, error: "Need a name to claim." };
    const handle = cleanHandle(data.handle);
    const url = cleanUrl(data.url);
    await sql`
      update runs
      set display_name = ${displayName},
          handle = ${handle},
          url = ${url}
      where id = ${mine[0].id}
    `;
    return { ok: true as const, rank };
  });

const duelCreateSchema = z.object({
  fingerprint: fpSchema,
  name: z.string().max(24).optional(),
});

export const createDuel = createServerFn({ method: "POST" })
  .validator(duelCreateSchema)
  .handler(async ({ data }) => {
    const dayKey = utcDayKey();
    const sql = await getSql();
    const mine = await sql<{ splits: unknown }>`
      select splits from runs
      where day_key = ${dayKey} and fingerprint = ${data.fingerprint}
    `;
    if (!mine[0]) return { ok: false as const, error: "Play first, then challenge." };
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const hostName = cleanName(data.name);
    const hostSplits = toPgIntArray(fromPgIntArray(mine[0].splits));
    await sql`
      insert into duels (id, day_key, host_fingerprint, host_name, host_splits)
      values (${id}, ${dayKey}, ${data.fingerprint}, ${hostName}, ${hostSplits}::integer[])
    `;
    return { ok: true as const, id };
  });

const duelGetSchema = z.object({ id: z.string().min(6).max(24) });

export const getDuel = createServerFn({ method: "GET" })
  .validator(duelGetSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      day_key: string;
      host_name: string | null;
      host_splits: unknown;
      guest_name: string | null;
      guest_splits: unknown;
    }>`
      select id, day_key, host_name, host_splits, guest_name, guest_splits
      from duels where id = ${data.id}
    `;
    const d = rows[0];
    if (!d) return { ok: false as const };
    return {
      ok: true as const,
      id: d.id,
      dayKey: d.day_key,
      hostName: d.host_name,
      hostSplits: fromPgIntArray(d.host_splits),
      guestName: d.guest_name,
      guestSplits: d.guest_splits ? fromPgIntArray(d.guest_splits) : null,
      expired: d.day_key !== utcDayKey(),
    };
  });

const duelJoinSchema = z.object({
  id: z.string().min(6).max(24),
  fingerprint: fpSchema,
  name: z.string().max(24).optional(),
  splits: z.array(z.number().int().min(0).max(100)).length(5),
});

export const joinDuel = createServerFn({ method: "POST" })
  .validator(duelJoinSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{
      day_key: string;
      host_splits: unknown;
      host_name: string | null;
      guest_splits: unknown;
    }>`
      select day_key, host_splits, host_name, guest_splits
      from duels where id = ${data.id}
    `;
    const d = rows[0];
    if (!d) return { ok: false as const, error: "Challenge not found." };
    if (d.day_key !== utcDayKey()) {
      return { ok: false as const, error: "That challenge expired at midnight UTC." };
    }
    const guestName = cleanName(data.name);
    const hostSplits = fromPgIntArray(d.host_splits);
    if (!d.guest_splits) {
      const guestLiteral = toPgIntArray(data.splits);
      await sql`
        update duels
        set guest_splits = ${guestLiteral}::integer[], guest_name = ${guestName}
        where id = ${data.id} and guest_splits is null
      `;
    }
    const gap = Math.round(
      hostSplits.reduce(
        (acc, h, i) => acc + Math.abs(h - (data.splits[i] ?? 50)),
        0,
      ) / 5,
    );
    return {
      ok: true as const,
      hostName: d.host_name ?? "Host",
      guestName: guestName ?? "You",
      hostSplits,
      guestSplits: data.splits,
      gap,
    };
  });

const caseSchema = z.object({
  productName: z.string().min(2).max(48),
  url: z.string().max(200).optional(),
  handle: z.string().max(40).optional(),
  founderA: z.string().min(1).max(40),
  founderB: z.string().min(1).max(40),
  story: z.string().min(20).max(400),
});

export const submitCase = createServerFn({ method: "POST" })
  .validator(caseSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into case_queue (product_name, url, handle, founder_a, founder_b, story)
      values (
        ${data.productName.trim().slice(0, 48)},
        ${cleanUrl(data.url)},
        ${cleanHandle(data.handle)},
        ${data.founderA.trim().slice(0, 40)},
        ${data.founderB.trim().slice(0, 40)},
        ${data.story.trim().slice(0, 400)}
      )
    `;
    return { ok: true as const };
  });

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return "";
}

export const getOps = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const days = await sql<{ day_key: string; plays: number }>`
    select day_key, count(*)::int as plays
    from runs
    group by day_key
    order by day_key desc
  `;
  const runs = await sql<{
    day_key: string;
    display_name: string | null;
    handle: string | null;
    url: string | null;
    fairness: number;
    archetype: string;
    time_ms: number;
    created_at: unknown;
  }>`
    select day_key, display_name, handle, url, fairness, archetype, time_ms, created_at
    from runs
    order by created_at desc
    limit 200
  `;
  const queue = await sql<{
    id: number;
    product_name: string;
    url: string | null;
    handle: string | null;
    founder_a: string;
    founder_b: string;
    story: string;
    created_at: unknown;
  }>`
    select id, product_name, url, handle, founder_a, founder_b, story, created_at
    from case_queue
    order by created_at desc
    limit 100
  `;
  const duels = await sql<{
    id: string;
    day_key: string;
    host_name: string | null;
    guest_name: string | null;
    created_at: unknown;
  }>`
    select id, day_key, host_name, guest_name, created_at
    from duels
    order by created_at desc
    limit 50
  `;
  return {
    source: dbSource,
    dayKey: utcDayKey(),
    days,
    runs: runs.map((r) => ({
      dayKey: r.day_key,
      displayName: r.display_name,
      handle: r.handle,
      url: r.url,
      fairness: r.fairness,
      archetype: r.archetype,
      timeMs: r.time_ms,
      createdAt: asIso(r.created_at),
    })),
    queue: queue.map((q) => ({
      id: q.id,
      productName: q.product_name,
      url: q.url,
      handle: q.handle,
      founderA: q.founder_a,
      founderB: q.founder_b,
      story: q.story,
      createdAt: asIso(q.created_at),
    })),
    duels: duels.map((d) => ({
      id: d.id,
      dayKey: d.day_key,
      hostName: d.host_name,
      guestName: d.guest_name,
      createdAt: asIso(d.created_at),
    })),
  };
});
