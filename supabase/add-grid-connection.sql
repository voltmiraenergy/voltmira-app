-- add-grid-connection.sql
-- Phase 2, grid connection (docs/features/phase2.md). One paste: Supabase > SQL Editor > New query, paste this
-- whole file, Run. Safe to run again. Runs on its own; the parts for the grid submissions apply once
-- add-integrations.sql has created them (run that one too, in any order, then this one again).
--
--   1. What each operator asks for, versioned: the documents, how recent some must be, and how many days a file
--      may wait in each status. A platform admin publishes a new version at /admin/grid; nothing is ever edited
--      in place. Version 1 is the rules the code used until now.
--   2. On each submission: the issue dates of the documents that must be recent, any exception an owner or a
--      manager made with a written reason, the rules' version it was checked against, and the "meter installed"
--      status.
--   3. The client's language, for the messages they get at each step (on the quote, and on a lead from the
--      estimate page).

-- the append-only guard, also created by add-tariffs-subsidies.sql and add-integrations.sql
create or replace function refuse_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows are append-only: add a new version instead', tg_table_name;
end $$;

-- 1. the operators' requirements
create table if not exists grid_requirements (
  id             uuid primary key default gen_random_uuid(),
  operator       text not null check (operator in ('premier', 'rednord')),
  version        integer not null check (version >= 1),
  docs           jsonb not null,                       -- { person: [ids], company: [ids] }
  custom         jsonb not null default '{}'::jsonb,   -- { id: { name: { en, ro, ru, uk }, optional } }
  max_age_days   jsonb not null default '{}'::jsonb,   -- { doc id: days }
  expected_days  jsonb not null,                       -- { status: days }
  note           text not null default '' check (char_length(note) <= 1000),
  created_by     text not null default '' check (char_length(created_by) <= 200),
  created_at     timestamptz not null default now(),
  unique (operator, version)
);
alter table grid_requirements enable row level security;
drop policy if exists grid_requirements_read on grid_requirements;
create policy grid_requirements_read on grid_requirements for select to authenticated using (true);
drop trigger if exists grid_requirements_append_only on grid_requirements;
create trigger grid_requirements_append_only before update or delete on grid_requirements
  for each row execute function refuse_change();

insert into grid_requirements (operator, version, docs, custom, max_age_days, expected_days, note, created_by)
select op, 1,
  '{"person": ["application", "signed", "id_copy", "property", "authorization"],
    "company": ["application", "signed", "registry_extract", "property", "site_sketch", "owner_consent", "authorization"]}'::jsonb,
  '{}'::jsonb,
  '{"registry_extract": 90}'::jsonb,
  '{"submitted": 10, "docs_requested": 10, "approved": 30, "meter_installed": 14}'::jsonb,
  'The rules the code used until this table existed.', 'seed'
from unnest(array['premier', 'rednord']) as op
on conflict (operator, version) do nothing;

-- 2. the submissions (only once add-integrations.sql has created them)
do $$
begin
  if to_regclass('public.grid_submissions') is not null then
    alter table public.grid_submissions add column if not exists overrides jsonb not null default '[]'::jsonb;
    alter table public.grid_submissions add column if not exists doc_dates jsonb not null default '{}'::jsonb;
    alter table public.grid_submissions add column if not exists rules_version integer not null default 0;
    alter table public.grid_submissions drop constraint if exists grid_submissions_status_check;
    alter table public.grid_submissions add constraint grid_submissions_status_check
      check (status in ('submitted', 'docs_requested', 'approved', 'meter_installed', 'connected', 'rejected'));
    create index if not exists grid_submissions_company_idx on public.grid_submissions (company_id, status);
  end if;
  if to_regclass('public.grid_submission_events') is not null then
    create index if not exists grid_submission_events_sub_idx on public.grid_submission_events (submission_id, created_at);
  end if;
end $$;

-- 3. the client's language
alter table public.projects add column if not exists client_lang text;
alter table public.projects drop constraint if exists projects_client_lang_check;
alter table public.projects add constraint projects_client_lang_check check (client_lang is null or client_lang in ('en', 'ro', 'ru', 'uk'));
alter table public.leads add column if not exists lang text;
alter table public.leads drop constraint if exists leads_lang_check;
alter table public.leads add constraint leads_lang_check check (lang is null or lang in ('en', 'ro', 'ru', 'uk'));

-- Check it worked (optional):
--   select operator, version, expected_days from grid_requirements order by operator, version;
