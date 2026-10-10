-- supabase/add-client-kind.sql — who the client on a quote is: a household, a
-- small business or a company. It decides which support programmes fit the
-- job (lib/greenSupport.js: Casa Verde for households, the VAT refund and the
-- state loan guarantee for businesses, FACEM for small businesses).
-- Nullable: a quote whose client type is not chosen yet shows no programmes.
-- Safe to run more than once.

alter table projects add column if not exists client_kind text;
alter table projects drop constraint if exists projects_client_kind_check;
alter table projects add constraint projects_client_kind_check
  check (client_kind is null or client_kind in ('household', 'sme', 'company'));
