-- add-quote-fast.sql
-- Phase 1, "quote in 10 minutes" (docs/features/phase1.md). One paste: Supabase > SQL Editor > New query, paste
-- this whole file, Run. Safe to run again. Runs on its own: no other pending file is needed first.
--
--   1. The installer's public estimate page: its own address (/estimate/<public_slug>) and colour.
--   2. The lead score: the weights each installer sets, the districts they serve, and what the estimate page
--      learns about a lead (when they want to install, interest in financing, the district, what they were shown).
--   3. Follow-ups: each workspace's own days, and a switch per offer.
--   4. Reading time per section of the offer, and the option looked at.
-- No new table: the existing row security (each workspace sees only its own rows) covers every column added here.

-- 1. the public estimate page
alter table public.companies add column if not exists public_slug text;
alter table public.companies drop constraint if exists companies_public_slug_check;
alter table public.companies add constraint companies_public_slug_check
  check (public_slug is null or public_slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$');
create unique index if not exists companies_public_slug_key on public.companies (public_slug);
alter table public.companies add column if not exists brand_color text;
alter table public.companies drop constraint if exists companies_brand_color_check;
alter table public.companies add constraint companies_brand_color_check
  check (brand_color is null or brand_color ~ '^#[0-9a-f]{6}$');

-- 2. the lead score
alter table public.companies add column if not exists lead_score_weights jsonb;
alter table public.companies add column if not exists service_districts text[];
alter table public.leads add column if not exists timeline text;
alter table public.leads drop constraint if exists leads_timeline_check;
alter table public.leads add constraint leads_timeline_check check (timeline is null or timeline in ('now', 'soon', 'later'));
alter table public.leads add column if not exists wants_financing boolean;
alter table public.leads add column if not exists district text;
alter table public.leads add column if not exists estimate jsonb;

-- 3. follow-ups
alter table public.companies add column if not exists nudge_days int[];
alter table public.proposals add column if not exists nudges_off boolean not null default false;

-- 4. reading time per section, and the option looked at (kept 12 months: the daily follow-up job removes older ones)
alter table public.proposal_events drop constraint if exists proposal_events_kind_check;
alter table public.proposal_events add constraint proposal_events_kind_check
  check (kind in ('open', 'heartbeat', 'toggle_batt', 'accept', 'request', 'section', 'option'));
create index if not exists proposal_events_kind_idx on public.proposal_events (kind, created_at);

-- Check it worked (optional):
--   select column_name from information_schema.columns where table_name = 'companies' and column_name in ('public_slug', 'brand_color', 'lead_score_weights', 'service_districts', 'nudge_days');
