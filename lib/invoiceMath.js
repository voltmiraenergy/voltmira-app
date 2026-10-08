// lib/invoiceMath.js — the real net/VAT/gross split every proforma invoice
// uses (app/(app)/projects/[id]/invoice/page.jsx, through invoiceAmounts),
// factored out so the fiscal CSV export (app/api/export-invoices/route.js)
// computes the SAME numbers instead of a second copy of this math that could
// drift from what the client's actual invoice PDF shows.
//
// Prices are VAT-inclusive (what the client agreed to pay), so the net and
// VAT amounts are backed OUT of the gross, not added on top.

/**
 * @param {number} gross VAT-inclusive total
 * @param {number} vatRatePct VAT rate, percent (0 = not VAT-registered — see
 *   the invoice page's own comment on why that prints a single Total instead
 *   of a fabricated "VAT (0%)" line)
 * @returns {{net:number, vat:number, gross:number, rate:number, showVat:boolean}}
 */
export function vatBreakdown(gross, vatRatePct) {
  const g = Math.max(0, Math.round(Number(gross) || 0));
  const rate = Math.max(0, Number(vatRatePct) || 0);
  const showVat = rate > 0;
  const net = showVat ? g / (1 + rate / 100) : g;
  const vat = g - net;
  return { net, vat, gross: g, rate, showVat };
}

/**
 * Every figure a proforma prints, in the currency it is issued in (the
 * quote's offer currency, lib/offerCurrency.js).
 *
 * The quote is priced in EUR, so the total is CONVERTED first (from the whole
 * euro, as the fiscal CSV export does, so the two keep printing the same
 * total) and rounded to a whole unit of the invoice's own currency; the VAT,
 * the deposit and the balance are then split from that total in the same
 * currency. Converting each line separately instead (net, VAT, deposit, each
 * from EUR) let them miss the printed total by a leu, which is exactly what a
 * client checking the arithmetic finds. Here net + VAT = total and
 * deposit + balance = total, always, in whole units.
 *
 * @param {{grossEur:number, fx?:number, vatRatePct?:number, depositPct?:number}} a
 *   grossEur VAT-inclusive total in EUR; fx units of the invoice currency per
 *   1 EUR (1 for EUR); depositPct 0..100, 0 = invoice the full amount
 */
export function invoiceAmounts({ grossEur, fx = 1, vatRatePct = 0, depositPct = 0 } = {}) {
  const rateFx = Number(fx) > 0 ? Number(fx) : 1;
  const gross = Math.max(0, Math.round(Math.round(Number(grossEur) || 0) * rateFx));
  const { rate, showVat } = vatBreakdown(gross, vatRatePct);
  const net = showVat ? Math.round(gross / (1 + rate / 100)) : gross;
  const pct = Math.min(100, Math.max(0, Number(depositPct) || 0));
  const deposit = pct > 0 ? Math.round(gross * pct / 100) : 0;
  return { gross, net, vat: gross - net, rate, showVat, depositPct: pct, deposit, balance: gross - deposit };
}
