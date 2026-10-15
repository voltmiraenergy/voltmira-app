-- add-lead-details.sql
-- A lead from the public widget already carries an address and a monthly bill
-- — everything "Generate a full offer" needs — but both were only ever folded
-- into the free-text `note` string, so converting a lead built a completely
-- blank project (name only) and the installer retyped the address and sized
-- the system by hand. These columns give the widget somewhere structured to
-- put that data, so the same flow that already exists (createProjectFromLead)
-- can actually geocode the roof, pull its real PVGIS yield, size the system
-- from the stated bill, and hand back a ready-to-review project instead of an
-- empty shell. Idempotent; every write degrades gracefully if this hasn't run.

alter table leads add column if not exists address      text;
alter table leads add column if not exists lat           double precision;
alter table leads add column if not exists lon           double precision;
alter table leads add column if not exists monthly_bill  numeric;
