-- add-lead-agent.sql
-- The lead assistant's messaging channels (lib/leadAgent.js). The website chat
-- (/widget/chat) needs none of this; Telegram does, because a Telegram chat
-- has no browser to hold the conversation.
--
-- 1. agent_channels: an installer's connected bot (one per Telegram bot).
-- 2. agent_channel_secrets: its bot token, encrypted (lib/secretBox.js).
--    RLS on with NO policies: only the server (service role) can read it.
-- 3. agent_conversations: each chat's recent turns and the lead it produced.
--    Server-only as well: it holds homeowners' messages.
-- Safe to re-run.

create table if not exists agent_channels (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  kind         text not null check (kind in ('telegram')),
  bot_username text not null default '',
  status       text not null default 'ok' check (status in ('ok', 'error')),
  last_error   text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists agent_channels_company_idx on agent_channels(company_id);
alter table agent_channels enable row level security;
drop policy if exists agent_channels_read on agent_channels;
create policy agent_channels_read on agent_channels for select using (company_id = my_company_id());

create table if not exists agent_channel_secrets (
  channel_id  uuid primary key references agent_channels(id) on delete cascade,
  ciphertext  text not null
);
alter table agent_channel_secrets enable row level security;

create table if not exists agent_conversations (
  id                uuid primary key default gen_random_uuid(),
  channel_id        uuid not null references agent_channels(id) on delete cascade,
  company_id        uuid not null references companies(id) on delete cascade,
  chat_id           text not null,
  turns             jsonb not null default '[]'::jsonb,       -- [{ role, text }], last 12
  lead_id           uuid references leads(id) on delete set null,
  survey_requested  boolean not null default false,
  last_update_id    bigint,                                   -- Telegram redelivers slow updates; answer each once
  updated_at        timestamptz not null default now(),
  unique (channel_id, chat_id)
);
create index if not exists agent_conversations_company_idx on agent_conversations(company_id, updated_at desc);
alter table agent_conversations enable row level security;
