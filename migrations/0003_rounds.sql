-- 3-hour rounds, founder profiles, richer listed fights.
alter table runs add column if not exists round_key text;
update runs set round_key = day_key where round_key is null;
alter table runs alter column round_key set not null;
alter table runs drop constraint if exists runs_day_key_fingerprint_key;
create unique index if not exists runs_round_fp_uidx on runs (round_key, fingerprint);
create index if not exists runs_round_fairness_idx on runs (round_key, fairness desc, time_ms asc);
create index if not exists runs_day_fairness_idx2 on runs (day_key, fairness desc, time_ms asc);
alter table runs add column if not exists logo_url text;
alter table runs add column if not exists bio text;

create table if not exists profiles (
  fingerprint text primary key,
  display_name text not null,
  handle text,
  url text,
  logo_url text,
  bio text,
  updated_at timestamptz not null default now()
);

alter table case_queue add column if not exists logo_url text;
alter table case_queue add column if not exists description text;
alter table case_queue add column if not exists a_label text;
alter table case_queue add column if not exists b_label text;
alter table case_queue add column if not exists used_round text;

alter table duels add column if not exists round_key text;
update duels set round_key = day_key where round_key is null;
