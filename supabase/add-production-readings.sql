-- add-production-readings.sql
-- Real monthly production from installed systems — the other half of the
-- honesty engine.
--
-- Every quote promises a P50 yield. Nothing in the product ever checked whether
-- those promises came true, so the estimate for quote #200 was no better
-- informed than the one for quote #1. This table closes that loop: one row per
-- system per month, read off the inverter portal, against which the original
-- P50 can be measured.
--
-- Why a table and not the monitoring screen's localStorage: a calibration is
-- only worth anything across the whole installed base, and browser storage is
-- per-device, per-browser and lost on a cache clear.
--
-- `month` is the first day of the month it covers, so a unique key per project
-- per month prevents double-counting when a reading is re-entered. Idempotent.

create table if not exists production_readings (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  month       date not null,                       -- first day of the month
  kwh         numeric not null default 0 check (kwh >= 0),
  source      text not null default 'manual'       -- manual | inverter portal name
              check (source in ('manual','solarman','fusionsolar','solaredge','other')),
  created_at  timestamptz not null default now()
);

create unique index if not exists production_readings_uniq
  on production_readings(project_id, month);
create index if not exists production_readings_company_idx
  on production_readings(company_id, month);

alter table production_readings enable row level security;
drop policy if exists production_readings_all on production_readings;
create policy production_readings_all on production_readings for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- When the system was switched on. Without it a partial first month reads as
-- underperformance, and the age-based degradation can't be applied either.
alter table projects add column if not exists commissioned_at date;
