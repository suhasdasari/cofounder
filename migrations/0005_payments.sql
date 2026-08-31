-- One Base tx cannot be reused to mark multiple listings paid.
create table if not exists payments (
  tx_hash text primary key,
  fingerprint text not null,
  kind text not null,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);
create index if not exists payments_fp_idx on payments (fingerprint, created_at desc);
