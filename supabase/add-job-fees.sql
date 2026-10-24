-- add-job-fees.sql
-- VoltMira's fee per won project (docs/features/job-fees.md). One paste: Supabase > SQL Editor > New query, paste
-- this whole file, Run. Safe to run again. Runs on its own: no other pending file is needed first.
--
--   1. The installer's company tax id (IDNO): the first 3 won projects are free per company, across its workspaces.
--   2. job_fees: one fee per won project, ever, with its tier, amount in lei, status and the 14 days to pay.
--   3. job_fee_payments: every attempt to pay (card or transfer), so a payment confirmed twice counts once.
--   4. job_fee_credits: the amount of a paid job later cancelled, kept for the next fee.
--   5. job_fee_invoices: VoltMira's own invoice for each fee (or each month), in its own number series.
--   6. job_fee_reminders: which reminder went out for which fee, so none goes twice.
--   7. projects.is_sample: a demo project, never charged; only the server can set it.
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
-- one invoice a month instead of one per fee (offered from 3 paid fees on)
alter table public.companies add column if not exists fee_monthly_invoice boolean not null default false;
-- only the server sets the tax id (Settings goes through it), and not once a fee carries it: a new id would hand out
-- three more free projects
drop trigger if exists companies_lock_idno on public.companies;
create trigger companies_lock_idno before update on public.companies
  for each row execute function lock_columns('idno', 'fee_monthly_invoice');

-- 2. the fees
create table if not exists job_fees (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null unique references projects(id) on delete cascade,
  idno            text check (idno is null or idno ~ '^[0-9]{13}$'),   -- empty until the company enters it
  kw              numeric(10, 2) not null default 0 check (kw >= 0),
  tier            smallint not null check (tier between 0 and 3),
  amount_minor    bigint not null check (amount_minor >= 0),
  currency        text not null default 'MDL' check (currency = 'MDL'),
  status          text not null check (status in ('free', 'due', 'paid', 'void', 'waived')),
  trigger         text not null check (trigger in ('signed', 'manual')),
  free_slot       smallint check (free_slot between 1 and 3),
  won_at          timestamptz not null,
  grace_ends_at   timestamptz not null,
  paid_at         timestamptz,
  payment_method  text check (payment_method in ('card', 'transfer', 'credit', 'admin')),
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

-- 3. the attempts to pay
create table if not exists job_fee_payments (
  id               uuid primary key default gen_random_uuid(),
  fee_id           uuid not null references job_fees(id) on delete cascade,
  company_id       uuid not null references companies(id) on delete cascade,
  order_id         text not null unique check (char_length(order_id) between 6 and 64),
  method           text not null check (method in ('card', 'transfer')),
  gateway          text not null default '' check (char_length(gateway) <= 40),
  amount_minor     bigint not null check (amount_minor > 0),
  status           text not null default 'started' check (status in ('started', 'paid', 'failed', 'cancelled')),
  reply            jsonb,
  idempotency_key  text not null unique check (char_length(idempotency_key) between 8 and 120),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists job_fee_payments_fee_idx on job_fee_payments (fee_id, created_at desc);
alter table job_fee_payments enable row level security;
drop policy if exists job_fee_payments_read on job_fee_payments;
create policy job_fee_payments_read on job_fee_payments for select using (company_id = my_company_id());

-- 4. credits from cancelled paid jobs
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

-- 5. VoltMira's invoices for the fees, in their own series (VMF-2026-000001)
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
alter table job_fee_invoices enable row level security;
drop policy if exists job_fee_invoices_read on job_fee_invoices;
create policy job_fee_invoices_read on job_fee_invoices for select using (company_id = my_company_id());
-- the next number, for the server only
create or replace function next_job_fee_invoice_no() returns text
language sql security definer set search_path = public as $$
  select 'VMF-' || to_char(now() at time zone 'Europe/Chisinau', 'YYYY') || '-' || lpad(nextval('job_fee_invoice_seq')::text, 6, '0')
$$;
revoke all on function next_job_fee_invoice_no() from public, anon, authenticated;

-- 6. the reminders sent
create table if not exists job_fee_reminders (
  fee_id      uuid not null references job_fees(id) on delete cascade,
  step        text not null check (step in ('won', 'week', 'last_day', 'locked')),
  sent_at     timestamptz not null default now(),
  primary key (fee_id, step)
);
alter table job_fee_reminders enable row level security;

-- 7. demo projects: never charged, and only the server marks one
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
