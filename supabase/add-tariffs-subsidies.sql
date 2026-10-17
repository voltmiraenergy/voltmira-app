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
