-- =====================================================================
-- VoltMira — landing-page waitlist  (run once in the Supabase SQL editor)
-- Written ONLY by the server (service role) via /api/waitlist.
-- RLS is ON with NO policies, so the public anon key can neither read nor
-- write it: your signups stay private. Read them in the Supabase Table
-- editor, or: select * from waitlist order by created_at desc;
-- =====================================================================
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,           -- lowercased before insert; upsert key
  name       text default '',
  lang       text not null default 'en' check (lang in ('en','ro','ru')),
  source     text not null default 'landing',
  ip         text default '',
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
-- Intentionally no policies: only the service role (which bypasses RLS) touches
-- this table. The browser anon key sees nothing here.
