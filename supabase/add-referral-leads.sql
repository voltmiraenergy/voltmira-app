-- supabase/add-referral-leads.sql — a lead can come from a client's
-- recommendation (app/r/[code], app/api/referral). Until this runs such a lead
-- is saved as 'manual' on the "referral" channel, with "Recommended by ..." in
-- its note. Replaces whatever check the source column has. Safe to run again.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.leads'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source%'
  loop
    execute format('alter table public.leads drop constraint %I', c);
  end loop;
end $$;
alter table public.leads add constraint leads_source_check
  check (source in ('widget', 'proposal', 'manual', 'referral'));
