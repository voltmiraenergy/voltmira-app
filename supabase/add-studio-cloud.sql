-- add-studio-cloud.sql
-- Studio stops living in one browser.
--
-- Until now every Studio tool (the job workspace, payments, monitoring, the
-- P50/P90 export, the lead widget panel) kept its data in localStorage: gone on
-- a cache clear, invisible on a second device, and the first thing a technical
-- due-diligence review would find. This table is where it lives instead.
--
-- One row per (company, key). The keys are the same ones Studio has always
-- used in localStorage ("voltmira_studio_jobs_v2", "voltmira_studio_pay_<job>",
-- …), so the client keeps its fast synchronous reads from a local cache and
-- writes through to here (app/(app)/studio/studio-sync.js). Nothing in the
-- Studio code had to change shape to move.
--
-- company_id defaults to the caller's company, so the browser can upsert
-- {key, value} without ever sending (or being able to forge) a company id.
-- Idempotent: safe to run twice.

create table if not exists studio_state (
  company_id  uuid not null default my_company_id() references companies(id) on delete cascade,
  key         text not null check (char_length(key) between 1 and 200),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (company_id, key)
);

-- A resized site photo is 20-60 KB; a whole job's worth stays far below this.
-- The cap only stops a runaway write from bloating the table.
alter table studio_state drop constraint if exists studio_state_size;
alter table studio_state add constraint studio_state_size check (pg_column_size(value) < 2000000);

create index if not exists studio_state_updated_idx on studio_state(company_id, updated_at desc);

alter table studio_state enable row level security;
drop policy if exists studio_state_all on studio_state;
create policy studio_state_all on studio_state for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());
