-- add-proposal-nudges.sql
-- Automated day-3/7/14 follow-up nudges for proposals still unaccepted (a
-- Make.com scenario calls into this app to run them — see
-- docs/MAKE_AUTOMATIONS.md for the full setup).
--
--   proposals.nudge_count    how many tiers have actually been sent (0-3);
--                            also the idempotency key a retried Make.com
--                            call is checked against, so a lost HTTP
--                            response can never cause a duplicate email.
--   proposals.last_nudge_at  audit trail only.
--   companies.nudge_enabled  OFF by default on purpose: this feature emails
--                            an installer's REAL client, under the
--                            installer's own brand, with AI-phrased copy
--                            the installer never wrote or approved. That
--                            must be an explicit opt-in from Settings for
--                            every company, not silently on the day this
--                            migration runs.
--   projects.client_email    nothing in this app stored a client's email
--                            address before now — the "send by email" share
--                            flow only ever took one typed fresh each time,
--                            nowhere persisted. Without a stored address the
--                            nudge endpoint has no one to email; this column
--                            is the real prerequisite, not an add-on.
--
-- Nullable/defaulted + idempotent; the app degrades gracefully before this
-- runs (the automation endpoints simply return nothing to nudge). Run once.

alter table proposals add column if not exists nudge_count int not null default 0;
alter table proposals add column if not exists last_nudge_at timestamptz;
alter table companies add column if not exists nudge_enabled boolean not null default false;
alter table projects add column if not exists client_email text not null default '';
