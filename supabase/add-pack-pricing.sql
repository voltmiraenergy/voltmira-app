-- add-pack-pricing.sql
-- The bank pack sold per project (lib/packPricing.js): which plants a
-- company has paid for, and the invoice requests waiting for VoltMira.
-- Safe to run twice.
--
-- A company reads its own rows through its session (RLS). Nobody writes them
-- from the browser: the Paddle webhook and the platform admin write with the
-- service role, after checking the payment.

-- 1. The unlocks: one row per paid pack. plant_id null is a portfolio's data room.
create table if not exists pack_unlocks (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  portfolio_id   uuid not null references portfolios(id) on delete cascade,
  plant_id       text check (plant_id is null or char_length(plant_id) between 1 and 80),
  tier           text not null check (tier in ('ci', 'utility', 'portfolio')),
  amount_eur     numeric(12, 2) not null default 0 check (amount_eur >= 0),
  source         text not null check (source in ('paddle', 'invoice', 'admin')),
  paddle_txn_id  text unique,
  note           text not null default '' check (char_length(note) <= 300),
  unlocked_by    text not null default '' check (char_length(unlocked_by) <= 200),
  unlocked_at    timestamptz not null default now(),
  expires_at     timestamptz not null
);
create index if not exists pack_unlocks_lookup_idx on pack_unlocks(company_id, portfolio_id, plant_id);
alter table pack_unlocks enable row level security;
drop policy if exists pack_unlocks_read on pack_unlocks;
create policy pack_unlocks_read on pack_unlocks for select
  using (company_id = my_company_id());

-- 2. The invoice requests: a developer who pays by bank transfer asks for an
-- invoice; VoltMira sends it, and unlocks the pack when the transfer arrives.
create table if not exists pack_requests (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  portfolio_id   uuid not null references portfolios(id) on delete cascade,
  plant_id       text check (plant_id is null or char_length(plant_id) between 1 and 80),
  plant_name     text not null default '' check (char_length(plant_name) <= 200),
  tier           text not null check (tier in ('ci', 'utility', 'portfolio')),
  amount_eur     numeric(12, 2) not null check (amount_eur >= 0),
  billing        text not null default '' check (char_length(billing) <= 1000),
  requested_by   text not null default '' check (char_length(requested_by) <= 200),
  status         text not null default 'open' check (status in ('open', 'unlocked', 'cancelled')),
  created_at     timestamptz not null default now(),
  closed_at      timestamptz
);
create index if not exists pack_requests_open_idx on pack_requests(status, created_at);
alter table pack_requests enable row level security;
drop policy if exists pack_requests_read on pack_requests;
create policy pack_requests_read on pack_requests for select
  using (company_id = my_company_id());
