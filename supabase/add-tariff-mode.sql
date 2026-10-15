-- add-tariff-mode.sql
-- Moldova's differentiated day/night electricity tariff (Premier Energy /
-- RED Nord service area, ANRE-approved) — per-project opt-in, since not
-- every client of the same installer is necessarily on that plan. The
-- day/night MDL rates themselves are a company-wide, admin-editable setting
-- (engine.mdDayRateMdl/mdNightRateMdl in defaultEngineSettings(), same
-- pattern as costPerKw) — this column is only which mode THIS project uses.
-- Idempotent.

alter table projects add column if not exists tariff_mode text not null default 'flat';
