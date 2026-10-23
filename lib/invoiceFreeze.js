// lib/invoiceFreeze.js — the figures of an invoice, kept with its number.
// Only invoice_no and invoiced_at used to be stored, and every reader (the page, the PDF, the fiscal CSV, the 1C
// export, e-Factura, the billing page) recomputed the price from the engine, today's rate, the workspace's
// settings and the quote's current size: the same invoice number printed 223,740 lei one day and 224,870 the
// next week. Now the amounts, the currency, the rate (with where it came from) and what the line says are written
// in the same statement that draws the number, and read back from there. Pure, no I/O.

const CURRENCIES = ["EUR", "MDL", "RON", "UAH"];
const finite = (v) => Number.isFinite(Number(v));

/**
 * What is stored with the number.
 * @param {{amounts:object, cur:string, fx:number, fxInfo?:{live?:boolean, source?:string, asOf?:string}, project:object}} a
 */
export function freezeInvoice({ amounts, cur, fx, fxInfo = null, project = {} }) {
  const live = !!(fxInfo?.live && fxInfo?.source);
  return {
    v: 1,
    cur, fx: Number(fx) > 0 ? Number(fx) : 1,
    fxLive: live, fxSource: live ? String(fxInfo.source).slice(0, 80) : "", fxAsOf: live ? String(fxInfo.asOf || "").slice(0, 20) : "",
    gross: amounts.gross, net: amounts.net, vat: amounts.vat, rate: amounts.rate, showVat: !!amounts.showVat,
    depositPct: amounts.depositPct || 0, deposit: amounts.deposit || 0, balance: amounts.balance ?? amounts.gross,
    title: String(project.title || "").slice(0, 200),
    kw: Number(project.kw) || 0,
    battKwh: project.batt ? Number(project.batt_kwh) || 10 : null,
  };
}

/** The stored figures as the readers use them, or null when there are none (an invoice issued before this) or they are not whole. */
export function readFrozen(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== 1) return null;
  if (!CURRENCIES.includes(raw.cur)) return null;
  for (const k of ["fx", "gross", "net", "vat", "rate", "deposit", "balance", "depositPct", "kw"]) if (!finite(raw[k])) return null;
  if (!(Number(raw.fx) > 0)) return null;
  return {
    cur: raw.cur, fx: Number(raw.fx),
    fxInfo: { live: !!raw.fxLive, source: String(raw.fxSource || ""), asOf: String(raw.fxAsOf || "") },
    amounts: {
      gross: Number(raw.gross), net: Number(raw.net), vat: Number(raw.vat), rate: Number(raw.rate), showVat: !!raw.showVat,
      depositPct: Number(raw.depositPct), deposit: Number(raw.deposit), balance: Number(raw.balance),
    },
    title: String(raw.title || ""), kw: Number(raw.kw), battKwh: raw.battKwh == null ? null : Number(raw.battKwh) || null,
  };
}
