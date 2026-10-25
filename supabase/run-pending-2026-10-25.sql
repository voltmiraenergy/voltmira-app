-- run-pending-2026-10-25.sql
-- Every pending database change in one paste: Supabase > SQL Editor > New query, paste this whole file, Run.
-- Safe to run again: each part only adds what is missing. It runs as one batch, so if anything fails nothing is
-- applied and the error names the line; send it over and run the whole file again once fixed.
-- Order: each part comes after the ones it needs (add-integrations.sql, already run, before milestones).
--
--   1 add-deadline-alerts      5 add-grid-connection       9 add-fee-lockdown    13 add-signups-view
--   2 add-referral-leads       6 add-security-hardening   10 add-jobs-board
--   3 add-tariffs-subsidies    7 add-invoice-freeze       11 add-milestones
--   4 add-financing            8 add-job-fees             12 add-service


-- ============================================================ 1. add-deadline-alerts.sql
-- add-deadline-alerts.sql
-- The weekly "permits and deadlines" email (lib/deadlineRun.js, the Monday cron
-- in vercel.json): each company can turn it off in Settings, under
-- Notifications. On by default. Safe to run twice.
alter table companies add column if not exists notify_deadlines boolean not null default true;


-- ============================================================ 2. add-referral-leads.sql
-- supabase/add-referral-leads.sql — a lead can come from a client's
-- recommendation (app/r/[code], app/api/referral). Until this runs such a lead
-- is saved as 'manual' on the "referral" channel, with "Recommended by ..." in
-- its note. Replaces whatever check the source column has. Safe to run again.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.leads'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source%'
  loop
    execute format('alter table public.leads drop constraint %I', c);
  end loop;
end $$;
alter table public.leads add constraint leads_source_check
  check (source in ('widget', 'proposal', 'manual', 'referral'));


