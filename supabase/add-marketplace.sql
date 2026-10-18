-- supabase/add-marketplace.sql — Phase 5, the homeowner app and the installer
-- marketplace (docs/MARKETPLACE.md): homeowner accounts linked to their
-- systems, installer verification and public profiles, quote requests from the
-- public funnel and their routing to installers, ratings from completed
-- projects, and maintenance tickets. Runs on its own. Safe to run more than once.
--
-- Who reads and writes: the server writes everything here with the service
-- role after its own checks. A workspace reads its own rows (my_company_id());
-- a homeowner reads only their own links (auth.uid()), and everything else
-- they see is served by the server for those links. A quote request's contact
-- details have no policy at all: an installer gets them only by accepting.

-- The guard for a history that belongs to a quote: no row is ever changed or
-- removed on its own, but deleting the quote takes its history with it (a
-- cascade runs this trigger one level deeper than a direct statement).
create or replace function refuse_change_direct() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception '% rows are append-only', tg_table_name;
end $$;

-- 1. A homeowner's account, linked to the systems that are theirs.
create table if not exists homeowner_links (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  project_id   uuid not null references projects(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  email        text not null check (char_length(email) between 3 and 200),
  via          text not null default 'claim' check (via in ('claim', 'invite')),
  created_at   timestamptz not null default now(),
  unique (user_id, project_id)
);
create index if not exists homeowner_links_project_idx on homeowner_links(project_id);
alter table homeowner_links enable row level security;
drop policy if exists homeowner_links_own on homeowner_links;
create policy homeowner_links_own on homeowner_links for select using (user_id = auth.uid() or company_id = my_company_id());

-- 2. The installer's public profile and its verification.
create table if not exists installer_profiles (
  company_id            uuid primary key references companies(id) on delete cascade,
  slug                  text unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  published             boolean not null default false,
  accepting             boolean not null default true,     -- takes requests from the marketplace
  about                 text not null default '' check (char_length(about) <= 1200),
  regions               text[] not null default '{}',      -- district ids (lib/mdRaions.js)
  min_kw                numeric(8, 2) not null default 1 check (min_kw > 0),
  max_kw                numeric(8, 2) not null default 30 check (max_kw >= min_kw),
  sla_hours             integer not null default 24 check (sla_hours between 2 and 168),
  licence_no            text not null default '' check (char_length(licence_no) <= 80),
  licence_valid_to      date,
  licence_doc           text not null default '',          -- path in the verify-docs bucket
  insurer               text not null default '' check (char_length(insurer) <= 120),
  insurance_valid_to    date,
  insurance_doc         text not null default '',
  verification          text not null default 'none' check (verification in ('none', 'pending', 'verified', 'rejected')),
  verification_note     text not null default '' check (char_length(verification_note) <= 500),
  verified_at           timestamptz,
  verified_by           text not null default '',
  updated_at            timestamptz not null default now()
);
alter table installer_profiles enable row level security;
drop policy if exists installer_profiles_own on installer_profiles;
create policy installer_profiles_own on installer_profiles for select using (company_id = my_company_id());

-- the licence and insurance documents: private, the server only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verify-docs', 'verify-docs', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. A homeowner's request from the public funnel. No policy: the server only.
create table if not exists quote_requests (
  id                uuid primary key default gen_random_uuid(),
  lang              text not null default 'ro' check (lang in ('ro', 'ru', 'en', 'uk')),
  market            text not null default 'MD' check (market in ('MD')),
  address           text not null check (char_length(address) between 3 and 200),
  raion             text not null default '' check (char_length(raion) <= 40),
  lat               double precision,
  lon               double precision,
  cons_kwh_year     integer not null check (cons_kwh_year between 300 and 200000),
  kw                numeric(8, 2) not null check (kw > 0),
  estimate          jsonb not null default '{}'::jsonb,   -- what the homeowner was shown
  name              text not null check (char_length(name) between 2 and 120),
  phone             text not null default '' check (char_length(phone) <= 40),
  email             text not null default '' check (char_length(email) <= 200),
  consent_version   text not null,
  consent_at        timestamptz not null,
  consent_ip        text not null default '',
  status            text not null default 'open' check (status in ('open', 'accepted', 'unmatched', 'closed')),
  status_token_hash text not null,                         -- the homeowner's link to follow it
  idempotency_key   text not null unique check (char_length(idempotency_key) between 8 and 80),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists quote_requests_status_idx on quote_requests(status, created_at desc);
alter table quote_requests enable row level security;

-- 4. A request offered to one installer, with the time they have to answer.
create table if not exists lead_offers (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references quote_requests(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  rank          integer not null check (rank >= 1),
  score         integer not null default 0,
  status        text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'expired', 'withdrawn')),
  offered_at    timestamptz not null default now(),
  respond_by    timestamptz not null,
  responded_at  timestamptz,
  decline_reason text not null default '' check (char_length(decline_reason) <= 300),
  lead_id       uuid,
  unique (request_id, company_id)
);
create index if not exists lead_offers_company_idx on lead_offers(company_id, status, respond_by);
alter table lead_offers enable row level security;
drop policy if exists lead_offers_own on lead_offers;
create policy lead_offers_own on lead_offers for select using (company_id = my_company_id());

create table if not exists lead_offer_events (
  id           bigint generated always as identity primary key,
  offer_id     uuid not null references lead_offers(id) on delete cascade,
  request_id   uuid not null,
  company_id   uuid not null,
  from_status  text not null default '',
  to_status    text not null,
  source       text not null check (source in ('router', 'installer', 'sweep')),
  event_id     text not null check (char_length(event_id) between 1 and 120),
  note         text not null default '' check (char_length(note) <= 300),
  created_at   timestamptz not null default now(),
  unique (offer_id, event_id)
);
alter table lead_offer_events enable row level security;
drop policy if exists lead_offer_events_own on lead_offer_events;
create policy lead_offer_events_own on lead_offer_events for select using (company_id = my_company_id());
drop trigger if exists lead_offer_events_append_only on lead_offer_events;
create trigger lead_offer_events_append_only before update or delete on lead_offer_events
  for each row execute function refuse_change_direct();

-- a lead the marketplace brought
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.leads'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source%'
  loop
    execute format('alter table public.leads drop constraint %I', c);
  end loop;
end $$;
alter table public.leads add constraint leads_source_check
  check (source in ('widget', 'proposal', 'manual', 'referral', 'marketplace'));

-- 5. Ratings: one per project, only once it is commissioned (checked by the server).
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null unique references projects(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  rating        integer not null check (rating between 1 and 5),
  body          text not null default '' check (char_length(body) <= 1000),
  author        text not null default '' check (char_length(author) <= 60),   -- a first name and a locality
  hidden        boolean not null default false,                               -- moderation, platform only
  created_at    timestamptz not null default now()
);
create index if not exists reviews_company_idx on reviews(company_id, created_at desc);
alter table reviews enable row level security;
drop policy if exists reviews_own on reviews;
create policy reviews_own on reviews for select using (company_id = my_company_id() or user_id = auth.uid());

-- 6. Maintenance: a ticket per problem, and every change to it.
create table if not exists maintenance_tickets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  source        text not null check (source in ('monitoring', 'homeowner', 'installer')),
  kind          text not null default 'other' check (kind in ('underproduction', 'no_data', 'fault', 'cleaning', 'damage', 'other')),
  title         text not null check (char_length(title) between 2 and 160),
  detail        text not null default '' check (char_length(detail) <= 2000),
  status        text not null default 'open' check (status in ('open', 'scheduled', 'resolved', 'closed')),
  visit_at      timestamptz,
  outcome       text not null default '' check (char_length(outcome) <= 2000),
  alert_key     text,                                    -- one open ticket per monitoring alert
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists maintenance_alert_once on maintenance_tickets(project_id, alert_key) where alert_key is not null;
create index if not exists maintenance_company_idx on maintenance_tickets(company_id, status, created_at desc);
alter table maintenance_tickets enable row level security;
drop policy if exists maintenance_tickets_own on maintenance_tickets;
create policy maintenance_tickets_own on maintenance_tickets for select using (company_id = my_company_id());

create table if not exists ticket_events (
  id           bigint generated always as identity primary key,
  ticket_id    uuid not null references maintenance_tickets(id) on delete cascade,
  company_id   uuid not null,
  from_status  text not null default '',
  to_status    text not null,
  source       text not null check (source in ('monitoring', 'homeowner', 'installer')),
  note         text not null default '' check (char_length(note) <= 2000),
  created_at   timestamptz not null default now()
);
alter table ticket_events enable row level security;
drop policy if exists ticket_events_own on ticket_events;
create policy ticket_events_own on ticket_events for select using (company_id = my_company_id());
drop trigger if exists ticket_events_append_only on ticket_events;
create trigger ticket_events_append_only before update or delete on ticket_events
  for each row execute function refuse_change_direct();
