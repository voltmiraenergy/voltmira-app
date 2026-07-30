-- md-default-market.sql
-- Moldova is now the primary market. Flip the DB defaults so a new quote / new
-- company starts on MD (net billing) instead of RO. Existing rows are untouched
-- (installers can still pick RO per quote, and set their own default_market in
-- Settings). Run after remove-germany.sql (which tightens the check to RO/MD).
-- Idempotent.

alter table projects  alter column market         set default 'MD';
alter table companies alter column default_market set default 'MD';
