-- add-deadline-alerts.sql
-- The weekly "permits and deadlines" email (lib/deadlineRun.js, the Monday cron
-- in vercel.json): each company can turn it off in Settings, under
-- Notifications. On by default. Safe to run twice.
alter table companies add column if not exists notify_deadlines boolean not null default true;
