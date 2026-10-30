-- add-rate-limits.sql
-- A rate limit shared by every serverless instance, in Postgres, for production without Upstash Redis
-- (lib/ratelimit.js). Run on STAGING first, then production. One paste: Supabase > SQL Editor > New query, paste
-- this whole file, Run. Safe to run again. Runs on its own; changes no other table.
--
--   rate_limits       one row per key (a route and a caller): how many hits in the current window, and when it ends
--   rate_limit_hit()  counts one hit and says whether the key is over its limit, in one atomic statement
--                     (insert ... on conflict do update), so two instances can never both read "under the limit"
--   Server only: no policy on the table (a user session reads and writes nothing), the function for the service role.
--
-- Rollback: drop function if exists public.rate_limit_hit(text, int, int); drop table if exists public.rate_limits;
-- (the app then counts per instance, as before.)

create table if not exists public.rate_limits (
  key       text primary key check (char_length(key) <= 200),
  n         int not null default 0,
  reset_at  timestamptz not null
);
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_ms int) returns boolean
language plpgsql as $$
declare
  hits int;
  win interval := make_interval(secs => greatest(p_window_ms, 1000) / 1000.0);
begin
  insert into public.rate_limits as r (key, n, reset_at) values (left(p_key, 200), 1, now() + win)
  on conflict (key) do update
    set n = case when r.reset_at <= now() then 1 else r.n + 1 end,
        reset_at = case when r.reset_at <= now() then now() + win else r.reset_at end
  returning n into hits;
  -- now and then, the windows long over go (keeps the table small without a cron)
  if random() < 0.001 then
    delete from public.rate_limits where reset_at < now() - interval '1 hour';
  end if;
  return hits > p_max;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Check it worked (read-only):
--   select has_function_privilege('anon', 'public.rate_limit_hit(text,int,int)', 'execute') as anon_can_call;  -- false
