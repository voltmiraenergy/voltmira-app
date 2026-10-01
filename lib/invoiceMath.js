// lib/invoiceMath.js — the real net/VAT/gross split every proforma invoice
// uses (app/(app)/projects/[id]/invoice/page.jsx), factored out so the fiscal
// CSV export (app/api/export-invoices/route.js) computes the SAME numbers
// instead of a second copy of this math that could drift from what the
// client's actual invoice PDF shows.
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
