// lib/offerCurrency.js — which currency ONE offer is written in.
//
// The engine computes in EUR and lib/money.js shows that in the currency the
// reader expects. A workspace has one display currency (companies.currency),
// but one installer can quote several kinds of client: a Moldovan firm with a
// client across the border in Ukraine has to write that offer in hryvnia, and
// a client who pays in euro wants the offer in euro. So each quote may name
// its own currency (projects.offer_currency, supabase/add-offer-currency.sql);
// null means "follow the workspace", which keeps every existing quote as it is.
//
// The editor, the frozen proposal snapshot, the public proposal API and the
// proforma invoice all resolve it here, so they can never disagree about the
// currency of the same offer. Pure, no I/O.

/** The currencies an offer can be written in (the same set companies.currency allows). */
export const OFFER_CURRENCIES = ["EUR", "MDL", "RON", "UAH"];

/** Each market's own currency. */
export const MARKET_CURRENCY = { MD: "MDL", UA: "UAH", RO: "RON" };

/** A currency code an offer can be written in, upper-cased, or null. */
export function normCurrency(c) {
  const s = String(c ?? "").trim().toUpperCase();
  return OFFER_CURRENCIES.includes(s) ? s : null;
}

/**
 * The currency the offer is actually shown in:
 *   1. the offer's own, when it names one
 *   2. otherwise the workspace's (null on the quote means "follow the workspace")
 *   3. with no valid workspace currency either, the market's own, else EUR
 */
export function effectiveOfferCurrency(offerCurrency, workspaceCurrency, market) {
  return normCurrency(offerCurrency)
    || normCurrency(workspaceCurrency)
    || MARKET_CURRENCY[market]
    || "EUR";
}

/**
 * The market's own currency when `currency` is ANOTHER country's: lei for a
 * client in Ukraine, hryvnia for a client in Moldova. Null when nothing is off.
 * Euro is never off: it is a fair choice in every market.
 */
export function betterCurrencyFor(currency, market) {
  const own = MARKET_CURRENCY[market];
  const cur = normCurrency(currency);
  if (!own || !cur || cur === "EUR" || cur === own) return null;
  return own;
}

/**
 * What the offer currency becomes when the quote's market changes.
 *
 * Same rule as the electricity price in the editor: it follows the market only
 * while it is still following it, meaning it is on the workspace default or
 * on the old market's own currency. A deliberate choice (euro for a client in
 * Moldova, say) is kept as it is.
 *
 * While following, the new market's own currency is either:
 *   - already the workspace's: back to the default (null), nothing to say
 *   - needed, because the workspace is in another country's currency (lei for
 *     a client in Ukraine) or the offer was already on the old market's own
 *     currency: switched, and the editor says so
 *   - optional, because the workspace is in euro, which suits any market:
 *     left on the default, and the editor offers it in one click
 *
 * @param {{offerCurrency?: string|null, workspaceCurrency?: string|null, from?: string, to: string}} a
 * @returns {{offerCurrency: string|null, note: null | {kind: "switched"|"suggest", currency: string}}}
 */
export function currencyOnMarketChange({ offerCurrency, workspaceCurrency, from, to }) {
  const offer = normCurrency(offerCurrency);
  const ws = normCurrency(workspaceCurrency) || "EUR";
  const target = MARKET_CURRENCY[to];
  const keep = { offerCurrency: offer, note: null };
  if (!target || from === to) return keep;

  const following = offer == null || offer === MARKET_CURRENCY[from];
  if (!following) return keep;

  if (target === ws) return { offerCurrency: null, note: null };
  if (offer != null || ws !== "EUR") {
    return { offerCurrency: target, note: offer === target ? null : { kind: "switched", currency: target } };
  }
  return { offerCurrency: null, note: { kind: "suggest", currency: target } };
}
