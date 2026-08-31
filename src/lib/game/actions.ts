import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import {
  casesForRound,
  fairAFromStory,
  roundEndsAt,
  toPublicCase,
  utcDayKey,
  utcRoundKey,
  type Case,
  type PublicCase,
} from "./cases";
import { pickArchetype, sessionScore } from "./score";

const fpSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[a-z0-9]+$/i);

const roundKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}$/);

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
    return u.href.slice(0, 240);
  } catch {
    return null;
  }
}

function cleanName(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const n = raw.trim().slice(0, 24);
  return n.length ? n : null;
}

function cleanBio(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const n = raw.trim().slice(0, 80);
  return n.length ? n : null;
}

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

export type ProfileRow = {
  rank: number;
  displayName: string | null;
  handle: string | null;
  url: string | null;
  logoUrl: string | null;
  bio: string | null;
  fairness: number;
  archetype: string;
  timeMs: number;
};

export type QueuePreview = {
  productName: string;
  handle: string | null;
  logoUrl: string | null;
};

export type TodayPayload = {
  roundKey: string;
  dayKey: string;
  endsAt: string;
  cases: PublicCase[];
  featured: ProfileRow[];
  daily: ProfileRow[];
  allTime: ProfileRow[];
  plays: number;
  queuePreview: QueuePreview[];
};

type SqlClient = Awaited<ReturnType<typeof getSql>>;

type QueueRow = {
  id: number;
  product_name: string;
  url: string | null;
  handle: string | null;
  founder_a: string;
  founder_b: string;
  story: string;
  logo_url: string | null;
  description: string | null;
  a_label: string | null;
  b_label: string | null;
};

type RawBoard = {
  display_name: string | null;
  handle: string | null;
  url: string | null;
  logo_url: string | null;
  bio: string | null;
  fairness: number;
  archetype: string;
  time_ms: number;
};

function mapBoard(rows: RawBoard[]): ProfileRow[] {
  return rows.map((row, i) => ({
    rank: i + 1,
    displayName: row.display_name,
    handle: row.handle,
    url: row.url,
    logoUrl: row.logo_url,
    bio: row.bio,
    fairness: row.fairness,
    archetype: row.archetype,
    timeMs: row.time_ms,
  }));
}

function listedToCase(row: QueueRow): Case {
  return {
    id: `listed-${row.id}`,
    title: row.product_name,
    story: row.story,
    aName: row.founder_a,
    aLabel: row.a_label?.trim() || "cofounder A",
    bName: row.founder_b,
    bLabel: row.b_label?.trim() || "cofounder B",
    fairA: fairAFromStory(row.story),
    listedBy: {
      productName: row.product_name,
      url: row.url,
      handle: row.handle,
      logoUrl: row.logo_url,
      description: row.description,
    },
  };
}

async function listedCaseForRound(sql: SqlClient, roundKey: string): Promise<Case | null> {
  const existing = await sql<QueueRow>`
    select id, product_name, url, handle, founder_a, founder_b, story, logo_url, description, a_label, b_label
    from case_queue
    where used_round = ${roundKey}
    order by id asc
    limit 1
  `;
  if (existing[0]) return listedToCase(existing[0]);
  const claimed = await sql<QueueRow>`
    update case_queue
    set used_round = ${roundKey}
    where id = (
      select id from case_queue
      where used_round is null
      order by id asc
      limit 1
    )
    and used_round is null
    returning id, product_name, url, handle, founder_a, founder_b, story, logo_url, description, a_label, b_label
  `;
  if (claimed[0]) return listedToCase(claimed[0]);
  return null;
}

async function hiddenCases(sql: SqlClient, roundKey: string): Promise<Case[]> {
  const listed = await listedCaseForRound(sql, roundKey);
  return casesForRound(roundKey, listed);
}

async function roundBoard(sql: SqlClient, roundKey: string, limit: number) {
  return sql<RawBoard>`
    select
      coalesce(p.display_name, r.display_name) as display_name,
      coalesce(p.handle, r.handle) as handle,
      coalesce(p.url, r.url) as url,
      coalesce(p.logo_url, r.logo_url) as logo_url,
      coalesce(p.bio, r.bio) as bio,
      r.fairness, r.archetype, r.time_ms
    from runs r
    left join profiles p on p.fingerprint = r.fingerprint
    where r.round_key = ${roundKey}
    order by r.fairness desc, r.time_ms asc
    limit ${limit}
  `;
}

