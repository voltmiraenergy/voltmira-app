// lib/monitorTickets.js — the nightly look at every monitored system
// (docs/MARKETPLACE.md): this year's months against what the signed offer
// promised (lib/fleetHealth.js assessSystem), and a maintenance ticket when a
// system produces clearly below it or its readings stopped
// (lib/ticketFlow.js openFromMonitoring, at most one a month per problem).
//
// Only systems connected to an inverter portal (inverter_stations) are
// judged: a system whose owner types readings by hand already gets the weekly
// "no reading for 30 days" email (lib/readingAlerts.js), and a missing hand
// reading is not a fault.
import { quote, SOLAR_SEASON } from "@voltmira/engine";
import { assessSystem } from "./fleetHealth.js";
import { snapshotEngine } from "./engineSettings.js";
import { offerQuoteInput } from "./offerInput.js";
import { openFromMonitoring } from "./ticketFlow.js";
import { xt } from "./integrationText.js";

/**
 * This calendar year as fleetHealth reads it. Pure.
 * @param {object} a
 * @param {Array<{month, kwh}>} a.readings   "YYYY-MM-01"
 * @param {number} a.annualKwh                the offer's first-year production
 * @param {number[]} a.shape                  12 monthly weights
 * @param {string|null} a.commissioned        "YYYY-MM-DD"
 * @returns {null | { p50, actual, asOf, firstMonth, month }}  null in January (no complete month yet) or without a promise
 */
export function systemCalendar({ readings = [], annualKwh, shape, commissioned = null, now = new Date() }) {
  const year = now.getUTCFullYear();
  const asOf = now.getUTCMonth() - 1;
  if (asOf < 0 || !(annualKwh > 0)) return null;
  const w = Array.isArray(shape) && shape.length === 12 ? shape.map((x) => Math.max(0, Number(x) || 0)) : SOLAR_SEASON;
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const p50 = w.map((x) => (annualKwh * x) / sum);
  const actual = Array(12).fill(null);
  for (const r of readings) {
    const m = String(r.month || "");
    if (Number(m.slice(0, 4)) === year && Number(r.kwh) >= 0) actual[Number(m.slice(5, 7)) - 1] = Number(r.kwh);
  }
  const c = commissioned ? String(commissioned).slice(0, 10) : null;
  // the month after commissioning is the first full one
  const firstMonth = !c ? 0 : Number(c.slice(0, 4)) < year ? 0 : Number(c.slice(0, 4)) > year ? 12 : Math.min(12, Number(c.slice(5, 7)));
  return { p50, actual, asOf, firstMonth, month: `${year}-${String(asOf + 1).padStart(2, "0")}` };
}

/**
 * Run over every monitored, commissioned system. Never throws; returns counts.
 * @param {object} admin  service-role client
 * @param {object} a
 * @param {(co) => object} a.notifierFor  lib/ticketServer.js ticketNotifier, per workspace
 */
export async function runMonitoringTickets(admin, { notifierFor, now = new Date(), budgetMs = 20_000 } = {}) {
  const t0 = Date.now();
  const out = { checked: 0, opened: 0 };
  const { data: stations, error } = await admin.from("inverter_stations").select("project_id").not("project_id", "is", null).limit(2000);
  if (error || !stations?.length) return out;
  const ids = [...new Set(stations.map((s) => s.project_id))];
  for (let i = 0; i < ids.length && Date.now() - t0 < budgetMs; i += 50) {
    const batch = ids.slice(i, i + 50);
    const [{ data: projects }, { data: readings }, { data: props }] = await Promise.all([
      admin.from("projects").select("id, company_id, title, client_name, client_email, address, status, market, install_progress").in("id", batch),
      admin.from("production_readings").select("project_id, month, kwh").in("project_id", batch).gte("month", `${now.getUTCFullYear()}-01-01`),
      admin.from("proposals").select("project_id, snapshot, accepted_at").in("project_id", batch).not("accepted_at", "is", null),
    ]);
    const cos = new Map();
    for (const p of projects || []) {
      if (p.status !== "won" || !p.install_progress?.commission) continue;
      const prop = (props || []).find((x) => x.project_id === p.id);
      if (!prop?.snapshot) continue;
      if (!cos.has(p.company_id)) {
        const { data: co } = await admin.from("companies").select("id, name, short_name, lang, engine").eq("id", p.company_id).maybeSingle();
        cos.set(p.company_id, co);
      }
      const co = cos.get(p.company_id);
      if (!co) continue;
      let annualKwh = 0;
      try { annualKwh = quote(offerQuoteInput(prop.snapshot), snapshotEngine(prop.snapshot.engine, co)).e.prod0; } catch { continue; }
      const cal = systemCalendar({ readings: (readings || []).filter((r) => r.project_id === p.id), annualKwh, shape: prop.snapshot.monthlyYieldShape, commissioned: p.install_progress.commission, now });
      if (!cal) continue;
      out.checked++;
      const assessment = assessSystem({ p50: cal.p50, actual: cal.actual, market: p.market || "MD", asOf: cal.asOf, firstMonth: cal.firstMonth });
      const lang = co.lang || "ro";
      const monthName = new Intl.DateTimeFormat({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO", { month: "long", timeZone: "UTC" }).format(new Date(`${cal.month}-15T00:00:00Z`));
      const r = await openFromMonitoring(admin, [{
        project: p, month: cal.month, assessment,
        title: (t) => t.kind === "no_data" ? xt("mt_mon_nodata", lang, { m: monthName }) : xt("mt_mon_under", lang, { pct: Math.round((t.ratio ?? assessment.ratioYtd ?? 0) * 100), m: monthName }),
      }], { io: notifierFor(co) });
      out.opened += r.opened;
    }
  }
  return out;
}
