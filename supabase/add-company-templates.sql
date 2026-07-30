-- Adds saved quote templates to companies. An installer doing the same 6 kWp
-- residential system every week saves a template (default size, market, price,
-- battery) and spins up a pre-filled quote in one click. Stored as a JSON array
-- of {id,name,kw,market,batt,price,cons}. Safe to run more than once.
--
-- Run this as its own standalone block in the Supabase SQL editor.
alter table companies add column if not exists quote_templates jsonb not null default '[]'::jsonb;
