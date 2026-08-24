-- add-proposal-signature.sql
-- E-signature on acceptance: when the homeowner taps Accept they draw their
-- signature and type their name, right on the proposal page.
--
-- What gives an electronic signature its evidentiary weight is not the drawing
-- itself but the AUDIT TRAIL around it, so we capture who signed, when, from
-- what IP and which device, alongside the drawn image.
--
--   signature      the drawn signature as a PNG data URL (small, ~10-40 KB)
--   signer_name    the name the client typed under the signature
--   signed_ip      IP the acceptance came from
--   signed_ua      user agent (device/browser) that signed
--
-- Nullable + idempotent; the app degrades gracefully before this runs (the
-- acceptance still works, it just stores no signature). Run once.

alter table proposals add column if not exists signature   text;
alter table proposals add column if not exists signer_name text;
alter table proposals add column if not exists signed_ip   text;
alter table proposals add column if not exists signed_ua   text;

-- verify:
--   select code, signer_name, accepted_at, left(signature, 24) as sig
--   from proposals where accepted_at is not null order by accepted_at desc limit 5;
