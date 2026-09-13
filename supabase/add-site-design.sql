-- add-site-design.sql
-- Site Designer: the installer draws the roof (one or more planes), places
-- obstacles (chimneys, vents, dormers), and sets a real tilt/azimuth per
-- plane, instead of every quote assuming one flat 35°-south roof. Panel
-- layout is per-project and never queried across projects, so — like bom,
-- options, cons_monthly — it's a single jsonb blob rather than new tables.
-- Shape: { planes: [{id, polygon:[[lat,lon],...], tiltDeg, azimuthDeg}],
--   obstacles: [{id, polygon:[[lat,lon],...], kind}] } — obstacles are flat,
-- not nested per-plane: which plane an obstacle affects is a geometric
-- containment check at layout time, not a stored relationship. A later
-- panel-layout pass adds its own per-plane result once it exists.
-- Idempotent.

alter table projects add column if not exists site_design jsonb not null default '{}'::jsonb;
