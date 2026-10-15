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
