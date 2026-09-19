-- add-crm-webhook.sql
-- Outbound webhook for external CRMs (Bitrix24, amoCRM, or anything that
-- accepts a POST — Zapier/Make/n8n included): opt-in, one URL per company.
-- Same "disabled until the installer turns it on" posture as
-- add-proposal-nudges.sql's nudge_enabled. Idempotent.

alter table companies add column if not exists crm_webhook_url text;
alter table companies add column if not exists crm_webhook_enabled boolean not null default false;
