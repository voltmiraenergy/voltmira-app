// lib/gridOverview.js — the grid connections overview (/grid): every file sent to an operator, how many days it
// has been in its step against the operator's usual days (lib/gridRules.js), what is overdue, and the average days
// from a signed offer to a connected system. Pure: the page loads the rows, this reads them.
import { overdueOf, daysBetween } from "./gridRules.js";
import { dayKeyOf } from "./tz.js";

const FINAL = ["connected", "rejected"];

/**
 * @param {object} a
 * @param {object[]} a.subs      grid_submissions rows
 * @param {object[]} a.events    grid_submission_events rows of those submissions
 * @param {Map<string, {client_name?:string, title?:string}>} a.projects  by id
 * @param {Map<string, string>} a.signedAt  project id -> when its offer was signed (ISO)
 * @param {Record<string, object>} a.rules  per operator (lib/gridRules.js latestGridRules)
 * @param {string} a.today       YYYY-MM-DD, Chișinău
 * @returns {{ open: object[], closed: object[], stats: { open: number, overdue: number, avgDays: number|null, avgN: number } }}
 */
export function gridOverview({ subs = [], events = [], projects = new Map(), signedAt = new Map(), rules = {}, today }) {
  // the day each submission entered each status (the latest time, as a file may come back to "submitted")
  const entered = new Map();
  for (const e of events) {
    const k = e.submission_id + "|" + e.to_status;
    const d = dayKeyOf(e.created_at);
    if (d && (!entered.has(k) || entered.get(k) < d)) entered.set(k, d);
  }
  const rows = subs.map((s) => {
    const since = entered.get(s.id + "|" + s.status) || dayKeyOf(s.updated_at || s.created_at);
    const o = overdueOf(s.status, since, today, rules[s.operator]);
    const p = projects.get(s.project_id) || {};
    return {
      id: s.id, projectId: s.project_id, client: p.client_name || p.title || "", operator: s.operator, reference: s.reference,
      status: s.status, since, days: o.days, expected: o.expected, overdue: o.overdue, late: o.overdue ? o.days - o.expected : 0,
      exception: Array.isArray(s.overrides) && s.overrides.length > 0,
    };
  });

  // open files: the overdue ones first, the longest wait first
  const open = rows.filter((r) => !FINAL.includes(r.status))
    .sort((a, b) => (b.overdue - a.overdue) || (b.late - a.late) || ((b.days ?? 0) - (a.days ?? 0)));
  const closed = rows.filter((r) => FINAL.includes(r.status) && r.days != null && r.days <= 90)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  // signed offer to connection: connected files whose connection fell in the last 12 months, with a signed offer
  const spans = [];
  for (const s of subs) {
    if (s.status !== "connected") continue;
    const on = entered.get(s.id + "|connected") || dayKeyOf(s.updated_at);
    const signed = dayKeyOf(signedAt.get(s.project_id));
    if (!on || !signed || daysBetween(on, today) > 365) continue;
    const d = daysBetween(signed, on);
    if (d != null) spans.push(d);
  }
  const avgDays = spans.length ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10 : null;
  return { open, closed, stats: { open: open.length, overdue: open.filter((r) => r.overdue).length, avgDays, avgN: spans.length } };
}
