-- add-profile-fields.sql
-- The "human layer": personal details for each individual user, separate from the
-- company identity. `title` was added earlier (add-profile-title.sql); this adds a
-- direct phone and a personal avatar. Nullable-safe; the app degrades gracefully
-- before this runs. Idempotent.

alter table profiles add column if not exists phone      text not null default '';
alter table profiles add column if not exists avatar_url text not null default '';

-- verify:
--   select name, title, phone, (avatar_url <> '') as has_avatar from profiles;
