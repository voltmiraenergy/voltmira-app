-- add-signup-log.sql
-- A clean record of every real person who signs up, for the admin tab (/admin/signups). One paste: Supabase >
-- SQL Editor > New query, paste this whole file, Run. Safe to run again.
--
--   1. public.signup_log: one row per real account (the demo's accounts are never logged), written by the database
--      itself the moment an account is made, so it cannot be missed. The app adds the country and city when the
--      person first opens it (from the connection, never asked).
--   2. Everyone already signed up is added once.
-- Nobody but the server can read or write it: no policy for a signed-in user.

create table if not exists public.signup_log (
  user_id      uuid primary key,
  email        text not null,
  name         text not null default '',
  signed_up_at timestamptz not null default now(),
  provider     text not null default 'email',
  country      text,                    -- ISO code, e.g. MD, RO, UA (from the connection, set by the app)
  city         text,
  first_seen_at timestamptz,            -- the first time the person opened the app
  user_agent   text not null default ''
);
create index if not exists signup_log_at_idx on public.signup_log (signed_up_at desc);
alter table public.signup_log enable row level security;   -- no policy: the service role only

-- the database writes the row when an account is made; it must never break a sign-up
create or replace function public.log_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email ilike '%@demo.voltmira.com' then
    return new;
  end if;
  begin
    insert into public.signup_log (user_id, email, name, signed_up_at, provider)
    values (
      new.id, new.email,
      coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), ''),
      new.created_at,
      coalesce(new.raw_app_meta_data ->> 'provider', 'email')
    ) on conflict (user_id) do nothing;
  exception when others then
    null;   -- a failed log row never blocks the account
  end;
  return new;
end $$;
revoke all on function public.log_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_signup_log on auth.users;
create trigger on_auth_user_signup_log after insert on auth.users
  for each row execute function public.log_signup();

-- everyone already signed up
insert into public.signup_log (user_id, email, name, signed_up_at, provider)
select u.id, u.email,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', ''), ''),
  u.created_at, coalesce(u.raw_app_meta_data ->> 'provider', 'email')
from auth.users u
where u.email is not null and u.email not ilike '%@demo.voltmira.com'
on conflict (user_id) do nothing;

-- Check it worked (optional):
--   select count(*) from public.signup_log;
--   select email, name, country, signed_up_at from public.signup_log order by signed_up_at desc limit 10;
