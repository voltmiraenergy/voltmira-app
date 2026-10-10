-- run-pending-2026-10-02.sql
-- Everything since run-pending-2026-09-29.sql (which has been run), in one paste.
-- Supabase > SQL Editor > New query, paste this whole file, Run.
--
--   1. Per-quote offer currency (projects.offer_currency)
--   2. Who the client is on a quote (projects.client_kind), for the support programmes
--
-- Every part is safe to run again. Each also exists as a separate file.


-- ==========================================================================
-- 1. add-offer-currency.sql
-- ==========================================================================

-- add-offer-currency.sql
-- The currency of ONE offer. A workspace shows money in one currency
-- (companies.currency), but an installer may write a single quote in another:
-- hryvnia for a client in Ukraine when the workspace is in lei, or euro for a
-- client who pays in euro. The quote editor sets it, the proposal snapshot
-- freezes it, and the client's proposal page, its PDF and the proforma invoice
-- follow it (lib/offerCurrency.js).
--
-- Null means "follow the workspace", so every existing quote stays exactly as
-- it is. Until this runs, the editor still works: the choice drives the
-- editor's numbers in memory and the autosave logs a warning instead of
-- storing it. Idempotent.

alter table projects add column if not exists offer_currency text;

alter table projects drop constraint if exists projects_offer_currency_check;
alter table projects add constraint projects_offer_currency_check
  check (offer_currency is null or offer_currency in ('EUR','MDL','RON','UAH'));


-- ==========================================================================
-- 2. add-client-kind.sql
-- ==========================================================================

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
