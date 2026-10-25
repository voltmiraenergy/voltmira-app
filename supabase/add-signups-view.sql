-- add-signups-view.sql
-- Who is signing up, readable at a glance. One paste: Supabase > SQL Editor > New query, paste this whole file, Run.
-- Safe to run again. Changes no table and no data: three read-only views in their own schema, `admin`.
--
-- Why not tidy `profiles` itself: it is small (one row per person in a workspace), but every /demo visit adds four
-- demo accounts that live up to 24 hours, invited teammates sit next to new installers, and someone who signed up
-- but never finished creating their company has no profile row at all. The views below start from the sign-in
-- accounts (auth.users), leave the demo out, and say what each one is.
--
-- Where to look afterwards:
--   Table Editor > schema "admin" (the dropdown at the top left) > signups, signups_by_day, signups_summary
--   or in the SQL Editor:  select * from admin.signups_summary;
--
-- The `admin` schema is not served by the API (only `public` is), and anon / signed-in users get no access to it:
-- these views read auth.users, so they are for you in the dashboard only.

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- 1. every real account, newest first
create or replace view admin.signups as
select
  u.email,
  coalesce(nullif(p.name, ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '') as name,
  c.name as company,
  case
    when p.id is null then 'did not finish'          -- signed up, never created the company
    when p.role = 'owner' then 'new workspace'
    else 'invited teammate'
  end as kind,
  (u.created_at at time zone 'Europe/Chisinau')::timestamp(0) as signed_up,
  (u.last_sign_in_at at time zone 'Europe/Chisinau')::timestamp(0) as last_sign_in,
  u.email_confirmed_at is not null as email_confirmed,
  coalesce(u.raw_app_meta_data ->> 'provider', 'email') as signed_up_with,
  (select count(*) from public.projects pr where pr.company_id = c.id and not pr.sample) as quotes,
  (select count(*) from public.projects pr where pr.company_id = c.id and pr.status = 'won' and not pr.sample) as signed_jobs,
  c.lang as language,
  u.id as user_id,
  c.id as company_id
from auth.users u
left join public.profiles p on p.id = u.id
left join public.companies c on c.id = p.company_id
where u.email not ilike '%@demo.voltmira.com'
order by u.created_at desc;

-- 2. one row per day (Chișinău), newest first, with the running total of workspaces
create or replace view admin.signups_by_day as
select
  s.signed_up::date as day,
  count(*) as accounts,
  count(*) filter (where s.kind = 'new workspace') as new_workspaces,
  count(*) filter (where s.kind = 'invited teammate') as teammates,
  count(*) filter (where s.kind = 'did not finish') as did_not_finish,
  sum(count(*) filter (where s.kind = 'new workspace')) over (order by s.signed_up::date) as workspaces_so_far
from admin.signups s
group by s.signed_up::date
order by day desc;

-- 3. the numbers in one row
create or replace view admin.signups_summary as
with t as (select (now() at time zone 'Europe/Chisinau')::date as today)
select
  count(*) filter (where s.kind = 'new workspace') as workspaces_total,
  count(*) filter (where s.kind = 'new workspace' and s.signed_up >= t.today) as workspaces_today,
  count(*) filter (where s.kind = 'new workspace' and s.signed_up >= t.today - 6) as workspaces_last_7_days,
  count(*) filter (where s.kind = 'new workspace' and s.signed_up >= t.today - 29) as workspaces_last_30_days,
  count(*) filter (where s.kind = 'new workspace' and s.quotes > 0) as workspaces_with_a_quote,
  count(*) filter (where s.kind = 'new workspace' and s.signed_jobs > 0) as workspaces_with_a_signed_job,
  count(*) filter (where s.kind = 'invited teammate') as teammates_total,
  count(*) filter (where s.kind = 'did not finish') as did_not_finish_total,
  -- demo workspaces live 24 hours (the daily clean-up), so this is roughly the last day's /demo visits
  (select count(*) from public.profiles d where d.role = 'owner' and d.email ilike '%@demo.voltmira.com') as demo_visits_last_24h
from admin.signups s, t
group by t.today;

-- Check it worked (optional):
--   select * from admin.signups_summary;
--   select * from admin.signups_by_day limit 14;
--   select email, company, kind, signed_up, quotes from admin.signups limit 20;