async function dailyBoard(sql: SqlClient, dayKey: string, limit: number) {
  const rows = await sql<RawBoard & { fingerprint: string }>`
    select distinct on (r.fingerprint)
      r.fingerprint,
      coalesce(p.display_name, r.display_name) as display_name,
      coalesce(p.handle, r.handle) as handle,
      coalesce(p.url, r.url) as url,
      coalesce(p.logo_url, r.logo_url) as logo_url,
      coalesce(p.bio, r.bio) as bio,
      r.fairness, r.archetype, r.time_ms
    from runs r
    left join profiles p on p.fingerprint = r.fingerprint
    where r.day_key = ${dayKey}
    order by r.fingerprint, r.fairness desc, r.time_ms asc
  `;
  return rows
    .sort((a, b) => b.fairness - a.fairness || a.time_ms - b.time_ms)
    .slice(0, limit);
}

async function allTimeBoard(sql: SqlClient, limit: number) {
  const rows = await sql<RawBoard & { fingerprint: string }>`
    select distinct on (r.fingerprint)
      r.fingerprint,
      coalesce(p.display_name, r.display_name) as display_name,
      coalesce(p.handle, r.handle) as handle,
      coalesce(p.url, r.url) as url,
      coalesce(p.logo_url, r.logo_url) as logo_url,
      coalesce(p.bio, r.bio) as bio,
      r.fairness, r.archetype, r.time_ms
    from runs r
    left join profiles p on p.fingerprint = r.fingerprint
    order by r.fingerprint, r.fairness desc, r.time_ms asc
  `;
  return rows
    .sort((a, b) => b.fairness - a.fairness || a.time_ms - b.time_ms)
    .slice(0, limit);
}

export const getToday = createServerFn({ method: "GET" }).handler(
  async (): Promise<TodayPayload> => {
    const roundKey = utcRoundKey();
    const dayKey = utcDayKey();
    const sql = await getSql();
    const hidden = await hiddenCases(sql, roundKey);
    const countRows = await sql<{ n: number }>`
      select count(*)::int as n from runs where round_key = ${roundKey}
    `;
    const [featured, daily, allTime, queue] = await Promise.all([
      roundBoard(sql, roundKey, 10),
      dailyBoard(sql, dayKey, 10),
      allTimeBoard(sql, 10),
      sql<{ product_name: string; handle: string | null; logo_url: string | null }>`
        select product_name, handle, logo_url
        from case_queue
        where used_round is null
        order by id asc
        limit 6
      `,
    ]);
    return {
      roundKey,
      dayKey,
      endsAt: roundEndsAt(roundKey).toISOString(),
      cases: hidden.map(toPublicCase),
      plays: countRows[0]?.n ?? 0,
      featured: mapBoard(featured),
      daily: mapBoard(daily),
      allTime: mapBoard(allTime),
      queuePreview: queue.map((q) => ({
        productName: q.product_name,
        handle: q.handle,
        logoUrl: q.logo_url,
      })),
    };
  },
);

export const getBoard = createServerFn({ method: "GET" }).handler(async () => {
  const roundKey = utcRoundKey();
  const dayKey = utcDayKey();
  const sql = await getSql();
  const [round, daily, allTime] = await Promise.all([
    roundBoard(sql, roundKey, 50),
    dailyBoard(sql, dayKey, 50),
    allTimeBoard(sql, 50),
  ]);
  return {
    roundKey,
    dayKey,
    endsAt: roundEndsAt(roundKey).toISOString(),
    round: mapBoard(round),
    daily: mapBoard(daily),
    allTime: mapBoard(allTime),
  };
});

const submitSchema = z.object({
  fingerprint: fpSchema,
  splits: z.array(z.number().int().min(0).max(100)).length(5),
  timeMs: z.number().int().min(1).max(600000),
  roundKey: roundKeySchema,
});

