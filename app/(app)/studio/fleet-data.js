"use client";
// app/(app)/studio/fleet-data.js — the installed base, as the Monitoring tab
// sees it. Nothing here stores readings of its own: every number comes from
// the same per-job localStorage keys the job workspace's Monitoring step
// writes, so the fleet view and a job's own page can never disagree.
import { simulate, effectiveYield, SOLAR_SEASON, MARKETS, FX } from "./_engine.js";
import { defaultEngineSettings } from "./_engine.js";
import { DEFAULT_IDS } from "./catalog-data.js";
import {
  readJSON, writeJSON, actualsKey, installKey, payKey, ticketsKey, jobStageContext,
} from "./jobs-data.js";
import { assessSystem } from "../../../lib/fleetHealth.js";

// The P50 month by month, from the quote engine. The Monitoring step in the
// job workspace calls this same function, so both show identical targets.
export function p50Row(job) {
  const sim = simulate({
    market: job.market, kw: +job.kw || 0, price: +job.price || 0.185,
    cons: +job.cons || 0, batt: false, yieldOverride: effectiveYield(job),
  }, defaultEngineSettings(), "expc");
  const seasonSum = SOLAR_SEASON.reduce((a, b) => a + b, 0);
  return SOLAR_SEASON.map((f) => (sim.prod0 * f) / seasonSum);
}

// What one kWh of this system's output is worth to the client, in EUR:
// self-consumed energy at the retail price, the rest at the export price
// (Moldova's net billing) or credited 1:1 (Romania's net metering).
export function valuePerKwh(job) {
  const mkt = MARKETS[job.market] || MARKETS.MD;
  const battKwh = +job.batteryKwh || 0;
  const sim = simulate({
    market: job.market, kw: +job.kw || 0, price: +job.price || 0.185, cons: +job.cons || 0,
    batt: battKwh > 0, battKwh, yieldOverride: effectiveYield(job),
  }, defaultEngineSettings(), "expc");
  const price = +job.price || mkt.defaultPrice;
  return sim.self * price + (1 - sim.self) * (mkt.oneToOne ? price : mkt.feed);
}

// Clients think in lei: MDL in Moldova, RON in Romania.
export const localLei = (eur, market) => eur * (market === "RO" ? FX.RON : FX.MDL);

// The last month that is fully over — the newest one a reading can exist for.
export function asOfMonth(now = new Date()) {
  return (now.getMonth() + 11) % 12;
}

// First full calendar month of production this year. A partial commissioning
// month would read as underperformance, so it's skipped. Without a date, the
// assessment falls back to the first month with a reading.
export function firstMonthFor(job, now = new Date()) {
  if (!job.commissionedAt) return undefined;
  const d = new Date(job.commissionedAt);
  if (isNaN(d.getTime())) return undefined;
  if (d.getFullYear() < now.getFullYear()) return 0;
  if (d.getFullYear() > now.getFullYear()) return 12;
  return d.getMonth() + 1;
}

// A job joins the fleet once its handover certificate is signed (or, for a
// job whose readings predate that, once it has any).
export function fleetRows(jobs, now = new Date()) {
  const asOf = asOfMonth(now);
  return jobs.flatMap((job) => {
    const ctx = jobStageContext(job.id);
    if (!ctx.signed && !ctx.hasActuals) return [];
    const saved = readJSON(actualsKey(job.id), null);
    const actual = Array.isArray(saved) && saved.length === 12 ? saved : Array(12).fill("");
    const p50 = p50Row(job);
    const a = assessSystem({ p50, actual, market: job.market, asOf, firstMonth: firstMonthFor(job, now) });
    const eurPerKwh = valuePerKwh(job);
    const monthActual = (i) => {
      const v = Number(actual[i]);
      return actual[i] === "" || actual[i] == null || !Number.isFinite(v) ? null : v;
    };
    return [{
      job, p50, actual, asOf, eurPerKwh,
      a,
      savedYtdEur: a.ytdActual * eurPerKwh,
      lostEur: a.lostKwh * eurPerKwh,
      monthActual,
    }];
  });
}

/* ---------------------------------------------------------- sample fleet --- */
// A labelled demo fleet of Moldovan systems, so the tab can be shown before a
// real installer has entered a year of readings. Each tells one of the
// stories the diagnosis rules recognise. Loading it only ever ADDS new
// "sample-" jobs; it never touches a job the installer created.
const SIGNATURE = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="140"><path d="M30 95c20-40 40-55 55-30s-5 45 15 20 30-60 45-35 5 40 25 25 20-30 35-20 10 25 30 15 25-20 40-15" fill="none" stroke="#0F172A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
);

