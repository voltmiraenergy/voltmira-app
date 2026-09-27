// lib/traction.js — the platform's growth numbers, across every real
// workspace: kWp and € put in front of clients, win rate, time-to-quote,
// weekly active installers. Pure; lib/tractionData.js loads the rows and
// app/(app)/traction shows them to platform admins only.
//
// What counts, and why:
//   * Demo workspaces (lib/demo.js) and "Load sample pipeline" rows are left
//     out everywhere. They are ours, not traction. So are workspaces with no
//     people left in them (a reaped demo can leave its company row behind),
//     workspaces a platform admin belongs to (the team's own test accounts),
//     and any listed in `excludeIds`.
//   * A quote is "sent" when its first proposal link is created. Re-sends
//     don't count twice, and drafts that never went out don't count at all.
//   * kWp and € are counted in the week a quote was sent, at the price the
//     engine gives it (grossOf), the same figure the dashboard's pipeline uses.
//   * A workspace is active in a week if someone in it created or edited a
//     quote, sent a proposal, or did something the activity log attributes to
//     a person. Inbound leads and client page opens alone don't count.
//   * Time-to-quote is measured two ways: lead in -> proposal sent (for
//     leads linked to a quote), and quote created -> first sent.
import { mdDayKey } from "./tz.js";

const DAY = 864e5;

/** Monday (YYYY-MM-DD) of the week containing `ms`, in the app's time zone. */
export function weekOf(ms) {
  const d = new Date(mdDayKey(ms) + "T00:00:00Z");
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
}

export function median(xs) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const ts = (v) => (v ? new Date(v).getTime() : NaN);

// Every new workspace starts on `plan: "pro"` (add-enterprise-plan.sql), so the
// plan alone says nothing about payment. A billing subscription does.
export const hasSubscription = (c) => !!(c.paddle_subscription_id || c.stripe_subscription_id);

/** Companies that are real customers, and how many were left out. */
export function realCompanyIds(companies, profiles, isDemoEmail, { isInternalEmail = () => false, excludeIds = [] } = {}) {
  const out = new Set(excludeIds);
  const members = new Set();
  for (const p of profiles) {
    members.add(p.company_id);
    if (isDemoEmail(p.email) || isInternalEmail(p.email)) out.add(p.company_id);
  }
  const real = new Set(companies.filter((c) => members.has(c.id) && !out.has(c.id)).map((c) => c.id));
  real.excluded = companies.length - real.size;
  return real;
}

/**
 * @param {object} d
 * @param {object[]} d.companies   { id, name, created_at, plan, paddle_subscription_id?, stripe_subscription_id? }
 * @param {object[]} d.profiles    { company_id, email }
 * @param {object[]} d.projects    { id, company_id, status, kw, created_at, updated_at, sample? }
 * @param {object[]} d.proposals   { project_id, company_id, created_at, opens, accepted_at }
 * @param {object[]} d.leads       { company_id, project_id, created_at, source, sample? }
 * @param {object[]} d.activity    { company_id, created_at, actor_id }
 * @param {(project) => number} d.grossOf  contract value in € for a project row
 * @param {(email: string) => boolean} d.isDemoEmail
 * @param {(email: string) => boolean} [d.isInternalEmail]  the team's own addresses
 * @param {string[]} [d.excludeIds]  other workspaces to leave out (internal, test)
 * @param {number} [d.now]
 * @param {number} [d.weeks]  how many weeks the weekly series covers
 */
