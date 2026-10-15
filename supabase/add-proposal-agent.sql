-- add-proposal-agent.sql
-- The proposal assistant (app/api/proposal/[code]/qa, lib/proposalAgent.js):
-- answers the client's questions on a live proposal and, when the installer
-- allows it, negotiates within limits they set.
--
-- 1. companies.negotiation: the installer's limits (Settings > Proposal
--    assistant). Off by default: { enabled, maxDiscountPct, allowOptions }.
-- 2. proposal_offers: what the assistant agreed on a proposal (a discount, a
--    switch to an attached option) and when it handed the client to a person.
--    Written only by the server (service role) after lib/negotiation.js has
--    checked it; the installer's team can read their own.
-- Safe to re-run.

alter table companies add column if not exists negotiation jsonb not null default '{}'::jsonb;

create table if not exists proposal_offers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references proposals(code) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  kind        text not null check (kind in ('discount', 'option', 'escalation')),
  pct         numeric check (pct is null or (pct > 0 and pct <= 15)),    -- discount only
  option_no   int,                                                       -- option only, 1-based
  detail      jsonb not null default '{}'::jsonb,                        -- reason, summary, figures at the time
  status      text not null default 'open' check (status in ('open', 'replaced', 'accepted', 'closed')),
  created_at  timestamptz not null default now()
);
create index if not exists proposal_offers_code_idx on proposal_offers(code, created_at desc);
create index if not exists proposal_offers_company_idx on proposal_offers(company_id, created_at desc);

alter table proposal_offers enable row level security;
drop policy if exists proposal_offers_read on proposal_offers;
create policy proposal_offers_read on proposal_offers for select
  using (company_id = my_company_id());
-- No insert/update/delete policies: only the server writes offers.
