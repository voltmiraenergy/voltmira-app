-- add-invoice-date.sql
-- The exact moment a proforma invoice number was first drawn (see
-- add-invoice-sequence.sql's next_invoice_no()) — projects.updated_at is NOT
-- a safe substitute, since a project can be edited again long after its
-- invoice was issued. Frozen alongside invoice_no, same "drawn once, never
-- changes" rule. Needed for the fiscal CSV export
-- (app/api/export-invoices/route.js) to print a real invoice date instead of
-- guessing one. Idempotent.

alter table projects add column if not exists invoiced_at timestamptz;
