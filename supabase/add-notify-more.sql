-- supabase/add-notify-more.sql — three more email switches in Settings,
-- Notifications: a client asked for a call (app/api/proposal/[code]/route.js),
-- a client accepted an offer (same route), and a commissioned system has had
-- no production reading for 30 days (lib/readingAlerts.js, on the Monday
-- cron). All on by default; until this runs, the app treats them as on and
-- Settings saves the other switches without them. Safe to run more than once.

alter table companies add column if not exists notify_calls boolean not null default true;
alter table companies add column if not exists notify_accepted boolean not null default true;
alter table companies add column if not exists notify_readings boolean not null default true;

-- "Offer opened": at once ('instant') or one email each morning ('digest'),
-- and quiet hours (no email 21:00 to 08:00 Chisinau time; it waits for the morning).
alter table companies add column if not exists notify_open_mode text not null default 'instant';
alter table companies add column if not exists notify_quiet boolean not null default false;
alter table companies drop constraint if exists companies_notify_open_mode_check;
alter table companies add constraint companies_notify_open_mode_check check (notify_open_mode in ('instant', 'digest'));
