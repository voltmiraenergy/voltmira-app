-- add-fee-integrity.sql
-- The fee for signed jobs, made safe under concurrency (2026-10-30 hardening). Run on STAGING first, then on
-- production, after add-job-fees.sql and add-fee-lockdown.sql (and after supabase/check-security.sql says both are
-- in). One paste: Supabase > SQL Editor > New query, paste this whole file, Run. Safe to run again. Changes no data.
--
--   1. job_fees_free_guard: at most 2 free jobs per company, enforced by the database itself. Before a fee is
--      written as free, the company's free jobs are counted under an advisory lock taken on the workspace and on its
--      tax id (IDNO), so two jobs signed at the same moment, or from two workspaces of one company, cannot both take
--      the last free slot. A third is refused with "free_jobs_used"; the app then writes the fee as due
--      (lib/jobFeeServer.js ensureJobFee). Applies to every writer, the app's service role included.
--   2. job_fee_record_paperwork(): puts a document on the fee's record in one statement, and only while the fee is
--      not void, so a document and a cancellation at the same moment cannot both win (lib/jobFeeServer.js
--      recordPaperwork). Server only.
--
-- Rollback (if ever needed; the app keeps working without both, with the weaker app-only checks):
--   drop trigger if exists job_fees_free_guard on public.job_fees;
--   drop function if exists public.job_fees_free_guard();
--   drop function if exists public.job_fee_record_paperwork(uuid, text);

-- 1. at most 2 free jobs per company (tax id), whatever writes the row
create or replace function public.job_fees_free_guard() returns trigger
language plpgsql as $$
declare
  used int;
begin
  if new.free_slot is null then
    return new;
  end if;
  -- an update that keeps a free fee free in the same workspace and under the same tax id changes nothing counted
  if tg_op = 'UPDATE' and old.free_slot is not null
     and new.company_id is not distinct from old.company_id
     and new.idno is not distinct from old.idno then
    return new;
  end if;
  -- always the workspace first, then the tax id: one order everywhere, so two writers never wait on each other
  -- in a circle. Held until the transaction ends, so the count below sees every free job committed before it.
  if new.company_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('vm_free_jobs:c:' || new.company_id::text, 0));
  end if;
  if new.idno is not null then
    perform pg_advisory_xact_lock(hashtextextended('vm_free_jobs:i:' || new.idno, 0));
  end if;
  select count(*) into used
    from public.job_fees f
   where f.free_slot is not null
     and f.id <> new.id
     and (f.company_id = new.company_id or (new.idno is not null and f.idno = new.idno));
  if used >= 2 then
    raise exception 'free_jobs_used: this company has had its 2 free jobs' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists job_fees_free_guard on public.job_fees;
create trigger job_fees_free_guard before insert or update of free_slot, company_id, idno on public.job_fees
  for each row execute function public.job_fees_free_guard();

-- 2. a document on the fee's record, never on a void fee
create or replace function public.job_fee_record_paperwork(p_fee uuid, p_kind text) returns boolean
language sql as $$
  with u as (
    update public.job_fees
       set docs_kinds = array(select distinct k from unnest(coalesce(docs_kinds, '{}'::text[]) || left(p_kind, 40)) as k order by k),
           docs_at = coalesce(docs_at, now())
     where id = p_fee and status <> 'void'
     returning 1
  )
  select exists (select 1 from u)
$$;
revoke all on function public.job_fee_record_paperwork(uuid, text) from public, anon, authenticated;
grant execute on function public.job_fee_record_paperwork(uuid, text) to service_role;

-- Check it worked (read-only):
--   select tgname from pg_trigger where tgname = 'job_fees_free_guard';
--   select has_function_privilege('authenticated', 'public.job_fee_record_paperwork(uuid,text)', 'execute') as users_can_call; -- false
