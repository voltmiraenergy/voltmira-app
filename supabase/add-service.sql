-- add-service.sql
-- Phase 5, after the handover (docs/features/phase5.md): the client's requests, the yearly check and the warranties
-- of each installed system. One paste: Supabase > SQL Editor > New query, paste this whole file, Run. Safe to run
-- again. Run it after add-jobs-board.sql (it adds the "maintenance" visit kind to crew_visits).
--
--   1. companies: the working days to answer a request, the months between checks, the client's check reminder.
--   2. projects: the client's "report a problem" link, checks on or off for the job.
--   3. service_requests and service_request_events: a request and every change to it.
--   4. service_photos and the private bucket service-photos: the photos sent with a request.
--   5. maintenance_checks: each yearly check done (or planned, with its visit).
--   6. warranties: what was set by hand for a system (the rest come from the catalog and the workspace).
--   7. service_reminders: which reminder went out, so none goes twice.
--   8. crew_visits: the "maintenance" kind.
-- Each workspace reads its own rows; the server writes them.

-- 1. the workspace's settings
alter table public.companies add column if not exists service_reply_days smallint not null default 2;
alter table public.companies add column if not exists maintenance_months smallint not null default 12;
alter table public.companies add column if not exists maintenance_client_reminder boolean not null default true;
alter table public.companies drop constraint if exists companies_service_reply_days_check;
alter table public.companies add constraint companies_service_reply_days_check check (service_reply_days between 1 and 10);
alter table public.companies drop constraint if exists companies_maintenance_months_check;
alter table public.companies add constraint companies_maintenance_months_check check (maintenance_months between 3 and 36);

-- 2. the job's link and checks
alter table public.projects add column if not exists service_token text;
create unique index if not exists projects_service_token_key on public.projects (service_token) where service_token is not null;
alter table public.projects add column if not exists maintenance_off boolean not null default false;

-- 3. the requests
create table if not exists service_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  source          text not null check (source in ('client', 'installer')),
  kind            text not null check (kind in ('no_production', 'inverter_error', 'damage', 'roof_leak', 'other')),
  description     text not null check (char_length(description) between 3 and 2000),
  contact_name    text not null default '' check (char_length(contact_name) <= 120),
  contact_phone   text not null default '' check (char_length(contact_phone) <= 24),
  status          text not null default 'new' check (status in ('new', 'planned', 'in_progress', 'resolved', 'closed')),
  visit_id        uuid,
  first_reply_at  timestamptz,
  resolved_at     timestamptz,
  resolution      text not null default '' check (char_length(resolution) <= 2000),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists service_requests_company_idx on service_requests (company_id, status, created_at desc);
create index if not exists service_requests_project_idx on service_requests (project_id, created_at desc);
alter table service_requests enable row level security;
drop policy if exists service_requests_read on service_requests;
create policy service_requests_read on service_requests for select using (company_id = my_company_id());

create table if not exists service_request_events (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references service_requests(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  actor        text not null default '' check (char_length(actor) <= 160),
  from_status  text,
  to_status    text,
  note         text not null default '' check (char_length(note) <= 2000),
  created_at   timestamptz not null default now()
);
create index if not exists service_request_events_idx on service_request_events (request_id, created_at);
alter table service_request_events enable row level security;
drop policy if exists service_request_events_read on service_request_events;
create policy service_request_events_read on service_request_events for select using (company_id = my_company_id());

-- 4. the photos: private, 8 MB each, images only; written and read through the server
create table if not exists service_photos (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references service_requests(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  path        text not null unique,
  created_at  timestamptz not null default now()
);
alter table service_photos enable row level security;
drop policy if exists service_photos_read on service_photos;
create policy service_photos_read on service_photos for select using (company_id = my_company_id());
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-photos', 'service-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 5. the yearly checks
create table if not exists maintenance_checks (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  due_on      date not null,
  visit_id    uuid,
  done_on     date,
  note        text not null default '' check (char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  unique (project_id, due_on)
);
create index if not exists maintenance_checks_company_idx on maintenance_checks (company_id, done_on);
alter table maintenance_checks enable row level security;
drop policy if exists maintenance_checks_read on maintenance_checks;
create policy maintenance_checks_read on maintenance_checks for select using (company_id = my_company_id());

-- 6. the warranties set by hand
create table if not exists warranties (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  item        text not null check (item in ('panels', 'performance', 'inverter', 'battery', 'install')),
  product     text not null default '' check (char_length(product) <= 160),
  years       numeric(4, 1) check (years is null or (years > 0 and years <= 40)),
  starts_on   date,
  note        text not null default '' check (char_length(note) <= 500),
  updated_at  timestamptz not null default now(),
  unique (project_id, item)
);
alter table warranties enable row level security;
drop policy if exists warranties_read on warranties;
create policy warranties_read on warranties for select using (company_id = my_company_id());

-- 7. the reminders sent
create table if not exists service_reminders (
  key      text primary key check (char_length(key) <= 200),   -- e.g. "check-client:<project>:<due day>"
  sent_at  timestamptz not null default now()
);
alter table service_reminders enable row level security;

-- 8. the yearly check as a visit kind (crew_visits comes from add-jobs-board.sql; skipped quietly before it)
do $$
begin
  if to_regclass('public.crew_visits') is not null then
    alter table public.crew_visits drop constraint if exists crew_visits_kind_check;
    alter table public.crew_visits add constraint crew_visits_kind_check check (kind in ('survey', 'install', 'service', 'maintenance', 'other'));
  end if;
end $$;

-- Check it worked (optional):
--   select count(*) from service_requests;
--   select id, public from storage.buckets where id = 'service-photos';
