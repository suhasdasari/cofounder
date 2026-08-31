-- Toxic AI cofounder arena. Rank is valuation. URL never moves on steal.
create table if not exists pitches (
  id text primary key,
  fingerprint text not null,
  kind text not null,
  pitch text not null,
  url text,
  page_title text,
  page_meta text,
  roast text not null,
  clapback text not null,
  n integer not null,
  c integer not null,
  m integer not null,
  valuation integer not null,
  archetype text not null,
  quote text,
  display_name text,
  handle text,
  logo_url text,
  bio text,
  verified boolean not null default false,
  paid boolean not null default false,
  house boolean not null default false,
  defend_used boolean not null default false,
  crowd_valuation integer,
  crowd_handle text,
  crowd_fp text,
  crowd_clapback text,
  crowd_scar boolean not null default false,
  round_key text not null,
  day_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists pitches_sort_idx on pitches (day_key, valuation desc, created_at asc);
create index if not exists pitches_round_idx on pitches (round_key, valuation desc);

create table if not exists steals (
  id text primary key,
  pitch_id text not null references pitches(id),
  fingerprint text not null,
  clapback text not null,
  n integer not null,
  c integer not null,
  m integer not null,
  valuation integer not null,
  beat boolean not null default false,
  scar boolean not null default false,
  paid boolean not null default false,
  round_key text not null,
  day_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists steals_pitch_idx on steals (pitch_id, created_at desc);
create index if not exists steals_fp_day_idx on steals (fingerprint, day_key);

create table if not exists usage_day (
  fingerprint text not null,
  day_key text not null,
  joke_count integer not null default 0,
  steal_count integer not null default 0,
  primary key (fingerprint, day_key)
);
