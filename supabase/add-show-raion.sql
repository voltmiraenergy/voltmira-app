-- supabase/add-show-raion.sql: whether the client's offer shows one line about
-- the job's area from CNED's register ("Households in Ialoveni that already
-- produce their own electricity: 523"). Off by default; the installer turns it
-- on per quote in the area card (components/RaionCard.jsx). The line is frozen
-- into the offer when it is generated (lib/actions.js) and shown only while
-- CNED_DATA is on (lib/cnedData.js). Safe to run more than once.

alter table projects add column if not exists show_raion boolean not null default false;
