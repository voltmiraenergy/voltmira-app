-- run-pending-2026-09.sql
-- Everything built since September 25 that needs the database, in one paste.
-- Open Supabase > SQL Editor > New query, paste this whole file, press Run.
--
--   1. Studio in the cloud        (studio_state)
--   2. Inverter portals           (inverter_connections, inverter_secrets, inverter_stations)
--   3. Lead assistant             (agent_channels, agent_channel_secrets, agent_conversations)
--   4. Proposal assistant         (companies.negotiation, proposal_offers)
--   5. Moldova launch defaults    (new workspaces start in MD, MDL and Romanian)
--
-- Every part is safe to run again: tables and indexes use IF NOT EXISTS,
-- policies are dropped and recreated, functions are CREATE OR REPLACE. If a
-- part was already run, running it again changes nothing.
-- The same parts also exist as separate files in this folder.


-- ==========================================================================
-- 1. add-studio-cloud.sql
-- ==========================================================================

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


-- ==========================================================================
-- 2. add-inverter-portals.sql
-- ==========================================================================

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

-- production_readings.source gains the Growatt portal (only when that table
-- exists: it comes from add-production-readings.sql).
do $$
begin
  if to_regclass('public.production_readings') is not null then
    alter table production_readings drop constraint if exists production_readings_source_check;
    alter table production_readings add constraint production_readings_source_check
      check (source in ('manual','solarman','fusionsolar','solaredge','growatt','other'));
  end if;
end $$;


-- ==========================================================================
-- 3. add-lead-agent.sql
-- ==========================================================================

-- add-lead-agent.sql
-- The lead assistant's messaging channels (lib/leadAgent.js). The website chat
-- (/widget/chat) needs none of this; Telegram does, because a Telegram chat
-- has no browser to hold the conversation.
--
-- 1. agent_channels: an installer's connected bot (one per Telegram bot).
-- 2. agent_channel_secrets: its bot token, encrypted (lib/secretBox.js).
--    RLS on with NO policies: only the server (service role) can read it.
-- 3. agent_conversations: each chat's recent turns and the lead it produced.
--    Server-only as well: it holds homeowners' messages.
-- Safe to re-run.

create table if not exists agent_channels (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  kind         text not null check (kind in ('telegram')),
  bot_username text not null default '',
  status       text not null default 'ok' check (status in ('ok', 'error')),
  last_error   text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists agent_channels_company_idx on agent_channels(company_id);
alter table agent_channels enable row level security;
drop policy if exists agent_channels_read on agent_channels;
create policy agent_channels_read on agent_channels for select using (company_id = my_company_id());

create table if not exists agent_channel_secrets (
  channel_id  uuid primary key references agent_channels(id) on delete cascade,
  ciphertext  text not null
);
alter table agent_channel_secrets enable row level security;

create table if not exists agent_conversations (
  id                uuid primary key default gen_random_uuid(),
  channel_id        uuid not null references agent_channels(id) on delete cascade,
  company_id        uuid not null references companies(id) on delete cascade,
  chat_id           text not null,
  turns             jsonb not null default '[]'::jsonb,       -- [{ role, text }], last 12
  lead_id           uuid references leads(id) on delete set null,
  survey_requested  boolean not null default false,
  last_update_id    bigint,                                   -- Telegram redelivers slow updates; answer each once
  updated_at        timestamptz not null default now(),
  unique (channel_id, chat_id)
);
create index if not exists agent_conversations_company_idx on agent_conversations(company_id, updated_at desc);
alter table agent_conversations enable row level security;


-- ==========================================================================
-- 4. add-proposal-agent.sql
-- ==========================================================================

-- add-proposal-agent.sql
-- The proposal assistant (app/api/proposal/[code]/qa, lib/proposalAgent.js):
-- answers the client's questions on a live proposal and, when the installer
-- allows it, negotiates within limits they set.
--
-- 1. companies.negotiation: the installer's limits (Settings > Proposal
--    assistant). Off by default: { enabled, maxDiscountPct, allowOptions }.
-- 2. proposal_offers: what the assistant agreed on a proposal (a discount, a
--    switch to an attached option) and when it handed the client to a person.
--    Written only by the server (service role) after lib/negotiation.js has
--    checked it; the installer's team can read their own.
-- Safe to re-run.

alter table companies add column if not exists negotiation jsonb not null default '{}'::jsonb;

create table if not exists proposal_offers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references proposals(code) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  kind        text not null check (kind in ('discount', 'option', 'escalation')),
  pct         numeric check (pct is null or (pct > 0 and pct <= 15)),    -- discount only
  option_no   int,                                                       -- option only, 1-based
  detail      jsonb not null default '{}'::jsonb,                        -- reason, summary, figures at the time
  status      text not null default 'open' check (status in ('open', 'replaced', 'accepted', 'closed')),
  created_at  timestamptz not null default now()
);
create index if not exists proposal_offers_code_idx on proposal_offers(code, created_at desc);
create index if not exists proposal_offers_company_idx on proposal_offers(company_id, created_at desc);

alter table proposal_offers enable row level security;
drop policy if exists proposal_offers_read on proposal_offers;
create policy proposal_offers_read on proposal_offers for select
  using (company_id = my_company_id());
-- No insert/update/delete policies: only the server writes offers.


-- ==========================================================================
-- 5. md-launch-defaults.sql
-- ==========================================================================

-- md-launch-defaults.sql
-- VoltMira launches in Moldova first. A new workspace should start the way a
-- Moldovan installer works: market Moldova (net billing), prices in MDL, and
-- the app in Romanian, or in the language they signed up in.
--
-- Existing workspaces are untouched; each can still change market, currency
-- and language in Settings. Idempotent: safe to run more than once.
-- Supersedes md-default-market.sql (included here, so running only this is fine).

alter table companies alter column default_market set default 'MD';
alter table companies alter column currency       set default 'MDL';
alter table companies alter column lang           set default 'ro';
alter table projects  alter column market         set default 'MD';

-- The sign-up language, so a Russian-speaking installer who registers on the
-- Russian sign-in page gets the app in Russian. The two-argument version stays
-- for older clients and simply takes the table default above.
create or replace function bootstrap_company(company_name text, user_name text, company_lang text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    return my_company_id();
  end if;
  insert into companies (name, lang)
    values (coalesce(nullif(company_name,''), 'My Solar Company'),
            case when company_lang in ('ro','ru','en') then company_lang else 'ro' end)
    returning id into cid;
  insert into profiles (id, company_id, name, role, email)
    values (auth.uid(), cid, coalesce(user_name,''), 'owner',
            coalesce((select email from auth.users where id = auth.uid()), ''));
  return cid;
end $$;

revoke all on function bootstrap_company(text, text, text) from public;
grant execute on function bootstrap_company(text, text, text) to authenticated;