export function computeTraction({ companies, profiles, projects, proposals, leads, activity = [], grossOf, isDemoEmail, isInternalEmail, excludeIds, now = Date.now(), weeks = 12 }) {
  const real = realCompanyIds(companies, profiles, isDemoEmail, { isInternalEmail, excludeIds });
  const liveProjects = projects.filter((p) => real.has(p.company_id) && !p.sample);
  const projById = new Map(liveProjects.map((p) => [p.id, p]));
  const liveLeads = leads.filter((l) => real.has(l.company_id) && !l.sample);

  // First send per quote.
  const sentAt = new Map();
  let opened = 0, signed = 0, links = 0;
  for (const pr of proposals) {
    if (!projById.has(pr.project_id)) continue;
    links++;
    if ((pr.opens || 0) > 0) opened++;
    if (pr.accepted_at) signed++;
    const t = ts(pr.created_at);
    if (!sentAt.has(pr.project_id) || t < sentAt.get(pr.project_id)) sentAt.set(pr.project_id, t);
  }

  // Who did something, and when.
  const touches = [];   // [companyId, ms]
  for (const p of liveProjects) { touches.push([p.company_id, ts(p.created_at)]); touches.push([p.company_id, ts(p.updated_at)]); }
  for (const [pid, t] of sentAt) touches.push([projById.get(pid).company_id, t]);
  for (const a of activity) if (real.has(a.company_id) && a.actor_id) touches.push([a.company_id, ts(a.created_at)]);
  const lastActive = new Map();
  for (const [c, t] of touches) if (Number.isFinite(t) && t > (lastActive.get(c) ?? -Infinity)) lastActive.set(c, t);

  // Weekly series, oldest first, ending with the current week.
  const thisWeek = weekOf(now);
  const series = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const w = new Date(new Date(thisWeek + "T00:00:00Z").getTime() - i * 7 * DAY).toISOString().slice(0, 10);
    series.push({ week: w, newWorkspaces: 0, activeWorkspaces: 0, sent: 0, kwpQuoted: 0, eurQuoted: 0, signed: 0, leads: 0 });
  }
  const bucket = new Map(series.map((s) => [s.week, s]));
  const at = (ms) => (Number.isFinite(ms) ? bucket.get(weekOf(ms)) : undefined);

  for (const c of companies) if (real.has(c.id)) { const b = at(ts(c.created_at)); if (b) b.newWorkspaces++; }
  for (const [pid, t] of sentAt) {
    const b = at(t); if (!b) continue;
    const p = projById.get(pid);
    b.sent++; b.kwpQuoted += Number(p.kw) || 0; b.eurQuoted += grossOf(p) || 0;
  }
  for (const pr of proposals) if (projById.has(pr.project_id) && pr.accepted_at) { const b = at(ts(pr.accepted_at)); if (b) b.signed++; }
  for (const l of liveLeads) { const b = at(ts(l.created_at)); if (b) b.leads++; }
  const activeByWeek = new Map();
  for (const [c, t] of touches) {
    if (!Number.isFinite(t)) continue;
    const w = weekOf(t);
    if (!bucket.has(w)) continue;
    (activeByWeek.get(w) || activeByWeek.set(w, new Set()).get(w)).add(c);
  }
  for (const s of series) s.activeWorkspaces = activeByWeek.get(s.week)?.size || 0;

  // Rolling 30 days against the 30 before, for the headline tiles.
  const win = (from, to) => {
    const inWin = (t) => t >= from && t < to;
    let sent = 0, kwp = 0, eur = 0;
    for (const [pid, t] of sentAt) if (inWin(t)) { const p = projById.get(pid); sent++; kwp += Number(p.kw) || 0; eur += grossOf(p) || 0; }
    const active = new Set(touches.filter(([, t]) => inWin(t)).map(([c]) => c)).size;
    const fresh = companies.filter((c) => real.has(c.id) && inWin(ts(c.created_at))).length;
    return { sent, kwp, eur, active, fresh };
  };
  const last30 = win(now - 30 * DAY, now + 1);
  const prev30 = win(now - 60 * DAY, now - 30 * DAY);

  // Outcomes.
  const won = liveProjects.filter((p) => p.status === "won");
  const lost = liveProjects.filter((p) => p.status === "lost").length;
  let kwpQuoted = 0, eurQuoted = 0;
  for (const pid of sentAt.keys()) { const p = projById.get(pid); kwpQuoted += Number(p.kw) || 0; eurQuoted += grossOf(p) || 0; }

  const leadToQuote = [];
  for (const l of liveLeads) {
    const t = sentAt.get(l.project_id);
    const t0 = ts(l.created_at);
    if (t != null && Number.isFinite(t0) && t >= t0) leadToQuote.push((t - t0) / 36e5);
  }
  const draftToSent = [];
  for (const [pid, t] of sentAt) { const t0 = ts(projById.get(pid).created_at); if (Number.isFinite(t0) && t >= t0) draftToSent.push((t - t0) / 36e5); }

  // Per workspace, most recently active first.
  const perCo = new Map([...real].map((id) => [id, { quotes: 0, sent: 0, won: 0, kwpQuoted: 0, eurQuoted: 0, leads: 0, members: 0 }]));
  for (const p of liveProjects) {
    const w = perCo.get(p.company_id);
    w.quotes++;
    if (p.status === "won") w.won++;
    if (sentAt.has(p.id)) { w.sent++; w.kwpQuoted += Number(p.kw) || 0; w.eurQuoted += grossOf(p) || 0; }
  }
  for (const l of liveLeads) perCo.get(l.company_id).leads++;
  for (const pf of profiles) if (perCo.has(pf.company_id)) perCo.get(pf.company_id).members++;
  const workspaces = companies.filter((c) => real.has(c.id)).map((c) => ({
    id: c.id, name: c.name || "", plan: c.plan || "free", subscribed: hasSubscription(c), createdAt: c.created_at,
    lastActive: lastActive.has(c.id) ? new Date(lastActive.get(c.id)).toISOString() : null,
    ...perCo.get(c.id),
  })).sort((a, b) => ts(b.lastActive || 0) - ts(a.lastActive || 0));

  return {
    totals: {
      workspaces: real.size,
      excluded: real.excluded,
      paying: companies.filter((c) => real.has(c.id) && hasSubscription(c)).length,
      quotes: liveProjects.length,
      sent: sentAt.size,
      won: won.length,
      lost,
      winRate: won.length + lost ? won.length / (won.length + lost) : null,
      kwpQuoted, eurQuoted,
      kwpWon: won.reduce((s, p) => s + (Number(p.kw) || 0), 0),
      eurWon: won.reduce((s, p) => s + (grossOf(p) || 0), 0),
      leads: liveLeads.length,
      openRate: links ? opened / links : null,
      signed,
      hoursLeadToQuote: median(leadToQuote),
      leadToQuoteN: leadToQuote.length,
      hoursDraftToSent: median(draftToSent),
      draftToSentN: draftToSent.length,
    },
    last30, prev30, series, workspaces,
  };
}

/** The weekly series as CSV, for pasting into a deck or a spreadsheet. */
export function tractionCsv(series) {
  const head = "week_starting,new_workspaces,active_workspaces,proposals_sent,kwp_quoted,eur_quoted,signed_online,leads";
  const rows = series.map((s) => [s.week, s.newWorkspaces, s.activeWorkspaces, s.sent, s.kwpQuoted.toFixed(1), Math.round(s.eurQuoted), s.signed, s.leads].join(","));
  return [head, ...rows].join("\n") + "\n";
}
