-- add-referred-by-ondelete.sql
-- companies.referred_by (add-referrals.sql) was declared with a bare
-- `references companies(id)` — no ON DELETE action, so Postgres defaults to
-- NO ACTION. If a company that successfully referred another one is later
-- deleted (app/api/account/route.js's self-service erasure), that DELETE
-- fails outright on this FK: the referred company's row still points at the
-- now-vanishing id. The route already treats any delete failure as a safe
-- refusal (a generic "delete_failed", no partial state), so nothing was ever
-- corrupted — but the real fix is letting the delete succeed and simply
-- forgetting who referred the surviving company, not blocking their own
-- erasure request over someone else's already-settled referral history.
--
-- ON DELETE SET NULL, not CASCADE: the REFERRED company is a real, unrelated
-- customer with its own data — it must never be deleted just because the
-- company that happened to refer it deletes its own account.
--
-- Finds the constraint by its actual columns/target rather than assuming
-- Postgres's default auto-generated name ("companies_referred_by_fkey") —
-- if a name guess were wrong, DROP CONSTRAINT IF EXISTS would silently no-op
-- and this would add a harmless-looking SECOND constraint while the real,
-- still-blocking one stayed in place; introspection can't get that wrong.
-- Idempotent: re-running finds nothing left with the old (missing) ON DELETE
-- action and does nothing further.
do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
  where con.contype = 'f'
    and rel.relname = 'companies'
    and att.attname = 'referred_by'
    and con.confrelid = rel.oid           -- self-referencing: points back at companies
    and con.confdeltype <> 'n';            -- 'n' = already ON DELETE SET NULL; skip if so

  if fk_name is not null then
    execute format('alter table companies drop constraint %I', fk_name);
    alter table companies add constraint companies_referred_by_fkey
      foreign key (referred_by) references companies(id) on delete set null;
  end if;
end $$;
