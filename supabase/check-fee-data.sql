-- check-fee-data.sql
-- READ-ONLY. The fee data checked against its own rules: run after check-security.sql says job_fees,
-- job_fee_credits and job_fee_invoices exist (add-job-fees.sql, add-fee-lockdown.sql). Changes nothing.
-- One row per check: area, check, ok, detail. Any ok = false: look before turning on JOB_FEES.

with
free_scopes as (
  -- a company (workspace, or tax id across workspaces) with more than 2 free jobs: must be none
  select coalesce(idno, company_id::text) as scope, count(*) as n
  from public.job_fees where free_slot is not null
  group by coalesce(idno, company_id::text) having count(*) > 2
),
checks as (
  select 'data', 'no company has more than 2 free jobs', count(*) = 0, coalesce(string_agg(scope || ' (' || n || ')', ', '), 'none')
  from free_scopes
  union all
  select 'data', 'every fee on a statement points back at it',
         count(*) = 0, count(*)::text || ' fee(s) listed on a statement but not linked to it'
  from public.job_fee_invoices i cross join lateral unnest(i.fee_ids) fid
  join public.job_fees f on f.id = fid where f.invoice_id is distinct from i.id
  union all
  select 'data', 'no credit spent twice', count(*) = 0, count(*)::text || ' fee(s) paid by more than one credit'
  from (select used_on_fee_id from public.job_fee_credits where used_on_fee_id is not null group by used_on_fee_id having count(*) > 1) d
)
select area, "check", ok, detail from checks order by ok, area, "check";
