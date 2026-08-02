-- add-activity-i18n.sql
-- Make the dashboard activity feed translatable. Rows now carry an i18n `key`
-- and `params` (translated at render time in the reader's language) instead of a
-- baked-in English sentence. The old `text` column stays as a fallback for
-- pre-existing rows, so this is fully backward-compatible and the app degrades
-- gracefully before this runs (writes fall back to text-only). Idempotent.

alter table activity add column if not exists key    text;
alter table activity add column if not exists params jsonb not null default '{}'::jsonb;

-- verify:
--   select kind, key, params, text from activity order by created_at desc limit 10;
