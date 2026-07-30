-- add-battery-kwh.sql
-- Battery is now capacity-based: the editor lets the installer enter usable kWh,
-- and both cost (€/kWh) and the self-consumption benefit scale with it. Store the
-- capacity per project. Existing battery projects default to 10 kWh (the same
-- figure the engine falls back to for a legacy batt=true). Idempotent.

alter table projects add column if not exists batt_kwh numeric not null default 10;
