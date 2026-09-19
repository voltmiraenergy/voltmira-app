-- add-storage-media.sql
-- A real Storage bucket for company logos and user avatars, replacing the
-- base64-in-a-text-column approach (logo_url/avatar_url held a whole
-- data:image/... string in the row). One public bucket, one file per
-- company logo and per user avatar (fixed path, overwritten on re-upload —
-- these are always downscaled to 256px client-side before upload, so
-- there's nothing to keep multiple versions of). Public read: logos and
-- avatars render on public-facing proposal/invoice pages, which have no
-- session to sign a URL with. Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Path convention: logos/<company_id>.png, avatars/<user_id>.png — checked
-- against my_company_id()/auth.uid() so a company can only write its own
-- logo and a user can only write their own avatar, never someone else's.
drop policy if exists public_media_read on storage.objects;
create policy public_media_read on storage.objects for select
  using (bucket_id = 'public-media');

drop policy if exists public_media_write_logo on storage.objects;
create policy public_media_write_logo on storage.objects for insert
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = 'logos'
    and (storage.foldername(name))[2] = my_company_id()::text
  );

drop policy if exists public_media_update_logo on storage.objects;
create policy public_media_update_logo on storage.objects for update
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = 'logos'
    and (storage.foldername(name))[2] = my_company_id()::text
  );

drop policy if exists public_media_write_avatar on storage.objects;
create policy public_media_write_avatar on storage.objects for insert
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists public_media_update_avatar on storage.objects;
create policy public_media_update_avatar on storage.objects for update
  using (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
