-- add-leads-status.sql
-- Adds a triage status to leads for the new Leads/Inbox tab: new → contacted →
-- converted (a quote was created from it) → archived. No CHECK constraint so the
-- app degrades gracefully before this runs (unknown/absent = treated as "new").
-- Existing rows default to 'new'. Idempotent.

alter table leads add column if not exists status text not null default 'new';

create index if not exists leads_company_status_idx on leads(company_id, status, created_at desc);

-- verify:
--   select status, count(*) from leads group by status;
