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
