-- add-fee-lockdown.sql
-- The fee for signed jobs cannot be dodged (docs/features/fee-lockdown.md). One paste: Supabase > SQL Editor >
-- New query, paste this whole file, Run. Safe to run again. Run it after add-job-fees.sql.
--
--   1. job_fees keeps when the first paperwork was made for the job (cancelling is free only before it), the job's
--      name (so a fee outlives a deleted job), and a request to VoltMira to waive it.
--   2. A fee is no longer deleted with its job: the job's row can go, the fee stays.
--   3. The company tax id must have a valid check digit (an invented IDNO no longer passes).
--   4. fee_hold_level(): how far a workspace is held for an unpaid statement (1 paperwork, 2 no new offers after
--      30 days late, 3 read-only after 60), and the row rules that enforce 2 and 3 in the database itself.
--   5. The statement reminders for the 30 and 60 day steps.
--   6. A fee and a statement outlive a deleted workspace (the free jobs stay counted on its tax id).
--   7. projects.won_at: stamped by the database the moment a job turns signed, whatever wrote the status, so the
--      daily check finds a signed job that has no fee (and never charges a job signed before fees existed).

-- 1. what the fee keeps
alter table public.job_fees add column if not exists docs_at timestamptz;
alter table public.job_fees add column if not exists docs_kinds text[] not null default '{}';
alter table public.job_fees add column if not exists project_title text not null default '';
alter table public.job_fees add column if not exists client_name text not null default '';
alter table public.job_fees add column if not exists waiver_reason text not null default '' check (char_length(waiver_reason) <= 500);
alter table public.job_fees add column if not exists waiver_requested_at timestamptz;
-- the names of the jobs that already have a fee
update public.job_fees f set project_title = coalesce(p.title, ''), client_name = coalesce(p.client_name, '')
  from public.projects p where p.id = f.project_id and f.project_title = '';

-- 2. a fee outlives its job
alter table public.job_fees alter column project_id drop not null;
alter table public.job_fees drop constraint if exists job_fees_project_id_fkey;
alter table public.job_fees add constraint job_fees_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;

-- 3. a real IDNO: 13 digits, the last one the check digit (weights 7, 3, 1 over the first twelve, modulo 10)
create or replace function idno_ok(v text) returns boolean
language sql immutable as $$
  select v ~ '^[0-9]{13}$' and (
    (substr(v,1,1)::int*7 + substr(v,2,1)::int*3 + substr(v,3,1)::int*1 +
     substr(v,4,1)::int*7 + substr(v,5,1)::int*3 + substr(v,6,1)::int*1 +
     substr(v,7,1)::int*7 + substr(v,8,1)::int*3 + substr(v,9,1)::int*1 +
     substr(v,10,1)::int*7 + substr(v,11,1)::int*3 + substr(v,12,1)::int*1) % 10
  ) = substr(v,13,1)::int
$$;
alter table public.companies drop constraint if exists companies_idno_check;
-- not valid: an IDNO already saved stays as it is; every new or changed one must pass
alter table public.companies add constraint companies_idno_check check (idno is null or idno_ok(idno)) not valid;

-- 4. how far a workspace is held for an unpaid statement, counted in Chișinău days from its date to pay
create or replace function fee_hold_level(p_company uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(case when d >= 60 then 3 when d >= 30 then 2 when d >= 0 then 1 else 0 end), 0)::int
  from (
    select (now() at time zone 'Europe/Chisinau')::date - (i.due_at at time zone 'Europe/Chisinau')::date as d
    from job_fee_invoices i
    where i.company_id = p_company and i.paid_at is null and i.month is not null
      and exists (select 1 from job_fees f where f.invoice_id = i.id and f.status = 'due')
  ) x
$$;
revoke all on function fee_hold_level(uuid) from public, anon;
grant execute on function fee_hold_level(uuid) to authenticated, service_role;

-- 30 days late: no new offers, and the ones made are not changed (a signed-in user only; the server is not held)
drop policy if exists proposals_fee_hold_insert on proposals;
create policy proposals_fee_hold_insert on proposals as restrictive for insert to authenticated
  with check (fee_hold_level(company_id) < 2);
drop policy if exists proposals_fee_hold_update on proposals;
create policy proposals_fee_hold_update on proposals as restrictive for update to authenticated
  using (fee_hold_level(company_id) < 2) with check (fee_hold_level(company_id) < 2);
-- 60 days late: the quotes are read-only (nothing is deleted, nothing can be changed)
drop policy if exists projects_fee_hold_insert on projects;
create policy projects_fee_hold_insert on projects as restrictive for insert to authenticated
  with check (fee_hold_level(company_id) < 3);
drop policy if exists projects_fee_hold_update on projects;
create policy projects_fee_hold_update on projects as restrictive for update to authenticated
  using (fee_hold_level(company_id) < 3) with check (fee_hold_level(company_id) < 3);
drop policy if exists projects_fee_hold_delete on projects;
create policy projects_fee_hold_delete on projects as restrictive for delete to authenticated
  using (fee_hold_level(company_id) < 3);

-- 5. the reminders for the next steps
alter table public.job_fee_statement_reminders drop constraint if exists job_fee_statement_reminders_step_check;
alter table public.job_fee_statement_reminders add constraint job_fee_statement_reminders_step_check
  check (step in ('issued', 'week', 'last_day', 'locked', 'warn30', 'hold30', 'warn60', 'hold60'));

-- 6. a fee and a statement outlive a deleted workspace
alter table public.job_fees alter column company_id drop not null;
alter table public.job_fees drop constraint if exists job_fees_company_id_fkey;
alter table public.job_fees add constraint job_fees_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;
alter table public.job_fee_invoices alter column company_id drop not null;
alter table public.job_fee_invoices drop constraint if exists job_fee_invoices_company_id_fkey;
alter table public.job_fee_invoices add constraint job_fee_invoices_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

-- 7. the moment a job turns signed, stamped by the database (a status written by any path gets it; it cannot be
--    cleared or moved while the job stays signed)
alter table public.projects add column if not exists won_at timestamptz;
create or replace function projects_stamp_won() returns trigger
language plpgsql as $$
begin
  if new.status = 'won' then
    if tg_op = 'UPDATE' and old.status = 'won' then
      new.won_at := old.won_at;
    else
      new.won_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists projects_stamp_won on public.projects;
create trigger projects_stamp_won before insert or update of status, won_at on public.projects
  for each row execute function projects_stamp_won();

-- Check it worked (optional):
--   select idno_ok('1003600123456') as invented, fee_hold_level(id) from companies limit 3;
