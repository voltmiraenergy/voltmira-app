-- add-inverter-portals.sql
-- Monthly production read straight from the inverter makers' clouds
-- (Huawei FusionSolar, Solarman for Deye and others, Growatt) instead of being
-- typed in by hand. The readings land in production_readings, which is what
-- the dashboard's system health and the quote editor's yield calibration
-- already read, and in the linked Studio job's monitoring data.
--
-- Three tables:
--   inverter_connections  one per portal account; company members can SEE it
--   inverter_secrets      the account's credentials, AES-256-GCM encrypted
--                         (lib/secretBox.js) — RLS on with NO policies, so only
--                         the server's service role can read or write it. The
--                         browser never receives a credential, even encrypted.
--   inverter_stations     the systems that account can see, each optionally
--                         linked to a quote (projects) or a Studio job
--
-- All writes go through the server routes (app/api/inverters/*), which check
-- the caller's company and role first; members only get SELECT here.
-- Idempotent: safe to run twice. Needs add-production-readings.sql first.

create table if not exists inverter_connections (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  provider      text not null check (provider in ('fusionsolar','solarman','growatt')),
  label         text not null default '',
  account_hint  text not null default '',          -- masked login, for display only
  status        text not null default 'new' check (status in ('new','ok','error')),
  last_sync_at  timestamptz,
  last_error    text,
  last_error_code text,                             -- what the app translates: auth, rate_limited, network, key_changed…
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists inverter_connections_company_idx on inverter_connections(company_id);

create table if not exists inverter_secrets (
  connection_id uuid primary key references inverter_connections(id) on delete cascade,
  ciphertext    text not null
);

create table if not exists inverter_stations (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  connection_id  uuid not null references inverter_connections(id) on delete cascade,
  external_id    text not null,                    -- the portal's own station id
  name           text not null default '',
  capacity_kw    numeric,
  project_id     uuid references projects(id) on delete set null,
  studio_job_id  text,
  last_month     date,                             -- newest complete month read
  last_kwh       numeric,
  last_error     text,
  last_error_code text,
  updated_at     timestamptz not null default now(),
  unique (connection_id, external_id)
);
create index if not exists inverter_stations_company_idx on inverter_stations(company_id);

alter table inverter_connections enable row level security;
alter table inverter_secrets     enable row level security;   -- no policies: service role only
alter table inverter_stations    enable row level security;

drop policy if exists inverter_connections_read on inverter_connections;
create policy inverter_connections_read on inverter_connections for select
  using (company_id = my_company_id());
drop policy if exists inverter_stations_read on inverter_stations;
create policy inverter_stations_read on inverter_stations for select
  using (company_id = my_company_id());

-- production_readings.source gains the Growatt portal.
alter table production_readings drop constraint if exists production_readings_source_check;
alter table production_readings add constraint production_readings_source_check
  check (source in ('manual','solarman','fusionsolar','solaredge','growatt','other'));
