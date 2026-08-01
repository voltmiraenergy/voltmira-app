-- add-install-progress.sql
-- Post-sale tracking: once a quote is Won, the installer's job continues — permit,
-- equipment, install, grid connection, commissioning. This stores which of those
-- steps are done per project (a small map of step-key -> ISO date completed).
-- Idempotent; degrades gracefully (the app treats a missing column as "{}").

alter table projects add column if not exists install_progress jsonb not null default '{}'::jsonb;
