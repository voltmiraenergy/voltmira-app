-- add-project-coords.sql
-- The address picker resolves a street to an exact place, so store the
-- coordinates that came with it. Without them, every PVGIS lookup re-geocodes
-- the free-text address, and a street name that exists in several towns
-- ("Ștefan cel Mare", "Ceucari") can resolve somewhere else next time — the
-- yield silently changes under a quote that was already sent. Storing the pick
-- freezes the location the numbers were built on. Idempotent.

alter table projects add column if not exists lat double precision;
alter table projects add column if not exists lon double precision;
