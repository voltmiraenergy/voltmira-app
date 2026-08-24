-- supabase/add-invoice-sequence.sql
-- Sequential proforma invoice numbers (PF-2026-0001, -0002, …) instead of a
-- slice of the project's UUID.
--
-- Run this as its own standalone block in the Supabase SQL editor.
-- Safe to re-run: every statement is idempotent.
--
-- Until it's applied the app keeps working — the invoice page falls back to the
-- old id-derived number when the function/columns aren't there.

-- Per-company counter. The number is drawn from here and never reused.
alter table companies add column if not exists invoice_seq integer not null default 0;

-- The number, frozen onto the project the first time its invoice is opened, so
-- re-opening or re-printing always shows the same one.
alter table projects  add column if not exists invoice_no  text;

-- Atomic draw: UPDATE … RETURNING takes a row lock, so two tabs opening two
-- invoices at once can never be handed the same number.
create or replace function next_invoice_no(p_company uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  -- security definer bypasses RLS, so authorise explicitly: you may only draw a
  -- number for your OWN company. my_company_id() is the existing security-definer
  -- helper (it avoids the recursive profiles policy).
  --
  -- MUST be `is distinct from`, never `<>`. my_company_id() is NULL for a caller
  -- with no profile, and `p_company <> NULL` is NULL — not true — so `if` would
  -- not fire and the check was skipped entirely. `is distinct from` treats NULL
  -- as a real difference and refuses.
  if p_company is null or p_company is distinct from my_company_id() then
    raise exception 'forbidden';
  end if;

  update companies
     set invoice_seq = coalesce(invoice_seq, 0) + 1
   where id = p_company
  returning invoice_seq into v;

  return v;
end
$$;

revoke all on function next_invoice_no(uuid) from public, anon;
grant execute on function next_invoice_no(uuid) to authenticated;
