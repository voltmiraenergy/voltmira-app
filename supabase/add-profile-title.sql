-- Adds an optional job-title column to profiles so team members can carry a
-- role label (Sales / Engineer / Manager) shown on the Team page, independent
-- of the owner/member access role. Safe to run more than once.
--
-- Run this as its own standalone block in the Supabase SQL editor.
alter table profiles add column if not exists title text not null default '';
