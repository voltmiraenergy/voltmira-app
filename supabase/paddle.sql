-- supabase/paddle.sql — run ONCE in Supabase → SQL Editor → New query → Run.
-- Adds the columns the Paddle webhook writes to. Safe to re-run (IF NOT EXISTS).
alter table companies
  add column if not exists paddle_customer_id     text,
  add column if not exists paddle_subscription_id text;
