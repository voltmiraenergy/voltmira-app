// lib/clientJourney.js — what the client sees on their offer link once they
// have signed (app/p/[code]): where their installation stands, step by step,
// and what their system has produced against what the offer said. Read from
// the installer's own records (install_progress, the grid file, the monthly
// production readings), so the client sees the truth as the installer keeps
// it, never an estimate dressed as a reading. Pure.

/**
 * The client's steps, in order, each with the date it was done or null. A
 * Moldovan or Ukrainian grid file's own stages fill the grid steps when they
 * are there; otherwise the install checklist's.
 * @param {object} a
 * @param {string|null} a.signedAt  the offer's acceptance
 * @param {object} [a.progress]     install_progress
 * @returns {Array<{ id: string, at: string|null }>}
 */
export function journeySteps({ signedAt = null, progress = {} } = {}) {
  const p = progress || {};
  const st = p.gridFile?.stages || {};
  const day = (v) => (v ? String(v).slice(0, 10) : null);
  return [
    { id: "signed", at: day(signedAt) },
    { id: "deposit", at: day(p.deposit) },
    // the operator's approval: the grid file's (MD), the green-tariff notice (UA), else the permit tick
    { id: "approval", at: day(st.approval || st.ua_notice || p.permit) },
    { id: "install", at: day(p.install || st.installed || st.ua_installed) },
    // connected: the two-way meter and the contract, else the checklist's grid tick
    { id: "connected", at: day(st.contract || st.meter || st.ua_contract || st.ua_meter || p.grid) },
    { id: "live", at: day(p.commission) },
  ];
}

/** The step the client is waiting on: the first not done, or null when all are. */
export function nextStep(steps) {
  return (steps || []).find((s) => !s.at)?.id || null;
}

/**
 * Each month's reading against the offer's expectation for that month: the
 * first year's production spread over the months by the offer's own monthly
 * shape (PVGIS's for the site when it had one, else the engine's season).
 * Last `months` months with a reading, oldest first.
 * @param {Array<{month:string, kwh:number}>} readings  month "YYYY-MM-01"
 * @param {number} annualKwh  the offer's first-year production
 * @param {number[]} shape    12 monthly weights
 */
export function productionSeries(readings, annualKwh, shape, months = 12) {
  const w = Array.isArray(shape) && shape.length === 12 && shape.every((x) => Number(x) >= 0) ? shape.map(Number) : null;
  const sum = w ? w.reduce((a, b) => a + b, 0) : 0;
  const rows = (readings || [])
    .filter((r) => r && /^\d{4}-\d{2}/.test(String(r.month)) && Number(r.kwh) >= 0)
    .map((r) => {
      const m = Number(String(r.month).slice(5, 7)) - 1;
      const expected = sum > 0 && annualKwh > 0 ? (annualKwh * w[m]) / sum : null;
      return { month: String(r.month).slice(0, 7), kwh: Number(r.kwh), expected };
    })
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months);
  const total = rows.reduce((s, r) => s + r.kwh, 0);
  const expectedTotal = rows.every((r) => r.expected != null) ? rows.reduce((s, r) => s + r.expected, 0) : null;
  return { rows, total, expectedTotal, pct: expectedTotal ? (total / expectedTotal) * 100 : null };
}

/**
 * The few figures the client's page and a recommendation lead with: how many
 * steps are done, how many days from signing to a working system, the best
 * month and the last one with a reading, and what the energy produced is worth
 * at the offer's own prices (the offer's first-year saving per kWh it expected
 * to produce, in EUR; null when the offer has neither).
 */
export function journeyFacts(steps, production, { year1 = 0, prod0 = 0 } = {}) {
  const list = steps || [];
  const at = (id) => list.find((s) => s.id === id)?.at || null;
  const signed = at("signed"), live = at("live");
  const days = signed && live ? Math.max(0, Math.round((Date.parse(live) - Date.parse(signed)) / 864e5)) : null;
  const rows = production?.rows || [];
  const best = rows.reduce((b, r) => (!b || r.kwh > b.kwh ? r : b), null);
  const y1 = Number(year1), p0 = Number(prod0);
  return {
    done: list.filter((s) => s.at).length,
    total: list.length,
    days,
    best: best && best.kwh > 0 ? best : null,
    last: rows.length ? rows[rows.length - 1].month : null,
    valueEur: rows.length && y1 > 0 && p0 > 0 ? (production.total * y1) / p0 : null,
  };
}

/** The first word of a name: what a recommendation shows of the client who made it. */
export function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/** The locality of an address, its last part: "Str. Mare 5, Ialoveni" -> "Ialoveni". No street, no number. */
export function localityOf(address) {
  const parts = String(address || "").split(",").map((s) => s.trim()).filter(Boolean);
  const last = parts.filter((p) => !/^(md-?)?\d{4}$/i.test(p) && !/\d/.test(p)).pop();
  return last || "";
}
