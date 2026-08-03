-- add-sample-flag.sql
-- Marks demo/sample rows so the "Load sample pipeline" button can seed a realistic
-- workspace for a live presentation and remove it again in one click. Nullable-safe:
-- the app degrades gracefully before this runs (rows just can't be auto-cleared).
-- Idempotent.

alter table projects add column if not exists sample boolean not null default false;
alter table leads    add column if not exists sample boolean not null default false;

create index if not exists projects_sample_idx on projects(company_id) where sample;
create index if not exists leads_sample_idx    on leads(company_id)    where sample;

-- verify:
--   select count(*) from projects where sample;
