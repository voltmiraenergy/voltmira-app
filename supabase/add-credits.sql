-- supabase/add-credits.sql: VoltMira credits. A free workspace sends 5 offers a
-- month; further offers and the filled grid-connection application cost one
-- credit each (lib/credits.js). Credits are bought in Paddle (10 for 25 EUR,
-- 50 for 99 EUR); the webhook adds them, the server spends them.
--
-- credit_ledger holds every movement: positive rows are purchases (one per
-- Paddle transaction, so a retried notification adds nothing), negative rows
-- are spends. The balance is the sum. A workspace may read its own rows; only
-- the service role writes. Spending goes through spend_credits(), which locks
-- the workspace, checks the balance and writes in one step, so two offers sent
-- at once cannot spend the same credit, and spending for the same reference
-- twice (the same quote's grid file) charges once.
-- Nothing is charged until CREDITS_PAYWALL=on (Vercel env). Safe to run more than once.

create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('purchase', 'offer', 'grid_file', 'admin')),
  ref text,
  paddle_txn_id text unique,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_company_idx on credit_ledger(company_id, created_at desc);
-- one spend per reference: the same quote's grid file is charged once
create unique index if not exists credit_ledger_spend_once on credit_ledger(company_id, reason, ref)
  where delta < 0 and ref is not null;

alter table credit_ledger enable row level security;
drop policy if exists credit_ledger_read on credit_ledger;
create policy credit_ledger_read on credit_ledger for select using (company_id = my_company_id());

create or replace function spend_credits(p_company uuid, p_n integer, p_reason text, p_ref text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare bal integer;
begin
  if p_n is null or p_n <= 0 then return false; end if;
  perform pg_advisory_xact_lock(hashtext(p_company::text));
  -- already paid for this reference: allowed, no second charge
  if p_ref is not null and exists (
    select 1 from credit_ledger where company_id = p_company and reason = p_reason and ref = p_ref and delta < 0
  ) then return true; end if;
  select coalesce(sum(delta), 0) into bal from credit_ledger where company_id = p_company;
  if bal < p_n then return false; end if;
  insert into credit_ledger (company_id, delta, reason, ref) values (p_company, -p_n, p_reason, p_ref);
  return true;
end;
$$;
revoke all on function spend_credits(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function spend_credits(uuid, integer, text, text) to service_role;
