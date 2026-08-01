-- add-followup-snooze.sql
-- Lets an installer dismiss a "needs follow-up" reminder on the dashboard so they
-- stop piling up. Dismissing sets this timestamp; the reminder is hidden for a
-- week, then re-surfaces if the quote is still cold (so a real follow-up is never
-- lost forever). Idempotent; missing column = never snoozed.

alter table projects add column if not exists followup_snoozed_at timestamptz;
