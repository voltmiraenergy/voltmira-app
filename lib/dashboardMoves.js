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

import { gridFileStatus } from "./mdGrid.js";
import { gridFor } from "./gridFile.js";
import { projectWorkflow } from "./workflow.js";

export const INSTALL_STEPS = ["deposit", "permit", "order", "install", "grid", "commission"];

const DAY = 864e5;
const HOUR = 36e5;
const MIN = 6e4;

/** Minutes a proposal counts as "being read right now" after its last
 *  tracking event. The client page sends a heartbeat every 15 s while the
 *  tab is visible, so 2 minutes of silence means they have left. */
export const LIVE_WINDOW_MIN = 2;

/** Which filter tab a move belongs to. */
export const GROUP = {
  live: "sales", hot: "sales", followup: "sales", unopened: "sales", quiet: "sales", draft: "sales",
  lead: "leads", visit: "leads", visit_done: "leads",
  won_start: "jobs", install: "jobs", invoice: "jobs", grid: "jobs",
  health: "systems", nodata: "systems", unmonitored: "systems",
  gap: "jobs",
};

/**
 * The workflow's own next action and its alternative (lib/workflow.js) as row
 * buttons: the thing that records or moves the step, so a row is fixed from
 * the dashboard instead of only opened. Labels are the workflow's words.
 */
function wfButtons(w, f) {
  if (!w || !w.next) return [];
  const lab = (key, vars) => f.tr("wf:do_" + key, { ...(vars || {}), op: (w.op || f.tr("gf_ua_generic")) });
  const out = [];
  if (w.next.act) out.push({ ...w.next.act, label: lab(w.next.key, w.next.vars) });
  if (w.next.alt) {
    const k = w.next.altKey || (w.next.alt.type === "tel" ? "alt_call" : w.next.alt.type === "lead_quote" ? "alt_quote"
      : w.next.alt.type === "step" && w.next.alt.step === "deposit" ? "alt_deposit" : null);
    if (k) out.push({ ...w.next.alt, label: lab(k) });
  }
  return out;
}

