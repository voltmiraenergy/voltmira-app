-- Adds a free-text notes field to projects so installers can record client
-- context ("wants battery storage", "waiting on HOA approval", "call back
-- Thursday") right on the quote. Shown in the editor and flagged on the table.
-- Safe to run more than once.
--
-- Run this as its own standalone block in the Supabase SQL editor.
alter table projects add column if not exists notes text not null default '';
