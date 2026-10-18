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
