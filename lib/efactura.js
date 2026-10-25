// lib/efactura.js — submitting a quote's invoice to SFS e-Factura
// (docs/INTEGRATIONS.md). Pure, apart from the adapters' I/O.
//
// The invoice is built from what the proforma already prints (lib/
// invoiceMath.js invoiceAmounts), in minor units, and checked the way SFS
// checks it before anything is sent. Every provider is reached through:
//   adapter.submit(invoice) -> { ok: true, status: "submitted" | "accepted" | "rejected", sfsRef?, fiscalNumber?, code?, message? }
//                            | { ok: false, error }
//   adapter.status(sfsRef)  -> the same, later (SFS processes asynchronously)
// sfsMockAdapter validates like SFS and answers at once; sfsAdapter is the
// real one, which needs SFS onboarding (an EVOSign certificate and API
// access, env SFS_*) and answers "not_configured" until then.
import crypto from "node:crypto";

const digits = (s) => String(s || "").replace(/\D/g, "");

/**
 * The invoice as e-Factura takes it.
 * @param {object} a
 * @param {object} a.company   { legal_name, name, reg_no, vat_no, legal_address, iban }
 * @param {object} a.buyer     { name, idno?, idnp?, address?, kind: "person" | "company" }
 * @param {object} a.amounts   invoiceAmounts(): { gross, net, vat, rate } in whole units
 * @param {string} a.currency
 * @param {string} a.invoiceNo
 * @param {string} a.date      YYYY-MM-DD
 * @param {string} a.description  the line's text ("Sistem solar 8 kW ...")
 */
export function buildEfacturaInvoice({ company = {}, buyer = {}, amounts, currency = "MDL", invoiceNo, date, description }) {
  const m = (u) => Math.round((Number(u) || 0) * 100);
  return {
    number: String(invoiceNo || ""), date: String(date || "").slice(0, 10), currency,
    seller: { name: company.legal_name || company.name || "", idno: digits(company.reg_no), vatNo: digits(company.vat_no), address: company.legal_address || "", iban: String(company.iban || "").replace(/\s+/g, "") },
    buyer: { name: buyer.name || "", kind: buyer.kind === "company" ? "company" : "person", idno: digits(buyer.idno), idnp: digits(buyer.idnp), address: buyer.address || "" },
    lines: [{ name: String(description || "").slice(0, 300), qty: 1, unit: "buc", netMinor: m(amounts?.net), vatRate: Number(amounts?.rate) || 0, vatMinor: m(amounts?.vat), grossMinor: m(amounts?.gross) }],
    totals: { netMinor: m(amounts?.net), vatMinor: m(amounts?.vat), grossMinor: m(amounts?.gross) },
  };
}

/** What SFS would refuse, as stable codes. Empty: ready to submit. */
export function validateEfactura(inv) {
  const e = [];
  if (!inv.number) e.push("invoice_number");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.date || "")) e.push("invoice_date");
  if (inv.currency !== "MDL") e.push("currency_not_mdl");
  if (!inv.seller.name) e.push("seller_name");
  if (!/^\d{13}$/.test(inv.seller.idno)) e.push("seller_idno");
  if (inv.totals.vatMinor > 0 && !/^\d{7,13}$/.test(inv.seller.vatNo)) e.push("seller_vat_no");
  if (!inv.buyer.name) e.push("buyer_name");
  if (inv.buyer.kind === "company" && !/^\d{13}$/.test(inv.buyer.idno)) e.push("buyer_idno");
  if (!inv.lines.length || !(inv.totals.grossMinor > 0)) e.push("no_amount");
  const sum = inv.lines.reduce((s, l) => s + l.grossMinor, 0);
  if (sum !== inv.totals.grossMinor || inv.totals.netMinor + inv.totals.vatMinor !== inv.totals.grossMinor) e.push("totals");
  return e;
}

export const payloadHash = (inv) => crypto.createHash("sha256").update(JSON.stringify(inv)).digest("hex");

/** The simulated SFS: refuses what SFS would refuse, accepts the rest with a fiscal number. */
export function sfsMockAdapter() {
  return {
    id: "sfs_mock",
    async submit(inv) {
      const errors = validateEfactura(inv);
      if (errors.length) return { ok: true, status: "rejected", code: errors[0], message: errors.join(", ") };
      const ref = `MOCK-SFS-${payloadHash(inv).slice(0, 10).toUpperCase()}`;
      return { ok: true, status: "accepted", sfsRef: ref, fiscalNumber: `EF${inv.date.slice(0, 4)}${(inv.number.match(/\d+/g) || ["0"]).pop().slice(-6).padStart(6, "0")}` };
    },
    async status(sfsRef) { return { ok: true, status: "accepted", sfsRef }; },
  };
}

/** The real SFS e-Factura. Needs SFS_API_URL and the EVOSign certificate; until then, not configured. */
export function sfsAdapter(env = process.env) {
  const configured = !!(env.SFS_API_URL && env.SFS_CERT_PEM && env.SFS_KEY_PEM);
  return {
    id: "sfs",
    async submit() { return { ok: false, error: configured ? "not_implemented" : "not_configured" }; },
    async status() { return { ok: false, error: configured ? "not_implemented" : "not_configured" }; },
  };
}

export function efacturaAdapterFor(env = process.env) {
  if (env.SFS_ENABLED === "on") return sfsAdapter(env);
  // The simulation answers "accepted" with a made-up fiscal number. On a live site that reads as an invoice that reached
  // SFS when nothing did, so there it is off unless someone switches it on (EFACTURA_SIMULATION=on); without it the live
  // site says plainly that access to SFS is not set up. Locally and in tests the simulation is the default.
  const live = env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && !env.VERCEL_ENV);
  if (live && env.EFACTURA_SIMULATION !== "on") return sfsAdapter(env);
  return sfsMockAdapter();
}
