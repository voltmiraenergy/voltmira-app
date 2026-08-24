-- add-company-invoicing.sql
-- Company legal details, so VoltMira can generate a proper proforma / deposit
-- invoice PDF without the installer touching accounting software.
--
--   legal_name      the registered company name ("SolarTech SRL")
--   reg_no          company registration number — CUI (RO) / IDNO (MD)
--   vat_no          VAT / TVA registration number (blank if not VAT-registered)
--   legal_address   registered office address printed on the invoice
--   iban            bank account for the transfer line
--   invoice_prefix  optional prefix for invoice numbers (e.g. "VM")
--   vat_rate        VAT % applied on the invoice (0 = not VAT-registered / reverse)
--
-- All nullable + idempotent; the app degrades gracefully before this runs
-- (Settings save skips these fields; the invoice shows blanks where unset). Run once.

alter table companies add column if not exists legal_name     text;
alter table companies add column if not exists reg_no         text;
alter table companies add column if not exists vat_no         text;
alter table companies add column if not exists legal_address  text;
alter table companies add column if not exists iban           text;
alter table companies add column if not exists invoice_prefix text;
alter table companies add column if not exists vat_rate       numeric not null default 0;
