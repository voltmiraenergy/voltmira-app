-- add-lead-visits.sql
-- A site visit on a lead: the date and time the installer goes to measure the
-- roof. Shown on the lead, on the dashboard (today, tomorrow, and "the visit
-- happened, send the quote"), and exported to the phone's calendar.
-- Safe to run twice.

alter table leads add column if not exists visit_at timestamptz;
create index if not exists leads_company_visit_idx on leads(company_id, visit_at)
  where visit_at is not null;