const FLAT = (v) => Array(12).fill(v);
const SAMPLE_FLEET = [
  { id: "sample-ciobanu", name: "Familia Ciobanu", address: "str. Grenoble 142, Botanica, Chișinău, MD-2019", lat: 46.9867, lng: 28.8575,
    kw: 8, batteryKwh: 10, cons: 7800, price: 0.185, phases: 3, roofFactor: 0.97, commissionedAt: "2025-10-20", clientLang: "ro",
    profile: [1.02, 0.99, 1.03, 1.01, 1.02, 1.0, 1.03, 1.01, 1, 1, 1, 1] },
  { id: "sample-postica", name: "Andrei Postică", address: "str. Mihai Eminescu 18, Strășeni, MD-3701", lat: 47.1436, lng: 28.6106,
    kw: 5, batteryKwh: 0, cons: 5200, price: 0.185, phases: 1, roofFactor: 0.94, commissionedAt: "2025-09-05", clientLang: "ro",
    profile: [0.97, 1.0, 0.98, 0.99, 0.97, 1.01, 0.99, 0.98, 1, 1, 1, 1] },
  { id: "sample-pislaru", name: "Igor Pîslaru", address: "str. Independenței 31, Bălți, MD-3100", lat: 47.7617, lng: 27.9297,
    kw: 6.5, batteryKwh: 0, cons: 6400, price: 0.185, phases: 1, roofFactor: 0.96, commissionedAt: "2025-08-14", clientLang: "ru",
    profile: FLAT(1.0), event: "nodata" },
  { id: "sample-munteanu", name: "Familia Munteanu", address: "s. Mereni, r. Anenii Noi, MD-6531", lat: 46.9481, lng: 29.0472,
    kw: 10, batteryKwh: 5, cons: 9000, price: 0.185, phases: 3, roofFactor: 0.98, commissionedAt: "2025-11-03", clientLang: "ro",
    // weak rural line: fine until the midday sun gets strong, then trips
    profile: [1.01, 0.98, 0.99, 0.97, 0.88, 0.8, 0.78, 0.82, 0.9, 0.97, 1, 1] },
  { id: "sample-fructexport", name: "FructExport SRL", address: "str. Ștefan cel Mare 5, Criuleni, MD-4801", lat: 47.2133, lng: 29.159,
    kw: 60, batteryKwh: 0, cons: 95000, price: 0.16, phases: 3, roofFactor: 0.99, commissionedAt: "2025-06-30", clientLang: "ro",
    inverterId: "huawei-sun2000-100ktl", profile: FLAT(1.0), event: "soiling" },
  { id: "sample-codru", name: "Hotel Codru SRL", address: "str. Vasile Lupu 44, Orhei, MD-3505", lat: 47.3831, lng: 28.8231,
    kw: 30, batteryKwh: 0, cons: 52000, price: 0.16, phases: 3, roofFactor: 0.95, commissionedAt: "2025-12-10", clientLang: "ro",
    inverterId: "huawei-sun2000-100ktl", profile: FLAT(1.0), event: "sudden" },
  { id: "sample-ceban", name: "Familia Ceban", address: "str. Republicii 9, Cahul, MD-3909", lat: 45.9075, lng: 28.1944,
    kw: 7, batteryKwh: 0, cons: 6600, price: 0.185, phases: 1, roofFactor: 0.91, commissionedAt: "2025-10-01", clientLang: "ro",
    profile: [0.9, 0.91, 0.9, 0.9, 0.91, 0.9, 0.91, 0.89, 0.9, 0.9, 0.9, 0.9] },
  { id: "sample-vatra", name: "Pensiunea Vatra", address: "s. Butuceni, r. Orhei, MD-3552", lat: 47.3, lng: 28.9667,
    kw: 12, batteryKwh: 10, cons: 11000, price: 0.185, phases: 3, roofFactor: 0.93, commissionedAt: "2026-06-12", clientLang: "ro",
    profile: FLAT(1.03) },
];
export const SAMPLE_PREFIX = "sample-";
export const isSample = (job) => String(job?.id || "").startsWith(SAMPLE_PREFIX);

function seededNoise(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Readings for one sample system up to the last complete month. The
// sudden-drop, soiling and missing-reading stories are placed relative to
// that month so the demo tells the same story whenever it is loaded; the
// overvoltage story is seasonal by nature and stays on the calendar.
function sampleReadings(spec, job, now) {
  const asOf = asOfMonth(now);
  const start = firstMonthFor(job, now) ?? 0;
  const p50 = p50Row(job);
  const ratios = spec.profile.slice();
  if (spec.event === "sudden") ratios[asOf] = 0.64;
  if (spec.event === "soiling") for (let k = 0; k <= 4; k++) if (asOf - 4 + k >= 0) ratios[asOf - 4 + k] = 1 - 0.045 * k;
  const rnd = seededNoise(spec.id.length * 7919 + Math.round(spec.kw * 13));
  return p50.map((p, i) => {
    if (i < start || i > asOf) return "";
    if (spec.event === "nodata" && i === asOf) return "";
    return String(Math.round(p * ratios[i] * (1 + (rnd() - 0.5) * 0.02)));
  });
}

export function buildSampleFleet(existingIds, now = new Date()) {
  return SAMPLE_FLEET.filter((s) => !existingIds.has(s.id)).map((spec) => {
    const { profile, event, ...rest } = spec;
    const job = {
      contractNo: "", ref: "", market: "MD", paperworkFiled: true,
      panelId: DEFAULT_IDS.panel, inverterId: DEFAULT_IDS.inverter, batteryId: DEFAULT_IDS.battery, mountId: DEFAULT_IDS.mount,
      ...rest,
    };
    writeJSON(installKey(job.id), {
      signed: true, signatureDataUrl: SIGNATURE,
      steps: { fld_arrive: true, fld_mount: true, fld_dc: true, fld_ac: true, fld_test: true },
    });
    writeJSON(actualsKey(job.id), sampleReadings(spec, job, now));
    writeJSON(payKey(job.id), { depPct: 30, depPaid: true, done: true });
    return job;
  });
}

export function clearJobStorage(jobId) {
  for (const key of [actualsKey(jobId), installKey(jobId), payKey(jobId), ticketsKey(jobId), "voltmira_studio_notes_" + jobId]) {
    try { localStorage.removeItem(key); } catch { /* storage disabled */ }
  }
}
