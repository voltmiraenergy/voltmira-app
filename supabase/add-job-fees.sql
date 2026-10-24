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
