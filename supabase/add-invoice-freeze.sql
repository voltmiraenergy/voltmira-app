-- add-invoice-freeze.sql
-- The figures of an invoice are kept with its number: the amounts, the currency, the rate (and where it came
-- from), and what the line says. Until this column exists the app still issues invoice numbers, and works the
-- figures out from the quote as before. Safe to run twice.
alter table public.projects add column if not exists invoice_amounts jsonb;
