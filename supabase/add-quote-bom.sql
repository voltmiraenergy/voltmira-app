-- add-quote-bom.sql
-- Phase 2 of the catalog: a quote can carry a bill of materials — the actual
-- products (copied from the catalog) with quantities. When present, the BOM total
-- drives the quote's real cost (engine costOverride); with no BOM it falls back to
-- kW x EUR/kW exactly as before. Line items are copied (snapshotted) so later
-- catalog price edits never change an existing quote. Idempotent.

alter table projects add column if not exists bom jsonb not null default '[]'::jsonb;
