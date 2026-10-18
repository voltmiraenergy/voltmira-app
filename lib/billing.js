// lib/billing.js — the pure part of a quote's billing (docs/INTEGRATIONS.md):
// a payment as the installer types it, checked and turned into minor units,
// and what is still due against the invoice. No floats reach the database.

export const PAY_CURRENCIES = ["MDL", "EUR", "RON", "UAH"];
export const PAY_METHODS = ["bank", "cash", "card"];

/**
 * "1 500,50", "1500.5", "1.500,50" -> 150050. Null for anything else.
 * A single separator followed by exactly three digits is a thousands mark.
 */
export function parseAmountMinor(input) {
  const s = String(input ?? "").replace(/[\s  ']/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const marks = s.replace(/\d/g, "");
  let whole = s, frac = "";
  if (marks.includes(",") && marks.includes(".")) {
    // both: the last one is the decimal mark, the other the thousands mark
    const at = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    whole = s.slice(0, at); frac = s.slice(at + 1);
    if (/[.,]/.test(whole.replace(new RegExp(`\\${marks[0]}`, "g"), ""))) return null;
    whole = whole.replace(/[.,]/g, "");
  } else if (marks.length > 1) {
    whole = s.replace(/[.,]/g, "");              // "1.500.000": thousands marks only
    if (!/^\d{1,3}([.,]\d{3})+$/.test(s)) return null;
  } else if (marks.length === 1) {
    const [a, b] = s.split(/[.,]/);
    if (b.length === 3) whole = a + b;           // "1.500": a thousands mark
    else { whole = a; frac = b; }                // "1500,5": the decimal mark
  }
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(frac)) return null;
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * A payment from the form. @returns {{ ok: true, payment } | { ok: false, errors: string[] }}
 */
export function validatePayment({ amount, currency, paidAt, method = "bank", reference = "", idempotencyKey = "" }, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  const amountMinor = typeof amount === "number" ? (Number.isSafeInteger(amount) ? amount : null) : parseAmountMinor(amount);
  if (!(amountMinor > 0)) errors.push("amount");
  if (!PAY_CURRENCIES.includes(currency)) errors.push("currency");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(paidAt || "")) || Number.isNaN(Date.parse(paidAt)) || paidAt > today || paidAt < "2000-01-01") errors.push("paid_at");
  if (!PAY_METHODS.includes(method)) errors.push("method");
  const key = String(idempotencyKey || "");
  if (key.length < 8 || key.length > 80) errors.push("idempotency_key");
  if (errors.length) return { ok: false, errors };
  return { ok: true, payment: { amount_minor: amountMinor, currency, paid_at: paidAt, method, reference: String(reference || "").replace(/[\r\n]+/g, " ").trim().slice(0, 120), idempotency_key: key } };
}

/** Paid and due against the invoice, in its currency; payments in another currency are listed apart. */
export function paymentSummary(payments, grossMinor, currency) {
  const same = payments.filter((p) => p.currency === currency);
  const paidMinor = same.reduce((s, p) => s + (Number(p.amount_minor) || 0), 0);
  return { paidMinor, dueMinor: Math.max(0, grossMinor - paidMinor), overMinor: Math.max(0, paidMinor - grossMinor), otherCurrency: payments.length - same.length, settled: grossMinor > 0 && paidMinor >= grossMinor };
}
