-- =====================================================================
-- VoltMira — Supabase/PostgreSQL schema  (run in Supabase SQL editor)
-- Multi-tenant: every business row carries company_id; RLS enforces it.
-- =====================================================================

-- ---------- Companies (tenants) ----------
create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_name  text default '',
  logo_url    text default '',
  default_market text not null default 'RO' check (default_market in ('RO','MD','DE')),
  currency    text not null default 'EUR' check (currency in ('EUR','RON','MDL')),
  lang        text not null default 'en' check (lang in ('en','ro','ru')),
  -- calculation engine settings (same shape as engine/defaultEngineSettings)
  engine      jsonb not null default '{}'::jsonb,
  subsidy_amount_ron numeric not null default 20000,
  prosumer_limit_kw  numeric not null default 10.8,
  plan        text not null default 'free' check (plan in ('free','pro','team')),
  -- email the owner when a client opens a proposal (throttled per proposal)
  notify_open boolean not null default true,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at  timestamptz not null default now()
);

-- ---------- Profiles (users ↔ company; extends auth.users) ----------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name       text not null default '',
  role       text not null default 'member' check (role in ('owner','member')),
  email      text not null default '',
  created_at timestamptz not null default now()
);
create index profiles_company_idx on profiles(company_id);

-- Helper: current user's company (used by every policy)
create or replace function my_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid()
$$;

-- ---------- Projects ----------
create table projects (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  owner_id    uuid references profiles(id) on delete set null,
  title       text not null default 'New quote',
  client_name text not null default '',
  address     text not null default '',
  lat         double precision,
  lon         double precision,
  market      text not null default 'RO' check (market in ('RO','MD','DE')),
  status      text not null default 'draft' check (status in ('draft','sent','won','lost')),
  -- system inputs (engine project shape)
  kw          numeric not null default 6,
  price       numeric not null default 0.21,
  cons        numeric not null default 5000,
  batt        boolean not null default false,
  use_monthly boolean not null default false,
  cons_monthly jsonb,                    -- [12 numbers] or null
  afm_subsidy boolean not null default false,
  loan_monthly numeric not null default 118,
  yield_per_kwp numeric,                 -- cached PVGIS result for this site
  monthly_yield_shape jsonb,             -- cached PVGIS monthly shape
  scenarios   jsonb not null default '[]'::jsonb,  -- up to 3 scenario variants
  next_follow_up date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index projects_company_idx on projects(company_id, updated_at desc);

-- ---------- Proposals (public share links) ----------
create table proposals (
  code        text primary key,                       -- short random slug in the URL
  project_id  uuid not null references projects(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  -- frozen snapshot of inputs at send time, so later edits don't change
  -- what the client was shown (professional integrity + audit trail)
  snapshot    jsonb not null,
  opens       int not null default 0,
  seconds     int not null default 0,
  batt_toggles int not null default 0,
  accepted_at timestamptz,
  last_open   timestamptz,
  -- last time we emailed the installer about an open (notification throttle)
  notify_last_at timestamptz,
  created_at  timestamptz not null default now()
);
create index proposals_project_idx on proposals(project_id);

-- ---------- Proposal events (append-only tracking log) ----------
create table proposal_events (
  id          bigint generated always as identity primary key,
  code        text not null references proposals(code) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  kind        text not null check (kind in ('open','heartbeat','toggle_batt','accept','request')),
  seconds     int default 0,
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index proposal_events_code_idx on proposal_events(code, created_at desc);

-- ---------- Leads ----------
create table leads (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  project_id  uuid references projects(id) on delete set null,
  name        text not null,
  email       text default '',
  phone       text default '',
  note        text default '',
  hot         boolean not null default false,
  source      text not null default 'widget' check (source in ('widget','proposal','manual')),
  created_at  timestamptz not null default now()
);
create index leads_company_idx on leads(company_id, created_at desc);

-- ---------- Activity feed ----------
create table activity (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references companies(id) on delete cascade,
  kind        text not null,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index activity_company_idx on activity(company_id, created_at desc);

-- ---------- PVGIS cache (shared across tenants — it's public geo data) ----------
create table pvgis_cache (
  key         text primary key,
  value       jsonb not null,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- Row-Level Security
-- =====================================================================
alter table companies       enable row level security;
alter table profiles        enable row level security;
alter table projects        enable row level security;
alter table proposals       enable row level security;
alter table proposal_events enable row level security;
alter table leads           enable row level security;
alter table activity        enable row level security;
alter table pvgis_cache     enable row level security;

-- Companies: members can read; only owners update
create policy companies_select on companies for select
  using (id = my_company_id());
create policy companies_update on companies for update
  using (id = my_company_id()
         and exists (select 1 from profiles where id = auth.uid() and role = 'owner'));

-- Profiles: see teammates; edit self; owners manage team
create policy profiles_select on profiles for select
  using (company_id = my_company_id());
create policy profiles_update_self on profiles for update
  using (id = auth.uid());
create policy profiles_owner_all on profiles for all
  using (company_id = my_company_id()
         and exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.role = 'owner'));

-- Projects / leads / activity: full CRUD within own company
create policy projects_all on projects for all
  using (company_id = my_company_id()) with check (company_id = my_company_id());
create policy leads_all on leads for all
  using (company_id = my_company_id()) with check (company_id = my_company_id());
create policy activity_all on activity for all
  using (company_id = my_company_id()) with check (company_id = my_company_id());

-- Proposals: installer reads/writes own; the PUBLIC reads via the API
-- (service role) only — no anonymous select policy on the raw table.
create policy proposals_all on proposals for all
  using (company_id = my_company_id()) with check (company_id = my_company_id());
create policy proposal_events_select on proposal_events for select
  using (company_id = my_company_id());
-- events are INSERTED by the server (service role bypasses RLS)

-- PVGIS cache: readable by any signed-in user; written by server only
create policy pvgis_read on pvgis_cache for select using (auth.role() = 'authenticated');

-- =====================================================================
-- updated_at trigger
-- =====================================================================
create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger projects_touch before update on projects
  for each row execute function touch_updated_at();

-- =====================================================================
-- Signup bootstrap: create a company + owner profile on first login.
-- Called from the app right after auth signup (see web/lib/bootstrap.ts).
-- =====================================================================
create or replace function bootstrap_company(company_name text, user_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    return my_company_id();
  end if;
  insert into companies (name) values (coalesce(nullif(company_name,''), 'My Solar Company'))
    returning id into cid;
  insert into profiles (id, company_id, name, role, email)
    values (auth.uid(), cid, coalesce(user_name,''), 'owner',
            coalesce((select email from auth.users where id = auth.uid()), ''));
  return cid;
end $$;

-- =====================================================================
-- Atomic proposal counters — avoids the read-then-write race when many
-- events arrive at once. Called by the public proposal tracking endpoint.
-- SECURITY DEFINER so the anon-keyed endpoint can bump counters without
-- opening the table to arbitrary writes.
-- =====================================================================
create or replace function bump_proposal_stat(p_code text, p_field text, p_by int default 1)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_field = 'opens' then
    update proposals set opens = opens + p_by, last_open = now() where code = p_code;
  elsif p_field = 'seconds' then
    update proposals set seconds = seconds + p_by where code = p_code;
  elsif p_field = 'batt_toggles' then
    update proposals set batt_toggles = batt_toggles + p_by where code = p_code;
  end if;
end $$;
