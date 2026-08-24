-- add-referrals.sql
-- Referral program: each company gets a unique referral_code; a new company that
-- signs up via someone's link is attributed with referred_by, and a row is added
-- to `referrals` so the referrer can see who they brought in. Idempotent.

alter table companies add column if not exists referral_code text;
alter table companies add column if not exists referred_by  uuid references companies(id);
create unique index if not exists companies_referral_code_idx
  on companies(referral_code) where referral_code is not null;

create table if not exists referrals (
  id                   uuid primary key default gen_random_uuid(),
  referrer_company_id  uuid not null references companies(id) on delete cascade,
  referred_company_id  uuid not null references companies(id) on delete cascade,
  referred_name        text not null default '',
  status               text not null default 'signed_up'
                       check (status in ('signed_up','subscribed','rewarded')),
  created_at           timestamptz not null default now(),
  unique(referred_company_id)   -- a company can only be referred once
);
create index if not exists referrals_referrer_idx on referrals(referrer_company_id, created_at);

alter table referrals enable row level security;
-- The referrer can read their own referrals. Writes go through the service role
-- (server action), so no insert/update policy is exposed to the client.
drop policy if exists referrals_owner_read on referrals;
create policy referrals_owner_read on referrals for select
  using (referrer_company_id = my_company_id());
