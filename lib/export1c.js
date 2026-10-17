// lib/export1c.js — customers, invoices and payments in a format 1C imports
// (docs/INTEGRATIONS.md: "1C export"). Two forms:
//   CSV  one file per entity, for 1C's "load data from a spreadsheet"
//        processing (Загрузка данных из табличного документа): the column
//        headers, delimiter, decimal mark and date format come from the
//        installer's saved mapping, so they match the 1C configuration.
//   XML  one file, <VoltMiraExport version="1">, documented in the docs, for a
//        1C developer's import processing.
// Pure. Money is integer minor units in, a decimal string out.

export const ENTITIES = ["customers", "invoices", "payments"];

/** The fields of each entity, in order; the mapping only renames them. */
export const FIELDS = {
  customers: ["code", "name", "kind", "idno", "address", "phone", "email"],
  invoices: ["number", "date", "customer_code", "customer", "net", "vat_rate", "vat", "gross", "currency", "fiscal_number"],
  payments: ["date", "invoice_number", "customer_code", "amount", "currency", "method", "reference"],
};

export const DEFAULT_MAPPING = {
  delimiter: ";", decimal: ",", dateFormat: "DD.MM.YYYY", bom: true,
  headers: {
    customers: { code: "Cod", name: "Denumire", kind: "Tip", idno: "IDNO/IDNP", address: "Adresa", phone: "Telefon", email: "E-mail" },
    invoices: { number: "Numar", date: "Data", customer_code: "Cod client", customer: "Client", net: "Suma fara TVA", vat_rate: "Cota TVA", vat: "TVA", gross: "Suma cu TVA", currency: "Valuta", fiscal_number: "Nr. e-Factura" },
    payments: { date: "Data", invoice_number: "Factura", customer_code: "Cod client", amount: "Suma", currency: "Valuta", method: "Metoda", reference: "Referinta" },
  },
};

/** A mapping from the browser, kept to what the export understands. */
export function cleanMapping(m = {}) {
  const out = { ...DEFAULT_MAPPING, headers: {} };
  if ([";", ",", "\t"].includes(m.delimiter)) out.delimiter = m.delimiter;
  if ([",", "."].includes(m.decimal)) out.decimal = m.decimal;
  if (["DD.MM.YYYY", "YYYY-MM-DD", "DD/MM/YYYY"].includes(m.dateFormat)) out.dateFormat = m.dateFormat;
  if (typeof m.bom === "boolean") out.bom = m.bom;
  if (out.delimiter === out.decimal) out.decimal = out.delimiter === "," ? "." : ",";
  for (const ent of ENTITIES) {
    out.headers[ent] = {};
    for (const f of FIELDS[ent]) {
      const v = String(m.headers?.[ent]?.[f] ?? DEFAULT_MAPPING.headers[ent][f]).replace(/[\r\n]/g, " ").trim().slice(0, 60);
      out.headers[ent][f] = v || DEFAULT_MAPPING.headers[ent][f];
    }
  }
  return out;
}

export function fmtDate(iso, format) {
  const [y, mo, d] = String(iso || "").slice(0, 10).split("-");
  if (!y || !mo || !d) return "";
  return format === "YYYY-MM-DD" ? `${y}-${mo}-${d}` : format === "DD/MM/YYYY" ? `${d}/${mo}/${y}` : `${d}.${mo}.${y}`;
}

export function fmtMoney(minor, decimal = ",") {
  const n = Math.round(Number(minor) || 0);
  const s = `${n < 0 ? "-" : ""}${Math.floor(Math.abs(n) / 100)}.${String(Math.abs(n) % 100).padStart(2, "0")}`;
  return decimal === "," ? s.replace(".", ",") : s;
}

const MONEY = new Set(["net", "vat", "gross", "amount"]);
const DATES = new Set(["date"]);

function cell(v, delim) {
  const s = String(v ?? "");
  // a formula-looking cell is defused, and anything with the delimiter, a quote or a break is quoted
  const safe = /^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().,-]+$/.test(s) ? `'${s}` : s;
  return safe.includes(delim) || /["\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One entity's rows as CSV text, in the mapping's form. */
export function toCsv(entity, rows, mapping = DEFAULT_MAPPING) {
  const m = cleanMapping(mapping);
  const f = FIELDS[entity];
  const head = f.map((k) => cell(m.headers[entity][k], m.delimiter)).join(m.delimiter);
  const body = rows.map((r) => f.map((k) => {
    const v = r[k];
    if (MONEY.has(k)) return cell(fmtMoney(v, m.decimal), m.delimiter);
    if (DATES.has(k)) return cell(fmtDate(v, m.dateFormat), m.delimiter);
    if (k === "vat_rate") return cell(String(v ?? "").replace(".", m.decimal), m.delimiter);
    return cell(v, m.delimiter);
  }).join(m.delimiter));
  return (m.bom ? "\uFEFF" : "") + [head, ...body].join("\r\n") + "\r\n";
}

const x = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** All three entities as one XML document (documented in docs/INTEGRATIONS.md). Money with a dot, dates ISO. */
export function toXml({ customers = [], invoices = [], payments = [] }, { from, to, company = "" } = {}) {
  const el = (tag, row, fields) => `    <${tag} ${fields.map((k) => `${k}="${x(MONEY.has(k) ? fmtMoney(row[k], ".") : DATES.has(k) ? String(row[k] || "").slice(0, 10) : row[k])}"`).join(" ")}/>`;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<VoltMiraExport version="1" company="${x(company)}" from="${x(from)}" to="${x(to)}">`,
    `  <Customers>`, ...customers.map((r) => el("Customer", r, FIELDS.customers)), `  </Customers>`,
    `  <Invoices>`, ...invoices.map((r) => el("Invoice", r, FIELDS.invoices)), `  </Invoices>`,
    `  <Payments>`, ...payments.map((r) => el("Payment", r, FIELDS.payments)), `  </Payments>`,
    `</VoltMiraExport>`, "",
  ].join("\n");
}

/** Inside [from, to], both YYYY-MM-DD inclusive. */
export const inRange = (iso, from, to) => { const d = String(iso || "").slice(0, 10); return !!d && (!from || d >= from) && (!to || d <= to); };
