-- add-security-hardening.sql
-- One paste: Supabase > SQL Editor > New query, paste this whole file, Run.
-- Safe to run again. Runs on its own (it defines the two helpers it uses).
--
--   1. The link a signed client shares with friends (/r/...) used to be the offer's own
--      code, which opens the whole offer: name, address, price, equipment and the PDF.
--      Each offer now gets a random referral_token; the app shares that, and it opens
--      nothing else. Links already shared with the old code stop working once this is run.
--
--   2. A signed offer cannot be rewritten by an installer's session any more: its
--      snapshot (price, kW, warranty) and identity are frozen once accepted_at is set,
--      for calls made with a user's session (the browser, the anon key). The server and
--      this editor are not affected, nor is refreshing an offer that is not yet signed.
--
--   3. A member cannot give themselves the manager title straight through the API
--      (profiles.title), and nobody can change an offer's referral token.
--
--   4. bump_proposal_stat (the open/time counters) was callable by anyone holding the
--      public anon key, with a negative number: it is for the server only.

-- the shared helpers (defined in lock-down-2026-09-28.sql as well; same text)
create or replace function is_user_session() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) in ('authenticated', 'anon')
$$;

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

-- 1. the referral token
alter table proposals add column if not exists referral_token text;
update proposals set referral_token = replace(gen_random_uuid()::text, '-', '') where referral_token is null;
alter table proposals alter column referral_token set default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists proposals_referral_token_key on proposals (referral_token);

-- 2. a signed offer is frozen
create or replace function lock_signed_proposal() returns trigger
language plpgsql as $$
begin
  if is_user_session() and old.accepted_at is not null and (
       new.snapshot   is distinct from old.snapshot
    or new.code       is distinct from old.code
    or new.project_id is distinct from old.project_id
    or new.company_id is distinct from old.company_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'A signed proposal cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists proposals_lock_signed on proposals;
create trigger proposals_lock_signed before update on proposals
  for each row execute function lock_signed_proposal();

-- 3. the signature columns now include the referral token; a profile's title is the server's to set
drop trigger if exists proposals_lock_signature on proposals;
create trigger proposals_lock_signature before update on proposals
  for each row execute function lock_columns('accepted_at', 'signature',
    'signer_name', 'signed_ip', 'signed_ua', 'referral_token');

drop trigger if exists profiles_lock_identity on profiles;
create trigger profiles_lock_identity before update on profiles
  for each row execute function lock_columns('id', 'company_id', 'role', 'email', 'title');

-- 4. the counters are for the server only
revoke all on function bump_proposal_stat(text, text, integer) from public, anon, authenticated;
grant execute on function bump_proposal_stat(text, text, integer) to service_role;

-- Check it worked (optional):
--   select count(*) filter (where referral_token is null) as without_token from proposals;   -- 0
--   select tgname from pg_trigger where tgname in ('proposals_lock_signed', 'proposals_lock_signature', 'profiles_lock_identity');
