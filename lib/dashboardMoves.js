// lib/dashboardMoves.js — "what should I do next?" for the dashboard.
//
// Every row is derived from a signal the app already records: a proposal
// heartbeat, an open count, a follow-up date the installer set in the editor,
// a lead's status, the install checklist, the invoice stamp, monthly
// production readings. Nothing is guessed, and every reason sentence quotes
// the numbers it was ranked on, so the installer can see why it is there.
//
// One row per quote or lead: the most urgent signal wins, so the list never
// repeats the same client three times. Scores only order the list; they are
// never shown.
//
// Pure: no I/O, no clock, no language. The caller passes `now`, the data and a
// small set of formatters, which is what makes the ranking testable.

export const INSTALL_STEPS = ["deposit", "permit", "order", "install", "grid", "commission"];

const DAY = 864e5;
const MIN = 6e4;

/** Minutes a proposal counts as "being read right now" after its last
 *  tracking event. The client page sends a heartbeat every 15 s while the
 *  tab is visible, so 2 minutes of silence means they have left. */
export const LIVE_WINDOW_MIN = 2;

/** Which filter tab a move belongs to. */
export const GROUP = {
  live: "sales", hot: "sales", followup: "sales", unopened: "sales", quiet: "sales", draft: "sales",
  lead: "leads",
  won_start: "jobs", install: "jobs", invoice: "jobs",
  health: "systems", nodata: "systems",
};

const t0 = (iso) => (iso ? new Date(iso).getTime() : NaN);
const daysBetween = (a, b) => Math.max(0, Math.floor((b - a) / DAY));

/**
 * @param {object} p
 * @param {object[]} p.projects   rows from `projects`
 * @param {Map}      p.stats      project_id -> { opens, lastOpen, sentAt, acceptedAt, battToggles }
 * @param {object[]} p.leads      open leads (not converted / archived)
 * @param {Map}      p.lastEvent  project_id -> ISO of the latest proposal_events row
 * @param {Map}      p.health     project_id -> { ratio, months, lastMonth: Date|null }
 * @param {number}   p.now        epoch ms
 * @param {string}   p.todayKey   "YYYY-MM-DD" in the app timezone
 * @param {object}   p.f          formatters: tr(key, vars), when(iso), dur(days), date(iso),
 *                                month(Date), step(key), channel(lead)
 * @returns {object[]} moves, most urgent first
 */
