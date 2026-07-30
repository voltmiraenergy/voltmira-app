-- add-enterprise-plan.sql
-- Two launch fixes for the pricing change (Free removed, Enterprise added):
--
-- 1. The plan CHECK constraint only allowed ('free','pro','team'), so the Paddle
--    webhook / setPlan('enterprise') would throw a constraint violation and the
--    €299 tier could never be stored. Widen it to include 'enterprise'.
--
-- 2. New signups defaulted to 'free' — but there is no Free tier anymore, and a
--    free-plan company stamps "Powered by VoltMira" on its client proposals + PDF
--    and shows an upgrade card. During beta everyone should be a full-access,
--    white-label account, so change the default to 'pro' and lift any existing
--    'free' rows to 'pro'. (Revert the default to a paid gate at real launch.)
--
-- Idempotent: safe to run more than once.

begin;

alter table companies drop constraint if exists companies_plan_check;
alter table companies add  constraint companies_plan_check
  check (plan in ('free','pro','team','enterprise'));

alter table companies alter column plan set default 'pro';

update companies set plan = 'pro' where plan = 'free';

commit;

-- verify:
--   select plan, count(*) from companies group by plan;