export const submitRun = createServerFn({ method: "POST" })
  .validator(submitSchema)
  .handler(async ({ data }) => {
    const roundKey = utcRoundKey();
    const dayKey = utcDayKey();
    if (data.roundKey !== roundKey) {
      return { ok: false as const, error: "This round already closed. Play the new five." };
    }
    const sql = await getSql();
    const hidden = await hiddenCases(sql, roundKey);
    const fairSplits = hidden.map((c) => c.fairA);
    const { fairness, bias, per } = sessionScore(data.splits, fairSplits);
    const archetype = pickArchetype(fairness, bias);
    const splitsLiteral = toPgIntArray(data.splits);

    const existing = await sql<{ id: number }>`
      select id from runs
      where round_key = ${roundKey} and fingerprint = ${data.fingerprint}
    `;
    const counted = existing.length === 0;
    if (counted) {
      await sql`
        insert into runs (
          day_key, round_key, fingerprint, splits, fairness, bias, archetype, time_ms
        ) values (
          ${dayKey},
          ${roundKey},
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
      where round_key = ${roundKey}
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
  url: z.string().max(240).optional(),
  logoUrl: z.string().max(240).optional(),
  bio: z.string().max(80).optional(),
});

export const claimRank = createServerFn({ method: "POST" })
  .validator(claimSchema)
  .handler(async ({ data }) => {
    const roundKey = utcRoundKey();
    const sql = await getSql();
    const mine = await sql<{ id: number; fairness: number; time_ms: number }>`
      select id, fairness, time_ms from runs
      where round_key = ${roundKey} and fingerprint = ${data.fingerprint}
    `;
    if (!mine[0]) return { ok: false as const, error: "Play this round's five first." };
    const ahead = await sql<{ n: number }>`
      select count(*)::int as n from runs
      where round_key = ${roundKey}
        and (fairness > ${mine[0].fairness}
          or (fairness = ${mine[0].fairness} and time_ms < ${mine[0].time_ms}))
    `;
    const rank = (ahead[0]?.n ?? 0) + 1;
    const displayName = cleanName(data.displayName);
    if (!displayName) return { ok: false as const, error: "Need a name to claim." };
    const handle = cleanHandle(data.handle);
    const url = cleanUrl(data.url);
    const logoUrl = cleanUrl(data.logoUrl);
    const bio = cleanBio(data.bio);
    await sql`
      update runs
      set display_name = ${displayName},
          handle = ${handle},
          url = ${url},
          logo_url = ${logoUrl},
          bio = ${bio}
      where id = ${mine[0].id}
    `;
    await sql`
      insert into profiles (fingerprint, display_name, handle, url, logo_url, bio, updated_at)
      values (
        ${data.fingerprint}, ${displayName}, ${handle}, ${url}, ${logoUrl}, ${bio}, now()
      )
      on conflict (fingerprint) do update set
        display_name = excluded.display_name,
        handle = excluded.handle,
        url = excluded.url,
        logo_url = excluded.logo_url,
        bio = excluded.bio,
        updated_at = now()
    `;
    return { ok: true as const, rank };
  });

const duelCreateSchema = z.object({
  fingerprint: fpSchema,
  name: z.string().max(24).optional(),
});

async function insertDuel(
  sql: SqlClient,
  roundKey: string,
  hostFingerprint: string,
  hostName: string | null,
  hostSplits: number[],
) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const splits = toPgIntArray(hostSplits);
  const dayKey = utcDayKey();
  await sql`
    insert into duels (id, day_key, round_key, host_fingerprint, host_name, host_splits)
    values (${id}, ${dayKey}, ${roundKey}, ${hostFingerprint}, ${hostName}, ${splits}::integer[])
  `;
  return id;
}

export const createDuel = createServerFn({ method: "POST" })
  .validator(duelCreateSchema)
  .handler(async ({ data }) => {
    const roundKey = utcRoundKey();
    const sql = await getSql();
    const mine = await sql<{ splits: unknown }>`
      select splits from runs
      where round_key = ${roundKey} and fingerprint = ${data.fingerprint}
    `;
    if (!mine[0]) return { ok: false as const, error: "Play first, then challenge." };
    const id = await insertDuel(
      sql,
      roundKey,
      data.fingerprint,
      cleanName(data.name),
      fromPgIntArray(mine[0].splits),
    );
    return { ok: true as const, id };
  });

const challengeSchema = z.object({
  fingerprint: fpSchema,
  rank: z.number().int().min(1).max(50).optional(),
  random: z.boolean().optional(),
});

export const challengeFounder = createServerFn({ method: "POST" })
  .validator(challengeSchema)
  .handler(async ({ data }) => {
    const roundKey = utcRoundKey();
    const sql = await getSql();
    const pool = await sql<{
      fingerprint: string;
      display_name: string | null;
      splits: unknown;
    }>`
      select r.fingerprint, coalesce(p.display_name, r.display_name) as display_name, r.splits
      from runs r
      left join profiles p on p.fingerprint = r.fingerprint
      where r.round_key = ${roundKey}
      order by r.fairness desc, r.time_ms asc
      limit 50
    `;
    if (pool.length === 0) {
      return { ok: false as const, error: "Nobody to challenge this round yet." };
    }
    let target = pool[0]!;
    if (data.random) {
      const others = pool.filter((r) => r.fingerprint !== data.fingerprint);
      const pick = others.length ? others : pool;
      target = pick[Math.floor(Math.random() * pick.length)]!;
    } else if (data.rank) {
      target = pool[data.rank - 1] ?? target;
    }
    const id = await insertDuel(
      sql,
      roundKey,
      target.fingerprint,
      cleanName(target.display_name) ?? "Founder",
      fromPgIntArray(target.splits),
    );
    return { ok: true as const, id, hostName: target.display_name ?? "Founder" };
  });

const duelGetSchema = z.object({ id: z.string().min(6).max(24) });

export const getDuel = createServerFn({ method: "GET" })
  .validator(duelGetSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      round_key: string | null;
      day_key: string;
      host_name: string | null;
      host_splits: unknown;
      guest_name: string | null;
      guest_splits: unknown;
    }>`
      select id, round_key, day_key, host_name, host_splits, guest_name, guest_splits
      from duels where id = ${data.id}
    `;
    const d = rows[0];
    if (!d) return { ok: false as const };
    const roundKey = d.round_key || d.day_key;
    return {
      ok: true as const,
      id: d.id,
      roundKey,
      hostName: d.host_name,
      hostSplits: fromPgIntArray(d.host_splits),
      guestName: d.guest_name,
      guestSplits: d.guest_splits ? fromPgIntArray(d.guest_splits) : null,
      expired: roundKey !== utcRoundKey(),
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
      round_key: string | null;
      day_key: string;
      host_splits: unknown;
      host_name: string | null;
      guest_splits: unknown;
    }>`
      select round_key, day_key, host_splits, host_name, guest_splits
      from duels where id = ${data.id}
    `;
    const d = rows[0];
    if (!d) return { ok: false as const, error: "Challenge not found." };
    const roundKey = d.round_key || d.day_key;
    if (roundKey !== utcRoundKey()) {
      return { ok: false as const, error: "That challenge expired when the round flipped." };
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
  url: z.string().max(240).optional(),
  handle: z.string().max(40).optional(),
  logoUrl: z.string().max(240).optional(),
  description: z.string().max(80).optional(),
  founderA: z.string().min(1).max(40),
  founderB: z.string().min(1).max(40),
  aLabel: z.string().max(40).optional(),
  bLabel: z.string().max(40).optional(),
  story: z.string().min(20).max(400),
});

export const submitCase = createServerFn({ method: "POST" })
  .validator(caseSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into case_queue (
        product_name, url, handle, logo_url, description,
        founder_a, founder_b, a_label, b_label, story
      ) values (
        ${data.productName.trim().slice(0, 48)},
        ${cleanUrl(data.url)},
        ${cleanHandle(data.handle)},
        ${cleanUrl(data.logoUrl)},
        ${cleanBio(data.description)},
        ${data.founderA.trim().slice(0, 40)},
        ${data.founderB.trim().slice(0, 40)},
        ${data.aLabel?.trim().slice(0, 40) || null},
        ${data.bLabel?.trim().slice(0, 40) || null},
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
  const rounds = await sql<{ round_key: string; plays: number }>`
    select round_key, count(*)::int as plays
    from runs
    group by round_key
    order by round_key desc
  `;
  const runs = await sql<{
    round_key: string;
    day_key: string;
    display_name: string | null;
    handle: string | null;
    url: string | null;
    logo_url: string | null;
    bio: string | null;
    fairness: number;
    archetype: string;
    time_ms: number;
    created_at: unknown;
  }>`
    select round_key, day_key, display_name, handle, url, logo_url, bio, fairness, archetype, time_ms, created_at
    from runs
    order by created_at desc
    limit 200
  `;
  const queue = await sql<{
    id: number;
    product_name: string;
    url: string | null;
    handle: string | null;
    logo_url: string | null;
    description: string | null;
    founder_a: string;
    founder_b: string;
    story: string;
    used_round: string | null;
    created_at: unknown;
  }>`
    select id, product_name, url, handle, logo_url, description, founder_a, founder_b, story, used_round, created_at
    from case_queue
    order by created_at desc
    limit 100
  `;
  const duels = await sql<{
    id: string;
    round_key: string | null;
    day_key: string;
    host_name: string | null;
    guest_name: string | null;
    created_at: unknown;
  }>`
    select id, round_key, day_key, host_name, guest_name, created_at
    from duels
    order by created_at desc
    limit 50
  `;
  const roundKey = utcRoundKey();
  return {
    source: dbSource,
    roundKey,
    dayKey: utcDayKey(),
    endsAt: roundEndsAt(roundKey).toISOString(),
    rounds,
    runs: runs.map((r) => ({
      roundKey: r.round_key,
      dayKey: r.day_key,
      displayName: r.display_name,
      handle: r.handle,
      url: r.url,
      logoUrl: r.logo_url,
      bio: r.bio,
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
      logoUrl: q.logo_url,
      description: q.description,
      founderA: q.founder_a,
      founderB: q.founder_b,
      story: q.story,
      usedRound: q.used_round,
      createdAt: asIso(q.created_at),
    })),
    duels: duels.map((d) => ({
      id: d.id,
      roundKey: d.round_key || d.day_key,
      hostName: d.host_name,
      guestName: d.guest_name,
      createdAt: asIso(d.created_at),
    })),
  };
});
