-- remove-germany.sql
-- Germany (DE) is being dropped as a market. The engine + editor no longer offer
-- it; this tightens the DB constraints to RO/MD only. Any existing DE rows are
-- moved to RO first (the engine already falls back to RO for an unknown market,
-- so this changes nothing about what those quotes compute). Idempotent.

begin;

update projects  set market = 'RO'         where market = 'DE';
update companies set default_market = 'RO' where default_market = 'DE';

alter table projects  drop constraint if exists projects_market_check;
alter table projects  add  constraint projects_market_check check (market in ('RO','MD'));

alter table companies drop constraint if exists companies_default_market_check;
alter table companies add  constraint companies_default_market_check check (default_market in ('RO','MD'));

commit;
