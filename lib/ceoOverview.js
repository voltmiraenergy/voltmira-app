// lib/ceoOverview.js — the admin Overview (app/(app)/admin/page.jsx): the few numbers that run the company, from the
// sign-up log (lib/signupsAdmin.js), the platform's traction (lib/traction.js) and VoltMira's fees (lib/feeRevenue.js).
// Pure: the page loads, this shapes.
const DAY = 864e5;

/** Change against the period before, as a ratio (0.25 = +25%); null when there was nothing before. */
export const change = (now, prev) => (prev > 0 ? (now - prev) / prev : null);

/** People (not teammates) who signed up in [from, to). */
const people = (rows) => rows.filter((r) => r.kind !== "teammate");
const within = (rows, from, to) => rows.filter((r) => { const t = Date.parse(r.at); return t >= from && t < to; });

/** Sign-ups per week, oldest first, the last one this week (weeks start on Monday, Chișinău calendar is close enough). */
export function weeklySignups(rows, { weeks = 12, now = Date.now() } = {}) {
  const d = new Date(now);
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * DAY;
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = monday - i * 7 * DAY;
    out.push({ week: new Date(from).toISOString().slice(0, 10), n: within(people(rows), from, from + 7 * DAY).length });
  }
  return out;
}

/**
 * From an account to a signed job: each step's count, its share of the step before and of the top.
 * @param {object[]} rows        sign-up rows (buildSignups().rows)
 * @param {object[]} workspaces  traction workspaces (quotes, sent, won per workspace)
 */
export function funnel(rows, workspaces) {
  const p = people(rows);
  const owners = p.filter((r) => r.kind === "owner");
  const steps = [
    ["accounts", p.length],
    ["workspace", owners.length],
    ["quote", workspaces.filter((w) => w.quotes > 0).length],
    ["sent", workspaces.filter((w) => w.sent > 0).length],
    ["signed", workspaces.filter((w) => w.won > 0).length],
  ];
  return steps.map(([key, n], i) => ({
    key, n,
    ofPrev: i === 0 ? null : steps[i - 1][1] > 0 ? n / steps[i - 1][1] : null,
    ofTop: steps[0][1] > 0 ? n / steps[0][1] : null,
  }));
}

/** New people to call: started in the last `days`, have not quoted yet, newest first; with a phone first. */
export function toCall(rows, { days = 14, now = Date.now(), max = 8 } = {}) {
  return people(rows)
    .filter((r) => now - Date.parse(r.at) < days * DAY && !(r.quotes > 0))
    .sort((a, b) => (b.phone ? 1 : 0) - (a.phone ? 1 : 0) || Date.parse(b.at) - Date.parse(a.at))
    .slice(0, max);
}

/** The installers doing the most: signed jobs first, then offers sent, then quotes. */
export function topInstallers(workspaces, max = 6) {
  return [...workspaces].filter((w) => w.quotes > 0)
    .sort((a, b) => b.won - a.won || b.sent - a.sent || b.quotes - a.quotes || (b.kwpQuoted || 0) - (a.kwpQuoted || 0))
    .slice(0, max);
}

/** A count per value, largest first: countries, how people signed up. */
export function breakdown(rows, key) {
  const m = new Map();
  for (const r of people(rows)) { const k = r[key] || "Unknown"; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}

/** Sign-ups in the last 30 days and the 30 before. */
export function signupWindow(rows, now = Date.now()) {
  const p = people(rows);
  return { last30: within(p, now - 30 * DAY, now + 1).length, prev30: within(p, now - 60 * DAY, now - 30 * DAY).length };
}

/** One sentence for the top of the page: this month in a line. */
export function headline({ signups30, sent30, won, active30 }) {
  const part = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return `Last 30 days: ${part(signups30, "new sign-up", "new sign-ups")}, ${part(active30, "active workspace", "active workspaces")}, ${part(sent30, "offer sent", "offers sent")}. ${part(won, "job", "jobs")} signed in all.`;
}
