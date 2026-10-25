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