/** Same action twice (the workflow's call and the row's own) shows once; at most three buttons. */
function uniq(actions) {
  const seen = new Set();
  const out = [];
  for (const a of actions) {
    if (!a) continue;
    const k = [a.type, a.step || a.stage || a.phone || a.href || a.id || ""].join(":");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out.slice(0, 3);
}

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
 * @param {Map}      [p.recentOpens]  project_id -> proposal opens in the last 2 days
 * @param {Map}      [p.wf]       project_id -> its workflow (lib/workflow.js); computed here when absent
 * @param {object}   p.f          formatters: tr(key, vars), when(iso), dur(days), date(iso),
 *                                month(Date), step(key), channel(lead), visit(iso) ("today, 15:00"),
 *                                day(iso) ("YYYY-MM-DD" in the app timezone). Keys starting
 *                                with "wf:" are the workflow's own words (lib/workflowText.js).
 * @returns {object[]} moves, most urgent first
 */
export function buildMoves({ projects = [], stats = new Map(), leads = [], lastEvent = new Map(), health = new Map(), recentOpens = new Map(), wf = null, now, todayKey, f }) {
  const out = [];

  for (const r of projects) {
    const st = stats.get(r.id) || {};
    const title = r.title || f.tr("untitled");
    const sub = r.client_name || "";
    const href = `/projects/${r.id}`;
    const open = { type: "link", href, label: f.tr("dx_act_open") };
    const cands = [];
    // Where the quote stands on the planned line, for the buttons that fix it.
    const w = (wf && wf.get(r.id)) || projectWorkflow({ project: r, stats: st, hasReadings: health.has(r.id), now, todayKey });
    const fixes = w && !w.lost ? wfButtons(w, f) : [];
    // An offer the client is deciding on: call (or resend), and if they already
    // signed some other way, record it right here.
    const signed = { type: "won", projectId: r.id, label: f.tr("wf:do_mark_signed") };
    const salesActs = uniq([...fixes, signed, open]);

    if (r.status === "sent" || r.status === "draft") {
      const ev = t0(lastEvent.get(r.id));
      if (ev && now - ev <= LIVE_WINDOW_MIN * MIN) {
        cands.push({ kind: "live", score: 100, at: lastEvent.get(r.id),
          reason: f.tr("mv_live"), actions: uniq([...fixes.filter((a) => a.type === "tel"), signed, open]) });
      }
    }

    if (r.status === "sent") {
      const lastOpen = t0(st.lastOpen);
      const sentAt = t0(st.sentAt);
      const opens = st.opens || 0;
      if (opens > 0 && lastOpen && now - lastOpen <= 2 * DAY) {
        // Opens in the last two days (proposal_events) say more than the
        // lifetime count: "4 times since Tuesday" is someone deciding now.
        const recent = recentOpens.get(r.id) || 0;
        cands.push({ kind: "hot", score: 85 + Math.min(opens, 10), at: st.lastOpen,
          reason: st.battToggles > 0
            ? f.tr("mv_hot_batt", { n: opens, when: f.when(st.lastOpen) })
            : recent >= 2
              ? f.tr("wf:mv_hot_recent", { n: recent, when: f.when(st.lastOpen) })
              : f.tr("mv_hot", { n: opens, when: f.when(st.lastOpen) }),
          actions: salesActs });
      }
      if (opens === 0 && sentAt && now - sentAt >= 3 * DAY) {
        const age = daysBetween(sentAt, now);
        cands.push({ kind: "unopened", score: 55 + Math.min(age, 30) * 0.3, at: st.sentAt,
          reason: f.tr("mv_unopened", { when: f.when(st.sentAt) }), actions: uniq([...fixes, open]) });
      }
      if (opens > 0 && sentAt && now - sentAt > 7 * DAY && lastOpen && now - lastOpen > 7 * DAY) {
        cands.push({ kind: "quiet", score: 46, at: st.lastOpen,
          reason: f.tr("mv_quiet", { n: opens, dur: f.dur(daysBetween(lastOpen, now)) }), actions: salesActs });
      }
    }

    // A follow-up date the installer set on the quote. Only the date part is
    // compared, in the app timezone, so "today" means today on their wall clock.
    if ((r.status === "sent" || r.status === "draft") && r.next_follow_up && r.next_follow_up <= todayKey) {
      const overdue = daysBetween(t0(r.next_follow_up + "T12:00:00Z"), now);
      cands.push({ kind: "followup", score: 80 + Math.min(overdue, 10), at: r.next_follow_up + "T08:00:00Z",
        reason: f.tr("mv_followup", { date: f.date(r.next_follow_up + "T12:00:00Z") }),
        actions: r.status === "draft" ? uniq([...fixes, open]) : salesActs });
    }

    if (r.status === "draft") {
      const upd = t0(r.updated_at);
      if (upd && now - upd >= 3 * DAY) {
        const age = daysBetween(upd, now);
        cands.push({ kind: "draft", score: 30 + Math.min(age, 20) * 0.3, at: r.updated_at,
          reason: f.tr("mv_draft", { dur: f.dur(age) }), actions: uniq([...fixes, open]) });
      }
    }

    if (r.status === "won") {
      const prog = r.install_progress || {};
      const done = INSTALL_STEPS.filter((s) => prog[s]);
      // The workflow's own next tick where it is a checklist step: a Ukrainian
      // job is built before its notice, so "permit" is not next after the
      // deposit there (lib/workflow.js stageOrder). Otherwise the checklist order.
      const wfStep = w && w.next && w.next.act && w.next.act.type === "step" ? w.next.act.step : null;
      const next = wfStep && !prog[wfStep] ? wfStep : INSTALL_STEPS.find((s) => !prog[s]);
      const wonAt = st.acceptedAt || r.updated_at;
      const depositStep = { type: "step", projectId: r.id, step: "deposit", label: f.tr("dx_act_step", { step: f.step("deposit") }) };
      if (done.length === 0 && !r.invoice_no) {
        // Signed and nothing invoiced: the deposit invoice is what starts the
        // job. The rail on the quote offers 30%, 50% or the full sum; a deposit
        // already taken some other way stays one tap away.
        cands.push({ kind: "won_start", score: 72, at: wonAt,
          reason: f.tr("wf:mv_won_invoice", { when: f.when(wonAt) }),
          actions: [{ type: "invoice", projectId: r.id, label: f.tr("wf:mv_act_invoice") }, depositStep] });
      } else if (done.length === 0) {
        cands.push({ kind: "won_start", score: 72, at: wonAt,
          reason: f.tr("mv_won_start", { when: f.when(wonAt), step: f.step("deposit") }),
          actions: [depositStep, open] });
      } else if (next) {
        const lastStep = done.map((s) => prog[s]).sort().pop();
        const since = daysBetween(t0(lastStep + "T12:00:00Z"), now);
        cands.push({ kind: "install", score: 50 + Math.min(since, 20), at: lastStep + "T12:00:00Z",
          reason: f.tr("mv_install", { d: done.length, step: f.step(next), when: f.when(lastStep + "T12:00:00Z") }),
          actions: [{ type: "step", projectId: r.id, step: next, label: f.tr("dx_act_step", { step: f.step(next) }) }, open] });
      }
      // The grid-connection file, Moldova's or Ukraine's (lib/mdGrid.js,
      // lib/uaGrid.js), has waited long enough on the operator: a call usually
      // moves it. Only once the installer has started the file in the editor;
      // the operator is the one they chose, else the one the editor suggests
      // from the address.
      const gf = prog.gridFile;
      const grid = gridFor(r.market);
      if (grid && gf && gf.stages && Object.keys(gf.stages).length) {
        const g = gridFileStatus(gf, todayKey, grid.stages);
        if (g.chase) {
          const O = grid.operators;
          const found = O[gf.operator] || O[grid.suggest([r.address, r.title].filter(Boolean).join(", "))];
          const op = found ? found.short : grid.market === "MD" ? O.premier.short : f.tr("gf_ua_generic");
          const rec = { type: "grid", projectId: r.id, stage: g.next, operator: gf.operator || null,
            label: f.tr("dx_act_step", { step: f.grid ? f.grid(g.next) : g.next }) };
          cands.push({ kind: "grid", score: 70 + Math.min(g.waitingDays, 20) * 0.2, at: g.since + "T12:00:00Z",
            reason: f.tr("mv_grid", { op, stage: f.grid ? f.grid(g.next) : g.next, dur: f.dur(g.waitingDays) }),
            actions: [rec, open] });
        }
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
            reason: f.tr("mv_nodata", { month: f.month(h.lastMonth) }),
            actions: [{ type: "link", href: "/studio/monitoring", label: f.tr("wf:mv_act_monitor") }, open] });
        }
      } else if (w && w.next && w.next.key === "monitor" && w.stuck) {
        // Finished a month ago and never a single reading: nobody would see a
        // fault. The other two only fire once readings exist.
        const at = w.since && /^\d{4}-\d{2}-\d{2}$/.test(String(w.since)) ? w.since + "T12:00:00Z" : w.since || r.updated_at;
        cands.push({ kind: "unmonitored", score: 40, at,
          reason: f.tr("wf:mv_unmonitored", { when: f.when(at) }),
          actions: [{ type: "link", href: "/studio/monitoring", label: f.tr("wf:mv_act_monitor") }, open] });
      }
    }

    // A later step is recorded and an earlier one is not: one tap records it.
    if (w && w.gap && w.target && fixes.length) {
      cands.push({ kind: "gap", score: 74, at: w.since || r.updated_at,
        reason: f.tr("wf:mv_gap", { stage: f.stage ? f.stage(w.target, r.market) : w.target }),
        actions: uniq([...fixes, open]) });
    }

    if (cands.length) {
      const best = cands.sort((a, b) => b.score - a.score)[0];
      out.push({ ...best, key: `${best.kind}:${r.id}`, group: GROUP[best.kind], title, sub, href });
    }
  }

  for (const l of leads) {
    const st = l.status || "new";
    const call = l.phone ? [{ type: "tel", phone: l.phone, label: f.tr("dx_act_call") }] : [];
    const quote = { type: "lead_quote", id: l.id, label: f.tr("lead_make_quote") };
    const base = { group: "leads", title: l.name || f.tr("untitled"), sub: l.phone || l.email || "", hot: !!l.hot, href: "/leads" };

    // A booked site visit outranks everything else about the lead: today's
    // is near the top, and once it has happened the next job is the quote.
    const visit = t0(l.visit_at);
    if (Number.isFinite(visit) && st !== "converted" && st !== "archived") {
      if (visit >= now - 3 * HOUR && visit < now + 2 * DAY) {
        const today = f.day ? f.day(l.visit_at) === todayKey : visit - now < 12 * HOUR;
        out.push({
          ...base, kind: "visit", key: `visit:${l.id}`, score: today ? 94 : 79, at: l.visit_at,
          note: l.address || "",
          reason: f.tr("mv_visit", { when: f.visit(l.visit_at) }),
          actions: [...call, { type: "link", href: "/leads", label: f.tr("dx_act_open") }],
        });
        continue;
      }
      if (visit < now - 3 * HOUR && visit >= now - 10 * DAY) {
        out.push({
          ...base, kind: "visit_done", key: `visit:${l.id}`, score: 77, at: l.visit_at,
          reason: f.tr("mv_visit_done", { when: f.when(l.visit_at) }),
          actions: [quote, ...call],
        });
        continue;
      }
    }

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
