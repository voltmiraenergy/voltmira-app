-- add-activity-actor.sql
-- Attribution for the Activity Log ("blame-shield"): who performed each event.
-- actor_id links to the profile; actor_name is captured at write time so the log
-- reads correctly even if the person is later renamed or removed. Client-driven
-- events (a homeowner opening/accepting a proposal) leave these null/empty.
-- Nullable-safe; the app degrades gracefully before this runs. Idempotent.

alter table activity add column if not exists actor_id   uuid;
alter table activity add column if not exists actor_name text not null default '';
-- Where a feed row links to (e.g. /projects/<id>, /leads, /settings) so the
-- Activity Log rows are clickable and jump straight to the thing that changed.
alter table activity add column if not exists link       text not null default '';

create index if not exists activity_actor_idx on activity(company_id, actor_id, created_at desc);

-- verify:
--   select actor_name, kind, text, created_at from activity order by created_at desc limit 10;
