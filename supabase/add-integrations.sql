-- supabase/add-integrations.sql — Phase 3, legally valid local integrations
-- (docs/INTEGRATIONS.md): qualified e-signatures (MSign/MPass), e-Factura
-- submissions to SFS, payments and the 1C export mapping, and grid-operator
-- submissions with their status history. Runs on its own (the append-only
-- guard is created below too); the audit log comes from
-- add-tariffs-subsidies.sql. Safe to run more than once.
--
-- Money is integer minor units with a currency. Each workspace reads its own
-- rows; the server writes the integration records (service role), the
-- installer writes payments and the export mapping on their own session.

-- The append-only guard, also created by add-tariffs-subsidies.sql; repeated
-- here so this file runs on its own, in any order.
create or replace function refuse_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows are append-only: add a new version instead', tg_table_name;
end $$;

-- 1. Qualified signatures (MSign with MPass). The signed container is kept as
--    it came back; proposals.signature_level says which kind signed the offer.
create table if not exists qualified_signatures (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  proposal_code    text not null,
  provider         text not null check (provider in ('msign', 'msign_mock')),
  request_id       text not null unique check (char_length(request_id) between 4 and 120),
  status           text not null default 'pending' check (status in ('pending', 'signed', 'failed', 'expired')),
  document_hash    text not null check (document_hash ~ '^[0-9a-f]{64}$'),
  signer_name      text not null default '' check (char_length(signer_name) <= 200),
  container        text,                                   -- base64, as the provider returned it
  verification     jsonb,                                  -- { valid, signer, issuer, signedAt, level, simulated }
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists qualified_signatures_code_idx on qualified_signatures(proposal_code);
alter table qualified_signatures enable row level security;
drop policy if exists qualified_signatures_read on qualified_signatures;
create policy qualified_signatures_read on qualified_signatures for select using (company_id = my_company_id());
alter table proposals add column if not exists signature_level text not null default 'simple'
  check (signature_level in ('simple', 'qualified'));

-- 2. e-Factura: one row per attempt to submit a quote's invoice.
create table if not exists efactura_submissions (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  project_id       uuid not null references projects(id) on delete cascade,
  invoice_no       text not null,
  attempt          integer not null check (attempt >= 1),
  provider         text not null check (provider in ('sfs', 'sfs_mock')),
  status           text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected', 'error')),
  sfs_ref          text not null default '' check (char_length(sfs_ref) <= 120),
  fiscal_number    text not null default '' check (char_length(fiscal_number) <= 120),
  error_code       text not null default '' check (char_length(error_code) <= 80),
  error_message    text not null default '' check (char_length(error_message) <= 500),
  payload_hash     text not null default '',
  gross_minor      bigint not null default 0,
  currency         text not null default 'MDL',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, attempt)
);
create index if not exists efactura_project_idx on efactura_submissions(project_id, attempt desc);
alter table efactura_submissions enable row level security;
drop policy if exists efactura_submissions_read on efactura_submissions;
create policy efactura_submissions_read on efactura_submissions for select using (company_id = my_company_id());

-- 3. Payments a client made against a quote's invoice (for the 1C export).
create table if not exists payments (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  project_id       uuid not null references projects(id) on delete cascade,
  amount_minor     bigint not null check (amount_minor > 0),
  currency         text not null check (currency in ('MDL', 'EUR', 'RON', 'UAH')),
  paid_at          date not null,
  method           text not null default 'bank' check (method in ('bank', 'cash', 'card')),
  reference        text not null default '' check (char_length(reference) <= 120),
  idempotency_key  text not null check (char_length(idempotency_key) between 8 and 80),
  created_by       uuid,
  created_at       timestamptz not null default now(),
  unique (company_id, idempotency_key)                     -- a double tap records one payment
);
create index if not exists payments_company_idx on payments(company_id, paid_at desc);
create index if not exists payments_project_idx on payments(project_id, paid_at desc);
alter table payments enable row level security;
drop policy if exists payments_all on payments;
create policy payments_all on payments for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 4. The 1C export's column mapping, one per workspace.
create table if not exists export_mappings (
  company_id       uuid primary key references companies(id) on delete cascade,
  mapping          jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);
alter table export_mappings enable row level security;
drop policy if exists export_mappings_all on export_mappings;
create policy export_mappings_all on export_mappings for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- 5. Grid-operator submissions and every status change after them.
create table if not exists grid_submissions (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  project_id       uuid not null references projects(id) on delete cascade,
  operator         text not null check (operator in ('premier', 'rednord')),
  channel          text not null check (channel in ('mock', 'email')),
  reference        text not null unique check (char_length(reference) between 6 and 40),
  status           text not null default 'submitted' check (status in ('submitted', 'docs_requested', 'approved', 'connected', 'rejected')),
  checklist        jsonb not null default '[]'::jsonb,       -- the documents and whether each was in the package
  package_hash     text not null default '',
  note             text not null default '' check (char_length(note) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists grid_submissions_project_idx on grid_submissions(project_id, created_at desc);
alter table grid_submissions enable row level security;
drop policy if exists grid_submissions_read on grid_submissions;
create policy grid_submissions_read on grid_submissions for select using (company_id = my_company_id());

create table if not exists grid_submission_events (
  id               bigint generated always as identity primary key,
  submission_id    uuid not null references grid_submissions(id) on delete cascade,
  company_id       uuid not null,
  from_status      text not null default '',
  to_status        text not null,
  source           text not null check (source in ('adapter', 'installer', 'operator')),
  event_id         text not null check (char_length(event_id) between 1 and 120),
  note             text not null default '' check (char_length(note) <= 1000),
  created_at       timestamptz not null default now(),
  unique (submission_id, event_id)
);
alter table grid_submission_events enable row level security;
drop policy if exists grid_submission_events_read on grid_submission_events;
create policy grid_submission_events_read on grid_submission_events for select using (company_id = my_company_id());
drop trigger if exists grid_submission_events_append_only on grid_submission_events;
create trigger grid_submission_events_append_only before update or delete on grid_submission_events
  for each row execute function refuse_change();
