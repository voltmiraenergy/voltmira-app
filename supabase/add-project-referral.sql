-- Adds a referral-source field to projects. The client-facing proposal asks
-- "how did you hear about us?"; the answer is stored here, per project, so the
-- installer can see over time which past clients drive new word-of-mouth
-- business. Safe to run more than once.
--
-- Run this as its own standalone block in the Supabase SQL editor.
alter table projects add column if not exists referral_source text not null default '';
