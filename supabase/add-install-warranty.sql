-- add-install-warranty.sql
-- The installer's OWN workmanship/installation warranty — a real commitment
-- THEY make (labor, mounting, wiring), distinct from the manufacturer
-- warranties in lib/supplierCatalog.js (which cover the equipment itself and
-- need no verification blocker since they're the installer's own words, not a
-- claim about a real manufacturer's terms).
--
--   install_warranty_years  years of workmanship coverage the installer
--                           offers (e.g. 5) — null/0 = not set, so the
--                           proposal's "Installation warranty" line stays
--                           hidden rather than printing a false "0 years".
--
-- Nullable + idempotent; the app degrades gracefully before this runs
-- (Settings save skips this field; the proposal simply omits the line). Run once.

alter table companies add column if not exists install_warranty_years numeric;
