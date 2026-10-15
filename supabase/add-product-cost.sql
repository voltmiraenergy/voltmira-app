-- add-product-cost.sql
-- Splits the one ambiguous `unit_price` into the two numbers an installer
-- actually works with:
--
--   cost_price  — what you pay the supplier for it
--   unit_price  — what it is listed at (already existed; unchanged)
--
-- Until now the catalog held a single price and the bill of materials treated it
-- as cost, so a product imported from the supplier browser carried the
-- distributor's list price into the margin calculation and understated the
-- margin on every quote that used it.
--
-- Existing rows keep working: cost_price defaults to 0, and anything reading it
-- falls back to unit_price when it is unset, so nothing changes until an
-- installer fills the new field in. Idempotent.

alter table products add column if not exists cost_price numeric not null default 0;
