-- add-portfolios.sql
-- Portfolios: several quotes grouped as one investment, with the finance
-- assumptions, stress scenario, per-asset document register and the
-- environmental and social screening answers that go with them
-- (app/(app)/portfolios, lib/portfolio.js). Safe to run twice.
--
-- project_ids is a plain list, not a foreign key: deleting a quote must never be
-- blocked by a portfolio, and the app simply skips an id that no longer exists.
-- company_id defaults to the caller's company, so the browser can insert and
-- update without ever sending (or being able to forge) a company id.

create table if not exists portfolios (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default my_company_id() references companies(id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 160),
  market      text not null default 'MD' check (market in ('MD','UA','RO')),
  project_ids uuid[] not null default '{}',
  finance     jsonb not null default '{}'::jsonb,   -- gearing, rate, tenor, grant, ...
  scenario    jsonb not null default '{}'::jsonb,   -- the base case's overlays: PPA, curtailment, ...
  assets      jsonb not null default '{}'::jsonb,   -- per quote id: document statuses, capex override
  es          jsonb not null default '{}'::jsonb,   -- screening answers, jobs and gender figures
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- a runaway write must not bloat the table
alter table portfolios drop constraint if exists portfolios_size;
alter table portfolios add constraint portfolios_size
  check (pg_column_size(finance) + pg_column_size(scenario) + pg_column_size(assets) + pg_column_size(es) < 1000000);
alter table portfolios drop constraint if exists portfolios_members;
alter table portfolios add constraint portfolios_members
  check (coalesce(array_length(project_ids, 1), 0) <= 500);

create index if not exists portfolios_company_idx on portfolios(company_id, updated_at desc);

alter table portfolios enable row level security;
drop policy if exists portfolios_all on portfolios;
create policy portfolios_all on portfolios for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());