export function buildMoves({ projects = [], stats = new Map(), leads = [], lastEvent = new Map(), health = new Map(), now, todayKey, f }) {
  const out = [];

  for (const r of projects) {
    const st = stats.get(r.id) || {};
    const title = r.title || f.tr("untitled");
    const sub = r.client_name || "";
    const href = `/projects/${r.id}`;
    const open = { type: "link", href, label: f.tr("dx_act_open") };
    const cands = [];

    if (r.status === "sent" || r.status === "draft") {
      const ev = t0(lastEvent.get(r.id));
      if (ev && now - ev <= LIVE_WINDOW_MIN * MIN) {
        cands.push({ kind: "live", score: 100, at: lastEvent.get(r.id),
          reason: f.tr("mv_live"), actions: [open] });
      }
    }

    if (r.status === "sent") {
      const lastOpen = t0(st.lastOpen);
      const sentAt = t0(st.sentAt);
      const opens = st.opens || 0;
      if (opens > 0 && lastOpen && now - lastOpen <= 2 * DAY) {
        cands.push({ kind: "hot", score: 85 + Math.min(opens, 10), at: st.lastOpen,
          reason: st.battToggles > 0
            ? f.tr("mv_hot_batt", { n: opens, when: f.when(st.lastOpen) })
            : f.tr("mv_hot", { n: opens, when: f.when(st.lastOpen) }),
          actions: [open] });
      }
      if (opens === 0 && sentAt && now - sentAt >= 3 * DAY) {
        const age = daysBetween(sentAt, now);
        cands.push({ kind: "unopened", score: 55 + Math.min(age, 30) * 0.3, at: st.sentAt,
          reason: f.tr("mv_unopened", { when: f.when(st.sentAt) }), actions: [open] });
      }
      if (opens > 0 && sentAt && now - sentAt > 7 * DAY && lastOpen && now - lastOpen > 7 * DAY) {
        cands.push({ kind: "quiet", score: 46, at: st.lastOpen,
          reason: f.tr("mv_quiet", { n: opens, dur: f.dur(daysBetween(lastOpen, now)) }), actions: [open] });
      }
    }

    // A follow-up date the installer set on the quote. Only the date part is
    // compared, in the app timezone, so "today" means today on their wall clock.
    if ((r.status === "sent" || r.status === "draft") && r.next_follow_up && r.next_follow_up <= todayKey) {
      const overdue = daysBetween(t0(r.next_follow_up + "T12:00:00Z"), now);
      cands.push({ kind: "followup", score: 80 + Math.min(overdue, 10), at: r.next_follow_up + "T08:00:00Z",
        reason: f.tr("mv_followup", { date: f.date(r.next_follow_up + "T12:00:00Z") }), actions: [open] });
    }

    if (r.status === "draft") {
      const upd = t0(r.updated_at);
      if (upd && now - upd >= 3 * DAY) {
        const age = daysBetween(upd, now);
        cands.push({ kind: "draft", score: 30 + Math.min(age, 20) * 0.3, at: r.updated_at,
          reason: f.tr("mv_draft", { dur: f.dur(age) }), actions: [open] });
      }
    }

    if (r.status === "won") {
      const prog = r.install_progress || {};
      const done = INSTALL_STEPS.filter((s) => prog[s]);
      const next = INSTALL_STEPS.find((s) => !prog[s]);
      const wonAt = st.acceptedAt || r.updated_at;
      if (done.length === 0) {
        cands.push({ kind: "won_start", score: 72, at: wonAt,
          reason: f.tr("mv_won_start", { when: f.when(wonAt), step: f.step("deposit") }),
          actions: [{ type: "step", projectId: r.id, step: "deposit", label: f.tr("dx_act_step", { step: f.step("deposit") }) }, open] });
      } else if (next) {
        const lastStep = done.map((s) => prog[s]).sort().pop();
        const since = daysBetween(t0(lastStep + "T12:00:00Z"), now);
        cands.push({ kind: "install", score: 50 + Math.min(since, 20), at: lastStep + "T12:00:00Z",
          reason: f.tr("mv_install", { d: done.length, step: f.step(next), when: f.when(lastStep + "T12:00:00Z") }),
          actions: [{ type: "step", projectId: r.id, step: next, label: f.tr("dx_act_step", { step: f.step(next) }) }, open] });
      }
      // Panels are on the roof but nobody has been billed yet.
      if (prog.install && !r.invoiced_at) {
        cands.push({ kind: "invoice", score: 66, at: prog.install + "T12:00:00Z",
          reason: f.tr("mv_invoice", { when: f.when(prog.install + "T12:00:00Z") }),
          actions: [{ type: "link", href: `${href}/invoice`, label: f.tr("dx_act_invoice") }, open] });
      }

      const h = health.get(r.id);
      if (h && h.ratio != null && h.months >= 2 && h.ratio < 0.85) {
        cands.push({ kind: "health", score: h.ratio < 0.75 ? 76 : 64, at: h.lastMonth ? h.lastMonth.toISOString() : r.updated_at,
          reason: f.tr("mv_health", { p: Math.round(h.ratio * 100), dur: f.dur(h.months, "month") }), actions: [open] });
      } else if (h && h.lastMonth) {
        // Two full months without a reading: nobody has looked at this system.
        const monthsSince = (new Date(now).getUTCFullYear() - h.lastMonth.getUTCFullYear()) * 12
          + new Date(now).getUTCMonth() - h.lastMonth.getUTCMonth();
        if (monthsSince >= 3) {
          cands.push({ kind: "nodata", score: 52, at: h.lastMonth.toISOString(),
            reason: f.tr("mv_nodata", { month: f.month(h.lastMonth) }), actions: [open] });
        }
      }
    }

    if (cands.length) {
      const best = cands.sort((a, b) => b.score - a.score)[0];
      out.push({ ...best, key: `${best.kind}:${r.id}`, group: GROUP[best.kind], title, sub, href });
    }
  }

  for (const l of leads) {
    const st = l.status || "new";
    if (st !== "new") continue;
    const age = daysBetween(t0(l.created_at), now);
    const actions = [];
    if (l.phone) actions.push({ type: "tel", phone: l.phone, label: f.tr("dx_act_call") });
    actions.push({ type: "lead_quote", id: l.id, label: f.tr("lead_make_quote") });
    actions.push({ type: "lead_contacted", id: l.id, label: f.tr("lead_mark_contacted") });
    out.push({
      kind: "lead", group: "leads", key: `lead:${l.id}`,
      score: 70 + (l.hot ? 12 : 0) - Math.min(age, 20) * 0.5,
      title: l.name || f.tr("untitled"), sub: l.phone || l.email || "",
      hot: !!l.hot, note: l.note || "",
      at: l.created_at, href: "/leads",
      reason: f.tr("mv_lead", { channel: f.channel(l), when: f.when(l.created_at) }),
      actions,
    });
  }

  return out.sort((a, b) => b.score - a.score || (t0(b.at) || 0) - (t0(a.at) || 0));
}

/**
 * Where each job sits on the lead-to-live line. Stages are exclusive: a quote
 * is counted once, at the furthest point it has reached.
 */
export function flowStages({ projects = [], stats = new Map(), leads = [], gross = new Map() }) {
  const s = {
    leads: { n: 0, hot: 0 },
    drafts: { n: 0, eur: 0 },
    sent: { n: 0, eur: 0 },
    opened: { n: 0, eur: 0, engaged: 0 },
    won: { n: 0, eur: 0 },
    installing: { n: 0, eur: 0, stepsLeft: 0 },
    live: { n: 0, eur: 0, kw: 0 },
  };
  for (const l of leads) {
    const st = l.status || "new";
    if (st === "new" || st === "contacted") { s.leads.n++; if (l.hot) s.leads.hot++; }
  }
  let sentOrLater = 0, openedEver = 0;
  for (const r of projects) {
    const g = gross.get(r.id) || 0;
    const st = stats.get(r.id) || {};
    if (r.status === "draft") { s.drafts.n++; s.drafts.eur += g; continue; }
    if (r.status === "lost") continue;
    if (st.sentAt) { sentOrLater++; if ((st.opens || 0) > 0) openedEver++; }
    if (r.status === "sent") {
      if ((st.opens || 0) > 0) {
        s.opened.n++; s.opened.eur += g;
        if (st.opens >= 3) s.opened.engaged++;
      } else { s.sent.n++; s.sent.eur += g; }
      continue;
    }
    if (r.status === "won") {
      const done = INSTALL_STEPS.filter((k) => r.install_progress?.[k]).length;
      if (done === INSTALL_STEPS.length || r.commissioned_at) { s.live.n++; s.live.eur += g; s.live.kw += Number(r.kw) || 0; }
      else if (done === 0) { s.won.n++; s.won.eur += g; }
      else { s.installing.n++; s.installing.eur += g; s.installing.stepsLeft += INSTALL_STEPS.length - done; }
    }
  }
  // Share of tracked proposals the client actually opened.
  const openRate = sentOrLater ? Math.round((openedEver / sentOrLater) * 100) : null;
  return { stages: s, openRate };
}