-- ============================================================ 3. add-tariffs-subsidies.sql
-- supabase/add-tariffs-subsidies.sql — versioned tariff rules, versioned
-- support programmes, and the append-only audit log (docs/TARIFFS_AND_SUBSIDIES.md).
--
-- Why: the savings math depends on net-billing rules that change (the operator's
-- buy-back price is republished every month), and an offer must keep computing
-- with the rule it was issued under. A new version is added, never edited: a
-- trigger refuses UPDATE and DELETE on all three tables.
--
-- Units: money and rates are integers with an explicit currency. Rates are in
-- minor units per MWh (bani per MWh): 2.51 lei/kWh = 251000.
--
-- Who reads and writes: tariff rules and programmes are the same for every
-- workspace, so every signed-in user reads them; only the platform admin
-- writes them, with the service role (app/api/admin/*). The audit log is read
-- by each workspace for its own rows only. Safe to run more than once.

-- 0. One guard for all three: a published row never changes.
create or replace function refuse_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows are append-only: add a new version instead', tg_table_name;
end $$;

-- 1. Tariff rules
create table if not exists tariff_rules (
  id                          uuid primary key default gen_random_uuid(),
  market                      text not null check (market in ('MD')),
  operator                    text not null check (operator in ('premier', 'rednord')),
  version                     integer not null check (version >= 1),
  effective_from              date not null,
  effective_to                date check (effective_to is null or effective_to > effective_from),
  currency                    text not null default 'MDL' check (currency in ('MDL', 'EUR')),
  retail_flat_minor_per_mwh   integer check (retail_flat_minor_per_mwh >= 0),
  retail_day_minor_per_mwh    integer check (retail_day_minor_per_mwh >= 0),
  retail_night_minor_per_mwh  integer check (retail_night_minor_per_mwh >= 0),
  export_monthly              jsonb,          -- 12 integers (minor per MWh) or nulls, January first
  export_flat_minor_per_mwh   integer check (export_flat_minor_per_mwh >= 0),
  prosumer_max_kw             numeric(10, 2) check (prosumer_max_kw > 0),
  source_title                text not null default '' check (char_length(source_title) <= 300),
  source_url                  text not null default '' check (char_length(source_url) <= 500),
  note                        text not null default '' check (char_length(note) <= 1000),
  created_by                  text not null default '' check (char_length(created_by) <= 200),
  created_at                  timestamptz not null default now(),
  unique (market, operator, version)
);
create index if not exists tariff_rules_pick_idx on tariff_rules(market, operator, effective_from desc);
alter table tariff_rules enable row level security;
drop policy if exists tariff_rules_read on tariff_rules;
create policy tariff_rules_read on tariff_rules for select to authenticated using (true);
drop trigger if exists tariff_rules_append_only on tariff_rules;
create trigger tariff_rules_append_only before update or delete on tariff_rules
  for each row execute function refuse_change();

-- 2. Support programmes
create table if not exists subsidy_programs (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  version             integer not null check (version >= 1),
  market              text not null check (market in ('MD')),
  kind                text not null check (kind in ('tax', 'duty', 'grant', 'guarantee', 'loan')),
  name                jsonb not null,     -- { en, ro, ru, uk }
  provider            text not null default '' check (char_length(provider) <= 200),
  eligibility         jsonb not null default '{}'::jsonb,
  estimate            jsonb not null default '{"type":"info"}'::jsonb,
  required_documents  jsonb not null default '[]'::jsonb,   -- [{ id, name: { en, ro, ru, uk } }]
  valid_from          date,
  valid_to            date,
  active              boolean not null default true,
  source_url          text not null default '' check (char_length(source_url) <= 500),
  created_by          text not null default '' check (char_length(created_by) <= 200),
  created_at          timestamptz not null default now(),
  unique (code, version)
);
alter table subsidy_programs enable row level security;
drop policy if exists subsidy_programs_read on subsidy_programs;
create policy subsidy_programs_read on subsidy_programs for select to authenticated using (true);
drop trigger if exists subsidy_programs_append_only on subsidy_programs;
create trigger subsidy_programs_append_only before update or delete on subsidy_programs
  for each row execute function refuse_change();

-- 3. The audit log: who changed what, before and after. Written by the server
-- (service role) only; each workspace reads its own rows; platform actions
-- (a new tariff version) have no workspace.
create table if not exists audit_log (
  id           bigint generated always as identity primary key,
  -- no foreign key: deleting a workspace would have to UPDATE these rows, which
  -- the append-only trigger refuses (retention is handled separately)
  company_id   uuid,
  actor_id     uuid,
  actor_email  text not null default '' check (char_length(actor_email) <= 200),
  action       text not null check (char_length(action) between 1 and 80),
  entity       text not null check (char_length(entity) between 1 and 80),
  entity_id    text not null default '' check (char_length(entity_id) <= 120),
  before       jsonb,
  after        jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_company_idx on audit_log(company_id, created_at desc);
create index if not exists audit_log_entity_idx on audit_log(entity, entity_id);
alter table audit_log enable row level security;
drop policy if exists audit_log_read on audit_log;
create policy audit_log_read on audit_log for select using (company_id = my_company_id());
drop trigger if exists audit_log_append_only on audit_log;
create trigger audit_log_append_only before update or delete on audit_log
  for each row execute function refuse_change();

-- 4. The homeowner's profile on a quote, for the eligibility check:
--    { vatPayer: bool, netMetering: bool, documentsHave: [ids] }
alter table projects add column if not exists client_profile jsonb not null default '{}'::jsonb;

-- 5. Version 1 of everything: exactly what the app used before this file
--    (lib/tariffSeed.js and lib/subsidySeed.js hold the same values, and
--    lib/tariffSeed.test.js checks the two agree).
insert into tariff_rules (market, operator, version, effective_from, currency,
  retail_day_minor_per_mwh, retail_night_minor_per_mwh, export_monthly,
  source_title, source_url, note, created_by)
values
  ('MD', 'premier', 1, '2024-01-01', 'MDL', 375000, 294000,
   '[306000,274000,263000,230000,239000,272000,258000,223000,213000,265000,272000,266000]'::jsonb,
   'Premier Energy Distribution: prețul mediu lunar de procurare a energiei livrate de prosumatori', '',
   'Latest published month for each calendar month (2026 Jan to Jul, 2025 Aug to Dec). Day/night retail: the defaults the app used.',
   'seed'),
  ('MD', 'rednord', 1, '2024-01-01', 'MDL', 489000, 391000,
   '[306000,274000,263000,230000,239000,272000,258000,223000,213000,265000,272000,266000]'::jsonb,
   'Premier Energy Distribution buy-back table, applied to RED Nord until RED Nord''s own is sourced', '',
   'RED Nord''s buy-back table is not in VoltMira yet: the app priced its exports with Premier''s, and this version records that. Day/night retail: FEE-Nord rates from Settings.',
   'seed')
on conflict (market, operator, version) do nothing;

insert into subsidy_programs (code, version, market, kind, name, provider, eligibility, estimate, required_documents, valid_from, valid_to, source_url, created_by)
values
  ('law112_vat', 1, 'MD', 'tax',
   '{"en":"VAT refund on the battery","ro":"Rambursarea TVA la baterie","ru":"Возврат НДС за батарею","uk":"Повернення ПДВ за батарею"}'::jsonb,
   'Legea nr. 112/2026',
   '{"clientKinds":["sme","company"],"requiresBattery":true,"vatPayer":true}'::jsonb,
   '{"type":"vat_in_battery"}'::jsonb,
   '[{"id":"vat_registration","name":{"en":"VAT payer registration","ro":"Înregistrarea ca plătitor de TVA","ru":"Регистрация плательщика НДС","uk":"Реєстрація платника ПДВ"}},{"id":"battery_invoice","name":{"en":"Invoice for the battery, with VAT","ro":"Factura pentru baterie, cu TVA","ru":"Счёт за батарею с НДС","uk":"Рахунок за батарею з ПДВ"}}]'::jsonb,
   '2026-06-11', null, '', 'seed'),
  ('law112_customs', 1, 'MD', 'duty',
   '{"en":"0% customs duty on batteries","ro":"Taxă vamală 0% la baterii","ru":"Пошлина 0% на батареи","uk":"Мито 0% на батареї"}'::jsonb,
   'Legea nr. 112/2026',
   '{"clientKinds":["household","sme","company"],"requiresBattery":true}'::jsonb,
   '{"type":"info","fromPct":8,"toPct":0}'::jsonb,
   '[]'::jsonb,
   '2026-06-11', null, '', 'seed'),
  ('facem_373', 1, 'MD', 'grant',
   '{"en":"FACEM, programme 373","ro":"FACEM, programul 373","ru":"FACEM, программа 373","uk":"FACEM, програма 373"}'::jsonb,
   'FACEM, programul 373',
   '{"clientKinds":["sme"],"requiresBattery":true,"netMetering":true}'::jsonb,
   '{"type":"pct_of","base":"battery","pct":30,"upTo":true}'::jsonb,
   '[{"id":"net_metering_contract","name":{"en":"Net-metering contract with the operator","ro":"Contractul de net-metering cu operatorul","ru":"Договор нет-метеринга с оператором","uk":"Договір нет-метерингу з оператором"}},{"id":"battery_invoice","name":{"en":"Invoice for the battery, with VAT","ro":"Factura pentru baterie, cu TVA","ru":"Счёт за батарею с НДС","uk":"Рахунок за батарею з ПДВ"}}]'::jsonb,
   null, null, '', 'seed'),
  ('bess_guarantee', 1, 'MD', 'guarantee',
   '{"en":"State guarantee on the battery loan","ro":"Garanția statului la creditul pentru baterie","ru":"Госгарантия по кредиту на батарею","uk":"Державна гарантія за кредитом на батарею"}'::jsonb,
   'Garanția de stat pentru stocarea energiei',
   '{"clientKinds":["sme","company"],"requiresBattery":true,"loan":true}'::jsonb,
   '{"type":"pct_of","base":"loan","pct":50,"capMinor":3000000000,"currency":"MDL","feePctYear":1,"maxMonths":120}'::jsonb,
   '[{"id":"loan_agreement","name":{"en":"Loan agreement for the battery","ro":"Contractul de credit pentru baterie","ru":"Кредитный договор на батарею","uk":"Кредитний договір на батарею"}}]'::jsonb,
   null, '2028-12-31', 'https://www.moldpres.md/rom/economie/republica-moldova-va-dezvolta-un-instrument-de-garantare-a-creditelor-pentru-investitiile-in-sisteme-de-stocare-a-energiei', 'seed')
on conflict (code, version) do nothing;


-- ============================================================ 4. add-financing.sql
-- supabase/add-financing.sql — green financing (docs/FINANCING.md): partner
-- lenders and their offers, the homeowner's loan applications from the
-- client's offer, every status change, and the commission VoltMira is owed
-- when a loan is funded. Runs on its own (the append-only guard is created
-- below too); the audit log comes from add-tariffs-subsidies.sql, and until
-- that runs the app skips audit rows without failing. Safe to run more than once.
--
-- Units: money is integer minor units (bani) with a currency; rates are basis
-- points (9.5 % a year = 950).
--
-- Who reads and writes:
--   lenders                     the server only (commission terms, token hashes).
--   financing_offers            every signed-in user reads them; the platform writes them.
--   loan_applications,          a workspace reads its own; the server writes
--   loan_status_events          them (the homeowner and the lender have no
--                               account).
--   commission_ledger           platform only: no workspace reads it.

-- The append-only guard, also created by add-tariffs-subsidies.sql; repeated
-- here so this file runs on its own, in any order.
create or replace function refuse_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows are append-only: add a new version instead', tg_table_name;
end $$;

-- 1. Partner lenders. The portal token is never stored, only its SHA-256.
create table if not exists lenders (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique check (code ~ '^[a-z0-9_]{2,30}$'),
  name                   text not null check (char_length(name) between 1 and 120),
  adapter                text not null default 'email' check (adapter in ('mock', 'email')),
  contact_email          text not null default '' check (char_length(contact_email) <= 200),
  commission_type        text not null default 'percent' check (commission_type in ('percent', 'flat')),
  commission_bps         integer not null default 0 check (commission_bps between 0 and 10000),
  commission_flat_minor  bigint not null default 0 check (commission_flat_minor >= 0),
  currency               text not null default 'MDL' check (currency in ('MDL', 'EUR')),
  portal_token_hash      text unique,
  is_sample              boolean not null default false,
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);
-- no policy: only the server (service role) reads lenders, so no workspace
-- ever sees a commission term or a token hash; it hands out names itself
alter table lenders enable row level security;
drop policy if exists lenders_read on lenders;

-- 2. Their offers.
create table if not exists financing_offers (
  id                 uuid primary key default gen_random_uuid(),
  lender_id          uuid not null references lenders(id) on delete cascade,
  product_name       jsonb not null,                              -- { en, ro, ru, uk }
  currency           text not null default 'MDL' check (currency in ('MDL', 'EUR')),
  rate_bps           integer not null check (rate_bps between 0 and 10000),
  term_min_months    integer not null check (term_min_months between 1 and 480),
  term_max_months    integer not null check (term_max_months between 1 and 480),
  fee_bps            integer not null default 0 check (fee_bps between 0 and 10000),
  fee_flat_minor     bigint not null default 0 check (fee_flat_minor >= 0),
  min_amount_minor   bigint not null check (min_amount_minor >= 0),
  max_amount_minor   bigint not null check (max_amount_minor > 0),
  eligibility        jsonb not null default '{}'::jsonb,          -- { markets, clientKinds, requiresBattery }
  is_sample          boolean not null default false,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  check (term_max_months >= term_min_months),
  check (max_amount_minor >= min_amount_minor)
);
create index if not exists financing_offers_lender_idx on financing_offers(lender_id);
alter table financing_offers enable row level security;
drop policy if exists financing_offers_read on financing_offers;
create policy financing_offers_read on financing_offers for select to authenticated using (true);

-- 3. The homeowner's application, from the client's offer.
create table if not exists loan_applications (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  project_id         uuid references projects(id) on delete set null,
  proposal_code      text not null,
  offer_id           uuid not null references financing_offers(id),
  lender_id          uuid not null references lenders(id),
  -- frozen at submission: what the homeowner saw and agreed to
  amount_minor       bigint not null check (amount_minor > 0),
  currency           text not null check (currency in ('MDL', 'EUR')),
  term_months        integer not null check (term_months between 1 and 480),
  rate_bps           integer not null,
  monthly_minor      bigint not null check (monthly_minor > 0),
  fee_minor          bigint not null default 0,
  support_minor      bigint not null default 0,
  applicant          jsonb not null,                               -- { name, phone, email, locality }
  -- the homeowner's consent to send their details to the lender
  consent_version    text not null,
  consent_at         timestamptz not null,
  consent_ip         text not null default '',
  consent_ua         text not null default '',
  status             text not null default 'submitted'
                     check (status in ('submitted', 'in_review', 'approved', 'rejected', 'funded', 'failed')),
  channel            text not null default '' check (channel in ('', 'mock', 'email')),
  lender_ref         text not null default '' check (char_length(lender_ref) <= 120),
  idempotency_key    text not null check (char_length(idempotency_key) between 8 and 80),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (proposal_code, idempotency_key)
);
create index if not exists loan_applications_company_idx on loan_applications(company_id, created_at desc);
create index if not exists loan_applications_lender_idx on loan_applications(lender_id, created_at desc);
create index if not exists loan_applications_project_idx on loan_applications(project_id);
alter table loan_applications enable row level security;
drop policy if exists loan_applications_read on loan_applications;
create policy loan_applications_read on loan_applications for select using (company_id = my_company_id());

-- 4. Every status change, append-only. event_id makes a repeated webhook a no-op.
create table if not exists loan_status_events (
  id               bigint generated always as identity primary key,
  application_id   uuid not null references loan_applications(id) on delete cascade,
  company_id       uuid not null,
  from_status      text not null default '',
  to_status        text not null,
  source           text not null check (source in ('adapter', 'webhook', 'portal', 'admin')),
  event_id         text not null check (char_length(event_id) between 1 and 120),
  note             text not null default '' check (char_length(note) <= 500),
  created_at       timestamptz not null default now(),
  unique (application_id, event_id)
);
alter table loan_status_events enable row level security;
drop policy if exists loan_status_events_read on loan_status_events;
create policy loan_status_events_read on loan_status_events for select using (company_id = my_company_id());
drop trigger if exists loan_status_events_append_only on loan_status_events;
create trigger loan_status_events_append_only before update or delete on loan_status_events
  for each row execute function refuse_change();

-- 5. What each lender owes VoltMira, one accrual per funded loan. Platform only.
create table if not exists commission_ledger (
  id               bigint generated always as identity primary key,
  lender_id        uuid not null references lenders(id),
  application_id   uuid not null unique references loan_applications(id),
  company_id       uuid not null,
  amount_minor     bigint not null check (amount_minor >= 0),
  currency         text not null check (currency in ('MDL', 'EUR')),
  basis            text not null check (basis in ('percent', 'flat')),
  rate_bps         integer not null default 0,
  loan_minor       bigint not null,
  period           text not null check (period ~ '^\d{4}-\d{2}$'),   -- the month it was funded
  created_at       timestamptz not null default now()
);
create index if not exists commission_ledger_period_idx on commission_ledger(lender_id, period);
alter table commission_ledger enable row level security;   -- no policy: the service role only
drop trigger if exists commission_ledger_append_only on commission_ledger;
create trigger commission_ledger_append_only before update or delete on commission_ledger
  for each row execute function refuse_change();

-- 6. Sample lenders and offers: placeholders, marked is_sample, shown to
--    homeowners only in demo workspaces (or with FINANCING_SAMPLES=on) until
--    real terms are signed. Rates and limits are illustrative, not the banks'.
insert into lenders (code, name, adapter, contact_email, commission_type, commission_bps, commission_flat_minor, currency, is_sample)
values
  ('maib', 'MAIB', 'mock', '', 'percent', 100, 0, 'MDL', true),
  ('micb', 'Moldindconbank', 'mock', '', 'percent', 75, 0, 'MDL', true),
  ('otp', 'OTP Bank', 'mock', '', 'flat', 0, 150000, 'MDL', true)
on conflict (code) do nothing;

insert into financing_offers (lender_id, product_name, currency, rate_bps, term_min_months, term_max_months, fee_bps, fee_flat_minor, min_amount_minor, max_amount_minor, eligibility, is_sample)
select l.id, o.product_name::jsonb, 'MDL', o.rate_bps, o.tmin, o.tmax, o.fee_bps, o.fee_flat, o.amin, o.amax, o.elig::jsonb, true
from (values
  ('maib', '{"en":"Green home loan (sample)","ro":"Credit verde pentru casă (exemplu)","ru":"Зелёный кредит для дома (пример)","uk":"Зелений кредит для дому (приклад)"}', 990, 12, 84, 100, 0, 3000000, 50000000, '{"markets":["MD"],"clientKinds":["household"]}'),
  ('micb', '{"en":"Solar loan (sample)","ro":"Credit solar (exemplu)","ru":"Солнечный кредит (пример)","uk":"Сонячний кредит (приклад)"}', 1050, 12, 120, 0, 50000, 2000000, 80000000, '{"markets":["MD"]}'),
  ('otp', '{"en":"Energy efficiency loan (sample)","ro":"Credit pentru eficiență energetică (exemplu)","ru":"Кредит на энергоэффективность (пример)","uk":"Кредит на енергоефективність (приклад)"}', 1150, 6, 60, 150, 0, 1000000, 30000000, '{"markets":["MD"]}')
) as o(code, product_name, rate_bps, tmin, tmax, fee_bps, fee_flat, amin, amax, elig)
join lenders l on l.code = o.code
where not exists (select 1 from financing_offers f where f.lender_id = l.id);


-- ============================================================ 5. add-grid-connection.sql
-- add-grid-connection.sql
-- Phase 2, grid connection (docs/features/phase2.md). One paste: Supabase > SQL Editor > New query, paste this
-- whole file, Run. Safe to run again. Runs on its own; the parts for the grid submissions apply once
-- add-integrations.sql has created them (run that one too, in any order, then this one again).
--
--   1. What each operator asks for, versioned: the documents, how recent some must be, and how many days a file
--      may wait in each status. A platform admin publishes a new version at /admin/grid; nothing is ever edited
--      in place. Version 1 is the rules the code used until now.
--   2. On each submission: the issue dates of the documents that must be recent, any exception an owner or a
--      manager made with a written reason, the rules' version it was checked against, and the "meter installed"
--      status.
--   3. The client's language, for the messages they get at each step (on the quote, and on a lead from the
--      estimate page).

-- the append-only guard, also created by add-tariffs-subsidies.sql and add-integrations.sql
create or replace function refuse_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows are append-only: add a new version instead', tg_table_name;
end $$;

-- 1. the operators' requirements
create table if not exists grid_requirements (
  id             uuid primary key default gen_random_uuid(),
  operator       text not null check (operator in ('premier', 'rednord')),
  version        integer not null check (version >= 1),
  docs           jsonb not null,                       -- { person: [ids], company: [ids] }
  custom         jsonb not null default '{}'::jsonb,   -- { id: { name: { en, ro, ru, uk }, optional } }
  max_age_days   jsonb not null default '{}'::jsonb,   -- { doc id: days }
  expected_days  jsonb not null,                       -- { status: days }
  note           text not null default '' check (char_length(note) <= 1000),
  created_by     text not null default '' check (char_length(created_by) <= 200),
  created_at     timestamptz not null default now(),
  unique (operator, version)
);
alter table grid_requirements enable row level security;
drop policy if exists grid_requirements_read on grid_requirements;
create policy grid_requirements_read on grid_requirements for select to authenticated using (true);
drop trigger if exists grid_requirements_append_only on grid_requirements;
create trigger grid_requirements_append_only before update or delete on grid_requirements
  for each row execute function refuse_change();

insert into grid_requirements (operator, version, docs, custom, max_age_days, expected_days, note, created_by)
select op, 1,
  '{"person": ["application", "signed", "id_copy", "property", "authorization"],
    "company": ["application", "signed", "registry_extract", "property", "site_sketch", "owner_consent", "authorization"]}'::jsonb,
  '{}'::jsonb,
  '{"registry_extract": 90}'::jsonb,
  '{"submitted": 10, "docs_requested": 10, "approved": 30, "meter_installed": 14}'::jsonb,
  'The rules the code used until this table existed.', 'seed'
from unnest(array['premier', 'rednord']) as op
on conflict (operator, version) do nothing;

-- 2. the submissions (only once add-integrations.sql has created them)
do $$
begin
  if to_regclass('public.grid_submissions') is not null then
    alter table public.grid_submissions add column if not exists overrides jsonb not null default '[]'::jsonb;
    alter table public.grid_submissions add column if not exists doc_dates jsonb not null default '{}'::jsonb;
    alter table public.grid_submissions add column if not exists rules_version integer not null default 0;
    alter table public.grid_submissions drop constraint if exists grid_submissions_status_check;
    alter table public.grid_submissions add constraint grid_submissions_status_check
      check (status in ('submitted', 'docs_requested', 'approved', 'meter_installed', 'connected', 'rejected'));
    create index if not exists grid_submissions_company_idx on public.grid_submissions (company_id, status);
  end if;
  if to_regclass('public.grid_submission_events') is not null then
    create index if not exists grid_submission_events_sub_idx on public.grid_submission_events (submission_id, created_at);
  end if;
end $$;

-- 3. the client's language
alter table public.projects add column if not exists client_lang text;
alter table public.projects drop constraint if exists projects_client_lang_check;
alter table public.projects add constraint projects_client_lang_check check (client_lang is null or client_lang in ('en', 'ro', 'ru', 'uk'));
alter table public.leads add column if not exists lang text;
alter table public.leads drop constraint if exists leads_lang_check;
alter table public.leads add constraint leads_lang_check check (lang is null or lang in ('en', 'ro', 'ru', 'uk'));

-- Check it worked (optional):
--   select operator, version, expected_days from grid_requirements order by operator, version;


-- ============================================================ 6. add-security-hardening.sql
-- add-security-hardening.sql
-- One paste: Supabase > SQL Editor > New query, paste this whole file, Run.
-- Safe to run again. Runs on its own (it defines the two helpers it uses).
--
--   1. The link a signed client shares with friends (/r/...) used to be the offer's own
--      code, which opens the whole offer: name, address, price, equipment and the PDF.
--      Each offer now gets a random referral_token; the app shares that, and it opens
--      nothing else. Links already shared with the old code stop working once this is run.
--
--   2. A signed offer cannot be rewritten by an installer's session any more: its
--      snapshot (price, kW, warranty) and identity are frozen once accepted_at is set,
--      for calls made with a user's session (the browser, the anon key). The server and
--      this editor are not affected, nor is refreshing an offer that is not yet signed.
--
--   3. A member cannot give themselves the manager title straight through the API
--      (profiles.title), and nobody can change an offer's referral token.
--
--   4. bump_proposal_stat (the open/time counters) was callable by anyone holding the
--      public anon key, with a negative number: it is for the server only.

-- the shared helpers (defined in lock-down-2026-09-28.sql as well; same text)
create or replace function is_user_session() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) in ('authenticated', 'anon')
$$;

create or replace function lock_columns() returns trigger
language plpgsql as $$
declare
  k text;
begin
  if not is_user_session() then
    return new;
  end if;
  foreach k in array tg_argv loop
    if to_jsonb(new) -> k is distinct from to_jsonb(old) -> k then
      raise exception 'Only the server can change %.%', tg_table_name, k
        using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- 1. the referral token
alter table proposals add column if not exists referral_token text;
update proposals set referral_token = replace(gen_random_uuid()::text, '-', '') where referral_token is null;
alter table proposals alter column referral_token set default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists proposals_referral_token_key on proposals (referral_token);

-- 2. a signed offer is frozen
create or replace function lock_signed_proposal() returns trigger
language plpgsql as $$
begin
  if is_user_session() and old.accepted_at is not null and (
       new.snapshot   is distinct from old.snapshot
    or new.code       is distinct from old.code
    or new.project_id is distinct from old.project_id
    or new.company_id is distinct from old.company_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'A signed proposal cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists proposals_lock_signed on proposals;
create trigger proposals_lock_signed before update on proposals
  for each row execute function lock_signed_proposal();

-- 3. the signature columns now include the referral token; a profile's title is the server's to set
drop trigger if exists proposals_lock_signature on proposals;
create trigger proposals_lock_signature before update on proposals
  for each row execute function lock_columns('accepted_at', 'signature',
    'signer_name', 'signed_ip', 'signed_ua', 'referral_token');

drop trigger if exists profiles_lock_identity on profiles;
create trigger profiles_lock_identity before update on profiles
  for each row execute function lock_columns('id', 'company_id', 'role', 'email', 'title');

-- 4. the counters are for the server only (skipped if the function has another shape; nothing else depends on it)
do $$
begin
  if to_regprocedure('public.bump_proposal_stat(text, text, integer)') is not null then
    revoke all on function public.bump_proposal_stat(text, text, integer) from public, anon, authenticated;
    grant execute on function public.bump_proposal_stat(text, text, integer) to service_role;
  else
    raise notice 'bump_proposal_stat(text, text, integer) not found: its access was left as it is';
  end if;
end $$;

-- Check it worked (optional):
--   select count(*) filter (where referral_token is null) as without_token from proposals;   -- 0
--   select tgname from pg_trigger where tgname in ('proposals_lock_signed', 'proposals_lock_signature', 'profiles_lock_identity');


-- ============================================================ 7. add-invoice-freeze.sql
-- add-invoice-freeze.sql
-- The figures of an invoice are kept with its number: the amounts, the currency, the rate (and where it came
-- from), and what the line says. Until this column exists the app still issues invoice numbers, and works the
-- figures out from the quote as before. Safe to run twice.
alter table public.projects add column if not exists invoice_amounts jsonb;


-- ============================================================ 8. add-job-fees.sql
-- add-job-fees.sql
-- VoltMira's fee for each signed job (docs/features/job-fees.md): 200 lei a kW, at most 8,000 lei, the first 2
-- jobs free, billed on one statement a month. One paste: Supabase > SQL Editor > New query, paste this whole file,
-- Run. Safe to run again (also over an earlier version of this file). Runs on its own.
--
--   1. The installer's company tax id (IDNO): the first 2 signed jobs are free per company, across its workspaces.
--   2. job_fees: one fee per signed job, ever, with its amount in lei, status and the date its statement is due.
--   3. job_fee_credits: the amount of a paid job later cancelled, kept for the next fee.
--   4. job_fee_invoices: VoltMira's statement each month, in its own number series, paid by bank transfer.
--   5. job_fee_statement_reminders: which reminder went out for which statement, so none goes twice.
--   6. projects.is_sample: a demo project, never charged; only the server can set it.
-- Each workspace reads its own rows; only the server writes them (no write policy for a user's session).

-- the shared checks, also in lock-down-2026-09-28.sql and add-security-hardening.sql, repeated so this file runs alone
create or replace function is_user_session() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) in ('authenticated', 'anon')
$$;

create or replace function lock_columns() returns trigger
language plpgsql as $$
declare
  k text;
begin
  if not is_user_session() then
    return new;
  end if;
  foreach k in array tg_argv loop
    if to_jsonb(new) -> k is distinct from to_jsonb(old) -> k then
      raise exception 'Only the server can change %.%', tg_table_name, k
        using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- 1. the company tax id
alter table public.companies add column if not exists idno text;
alter table public.companies drop constraint if exists companies_idno_check;
alter table public.companies add constraint companies_idno_check check (idno is null or idno ~ '^[0-9]{13}$');
create index if not exists companies_idno_idx on public.companies (idno) where idno is not null;
-- a Moldovan registration number already typed in for invoices is the IDNO
update public.companies set idno = reg_no where idno is null and reg_no ~ '^[0-9]{13}$';
-- only the server sets the tax id (Settings goes through it), and not once a fee carries it: a new id would hand out
-- more free jobs
drop trigger if exists companies_lock_idno on public.companies;
create trigger companies_lock_idno before update on public.companies
  for each row execute function lock_columns('idno');

-- 2. the fees
create table if not exists job_fees (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null unique references projects(id) on delete cascade,
  idno            text check (idno is null or idno ~ '^[0-9]{13}$'),   -- empty until the company enters it
  kw              numeric(10, 2) not null default 0 check (kw >= 0),
  tier            smallint not null default 0 check (tier between 0 and 3),   -- 1: the fee hit the 8,000 lei cap
  amount_minor    bigint not null check (amount_minor >= 0),
  currency        text not null default 'MDL' check (currency = 'MDL'),
  status          text not null check (status in ('free', 'due', 'paid', 'void', 'waived')),
  trigger         text not null check (trigger in ('signed', 'manual')),
  free_slot       smallint check (free_slot between 1 and 3),
  won_at          timestamptz not null,
  grace_ends_at   timestamptz not null,
  paid_at         timestamptz,
  payment_method  text check (payment_method in ('transfer', 'credit', 'admin')),
  payment_ref     text not null default '' check (char_length(payment_ref) <= 120),
  invoice_id      uuid,
  note            text not null default '' check (char_length(note) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists job_fees_company_idx on job_fees (company_id, status);
create index if not exists job_fees_idno_idx on job_fees (idno, status);
alter table job_fees enable row level security;
drop policy if exists job_fees_read on job_fees;
create policy job_fees_read on job_fees for select using (company_id = my_company_id());

-- 3. credits from cancelled paid jobs
create table if not exists job_fee_credits (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  amount_minor     bigint not null check (amount_minor > 0),
  source_fee_id    uuid not null unique references job_fees(id) on delete cascade,
  used_on_fee_id   uuid references job_fees(id) on delete set null,
  created_at       timestamptz not null default now(),
  used_at          timestamptz
);
create index if not exists job_fee_credits_company_idx on job_fee_credits (company_id) where used_on_fee_id is null;
alter table job_fee_credits enable row level security;
drop policy if exists job_fee_credits_read on job_fee_credits;
create policy job_fee_credits_read on job_fee_credits for select using (company_id = my_company_id());

-- 4. VoltMira's monthly statements, in their own invoice series (VMF-2026-000001)
create sequence if not exists job_fee_invoice_seq;
create table if not exists job_fee_invoices (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  company_id       uuid not null references companies(id) on delete cascade,
  fee_ids          uuid[] not null,
  buyer            jsonb not null,                       -- the installer's company as it was on the day
  seller           jsonb not null,                       -- VoltMira's details as they were on the day
  net_minor        bigint not null check (net_minor >= 0),
  vat_rate         numeric(5, 2) not null default 0 check (vat_rate >= 0),
  vat_minor        bigint not null default 0 check (vat_minor >= 0),
  total_minor      bigint not null check (total_minor >= 0),
  currency         text not null default 'MDL' check (currency = 'MDL'),
  payment_ref      text not null,
  issued_at        timestamptz not null default now(),
  due_at           timestamptz not null
);
create index if not exists job_fee_invoices_company_idx on job_fee_invoices (company_id, issued_at desc);
-- the month a statement is for, and when the transfer arrived
alter table job_fee_invoices add column if not exists month text check (month is null or month ~ '^[0-9]{4}-[0-9]{2}$');
alter table job_fee_invoices add column if not exists paid_at timestamptz;
create unique index if not exists job_fee_invoices_month_key on job_fee_invoices (company_id, month) where month is not null;
alter table job_fee_invoices enable row level security;
drop policy if exists job_fee_invoices_read on job_fee_invoices;
create policy job_fee_invoices_read on job_fee_invoices for select using (company_id = my_company_id());
-- the next number, for the server only
create or replace function next_job_fee_invoice_no() returns text
language sql security definer set search_path = public as $$
  select 'VMF-' || to_char(now() at time zone 'Europe/Chisinau', 'YYYY') || '-' || lpad(nextval('job_fee_invoice_seq')::text, 6, '0')
$$;
revoke all on function next_job_fee_invoice_no() from public, anon, authenticated;

-- 5. the statements' reminders
create table if not exists job_fee_statement_reminders (
  invoice_id  uuid not null references job_fee_invoices(id) on delete cascade,
  step        text not null check (step in ('issued', 'week', 'last_day', 'locked')),
  sent_at     timestamptz not null default now(),
  primary key (invoice_id, step)
);
alter table job_fee_statement_reminders enable row level security;

-- 6. demo projects: never charged, and only the server marks one
alter table public.projects add column if not exists is_sample boolean not null default false;
drop trigger if exists projects_lock_sample on public.projects;
create trigger projects_lock_sample before update on public.projects
  for each row execute function lock_columns('is_sample');
create or replace function projects_new_not_sample() returns trigger language plpgsql as $$
begin
  if is_user_session() then new.is_sample := false; end if;
  return new;
end $$;
drop trigger if exists projects_insert_not_sample on public.projects;
create trigger projects_insert_not_sample before insert on public.projects
  for each row execute function projects_new_not_sample();

-- Check it worked (optional):
--   select count(*) from job_fees;
--   select tgname from pg_trigger where tgname in ('projects_lock_sample', 'projects_insert_not_sample');


-- ============================================================ 9. add-fee-lockdown.sql
-- add-fee-lockdown.sql
-- The fee for signed jobs cannot be dodged (docs/features/fee-lockdown.md). One paste: Supabase > SQL Editor >
-- New query, paste this whole file, Run. Safe to run again. Run it after add-job-fees.sql.
--
--   1. job_fees keeps when the first paperwork was made for the job (cancelling is free only before it), the job's
--      name (so a fee outlives a deleted job), and a request to VoltMira to waive it.
--   2. A fee is no longer deleted with its job: the job's row can go, the fee stays.
--   3. The company tax id must have a valid check digit (an invented IDNO no longer passes).
--   4. fee_hold_level(): how far a workspace is held for an unpaid statement (1 paperwork, 2 no new offers after
--      30 days late, 3 read-only after 60), and the row rules that enforce 2 and 3 in the database itself.
--   5. The statement reminders for the 30 and 60 day steps.
--   6. A fee and a statement outlive a deleted workspace (the free jobs stay counted on its tax id).
--   7. projects.won_at: stamped by the database the moment a job turns signed, whatever wrote the status, so the
--      daily check finds a signed job that has no fee (and never charges a job signed before fees existed).

-- 1. what the fee keeps
alter table public.job_fees add column if not exists docs_at timestamptz;
alter table public.job_fees add column if not exists docs_kinds text[] not null default '{}';
alter table public.job_fees add column if not exists project_title text not null default '';
alter table public.job_fees add column if not exists client_name text not null default '';
alter table public.job_fees add column if not exists waiver_reason text not null default '' check (char_length(waiver_reason) <= 500);
alter table public.job_fees add column if not exists waiver_requested_at timestamptz;
-- the names of the jobs that already have a fee
update public.job_fees f set project_title = coalesce(p.title, ''), client_name = coalesce(p.client_name, '')
  from public.projects p where p.id = f.project_id and f.project_title = '';

-- 2. a fee outlives its job
alter table public.job_fees alter column project_id drop not null;
alter table public.job_fees drop constraint if exists job_fees_project_id_fkey;
alter table public.job_fees add constraint job_fees_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;

-- 3. a real IDNO: 13 digits, the last one the check digit (weights 7, 3, 1 over the first twelve, modulo 10)
create or replace function idno_ok(v text) returns boolean
language sql immutable as $$
  select v ~ '^[0-9]{13}$' and (
    (substr(v,1,1)::int*7 + substr(v,2,1)::int*3 + substr(v,3,1)::int*1 +
     substr(v,4,1)::int*7 + substr(v,5,1)::int*3 + substr(v,6,1)::int*1 +
     substr(v,7,1)::int*7 + substr(v,8,1)::int*3 + substr(v,9,1)::int*1 +
     substr(v,10,1)::int*7 + substr(v,11,1)::int*3 + substr(v,12,1)::int*1) % 10
  ) = substr(v,13,1)::int
$$;
alter table public.companies drop constraint if exists companies_idno_check;
-- not valid: an IDNO already saved stays as it is; every new or changed one must pass
alter table public.companies add constraint companies_idno_check check (idno is null or idno_ok(idno)) not valid;

-- 4. how far a workspace is held for an unpaid statement, counted in Chișinău days from its date to pay
create or replace function fee_hold_level(p_company uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(case when d >= 60 then 3 when d >= 30 then 2 when d >= 0 then 1 else 0 end), 0)::int
  from (
    select (now() at time zone 'Europe/Chisinau')::date - (i.due_at at time zone 'Europe/Chisinau')::date as d
    from job_fee_invoices i
    where i.company_id = p_company and i.paid_at is null and i.month is not null
      and exists (select 1 from job_fees f where f.invoice_id = i.id and f.status = 'due')
  ) x
$$;
revoke all on function fee_hold_level(uuid) from public, anon;
grant execute on function fee_hold_level(uuid) to authenticated, service_role;

-- 30 days late: no new offers, and the ones made are not changed (a signed-in user only; the server is not held)
drop policy if exists proposals_fee_hold_insert on proposals;
create policy proposals_fee_hold_insert on proposals as restrictive for insert to authenticated
  with check (fee_hold_level(company_id) < 2);
drop policy if exists proposals_fee_hold_update on proposals;
create policy proposals_fee_hold_update on proposals as restrictive for update to authenticated
  using (fee_hold_level(company_id) < 2) with check (fee_hold_level(company_id) < 2);
-- 60 days late: the quotes are read-only (nothing is deleted, nothing can be changed)
drop policy if exists projects_fee_hold_insert on projects;
create policy projects_fee_hold_insert on projects as restrictive for insert to authenticated
  with check (fee_hold_level(company_id) < 3);
drop policy if exists projects_fee_hold_update on projects;
create policy projects_fee_hold_update on projects as restrictive for update to authenticated
  using (fee_hold_level(company_id) < 3) with check (fee_hold_level(company_id) < 3);
drop policy if exists projects_fee_hold_delete on projects;
create policy projects_fee_hold_delete on projects as restrictive for delete to authenticated
  using (fee_hold_level(company_id) < 3);

-- 5. the reminders for the next steps
alter table public.job_fee_statement_reminders drop constraint if exists job_fee_statement_reminders_step_check;
alter table public.job_fee_statement_reminders add constraint job_fee_statement_reminders_step_check
  check (step in ('issued', 'week', 'last_day', 'locked', 'warn30', 'hold30', 'warn60', 'hold60'));

-- 6. a fee and a statement outlive a deleted workspace
alter table public.job_fees alter column company_id drop not null;
alter table public.job_fees drop constraint if exists job_fees_company_id_fkey;
alter table public.job_fees add constraint job_fees_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;
alter table public.job_fee_invoices alter column company_id drop not null;
alter table public.job_fee_invoices drop constraint if exists job_fee_invoices_company_id_fkey;
alter table public.job_fee_invoices add constraint job_fee_invoices_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

-- 7. the moment a job turns signed, stamped by the database (a status written by any path gets it; it cannot be
--    cleared or moved while the job stays signed)
alter table public.projects add column if not exists won_at timestamptz;
create or replace function projects_stamp_won() returns trigger
language plpgsql as $$
begin
  if new.status = 'won' then
    if tg_op = 'UPDATE' and old.status = 'won' then
      new.won_at := old.won_at;
    else
      new.won_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists projects_stamp_won on public.projects;
create trigger projects_stamp_won before insert or update of status, won_at on public.projects
  for each row execute function projects_stamp_won();

-- Check it worked (optional):
--   select idno_ok('1003600123456') as invented, fee_hold_level(id) from companies limit 3;


-- ============================================================ 10. add-jobs-board.sql
-- add-jobs-board.sql
-- Phase 3, the jobs board, crews and the on-site record (docs/features/phase3.md). One paste: Supabase > SQL Editor >
-- New query, paste this whole file, Run. Safe to run again. Runs on its own: no other pending file is needed first.
--
--   1. crews: a workspace's install crews (name, people, colour).
--   2. crew_visits: a crew's visit to a job (survey, installation, service) with its time, and whether the client is
--      told by email.
--   3. job_site: what the crew records on site for a won job: the checklist, the serial numbers, the client's
--      signature, with a version so a phone that was offline merges instead of overwriting.
--   4. job_photos and the private bucket "job-photos": the site photos, full size, under <company_id>/<project_id>/.
-- Each workspace reads and writes only its own rows and files.

-- 1. crews
create table if not exists crews (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default my_company_id() references companies(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  members     text not null default '' check (char_length(members) <= 200),
  color       text not null default '#1e6b4e' check (color ~ '^#[0-9a-f]{6}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists crews_company_idx on crews (company_id, active);
alter table crews enable row level security;
drop policy if exists crews_all on crews;
create policy crews_all on crews for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 2. visits
create table if not exists crew_visits (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null default my_company_id() references companies(id) on delete cascade,
  project_id     uuid not null references projects(id) on delete cascade,
  crew_id        uuid references crews(id) on delete set null,
  kind           text not null check (kind in ('survey', 'install', 'service', 'other')),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  note           text not null default '' check (char_length(note) <= 500),
  notify_client  boolean not null default true,
  notified_at    timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists crew_visits_company_idx on crew_visits (company_id, starts_at);
create index if not exists crew_visits_project_idx on crew_visits (project_id, starts_at);
alter table crew_visits enable row level security;
drop policy if exists crew_visits_all on crew_visits;
create policy crew_visits_all on crew_visits for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 3. the on-site record
create table if not exists job_site (
  project_id  uuid primary key references projects(id) on delete cascade,
  company_id  uuid not null default my_company_id() references companies(id) on delete cascade,
  record      jsonb not null default '{}'::jsonb,
  version     integer not null default 0,
  updated_by  text not null default '' check (char_length(updated_by) <= 120),
  updated_at  timestamptz not null default now()
);
alter table job_site enable row level security;
drop policy if exists job_site_all on job_site;
create policy job_site_all on job_site for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 4. the photos
create table if not exists job_photos (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default my_company_id() references companies(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  slot        text not null check (slot in ('roof', 'array', 'inverter', 'board', 'meter', 'labels', 'other')),
  path        text not null unique,
  client_id   text not null unique check (char_length(client_id) between 8 and 64),   -- the device's id: sent twice, kept once
  taken_at    timestamptz,
  taken_by    text not null default '' check (char_length(taken_by) <= 120),
  created_at  timestamptz not null default now()
);
create index if not exists job_photos_project_idx on job_photos (project_id, created_at);
alter table job_photos enable row level security;
drop policy if exists job_photos_all on job_photos;
create policy job_photos_all on job_photos for all using (company_id = my_company_id()) with check (company_id = my_company_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists job_photos_read on storage.objects;
create policy job_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = my_company_id()::text);
drop policy if exists job_photos_insert on storage.objects;
create policy job_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = my_company_id()::text);
drop policy if exists job_photos_delete on storage.objects;
create policy job_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = my_company_id()::text);

-- Check it worked (optional):
--   select id, public from storage.buckets where id = 'job-photos';


-- ============================================================ 11. add-milestones.sql
-- add-milestones.sql
-- The client's payments in stages (docs/features/phase4.md): 50% at signing, 40% at installation, 10% at grid
-- connection by default, each stage an invoice from the installer's own series, paid by bank transfer against a pay
-- link, with reminders. One paste: Supabase > SQL Editor > New query, paste this whole file, Run. Safe to run again.
-- Runs on its own.
--
--   1. companies.pay_schedule: the workspace's default stages and days to pay.
--   2. projects.pay_schedule: one job's own stages (empty: the workspace's).
--   3. pay_milestones: each stage of each job, its invoice number, due day, what was paid, its pay link.
--   4. payments.milestone_id: a payment recorded against a stage.
--   5. pay_milestone_reminders: which reminder went out for which stage, so none goes twice.
--   6. next_invoice_no_srv(): the installer's invoice number, drawn by the server when a client signs online.
--   7. the private bucket pay-proofs: the proof of transfer a client uploads on the pay link.
-- Each workspace reads its own rows; the server writes them.

-- 1, 2. the schedules
alter table public.companies add column if not exists pay_schedule jsonb;
alter table public.projects add column if not exists pay_schedule jsonb;

-- 3. the stages
create table if not exists pay_milestones (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  project_id        uuid not null references projects(id) on delete cascade,
  seq               smallint not null check (seq between 1 and 20),
  trigger           text not null check (trigger in ('signed', 'order', 'install', 'grid', 'commission')),
  pct               numeric(5, 2) not null check (pct > 0 and pct <= 100),
  amount_minor      bigint not null check (amount_minor >= 0),
  currency          text not null check (currency in ('MDL', 'EUR', 'RON', 'UAH')),
  status            text not null default 'planned' check (status in ('planned', 'issued', 'paid', 'void')),
  term_days         smallint not null default 7 check (term_days between 1 and 60),
  invoice_no        text,
  issued_at         timestamptz,
  due_on            date,
  paid_minor        bigint not null default 0 check (paid_minor >= 0),
  paid_at           date,
  pay_token         text not null unique check (char_length(pay_token) between 20 and 64),
  reminders_paused  boolean not null default false,
  proof_path        text,
  proof_at          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, seq)
);
create unique index if not exists pay_milestones_invoice_key on pay_milestones (company_id, invoice_no) where invoice_no is not null;
create index if not exists pay_milestones_company_idx on pay_milestones (company_id, status, due_on);
alter table pay_milestones enable row level security;
drop policy if exists pay_milestones_read on pay_milestones;
create policy pay_milestones_read on pay_milestones for select using (company_id = my_company_id());

-- 4. a payment against a stage (payments comes from add-integrations.sql; skipped quietly before it)
do $$
begin
  if to_regclass('public.payments') is not null then
    alter table public.payments add column if not exists milestone_id uuid references pay_milestones(id) on delete set null;
    create index if not exists payments_milestone_idx on public.payments (milestone_id) where milestone_id is not null;
  end if;
end $$;

-- 5. the reminders
create table if not exists pay_milestone_reminders (
  milestone_id  uuid not null references pay_milestones(id) on delete cascade,
  step          text not null check (step in ('issued', 'before3', 'due', 'late3', 'late10')),
  sent_at       timestamptz not null default now(),
  primary key (milestone_id, step)
);
alter table pay_milestone_reminders enable row level security;

-- 6. the installer's next invoice number, for the server only (next_invoice_no() answers only a signed-in member
-- of the company; a client signing online has no such session)
alter table public.companies add column if not exists invoice_seq integer;
create or replace function next_invoice_no_srv(p_company uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  update companies set invoice_seq = coalesce(invoice_seq, 0) + 1 where id = p_company returning invoice_seq into v;
  return v;
end
$$;
revoke all on function next_invoice_no_srv(uuid) from public, anon, authenticated;
grant execute on function next_invoice_no_srv(uuid) to service_role;

-- 7. the proofs of transfer: private, 8 MB, images or PDF; written and read only by the server
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pay-proofs', 'pay-proofs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Check it worked (optional):
--   select count(*) from pay_milestones;
--   select id, public from storage.buckets where id = 'pay-proofs';


-- ============================================================ 12. add-service.sql
-- add-service.sql
-- Phase 5, after the handover (docs/features/phase5.md): the client's requests, the yearly check and the warranties
-- of each installed system. One paste: Supabase > SQL Editor > New query, paste this whole file, Run. Safe to run
-- again. Run it after add-jobs-board.sql (it adds the "maintenance" visit kind to crew_visits).
--
--   1. companies: the working days to answer a request, the months between checks, the client's check reminder.
--   2. projects: the client's "report a problem" link, checks on or off for the job.
--   3. service_requests and service_request_events: a request and every change to it.
--   4. service_photos and the private bucket service-photos: the photos sent with a request.
--   5. maintenance_checks: each yearly check done (or planned, with its visit).
--   6. warranties: what was set by hand for a system (the rest come from the catalog and the workspace).
--   7. service_reminders: which reminder went out, so none goes twice.
--   8. crew_visits: the "maintenance" kind.
-- Each workspace reads its own rows; the server writes them.

-- 1. the workspace's settings
alter table public.companies add column if not exists service_reply_days smallint not null default 2;
alter table public.companies add column if not exists maintenance_months smallint not null default 12;
alter table public.companies add column if not exists maintenance_client_reminder boolean not null default true;
alter table public.companies drop constraint if exists companies_service_reply_days_check;
alter table public.companies add constraint companies_service_reply_days_check check (service_reply_days between 1 and 10);
alter table public.companies drop constraint if exists companies_maintenance_months_check;
alter table public.companies add constraint companies_maintenance_months_check check (maintenance_months between 3 and 36);

-- 2. the job's link and checks
alter table public.projects add column if not exists service_token text;
create unique index if not exists projects_service_token_key on public.projects (service_token) where service_token is not null;
alter table public.projects add column if not exists maintenance_off boolean not null default false;

-- 3. the requests
create table if not exists service_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  source          text not null check (source in ('client', 'installer')),
  kind            text not null check (kind in ('no_production', 'inverter_error', 'damage', 'roof_leak', 'other')),
  description     text not null check (char_length(description) between 3 and 2000),
  contact_name    text not null default '' check (char_length(contact_name) <= 120),
  contact_phone   text not null default '' check (char_length(contact_phone) <= 24),
  status          text not null default 'new' check (status in ('new', 'planned', 'in_progress', 'resolved', 'closed')),
  visit_id        uuid,
  first_reply_at  timestamptz,
  resolved_at     timestamptz,
  resolution      text not null default '' check (char_length(resolution) <= 2000),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists service_requests_company_idx on service_requests (company_id, status, created_at desc);
create index if not exists service_requests_project_idx on service_requests (project_id, created_at desc);
alter table service_requests enable row level security;
drop policy if exists service_requests_read on service_requests;
create policy service_requests_read on service_requests for select using (company_id = my_company_id());

create table if not exists service_request_events (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references service_requests(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  actor        text not null default '' check (char_length(actor) <= 160),
  from_status  text,
  to_status    text,
  note         text not null default '' check (char_length(note) <= 2000),
  created_at   timestamptz not null default now()
);
create index if not exists service_request_events_idx on service_request_events (request_id, created_at);
alter table service_request_events enable row level security;
drop policy if exists service_request_events_read on service_request_events;
create policy service_request_events_read on service_request_events for select using (company_id = my_company_id());

-- 4. the photos: private, 8 MB each, images only; written and read through the server
create table if not exists service_photos (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references service_requests(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  path        text not null unique,
  created_at  timestamptz not null default now()
);
alter table service_photos enable row level security;
drop policy if exists service_photos_read on service_photos;
create policy service_photos_read on service_photos for select using (company_id = my_company_id());
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-photos', 'service-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 5. the yearly checks
create table if not exists maintenance_checks (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  due_on      date not null,
  visit_id    uuid,
  done_on     date,
  note        text not null default '' check (char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  unique (project_id, due_on)
);
create index if not exists maintenance_checks_company_idx on maintenance_checks (company_id, done_on);
alter table maintenance_checks enable row level security;
drop policy if exists maintenance_checks_read on maintenance_checks;
create policy maintenance_checks_read on maintenance_checks for select using (company_id = my_company_id());

-- 6. the warranties set by hand
create table if not exists warranties (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  item        text not null check (item in ('panels', 'performance', 'inverter', 'battery', 'install')),
  product     text not null default '' check (char_length(product) <= 160),
  years       numeric(4, 1) check (years is null or (years > 0 and years <= 40)),
  starts_on   date,
  note        text not null default '' check (char_length(note) <= 500),
  updated_at  timestamptz not null default now(),
  unique (project_id, item)
);
alter table warranties enable row level security;
drop policy if exists warranties_read on warranties;
create policy warranties_read on warranties for select using (company_id = my_company_id());

-- 7. the reminders sent
create table if not exists service_reminders (
  key      text primary key check (char_length(key) <= 200),   -- e.g. "check-client:<project>:<due day>"
  sent_at  timestamptz not null default now()
);
alter table service_reminders enable row level security;

-- 8. the yearly check as a visit kind (crew_visits comes from add-jobs-board.sql; skipped quietly before it)
do $$
begin
  if to_regclass('public.crew_visits') is not null then
    alter table public.crew_visits drop constraint if exists crew_visits_kind_check;
    alter table public.crew_visits add constraint crew_visits_kind_check check (kind in ('survey', 'install', 'service', 'maintenance', 'other'));
  end if;
end $$;

-- Check it worked (optional):
--   select count(*) from service_requests;
--   select id, public from storage.buckets where id = 'service-photos';


-- ============================================================ 13. add-signups-view.sql
-- add-signups-view.sql
-- Who is signing up, readable at a glance. One paste: Supabase > SQL Editor > New query, paste this whole file, Run.
-- Safe to run again. Changes no table and no data: three read-only views in their own schema, `admin`.
--
-- Why not tidy `profiles` itself: it is small (one row per person in a workspace), but every /demo visit adds four
-- demo accounts that live up to 24 hours, invited teammates sit next to new installers, and someone who signed up
-- but never finished creating their company has no profile row at all. The views below start from the sign-in
-- accounts (auth.users), leave the demo out, and say what each one is.
--
-- Where to look afterwards:
--   Table Editor > schema "admin" (the dropdown at the top left) > signups, signups_by_day, signups_summary
--   or in the SQL Editor:  select * from admin.signups_summary;
--
-- The `admin` schema is not served by the API (only `public` is), and anon / signed-in users get no access to it:
-- these views read auth.users, so they are for you in the dashboard only.

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- 1. every real account, newest first
create or replace view admin.signups as
select
  u.email,
  coalesce(nullif(p.name, ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '') as name,
  c.name as company,
  case
    when p.id is null then 'did not finish'          -- signed up, never created the company
    when p.role = 'owner' then 'new workspace'
    else 'invited teammate'
  end as kind,
  (u.created_at at time zone 'Europe/Chisinau')::timestamp(0) as signed_up,
  (u.last_sign_in_at at time zone 'Europe/Chisinau')::timestamp(0) as last_sign_in,
  u.email_confirmed_at is not null as email_confirmed,
  coalesce(u.raw_app_meta_data ->> 'provider', 'email') as signed_up_with,
  (select count(*) from public.projects pr where pr.company_id = c.id and not pr.sample) as quotes,
  (select count(*) from public.projects pr where pr.company_id = c.id and pr.status = 'won' and not pr.sample) as signed_jobs,
  c.lang as language,
  u.id as user_id,
  c.id as company_id
from auth.users u
left join public.profiles p on p.id = u.id
left join public.companies c on c.id = p.company_id
where u.email not ilike '%@demo.voltmira.com'
order by u.created_at desc;

-- 2. one row per day (Chișinău), newest first, with the running total of workspaces
create or replace view admin.signups_by_day as
select
  s.signed_up::date as day,
  count(*) as accounts,
  count(*) filter (where s.kind = 'new workspace') as new_workspaces,
  count(*) filter (where s.kind = 'invited teammate') as teammates,
  count(*) filter (where s.kind = 'did not finish') as did_not_finish,
  sum(count(*) filter (where s.kind = 'new workspace')) over (order by s.signed_up::date) as workspaces_so_far
from admin.signups s
group by s.signed_up::date
order by day desc;

-- 3. the numbers in one row
create or replace view admin.signups_summary as
with t as (select (now() at time zone 'Europe/Chisinau')::date as today)
select
  count(*) filter (where s.kind = 'new workspace') as workspaces_total,
  count(*) filter (where s.kind = 'new workspace' and s.signed_up >= t.today) as workspaces_today,
  count(*) filter (where s.kind = 'new workspace' and s.signed_up >= t.today - 6) as workspaces_last_7_days,
  count(*) filter (where s.kind = 'new workspace' and s.signed_up >= t.today - 29) as workspaces_last_30_days,
  count(*) filter (where s.kind = 'new workspace' and s.quotes > 0) as workspaces_with_a_quote,
  count(*) filter (where s.kind = 'new workspace' and s.signed_jobs > 0) as workspaces_with_a_signed_job,
  count(*) filter (where s.kind = 'invited teammate') as teammates_total,
  count(*) filter (where s.kind = 'did not finish') as did_not_finish_total,
  -- demo workspaces live 24 hours (the daily clean-up), so this is roughly the last day's /demo visits
  (select count(*) from public.profiles d where d.role = 'owner' and d.email ilike '%@demo.voltmira.com') as demo_visits_last_24h
from admin.signups s, t
group by t.today;

-- Check it worked (optional):
--   select * from admin.signups_summary;
--   select * from admin.signups_by_day limit 14;
--   select email, company, kind, signed_up, quotes from admin.signups limit 20;
