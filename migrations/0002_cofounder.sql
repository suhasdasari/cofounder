-- Shared, unowned game data for cofounder.lol (no accounts).
create table if not exists runs (
  id serial primary key,
  day_key text not null,
  fingerprint text not null,
  splits integer[] not null,
  fairness integer not null,
  bias integer not null,
  archetype text not null,
  time_ms integer not null,
  display_name text,
  handle text,
  url text,
  created_at timestamptz not null default now(),
  unique (day_key, fingerprint)
);
create index if not exists runs_day_fairness_idx on runs (day_key, fairness desc, time_ms asc);

create table if not exists case_queue (
  id serial primary key,
  product_name text not null,
  url text,
  handle text,
  founder_a text not null,
  founder_b text not null,
  story text not null,
  created_at timestamptz not null default now()
);

create table if not exists duels (
  id text primary key,
  day_key text not null,
  host_fingerprint text not null,
  host_name text,
  host_splits integer[] not null,
  guest_splits integer[],
  guest_name text,
  created_at timestamptz not null default now()
);
