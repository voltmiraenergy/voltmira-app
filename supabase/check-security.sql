-- check-security.sql
-- READ-ONLY. What the app expects the database to protect, checked against the database you run it on. Changes
-- nothing: only SELECTs on the catalog and counts on the fee tables. Run it on staging, then on production, BEFORE
-- turning on JOB_FEES, and again after any migration. One paste: Supabase > SQL Editor > New query, Run.
--
-- One row per check: area, check, ok (true / false), detail. Any ok = false is a reason not to enable billing.
-- It reads only the catalog, so it runs whatever has or has not been migrated; the fee data checks are in
-- check-fee-data.sql (run that once job_fees exists).
-- Do not trust supabase/MIGRATIONS.md alone for what is in production: this is the source of truth.

with
t(name) as (values
  ('companies'), ('profiles'), ('projects'), ('proposals'), ('leads'), ('activity'),
  ('job_fees'), ('job_fee_credits'), ('job_fee_invoices'), ('job_fee_statement_reminders'),
  ('payments'), ('pay_milestones'), ('crews'), ('crew_visits'), ('job_site'), ('job_photos'),
  ('service_requests'), ('maintenance_checks'), ('warranties'), ('deal_documents'), ('deal_links'),
  ('signup_log'), ('audit_log'), ('rate_limits')
),
tables as (
  select t.name, c.oid, c.relrowsecurity as rls
  from t left join pg_class c on c.relname = t.name and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
),
trig(name, tbl) as (values
  ('companies_lock_idno', 'companies'), ('projects_lock_sample', 'projects'), ('projects_insert_not_sample', 'projects'),
  ('projects_stamp_won', 'projects'), ('proposals_lock_signed', 'proposals'), ('proposals_lock_signature', 'proposals'),
  ('profiles_lock_identity', 'profiles'), ('job_fees_free_guard', 'job_fees')
),
fn(sig, users_may_call) as (values
  ('public.next_job_fee_invoice_no()', false),
  ('public.job_fee_record_paperwork(uuid,text)', false),
  ('public.rate_limit_hit(text,integer,integer)', false),
  ('public.fee_hold_level(uuid)', true),
  ('public.idno_ok(text)', true)
),
buckets(name, public_ok) as (values
  ('deal-docs', false), ('job-photos', false), ('pay-proofs', false), ('service-photos', false)
),
checks as (
  -- 1. every table the app keeps private exists and has row level security on
  select 'rls' as area, 'table ' || name || ' exists, RLS on' as "check",
         coalesce(oid is not null and rls, false) as ok,
         case when oid is null then 'missing (its migration not run?)' when not rls then 'RLS OFF' else 'on' end as detail
  from tables
  union all
  -- 2. any public table at all with RLS off (the API would serve it to anyone with the anon key)
  select 'rls', 'no public table has RLS off', count(*) = 0,
         coalesce(string_agg(c.relname, ', '), 'none')
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity
  union all
  -- 3. the triggers that lock server-only columns and guard the fees
  select 'triggers', 'trigger ' || trig.name || ' on ' || trig.tbl, (tg.oid is not null and tg.tgenabled <> 'D'),
         case when tg.oid is null then 'missing' when tg.tgenabled = 'D' then 'DISABLED' else 'present' end
  from trig left join pg_trigger tg on tg.tgname = trig.name and not tg.tgisinternal
  union all
  -- 4. server-only functions are not callable by a user session; the ones the policies use are
  select 'functions', fn.sig || (case when fn.users_may_call then ' callable by signed-in users' else ' server only' end),
         case when to_regprocedure(fn.sig) is null then false
              when fn.users_may_call then has_function_privilege('authenticated', fn.sig, 'execute')
              else not has_function_privilege('authenticated', fn.sig, 'execute') and not has_function_privilege('anon', fn.sig, 'execute') end,
         case when to_regprocedure(fn.sig) is null then 'missing' else 'present' end
  from fn
  union all
  -- 5. security definer functions pin their search_path (else a user-created object could be picked up)
  select 'functions', 'security definer functions set search_path', count(*) = 0,
         coalesce(string_agg(p.proname, ', '), 'all pinned')
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  union all
  -- 6. the uniqueness the fee logic relies on
  select 'fees', 'one fee per job (job_fees.project_id unique)',
         exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                 where i.indrelid = to_regclass('public.job_fees') and i.indisunique and a.attname = 'project_id' and i.indnatts = 1), ''
  union all
  select 'fees', 'one credit per cancelled fee (job_fee_credits.source_fee_id unique)',
         exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                 where i.indrelid = to_regclass('public.job_fee_credits') and i.indisunique and a.attname = 'source_fee_id' and i.indnatts = 1), ''
  union all
  select 'fees', 'one statement per workspace and month', to_regclass('public.job_fee_invoices_month_key') is not null, ''
  union all
  -- 7. the columns the lockdown added
  select 'fees', 'column ' || x.col, exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = x.tbl and c.column_name = x.c2), ''
  from (values ('job_fees.docs_at', 'job_fees', 'docs_at'), ('job_fees.docs_kinds', 'job_fees', 'docs_kinds'),
               ('projects.won_at', 'projects', 'won_at'), ('projects.is_sample', 'projects', 'is_sample'),
               ('companies.idno', 'companies', 'idno')) x(col, tbl, c2)
  union all
  select 'fees', 'company IDNO must have a valid check digit',
         exists (select 1 from pg_constraint where conname = 'companies_idno_check' and pg_get_constraintdef(oid) like '%idno_ok%'), ''
  union all
  -- 9. the private buckets are private
  select 'storage', 'bucket ' || b.name || ' private', coalesce(s.public = false, false),
         case when s.id is null then 'missing' when s.public then 'PUBLIC' else 'private' end
  from buckets b left join storage.buckets s on s.id = b.name
)
select area, "check", ok, detail from checks order by ok, area, "check";
