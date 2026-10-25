-- add-jobs-board.sql
-- Phase 3, the jobs board, crews and the on-site record (docs/features/phase3.md). One paste: Supabase > SQL Editor >
-- New query, paste this whole file, Run. Safe to run again. Runs on its own: no other pending file is needed first.
--
--   1. crews: a workspace's install crews (name, people, colour).
--   2. crew_visits: a crew's visit to a job (survey, installation, service) with its time, and whether the client is
--      told by email.
--   3. job_site: what the crew records on site for a won job: the checklist, the serial numbers, the client's
--      signature, with a version so a phone that was offline merges instead of overwriting.
--   4. job_photos and the private bucket "job-photos": the site photos, full size, under <company_id>/<project_id>/.
-- Each workspace reads and writes only its own rows and files.

-- 1. crews
create table if not exists crews (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default my_company_id() references companies(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  members     text not null default '' check (char_length(members) <= 200),
  color       text not null default '#1e6b4e' check (color ~ '^#[0-9a-f]{6}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists crews_company_idx on crews (company_id, active);
alter table crews enable row level security;
drop policy if exists crews_all on crews;
create policy crews_all on crews for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 2. visits
create table if not exists crew_visits (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null default my_company_id() references companies(id) on delete cascade,
  project_id     uuid not null references projects(id) on delete cascade,
  crew_id        uuid references crews(id) on delete set null,
  kind           text not null check (kind in ('survey', 'install', 'service', 'other')),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  note           text not null default '' check (char_length(note) <= 500),
  notify_client  boolean not null default true,
  notified_at    timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists crew_visits_company_idx on crew_visits (company_id, starts_at);
create index if not exists crew_visits_project_idx on crew_visits (project_id, starts_at);
alter table crew_visits enable row level security;
drop policy if exists crew_visits_all on crew_visits;
create policy crew_visits_all on crew_visits for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 3. the on-site record
create table if not exists job_site (
  project_id  uuid primary key references projects(id) on delete cascade,
  company_id  uuid not null default my_company_id() references companies(id) on delete cascade,
  record      jsonb not null default '{}'::jsonb,
  version     integer not null default 0,
  updated_by  text not null default '' check (char_length(updated_by) <= 120),
  updated_at  timestamptz not null default now()
);
alter table job_site enable row level security;
drop policy if exists job_site_all on job_site;
create policy job_site_all on job_site for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 4. the photos
create table if not exists job_photos (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default my_company_id() references companies(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  slot        text not null check (slot in ('roof', 'array', 'inverter', 'board', 'meter', 'labels', 'other')),
  path        text not null unique,
  client_id   text not null unique check (char_length(client_id) between 8 and 64),   -- the device's id: sent twice, kept once
  taken_at    timestamptz,
  taken_by    text not null default '' check (char_length(taken_by) <= 120),
  created_at  timestamptz not null default now()
);
create index if not exists job_photos_project_idx on job_photos (project_id, created_at);
alter table job_photos enable row level security;
drop policy if exists job_photos_all on job_photos;
create policy job_photos_all on job_photos for all using (company_id = my_company_id()) with check (company_id = my_company_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists job_photos_read on storage.objects;
create policy job_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = my_company_id()::text);
drop policy if exists job_photos_insert on storage.objects;
create policy job_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = my_company_id()::text);
drop policy if exists job_photos_delete on storage.objects;
create policy job_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = my_company_id()::text);

-- Check it worked (optional):
--   select id, public from storage.buckets where id = 'job-photos';
