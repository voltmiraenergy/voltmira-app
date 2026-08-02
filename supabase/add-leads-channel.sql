-- add-leads-channel.sql
-- Marketing-channel attribution for leads. `source` stays the app's automatic
-- technical origin (widget / proposal / manual); `channel` is what the installer
-- assigns so they can see which marketing channel actually pays off
-- (website, facebook, instagram, whatsapp, google, referral, coldcall, other).
-- No CHECK constraint so the app degrades gracefully before this runs (a null
-- channel is derived from `source` in the UI). Idempotent.

alter table leads add column if not exists channel text;

create index if not exists leads_company_channel_idx on leads(company_id, channel);

-- verify:
--   select channel, count(*) from leads group by channel;
