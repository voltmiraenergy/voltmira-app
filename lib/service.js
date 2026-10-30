// lib/service.js — after the handover (docs/features/phase5.md): each installed system's health against its own
// quote, the client's requests and their life, the yearly check, and the warranties. Pure, no I/O: the server
// (lib/serviceServer.js, lib/serviceActions.js) reads and writes the rows.
import { assessSystem } from "./fleetHealth.js";
import { expectedMonthKwh } from "./yieldCalibration.js";
import { mdDayKey } from "./tz.js";

export const REQUEST_KINDS = ["no_production", "inverter_error", "damage", "roof_leak", "other"];
export const REQUEST_STATUSES = ["new", "planned", "in_progress", "resolved", "closed"];
export const OPEN_STATUSES = ["new", "planned", "in_progress"];
export const WARRANTY_ITEMS = ["panels", "performance", "inverter", "battery", "install"];
export const DEFAULTS = { replyDays: 2, checkMonths: 12, clientReminderDays: 14, soonDays: 60, warrantySoonDays: 90 };
const DAY = 864e5;

const dayMs = (d) => Date.parse(String(d).slice(0, 10) + "T12:00:00Z");
export const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / DAY);
/** "2026-10-24" plus n months, kept to the month's last day when it is shorter ("2026-01-31" + 1 = "2026-02-28"). */
export function addMonths(day, n) {
  const [y, m, d] = String(day).slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** The day a system went live: the commissioning step ticked, else the date it was commissioned, else null. */
export function liveOn(project) {
  const p = project?.install_progress || {};
  const d = p.commission || project?.commissioned_at || null;
  return d ? String(d).slice(0, 10) : null;
}

/**
 * One system's health against its own quote (lib/fleetHealth.js), from its monthly readings: the year of the last
 * complete month, from the month after it went live.
 * @param {{ kw, yield_per_kwp, monthly_yield_shape, market }} project
 * @param {{ month: "2026-03" | "2026-03-01", kwh }[]} readings
 * @returns {{ status, cause, ratio, months, lastMonth, lostKwh, evidence } }
 */
export function systemHealth(project, readings, today = mdDayKey(Date.now()), degrPct = 0.5) {
  const live = liveOn(project);
  const lastMonth = (readings || []).map((r) => String(r.month).slice(0, 7)).sort().pop() || null;
  if (!live) return { status: "pending", cause: null, ratio: null, months: 0, lastMonth, lostKwh: 0, evidence: {} };
  // the last complete month, and its year
  const [ty, tm] = today.slice(0, 7).split("-").map(Number);
  const asOfDate = new Date(Date.UTC(ty, tm - 2, 1));
  const year = asOfDate.getUTCFullYear(), asOf = asOfDate.getUTCMonth();
  const [ly, lm] = live.slice(0, 7).split("-").map(Number);
  // the month after going live is the first whole one
  const firstMonth = ly < year ? 0 : ly > year ? 12 : lm;   // lm is 1-based: the next month's 0-based index
  const startAge = (m) => Math.max(0, (Date.UTC(year, m, 15) - dayMs(live)) / (365.25 * DAY));
  const p50 = Array.from({ length: 12 }, (_, m) => expectedMonthKwh(project.kw, project.yield_per_kwp, project.monthly_yield_shape, m, startAge(m), degrPct));
  const actual = Array(12).fill(null);
  for (const r of readings || []) {
    const k = String(r.month).slice(0, 7);
    if (Number(k.slice(0, 4)) === year) actual[Number(k.slice(5, 7)) - 1] = Number(r.kwh);
  }
  if (!(Number(project.kw) > 0) || !(Number(project.yield_per_kwp) > 0)) return { status: "pending", cause: null, ratio: null, months: 0, lastMonth, lostKwh: 0, evidence: {} };
  const a = assessSystem({ p50, actual, market: project.market || "MD", asOf, firstMonth });
  // the last complete month's own figures, for the client's monthly note (lib/clientUpdate.js)
  const month = { index: asOf, kwh: actual[asOf], expected: Math.round(p50[asOf] || 0) };
  return { status: a.status, cause: a.cause, ratio: a.ratioYtd, lastRatio: a.last?.ratio ?? null, months: a.months, lastMonth, lostKwh: Math.round(a.lostKwh || 0), evidence: a.evidence, year, month };
}

/** Does this health call for a look (and so a suggested request)? */
export const needsAttention = (h) => ["critical", "warn", "nodata"].includes(h?.status);

/**
 * A request as typed, by the client on their page or by the installer.
 * @returns {{ ok: true, row } | { ok: false, errors: string[] }}
 */
export function cleanRequest(input, { source = "installer" } = {}) {
  const errors = [];
  const kind = REQUEST_KINDS.includes(input?.kind) ? input.kind : null;
  if (!kind) errors.push("kind");
  const description = String(input?.description || "").replace(/\r/g, "").trim();
  if (description.length < (source === "client" ? 5 : 3) || description.length > 2000) errors.push("description");
  const contact_name = String(input?.contact_name || "").trim().slice(0, 120);
  const phone = String(input?.contact_phone || "").trim();
  if (phone && !/^[+0-9 ()-]{6,24}$/.test(phone)) errors.push("phone");
  if (source === "client" && !phone) errors.push("phone");
  if (errors.length) return { ok: false, errors };
  return { ok: true, row: { kind, description, contact_name, contact_phone: phone, source: source === "client" ? "client" : "installer", status: "new" } };
}

/** The statuses a request can go to from where it is. */
export function nextStatuses(status) {
  return {
    new: ["planned", "in_progress", "resolved", "closed"],
    planned: ["in_progress", "resolved", "new"],
    in_progress: ["resolved", "planned"],
    resolved: ["closed", "in_progress"],
    closed: ["in_progress"],
  }[status] || [];
}

/** Working days (Monday to Friday) from a moment to a day, on the Chișinău calendar. */
export function workingDaysSince(iso, today = mdDayKey(Date.now())) {
  let d = mdDayKey(Date.parse(iso)), n = 0;
  while (d < today) {
    d = mdDayKey(dayMs(d) + DAY);
    const wd = new Date(dayMs(d)).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

/** A new request nobody has answered within the working days set: late. */
export function replyLate(req, replyDays = DEFAULTS.replyDays, today = mdDayKey(Date.now())) {
  return req?.status === "new" && !req.first_reply_at && workingDaysSince(req.created_at, today) > replyDays;
}

/**
 * The next yearly check: from the last one done, else from going live; null when checks are off or it is not live.
 * @param {{ live: string|null, lastDone: string|null, months?: number, off?: boolean }} a
 */
export function nextCheck({ live, lastDone = null, months = DEFAULTS.checkMonths, off = false }) {
  if (off || !live || !(months > 0)) return null;
  return addMonths(lastDone && lastDone > live ? lastDone : live, months);
}

/** Where a check stands: overdue, due within the soon window, or later. */
export function checkState(due, today = mdDayKey(Date.now()), soonDays = DEFAULTS.soonDays) {
  if (!due) return null;
  const left = daysBetween(today, due);
  return left < 0 ? "overdue" : left <= soonDays ? "soon" : "later";
}

/**
 * The warranties of one system: the ones set by hand win; else panels, inverter and battery from the catalog when
 * their warranty is verified (lookup), the installation from the workspace's own; the rest left to fill in.
 * @param {{ live: string|null, bom: object[], installYears: number|null, saved: object[], lookup: (brand, model) => ({ warrantyYears }|null) }} a
 */
export function warrantiesFor({ live, bom = [], installYears = null, saved = [], lookup = () => null }) {
  const byItem = new Map(saved.map((w) => [w.item, w]));
  const part = (kind) => (bom || []).find((b) => b.kind === kind) || null;
  const from = (item, product, years, source) => ({ item, product, years, source, starts_on: live, ends_on: live && years > 0 ? addMonths(live, Math.round(years * 12)) : null });
  return WARRANTY_ITEMS.map((item) => {
    const s = byItem.get(item);
    if (s) return { ...from(item, s.product || "", Number(s.years) || null, "set"), starts_on: s.starts_on || live, ends_on: (s.starts_on || live) && Number(s.years) > 0 ? addMonths(s.starts_on || live, Math.round(Number(s.years) * 12)) : null, serials: s.serials || [], note: s.note || "" };
    if (item === "install") return { ...from(item, "", Number(installYears) || null, installYears ? "workspace" : "none"), serials: [] };
    const kind = { panels: "panel", inverter: "inverter", battery: "battery", performance: null }[item];
    const b = kind ? part(kind) : null;
    if (!b) return { ...from(item, "", null, "none"), serials: [] };
    const w = lookup(b.brand, b.model);
    return { ...from(item, `${b.brand} ${b.model}`.trim(), w?.warrantyYears || null, w ? "catalog" : "none"), serials: [] };
  }).filter((w) => w.item !== "battery" || w.product || w.source === "set");
}

/** Warranties ending within the window, soonest first. */
export function endingSoon(list, today = mdDayKey(Date.now()), days = DEFAULTS.warrantySoonDays) {
  return list.filter((w) => w.ends_on && daysBetween(today, w.ends_on) >= 0 && daysBetween(today, w.ends_on) <= days).sort((a, b) => a.ends_on.localeCompare(b.ends_on));
}
