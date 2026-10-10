-- run-pending-2026-09-29.sql
-- Everything since run-pending-2026-09.sql, in one paste.
-- Supabase > SQL Editor > New query, paste this whole file, Run.
--
--   1. Security lock-down (fixes the Team page error too)
--   2. Site visits on leads
--   3. Ukraine: the language, the UA market, the hryvnia and the outage plan
--   4. Portfolios: grouping quotes for lenders and funds
--
-- Every part is safe to run again. They also exist as separate files.


-- ==========================================================================
-- 1. lock-down-2026-09-28.sql
-- ==========================================================================

-- lock-down-2026-09-28.sql
-- One paste: Supabase > SQL Editor > New query, paste this whole file, Run.
-- Safe to run again (every step drops and recreates, or is IF EXISTS).
--
-- Replaces fix-profiles-rls.sql. Do NOT run that file on its own: dropping
-- the recursive policy by itself opens the hole described in part 2.
--
--   1. Team page / New quote error "infinite recursion detected in policy for
--      relation profiles" (42P17). The owner policy on profiles queried
--      profiles inside its own check. It is dropped; the app already manages
--      the team server-side (app/api/team), so nothing depended on it.
--
--   2. A signed-in user could rewrite their own profile row straight through
--      the Supabase API: set role = 'owner', or set company_id to another
--      workspace's id (every lead widget embed shows it, /widget?c=...) and
--      read that installer's whole pipeline. Until now the recursion in part 1
--      made every such write fail with an error; with part 1 fixed it would
--      have worked. Who you are (id, company, role, email) can now only be
--      changed by the server.
--
--   3. The same for a workspace's plan and billing ids (an owner could have
--      set plan = 'enterprise' without paying) and for a client's signature
--      on a proposal (accepted_at, the drawn signature, name, IP, browser),
--      which only the public accept endpoint may write.
--
-- The app writes all of these with the service role, which these checks let
-- through, as does the SQL editor. Only calls made with a user's session (the
-- browser, the anon key) are refused.

-- --------------------------------------------------------------------------
-- The shared check: is this statement coming from a user's session?
-- --------------------------------------------------------------------------
create or replace function is_user_session() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) in ('authenticated', 'anon')
$$;

-- One trigger function for all three tables: the columns to protect are
-- passed as trigger arguments. Comparing through to_jsonb means a column an
-- older database never got (say the Paddle ids) is simply skipped, instead of
-- breaking every update of the table.
create or replace function lock_columns() returns trigger
language plpgsql as $$
declare
  k text;
begin
  if not is_user_session() then
    return new;
  end if;
  foreach k in array tg_argv loop
    if to_jsonb(new) -> k is distinct from to_jsonb(old) -> k then
      raise exception 'Only the server can change %.%', tg_table_name, k
        using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- --------------------------------------------------------------------------
-- 1 + 2. profiles
-- --------------------------------------------------------------------------
drop policy if exists profiles_owner_all on profiles;

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and company_id = my_company_id());

drop trigger if exists profiles_lock_identity on profiles;
create trigger profiles_lock_identity before update on profiles
  for each row execute function lock_columns('id', 'company_id', 'role', 'email');

-- --------------------------------------------------------------------------
-- 3a. companies: plan and billing
-- --------------------------------------------------------------------------
drop trigger if exists companies_lock_billing on companies;
create trigger companies_lock_billing before update on companies
  for each row execute function lock_columns('id', 'plan',
    'paddle_customer_id', 'paddle_subscription_id',
    'stripe_customer_id', 'stripe_subscription_id', 'referred_by');

-- --------------------------------------------------------------------------
-- 3b. proposals: the client's signature
-- --------------------------------------------------------------------------
drop trigger if exists proposals_lock_signature on proposals;
create trigger proposals_lock_signature before update on proposals
  for each row execute function lock_columns('accepted_at', 'signature',
    'signer_name', 'signed_ip', 'signed_ua');

-- --------------------------------------------------------------------------
-- Check it worked (optional). Both should list the new triggers, and the
-- first should no longer show profiles_owner_all.
--   select policyname from pg_policies where tablename = 'profiles';
--   select tgname from pg_trigger where tgname like '%_lock_%';
-- --------------------------------------------------------------------------


-- ==========================================================================
-- 2. add-lead-visits.sql
-- ==========================================================================

-- add-lead-visits.sql
-- A site visit on a lead: the date and time the installer goes to measure the
-- roof. Shown on the lead, on the dashboard (today, tomorrow, and "the visit
-- happened, send the quote"), and exported to the phone's calendar.
-- Safe to run twice.

alter table leads add column if not exists visit_at timestamptz;
create index if not exists leads_company_visit_idx on leads(company_id, visit_at)
  where visit_at is not null;


-- ==========================================================================
-- 3. add-ukrainian.sql
-- ==========================================================================

-- add-ukrainian.sql
-- Ukraine as a place to work in: the Ukrainian language, the UA market (green
-- tariff, oblenergo paperwork, outage plan) and the hryvnia. Until this runs,
-- the database refuses 'uk', 'UA' and 'UAH', and Settings says so. Safe to run twice.

-- the interface language
alter table companies drop constraint if exists companies_lang_check;
alter table companies add constraint companies_lang_check
  check (lang in ('en','ro','ru','uk'));

-- the country a workspace quotes in, and each quote's own market
alter table companies drop constraint if exists companies_default_market_check;
alter table companies add constraint companies_default_market_check
  check (default_market in ('RO','MD','UA'));
alter table projects drop constraint if exists projects_market_check;
alter table projects add constraint projects_market_check
  check (market in ('RO','MD','UA'));

-- the display currency
alter table companies drop constraint if exists companies_currency_check;
alter table companies add constraint companies_currency_check
  check (currency in ('EUR','RON','MDL','UAH'));

-- A Ukrainian quote's outage and loan plan (components/UaPanel.jsx): typical
-- outage hours, what stays on, generator size, Energy Credit term. Frozen into
-- the proposal with everything else.
alter table projects add column if not exists ua_plan jsonb not null default '{}'::jsonb;

-- the landing-page waitlist, where it exists
do $$
begin
  if to_regclass('public.waitlist') is not null then
    alter table waitlist drop constraint if exists waitlist_lang_check;
    alter table waitlist add constraint waitlist_lang_check
      check (lang in ('en','ro','ru','uk'));
  end if;
end $$;

-- The sign-up language. An installer who registers on the Ukrainian sign-in
-- page starts in Ukraine: Ukrainian, the UA market and hryvnia (all three can
-- be changed in Settings). Everyone else keeps the Moldovan defaults from
-- md-launch-defaults.sql.
create or replace function bootstrap_company(company_name text, user_name text, company_lang text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    return my_company_id();
  end if;
  if company_lang = 'uk' then
    insert into companies (name, lang, default_market, currency)
      values (coalesce(nullif(company_name,''), 'My Solar Company'), 'uk', 'UA', 'UAH')
      returning id into cid;
  else
    insert into companies (name, lang)
      values (coalesce(nullif(company_name,''), 'My Solar Company'),
              case when company_lang in ('ro','ru','en') then company_lang else 'ro' end)
      returning id into cid;
  end if;
  insert into profiles (id, company_id, name, role, email)
    values (auth.uid(), cid, coalesce(user_name,''), 'owner',
            coalesce((select email from auth.users where id = auth.uid()), ''));
  return cid;
end $$;

revoke all on function bootstrap_company(text, text, text) from public;
grant execute on function bootstrap_company(text, text, text) to authenticated;


-- ==========================================================================
-- 4. add-portfolios.sql
-- ==========================================================================

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
