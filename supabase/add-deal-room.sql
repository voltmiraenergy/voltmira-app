-- add-deal-room.sql
-- The deal room of a plant (lib/dealRoom.js): its documents in a private
-- Storage bucket, filed under the permit checklist's items; read-only links a
-- bank opens without an account (expiry date, revocable); the bank's questions
-- on an item and the answers; and the log of what was opened and when.
-- Safe to run twice.
--
-- The installer reads and writes through their own session (RLS: their
-- company only). A bank never touches these tables: the server reads them for
-- an open link with the service role and writes the bank's questions and the
-- log the same way, after checking the link.

-- 1. The private bucket. Path: <company_id>/<portfolio_id>/<plant_id>/<item>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-docs', 'deal-docs', false, 52428800, array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain', 'application/zip',
  'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- a company reaches only its own folder
drop policy if exists deal_docs_read on storage.objects;
create policy deal_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'deal-docs' and (storage.foldername(name))[1] = my_company_id()::text);
drop policy if exists deal_docs_insert on storage.objects;
create policy deal_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-docs' and (storage.foldername(name))[1] = my_company_id()::text);
drop policy if exists deal_docs_update on storage.objects;
create policy deal_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'deal-docs' and (storage.foldername(name))[1] = my_company_id()::text);
drop policy if exists deal_docs_delete on storage.objects;
create policy deal_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'deal-docs' and (storage.foldername(name))[1] = my_company_id()::text);

-- 2. The documents: one row per file, under a checklist item.
create table if not exists deal_documents (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null default my_company_id() references companies(id) on delete cascade,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  plant_id     text not null check (char_length(plant_id) between 1 and 80),
  item_id      text not null check (item_id ~ '^[a-z_]{1,24}$'),
  name         text not null check (char_length(name) between 1 and 200),
  path         text not null unique,
  size_bytes   bigint not null default 0 check (size_bytes between 0 and 52428800),
  mime         text not null default '' check (char_length(mime) <= 120),
  uploaded_by  uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  -- the file sits in this company's and this portfolio's folder
  constraint deal_documents_path check (split_part(path, '/', 1) = company_id::text and split_part(path, '/', 2) = portfolio_id::text)
);
create index if not exists deal_documents_plant_idx on deal_documents(portfolio_id, plant_id, item_id);
alter table deal_documents enable row level security;
drop policy if exists deal_documents_all on deal_documents;
create policy deal_documents_all on deal_documents for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- 3. The links: one per bank and plant, with an expiry, revocable.
create table if not exists deal_links (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null default my_company_id() references companies(id) on delete cascade,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  plant_id     text not null check (char_length(plant_id) between 1 and 80),
  token        text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  bank         text not null check (char_length(bank) between 1 and 80),
  lang         text not null default 'ro' check (lang in ('ro', 'en')),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  constraint deal_links_term check (expires_at <= created_at + interval '366 days')
);
create index if not exists deal_links_plant_idx on deal_links(portfolio_id, plant_id, created_at desc);
-- email alerts to the installer (lib/dealNotify.js): on by default; the last alert's time keeps it to one per 6 hours
alter table deal_links add column if not exists notify boolean not null default true;
alter table deal_links add column if not exists notified_at timestamptz;
alter table deal_links enable row level security;
drop policy if exists deal_links_all on deal_links;
create policy deal_links_all on deal_links for all
  using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- 4. The bank's questions on an item, and the answers (a text, a file, or both).
create table if not exists deal_questions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  portfolio_id  uuid not null references portfolios(id) on delete cascade,
  plant_id      text not null check (char_length(plant_id) between 1 and 80),
  item_id       text not null check (item_id ~ '^[a-z_]{1,24}$'),
  link_id       uuid references deal_links(id) on delete set null,
  asked_by      text not null default '' check (char_length(asked_by) <= 120),
  body          text not null check (char_length(body) between 1 and 2000),
  answer        text not null default '' check (char_length(answer) <= 4000),
  answer_doc_id uuid references deal_documents(id) on delete set null,
  answered_by   uuid,
  answered_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists deal_questions_plant_idx on deal_questions(portfolio_id, plant_id, created_at desc);
alter table deal_questions enable row level security;
drop policy if exists deal_questions_read on deal_questions;
create policy deal_questions_read on deal_questions for select using (company_id = my_company_id());
drop policy if exists deal_questions_answer on deal_questions;
create policy deal_questions_answer on deal_questions for update
  using (company_id = my_company_id()) with check (company_id = my_company_id());
drop policy if exists deal_questions_delete on deal_questions;
create policy deal_questions_delete on deal_questions for delete using (company_id = my_company_id());

-- 5. What was opened, when, through which link. No IP is kept: a keyed hash
-- of the address and browser only tells one visitor from another.
create table if not exists deal_views (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references companies(id) on delete cascade,
  link_id      uuid references deal_links(id) on delete cascade,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  plant_id     text not null check (char_length(plant_id) between 1 and 80),
  what         text not null check (what in ('open', 'summary', 'document', 'pack', 'question')),
  detail       text not null default '' check (char_length(detail) <= 200),
  visitor      text not null default '' check (char_length(visitor) <= 64),
  agent        text not null default '' check (char_length(agent) <= 120),
  at           timestamptz not null default now()
);
create index if not exists deal_views_link_idx on deal_views(link_id, at desc);
create index if not exists deal_views_plant_idx on deal_views(portfolio_id, plant_id, at desc);
alter table deal_views enable row level security;
drop policy if exists deal_views_read on deal_views;
create policy deal_views_read on deal_views for select using (company_id = my_company_id());
