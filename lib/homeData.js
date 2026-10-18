// lib/homeData.js — what the homeowner's page (app/home/[id]) shows that is
// worked out rather than read: the warranties and the day each runs to.
// Pure; no I/O.

/** "2026-09-01" + 10 years -> "2036-09-01" (29 February lands on 28). */
export function addYears(day, years) {
  const [y, m, d] = String(day || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d || !(years > 0)) return null;
  const target = new Date(Date.UTC(y + years, m - 1, 1));
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/**
 * The warranties: the installer's own on the work, then each piece of
 * equipment whose maker publishes a verified warranty (lookup: lib/
 * supplierCatalog.js findWarrantyInfo). Never a number nobody published.
 * @param {object} a
 * @param {object[]} a.bom              the signed offer's lines { kind, brand, model }
 * @param {number|null} a.installYears  companies.install_warranty_years
 * @param {string|null} a.commissionedAt "YYYY-MM-DD"
 * @param {(brand, model) => {warrantyYears}|null} a.lookup
 * @returns {Array<{ kind: "install"|string, label: string, years: number, until: string|null, url?: string|null }>}
 */
export function warrantyList({ bom = [], installYears = null, commissionedAt = null, lookup }) {
  const out = [];
  if (Number(installYears) > 0) out.push({ kind: "install", label: "", years: Number(installYears), until: addYears(commissionedAt, Number(installYears)) });
  const seen = new Set();
  for (const line of bom || []) {
    if (!line?.brand || !line?.model) continue;
    const key = `${line.brand}|${line.model}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const w = lookup ? lookup(line.brand, line.model) : null;
    if (!w || !(w.warrantyYears > 0)) continue;
    out.push({ kind: line.kind || "other", label: `${line.brand} ${line.model}`, years: w.warrantyYears, until: addYears(commissionedAt, w.warrantyYears), url: w.productUrl || null });
  }
  return out;
}
