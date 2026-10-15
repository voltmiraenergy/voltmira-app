// lib/workflow.js — the installer's whole job as one planned line, from the
// first message to a system producing on a roof (and, if they want it, inside
// a portfolio a lender can review).
//
// Every quote (and every lead that has no quote yet) is placed on that line
// from evidence the app already stores: the lead's status and site visit, the
// quote's status, its proposal row (sent, opens, accepted), the install
// checklist (install_progress), the grid-connection file inside it
// (install_progress.gridFile, lib/gridFile.js), the invoice number, the
// commissioning date, production readings and portfolio membership. Nothing
// is ticked on this screen and nothing is guessed: a stage is done only when
// one of those records says so.
//
// For each job it answers five questions:
//   where is it            stage (the furthest step reached) and every step's state
//   how far along          done / total over the required steps
//   what is the ONE next   next: a key the text table words, the one-tap action
//     thing to do          and a deep link to where it is done
//   who holds the ball     waitingOn: you, the client or the grid operator
//   is it stuck            days in the stage against a stated working rule
//
// Moldova and Ukraine run the grid file in a different order. In Moldova the
// connection approval (aviz de racordare) comes before the system goes up; a
// Ukrainian household installs first and then hands the notice to the
// supplier (lib/uaGrid.js). stageOrder() puts "apply" where each market has it.
//
// Pure: no I/O, no clock, no language. The caller passes `now`, the rows and
// the day key; lib/workflowText.js turns the keys into words.

import { gridFor } from "./gridFile.js";
import { gridFileStatus } from "./mdGrid.js";

const DAY = 864e5;

/** Markets a lender portfolio can model (lib/portfolioModel.js). */
export const PORTFOLIO_MARKETS = ["MD", "UA"];

/** Every stage, Moldova's order. */
export const STAGES = ["lead", "visit", "quote", "sent", "opened", "signed", "deposit", "apply", "installed", "connected", "live", "financed"];

/** Steps a job can do without. A quote made from a phone call has no site
 *  visit, and a portfolio is an option, not a step every job needs. */
export const OPTIONAL = new Set(["visit", "financed"]);

/** Which part of the business each stage belongs to (the pipeline groups by this). */
export const PHASE = {
  lead: "sell", visit: "sell", quote: "sell", sent: "sell", opened: "sell",
  signed: "close", deposit: "close",
  apply: "build", installed: "build", connected: "build",
  live: "run", financed: "run",
};
export const PHASES = ["sell", "close", "build", "run"];

/** The stages in the order a market runs them. */
export function stageOrder(market) {
  if (market === "UA") {
    // install first, then the notice to the supplier (lib/uaGrid.js)
    return ["lead", "visit", "quote", "sent", "opened", "signed", "deposit", "installed", "apply", "connected", "live", "financed"];
  }
  return [...STAGES];
}

/**
 * Days a job may wait on its next step before it counts as stuck. These are
 * VoltMira's working rules of thumb, not industry benchmarks or legal terms;
 * the screen always states the rule next to the verdict. Where the dashboard
 * already had a rule for the same wait (lib/dashboardMoves.js), it is the
 * same number, so the two never disagree. The grid operator's waits use the
 * grid file's own chaseAfter (lib/mdGrid.js, lib/uaGrid.js).
 */
export const STUCK_AFTER = {
  lead_new: 2,     // a new lead nobody has called
  lead_open: 7,    // contacted, no visit booked and no quote
  visit_done: 3,   // site visit done, no quote yet
  draft: 3,        // a draft untouched (dashboard: "draft")
  unopened: 3,     // sent and never opened (dashboard: "unopened")
  undecided: 7,    // opened, then quiet (dashboard: "quiet")
  deposit: 7,      // signed, no deposit recorded
  apply: 7,        // Moldova: deposit in, no application; Ukraine: installed, no notice
  build: 30,       // equipment to order and fit
  connect: 30,     // installed, not connected, when the grid file is not tracked stage by stage
  commission: 14,  // connected, not commissioned
  monitor: 30,     // commissioned, no production reading yet
};

const ms = (v) => {
  if (!v) return NaN;
  const s = String(v);
  // install_progress and the grid file store calendar days; read them at noon UTC
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + "T12:00:00Z") : Date.parse(s);
};
const daysSince = (t, now) => (Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : null);
const dayNum = (key) => Math.floor(Date.parse(String(key).slice(0, 10) + "T00:00:00Z") / DAY);
/** Whole days since a stamp: calendar days for a "YYYY-MM-DD" (as the grid
 *  file counts them), elapsed days for a timestamp. */
function age(v, now, today) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = dayNum(today) - dayNum(s);
    return Number.isFinite(d) ? Math.max(0, d) : null;
  }
  return daysSince(ms(s), now);
}
const latest = (...vals) => {
  const ok = vals.filter((v) => Number.isFinite(ms(v)));
  if (!ok.length) return null;
  return ok.reduce((a, b) => (ms(b) > ms(a) ? b : a));
};

/** The grid file's connection stages for a market (meter + contract). */
function connectionStages(market) {
  return market === "UA" ? ["ua_meter", "ua_contract"] : ["meter", "contract"];
}

/** The operator a quote's grid file goes to: the one chosen, else the one its address suggests. */
export function operatorFor(project) {
  const grid = gridFor(project?.market);
  if (!grid) return null;
  const gf = project?.install_progress?.gridFile || {};
  const O = grid.operators;
  const id = O[gf.operator] ? gf.operator : grid.suggest([project?.address, project?.title].filter(Boolean).join(", "));
  return id && O[id] ? { id, short: O[id].short } : null;
}

/**
 * Evidence for each project stage: done or not, and the day it happened when
 * a record has one.
 */
function evidence(p, st, lead, inPortfolio, now) {
  const prog = p.install_progress || {};
  const gf = (prog.gridFile && prog.gridFile.stages) || {};
  const market = p.market;
  const won = p.status === "won";
  const sentAt = st.sentAt || null;
  const signedAt = won ? (st.acceptedAt || p.updated_at || null) : null;
  const visitAt = lead && lead.visit_at && ms(lead.visit_at) <= now ? lead.visit_at : null;
  const conn = connectionStages(market);

  let applyAt = null;
  // Moldova: the operator's approval, or the checklist's permit tick, unless
  // the grid file itself shows an application still waiting for that approval
  // (then the file's record wins: the approval is not in yet).
  if (market === "MD") applyAt = gf.approval || (gf.applied ? null : prog.permit) || null;
  else if (market === "UA") applyAt = gf.ua_notice || prog.permit || null;
  else applyAt = prog.permit || null;

  const installedAt = prog.install || (market === "MD" ? gf.installed : market === "UA" ? gf.ua_installed : null) || null;
  const gridDone = conn.every((k) => gf[k]);
  const connectedAt = prog.grid || (gridDone ? latest(...conn.map((k) => gf[k])) : null);
  const liveAt = prog.commission || p.commissioned_at || null;

  return {
    lead: { done: true, at: lead?.created_at || p.created_at || null },
    visit: { done: !!visitAt, at: visitAt },
    quote: { done: true, at: p.created_at || null },
    sent: { done: !!sentAt || p.status !== "draft", at: sentAt },
    opened: { done: (st.opens || 0) > 0 || won, at: st.lastOpen || null },
    signed: { done: won, at: signedAt, approx: won && !st.acceptedAt },
    deposit: { done: !!prog.deposit, at: prog.deposit || null },
    apply: { done: !!applyAt, at: applyAt },
    installed: { done: !!installedAt, at: installedAt },
    connected: { done: !!connectedAt, at: connectedAt },
    live: { done: !!liveAt, at: liveAt },
    financed: { done: !!inPortfolio, at: null },
  };
}

/**
 * The actions that record each stage of a quote, and the tick each done stage
 * can take back. `fix` is for a stage still to do, `gap` for one a later step
 * shows already happened (record it first), `undo` only where removing this
 * screen's own tick really reopens the stage (another record, such as the
 * grid file or a commissioning date, may still hold it).
 */
function stageFixes({ p, id, market, prog, gfile, grid, op, phone, packable, act }) {
  const gst = (gfile && gfile.stages) || {};
  const conn = connectionStages(market);
  const nextConn = grid ? conn.find((k) => !gst[k]) : null;
  const tel = phone ? [{ key: "alt_call", act: { type: "tel", phone } }] : [];
  const won = { key: "mark_signed", act: { type: "won", projectId: id } };
  const opv = { op: op ? op.short : null };
  const deposit = { key: "deposit_paid", act: act.step("deposit") };
  const invoice = { key: "invoice", act: { type: "invoice", projectId: id } };
  const fix = {
    sent: [{ key: "send", act: { type: "send", projectId: id } }],
    opened: [{ key: "resend", act: { type: "copy_link", projectId: id } }, ...tel],
    signed: [...(phone ? [{ key: "call", act: { type: "tel", phone } }] : []), won],
    deposit: p.invoice_no ? [deposit] : [invoice, deposit],
    apply: market === "MD"
      ? (gst.applied ? [{ key: "approval", vars: opv, act: act.grid("approval") }]
        : [{ key: "apply_md", vars: opv, act: act.grid("applied") }, { key: "approval", vars: opv, act: act.grid("approval") }])
      : market === "UA" ? [{ key: "notice_ua", act: act.grid("ua_notice") }]
        : [{ key: "permit", act: act.step("permit") }],
    installed: prog.order ? [{ key: "install", act: act.step("install") }]
      : [{ key: "order", act: act.step("order") }, { key: "install", act: act.step("install") }],
    connected: nextConn
      ? [{ key: nextConn === conn[0] ? "meter" : "contract", act: act.grid(nextConn) }, { key: "connect", act: act.step("grid") }]
      : [{ key: "connect", act: act.step("grid") }],
    live: [{ key: "commission", act: act.step("commission") }],
    financed: packable ? [{ key: "package", act: { type: "portfolio", projectId: id } }] : [],
  };
  // Signing is what every later step implies, so a missing "sent", "opened" or
  // "signed" behind a recorded deposit is fixed by marking the quote won.
  const gap = {
    sent: [won], opened: [won], signed: [won, ...tel],
    deposit: [deposit, ...(p.invoice_no ? [] : [invoice])],
    apply: market === "MD" ? [{ key: "approval", vars: opv, act: act.grid("approval") }] : fix.apply,
    installed: [{ key: "install", act: act.step("install") }],
    connected: [{ key: "connect", act: act.step("grid") }],
  };
  // An undo is offered only when, without that tick, the stage really reopens.
  const without = (change) => {
    const prog2 = { ...prog };
    for (const k of change.prog || []) delete prog2[k];
    if (change.grid) {
      const st2 = { ...gst };
      for (const k of change.grid) delete st2[k];
      prog2.gridFile = { ...(prog.gridFile || {}), stages: st2 };
    }
    return { ...p, install_progress: prog2 };
  };
  const reopens = (s, change) => !evidence(without(change), {}, null, false, 0)[s].done;
  const undoStep = (s, step) => (prog[step] && reopens(s, { prog: [step] }) ? act.unstep(step) : null);
  const undoGrid = (s, stage) => (gst[stage] && reopens(s, { grid: [stage] }) ? act.ungrid(stage) : null);
  const undo = {
    deposit: undoStep("deposit", "deposit"),
    apply: market === "MD" ? undoGrid("apply", "approval") || undoStep("apply", "permit")
      : market === "UA" ? undoGrid("apply", "ua_notice") || undoStep("apply", "permit")
        : undoStep("apply", "permit"),
    installed: undoStep("installed", "install"),
    connected: undoStep("connected", "grid") || undoGrid("connected", conn[conn.length - 1]),
    live: undoStep("live", "commission"),
  };
  return { fix, gap, undo };
}

/**
 * One quote on the line.
 * @param {object} a
 * @param {object} a.project      a `projects` row
 * @param {object} [a.stats]      its proposal: { code, opens, lastOpen, sentAt, acceptedAt } (lib/proposalStats.js)
 * @param {object} [a.lead]       the lead it was made from (leads.project_id = project.id), if any
 * @param {boolean} [a.hasReadings]  at least one production reading exists for it
 * @param {boolean} [a.inPortfolio]  it is in at least one portfolio
 * @param {number} [a.recentOpens]   proposal opens in the last 2 days (proposal_events, kind "open")
 * @param {number} a.now          epoch ms
 * @param {string} [a.todayKey]   "YYYY-MM-DD" in the app timezone (for the grid file's waits)
 */
export function projectWorkflow({ project: p, stats = null, lead = null, hasReadings = false, inPortfolio = false, recentOpens = 0, now, todayKey }) {
  const st = stats || {};
  const today = todayKey || new Date(now).toISOString().slice(0, 10);
  const order = stageOrder(p.market);
  const ev = evidence(p, st, lead, inPortfolio, now);
  const id = p.id;
  const base = `/projects/${id}`;
  const rail = `${base}#workflow`;
  const market = p.market;
  const grid = gridFor(market);
  const prog = p.install_progress || {};
  const gfile = prog.gridFile || {};
  const op = operatorFor(p);
  const phone = (lead && lead.phone) || "";
  const won = p.status === "won";
  const lost = p.status === "lost";
  const packable = won && PORTFOLIO_MARKETS.includes(market) && !inPortfolio;

  // The last required step is "live"; "financed" only counts once the job is
  // built, so a signed job that a lender is already looking at still shows
  // where its build stands.
  const required = order.filter((s) => !OPTIONAL.has(s));
  let furthest = -1;
  order.forEach((s, i) => {
    if (s === "financed") return;
    if (ev[s].done) furthest = i;
  });
  if (ev.live.done && ev.financed.done) furthest = order.indexOf("financed");
  const stage = furthest >= 0 ? order[furthest] : "quote";

  // The target: the first required step not done. A gap (a later step ticked,
  // an earlier one never recorded) is the target before anything further on.
  const targetIdx = order.findIndex((s) => !OPTIONAL.has(s) && !ev[s].done);
  let target = targetIdx >= 0 ? order[targetIdx] : null;
  const gap = targetIdx >= 0 && targetIdx < furthest;

  const stages = order.map((s, i) => {
    const e = ev[s];
    let state;
    if (e.done) state = "done";
    else if (s === target) state = gap ? "gap" : "current";
    else if (OPTIONAL.has(s) && i < furthest) state = "skipped";
    else if (!OPTIONAL.has(s) && i < furthest) state = "gap";
    else state = "todo";
    return { id: s, state, at: e.at || null, optional: OPTIONAL.has(s) };
  });

  const doneN = required.filter((s) => ev[s].done).length;
  const monitored = !!hasReadings;
  const gridPapers = ev.connected.done;
  const out = {
    kind: "project", id, market, status: p.status, lost, order, stages, stage,
    phase: PHASE[stage], target, gap,
    done: doneN, total: required.length,
    next: null, waitingOn: null, blockers: [],
    since: null, days: null, idle: null, limit: null, stuck: false, rule: null,
    money: null, monitored, gridPapers,
    financingReady: won && PORTFOLIO_MARKETS.includes(market) && gridPapers,
    packable, inPortfolio: !!inPortfolio,
    op: op ? op.short : null,
  };

  if (lost) {
    out.target = null;
    out.stages = stages.map((s) => (s.state === "current" || s.state === "gap" ? { ...s, state: "todo" } : s));
    return out;
  }

  // Days in the stage: since the most recent dated step before the target. A
  // quote marked won by hand has no signing date of its own (updated_at moves
  // with every edit), so that stand-in only counts while signing is the last
  // thing that happened; once a later step is dated, the later step decides.
  const tIdx = target ? order.indexOf(target) : order.length;
  const dated = order.slice(0, tIdx).filter((s) => ev[s].done && ev[s].at);
  const last = dated[dated.length - 1];
  const sinceIso = (last && ev[last].approx ? ev[last].at : latest(...dated.filter((s) => !ev[s].approx).map((s) => ev[s].at)))
    || p.created_at || null;
  const days = (v) => age(v, now, today);
  out.since = sinceIso;
  out.days = days(sinceIso);
  out.idle = out.days;

  const set = (o) => Object.assign(out, o);
  const act = {
    link: (href) => ({ type: "link", href }),
    step: (step) => ({ type: "step", projectId: id, step }),
    grid: (stage) => ({ type: "grid", projectId: id, stage, operator: op ? op.id : null }),
    unstep: (step) => ({ type: "step", projectId: id, step, done: false }),
    ungrid: (stage) => ({ type: "grid", projectId: id, stage, clear: true }),
  };
  const callOr = (fallbackHref) => (phone ? { type: "tel", phone } : act.link(fallbackHref));

  switch (target) {
    case "sent": {
      // A draft: get it out. "Untouched" counts from the last edit, as on the dashboard.
      const idle = daysSince(ms(latest(p.updated_at, p.created_at)), now);
      set({ next: { key: "send", act: { type: "send", projectId: id }, href: base }, waitingOn: "you",
        idle, limit: STUCK_AFTER.draft, rule: "draft", blockers: [{ key: "why_draft" }] });
      break;
    }
    case "opened": {
      const since = ms(st.sentAt || p.updated_at);
      const idle = daysSince(since, now);
      set({ next: { key: "resend", act: { type: "copy_link", projectId: id }, href: base, alt: phone ? { type: "tel", phone } : null },
        waitingOn: "client", idle, limit: STUCK_AFTER.unopened, rule: "unopened", blockers: [{ key: "why_unopened" }] });
      break;
    }
    case "signed": {
      const lastOpen = ms(st.lastOpen);
      const idle = daysSince(Number.isFinite(lastOpen) ? lastOpen : ms(st.sentAt || p.updated_at), now);
      const planned = p.next_follow_up && p.next_follow_up > today;
      const dueFollowUp = p.next_follow_up && p.next_follow_up <= today;
      let next;
      if (recentOpens >= 2) next = { key: "call_hot", vars: { n: recentOpens }, act: callOr(base), href: base };
      else if (dueFollowUp) next = { key: "followup", vars: { date: p.next_follow_up }, act: callOr(base), href: base };
      else next = { key: "call", act: callOr(base), href: base };
      set({ next, waitingOn: "client", idle, limit: planned ? null : STUCK_AFTER.undecided, rule: planned ? "planned" : "undecided",
        blockers: [recentOpens >= 2
          ? { key: "why_hot", vars: { n: recentOpens } }
          : { key: "why_opened", vars: { n: st.opens || 0, at: st.lastOpen || null } }] });
      break;
    }
    case "deposit": {
      if (!p.invoice_no) {
        set({ next: { key: "invoice", act: { type: "invoice", projectId: id }, href: rail, alt: act.step("deposit") },
          waitingOn: "you", limit: STUCK_AFTER.deposit, rule: "deposit",
          blockers: [{ key: "why_signed", vars: { at: ev.signed.at } }] });
      } else {
        set({ next: { key: "deposit_paid", act: act.step("deposit"), href: rail }, waitingOn: "client",
          limit: STUCK_AFTER.deposit, rule: "deposit", blockers: [{ key: "why_invoiced", vars: { no: p.invoice_no } }] });
      }
      break;
    }
    case "apply": {
      if (market === "MD") {
        const g = gridFileStatus(gfile, today, grid.stages);
        const applied = !!(gfile.stages && gfile.stages.applied);
        if (applied) {
          // handed in: the operator owes the approval; call once its wait has run out
          const chase = g.next === "approval" && g.chase;
          set({ next: { key: "approval", vars: { op: out.op }, act: act.grid("approval"), href: rail, chase: !!chase },
            waitingOn: "operator", days: g.next === "approval" ? g.waitingDays : out.days,
            idle: g.next === "approval" ? g.waitingDays : out.days,
            limit: grid.stages.find((s) => s.id === "approval").chaseAfter, rule: "operator",
            blockers: [{ key: "why_await_op", vars: { op: out.op, stage: "approval", days: g.waitingDays ?? out.days } },
              ...(chase ? [{ key: "why_chase", vars: { op: out.op } }] : [])] });
        } else {
          set({ next: { key: "apply_md", vars: { op: out.op }, act: act.grid("applied"), href: rail }, waitingOn: "you",
            limit: STUCK_AFTER.apply, rule: "apply", blockers: [{ key: "why_apply_md", vars: { op: out.op } }] });
        }
      } else if (market === "UA") {
        set({ next: { key: "notice_ua", act: act.grid("ua_notice"), href: rail }, waitingOn: "you",
          limit: STUCK_AFTER.apply, rule: "apply", blockers: [{ key: "why_notice_ua" }] });
      } else {
        set({ next: { key: "permit", act: act.step("permit"), href: rail }, waitingOn: "you",
          limit: STUCK_AFTER.apply, rule: "apply", blockers: [{ key: "why_permit" }] });
      }
      break;
    }
    case "installed": {
      if (!prog.order) {
        set({ next: { key: "order", act: act.step("order"), href: rail }, waitingOn: "you",
          limit: STUCK_AFTER.build, rule: "build", blockers: [{ key: "why_order" }] });
      } else {
        // ordering the equipment is movement: the idle clock restarts from it
        set({ next: { key: "install", act: act.step("install"), href: rail }, waitingOn: "you",
          idle: days(latest(sinceIso, prog.order)),
          limit: STUCK_AFTER.build, rule: "build", blockers: [{ key: "why_install" }] });
      }
      break;
    }
    case "connected": {
      // The operator fits the meter, then the supplier signs the contract. When
      // the grid file tracks them, the wait is counted from the last thing
      // that happened (a grid stage, or the install itself) and the call comes
      // at the file's own chaseAfter.
      const conn = connectionStages(market);
      const gst = gfile.stages || {};
      const tracked = !!grid && Object.keys(gst).length > 0;
      const nextConn = conn.find((k) => !gst[k]);
      if (tracked && nextConn) {
        const stDef = grid.stages.find((s) => s.id === nextConn);
        const prior = grid.stages.slice(0, grid.stages.indexOf(stDef)).map((s) => gst[s.id]).filter(Boolean);
        const from = latest(...prior, ev.installed.at);
        const waited = days(from);
        const chase = stDef.chaseAfter != null && waited != null && waited >= stDef.chaseAfter;
        set({ next: { key: nextConn === conn[0] ? "meter" : "contract", vars: { op: out.op }, act: act.grid(nextConn), href: rail, chase: !!chase },
          waitingOn: "operator", since: from, days: waited, idle: waited,
          limit: stDef.chaseAfter, rule: "operator",
          blockers: [{ key: "why_await_op", vars: { op: out.op, stage: nextConn, days: waited } },
            ...(chase ? [{ key: "why_chase", vars: { op: out.op } }] : [])] });
      } else {
        set({ next: { key: "connect", act: act.step("grid"), href: rail }, waitingOn: "operator",
          limit: STUCK_AFTER.connect, rule: "connect", blockers: [{ key: "why_connect", vars: { op: out.op } }] });
      }
      break;
    }
    case "live": {
      set({ next: { key: "commission", act: act.step("commission"), href: rail }, waitingOn: "you",
        limit: STUCK_AFTER.commission, rule: "commission", blockers: [{ key: "why_commission" }] });
      break;
    }
    case null:
    default: {
      // Every required step is done. Two things can still be worth doing:
      // watching it produce, and packaging it for a lender.
      if (!monitored) {
        const since = ev.live.at;
        set({ next: { key: "monitor", act: act.link("/studio/monitoring"), href: "/studio/monitoring" }, waitingOn: "you",
          since, days: days(since), idle: days(since),
          limit: STUCK_AFTER.monitor, rule: "monitor", blockers: [{ key: "why_monitor", vars: { at: since } }] });
      } else if (packable) {
        out.target = "financed";
        out.stages = out.stages.map((s) => (s.id === "financed" ? { ...s, state: "current" } : s));
        set({ next: { key: "package", act: { type: "portfolio", projectId: id }, href: `${base}#portfolio` }, waitingOn: null,
          since: ev.live.at, days: days(ev.live.at), idle: null, limit: null, rule: null,
          blockers: [{ key: out.financingReady ? "why_package_ready" : "why_package" }] });
      } else {
        set({ next: null, waitingOn: null, since: ev.live.at, days: days(ev.live.at), idle: null, limit: null, rule: null,
          blockers: [] });
      }
    }
  }

  // Every stage carries the one-tap actions that record it (fix: the first is
  // the one to press) and, once done, the tick this screen may take back
  // (undo). The rail on a quote shows them for whichever stage is tapped.
  const fx = stageFixes({ p, id, market, prog, gfile, grid, op, phone, packable, act });
  out.stages = out.stages.map((s) => ({
    ...s,
    fix: s.state === "done" ? [] : (s.state === "gap" ? (fx.gap[s.id] || fx.fix[s.id] || []) : (fx.fix[s.id] || [])),
    undo: s.state === "done" ? fx.undo[s.id] || null : null,
  }));

  if (gap && target) {
    // A step later on the line is recorded, so this one happened too; it was
    // only never written down. The fix is to record it, not to chase anyone,
    // and a missing record is not a wait, so it is never "stuck".
    const f = fx.gap[target] || fx.fix[target] || [];
    if (f.length) {
      set({ next: { key: f[0].key, vars: f[0].vars || null, act: f[0].act, href: rail,
        alt: f[1] ? f[1].act : null, altKey: f[1] ? f[1].key : null },
        waitingOn: "you", limit: null, rule: null });
    }
    out.blockers.unshift({ key: "why_gap", vars: { stage: target } });
  }
  out.stuck = out.limit != null && out.idle != null && out.idle >= out.limit;
  // Where money is waiting, read from the records alone (not from the stuck
  // rule): signed with no deposit and no invoice; up on the roof but not
  // connected; finished but nobody is watching what it produces.
  if (won) {
    if (!prog.deposit && !p.invoice_no) out.money = "unbilled";
    else if (ev.installed.done && !ev.connected.done) out.money = "unconnected";
    else if (ev.live.done && !monitored) out.money = "unmonitored";
  }
  return out;
}

/**
 * A lead with no quote yet. Converted and archived leads are not on the line
 * (the quote carries a converted lead from here on).
 * @param {object} a
 * @param {object} a.lead   a `leads` row
 * @param {number} a.now
 */
export function leadWorkflow({ lead: l, now }) {
  const status = l.status || "new";
  if (status === "converted" || status === "archived" || l.project_id) return null;
  const visit = ms(l.visit_at);
  const hasVisit = Number.isFinite(visit);
  const visited = hasVisit && visit <= now;
  const booked = hasVisit && visit > now;
  const href = l.name ? `/leads?q=${encodeURIComponent(l.name)}` : "/leads";
  const stage = hasVisit ? "visit" : "lead";
  const out = {
    kind: "lead", id: l.id, market: null, status, lost: false, order: ["lead", "visit", "quote"],
    stages: [
      { id: "lead", state: "done", at: l.created_at || null, optional: false },
      { id: "visit", state: visited ? "done" : booked ? "current" : "todo", at: hasVisit ? l.visit_at : null, optional: true },
      { id: "quote", state: booked ? "todo" : "current", at: null, optional: false },
    ],
    stage, phase: "sell", target: booked ? "visit" : "quote", gap: false,
    done: 1, total: 2, next: null, waitingOn: "you", blockers: [],
    since: null, days: null, idle: null, limit: null, stuck: false, rule: null,
    money: null, monitored: false, gridPapers: false, financingReady: false, packable: false, inPortfolio: false, op: null,
    hot: !!l.hot,
  };
  const quote = { type: "lead_quote", id: l.id };
  const call = l.phone ? { type: "tel", phone: l.phone } : null;
  if (booked) {
    Object.assign(out, { since: l.created_at, days: daysSince(ms(l.created_at), now), idle: null,
      next: { key: "visit", vars: { at: l.visit_at }, act: { type: "link", href }, href, alt: call },
      blockers: [{ key: "why_visit", vars: { at: l.visit_at } }] });
  } else if (visited) {
    const d = daysSince(visit, now);
    Object.assign(out, { since: l.visit_at, days: d, idle: d, limit: STUCK_AFTER.visit_done, rule: "visit_done",
      next: { key: "quote", act: quote, href, alt: call },
      blockers: [{ key: "why_visit_done", vars: { at: l.visit_at } }] });
  } else if (status === "new") {
    const d = daysSince(ms(l.created_at), now);
    Object.assign(out, { since: l.created_at, days: d, idle: d, limit: STUCK_AFTER.lead_new, rule: "lead_new",
      next: { key: "call_lead", act: call || quote, href, alt: call ? quote : null },
      blockers: [{ key: "why_lead_new" }] });
  } else {
    const d = daysSince(ms(l.created_at), now);
    Object.assign(out, { since: l.created_at, days: d, idle: d, limit: STUCK_AFTER.lead_open, rule: "lead_open",
      next: { key: "quote", act: quote, href, alt: call },
      blockers: [{ key: "why_lead_open" }] });
  }
  out.stuck = out.limit != null && out.idle != null && out.idle >= out.limit;
  return out;
}

/** Project ids that sit in at least one portfolio, and the portfolios by id. */
export function portfolioIndex(portfolios = []) {
  const ids = new Set();
  const byProject = new Map();
  for (const pf of portfolios || []) {
    for (const pid of Array.isArray(pf.project_ids) ? pf.project_ids : []) {
      ids.add(pid);
      if (!byProject.has(pid)) byProject.set(pid, []);
      byProject.get(pid).push({ id: pf.id, name: pf.name || "", market: pf.market || null });
    }
  }
  return { ids, byProject };
}

/**
 * Every quote and open lead on the line in one pass, the way the dashboard and
 * the projects list both need it.
 * @returns {Map<string, object>} project or lead id -> workflow
 */
export function workflowsFor({ projects = [], stats = new Map(), leads = [], readingsBy = new Set(), portfolios = [], recentOpens = new Map(), now, todayKey }) {
  const { ids: inPf } = portfolioIndex(portfolios);
  const leadByProject = new Map();
  for (const l of leads) if (l.project_id && !leadByProject.has(l.project_id)) leadByProject.set(l.project_id, l);
  const has = (id) => (readingsBy instanceof Set ? readingsBy.has(id) : readingsBy instanceof Map ? readingsBy.has(id) : false);
  const out = new Map();
  for (const p of projects) {
    out.set(p.id, projectWorkflow({
      project: p, stats: stats.get(p.id) || null, lead: leadByProject.get(p.id) || null,
      hasReadings: has(p.id), inPortfolio: inPf.has(p.id), recentOpens: recentOpens.get(p.id) || 0, now, todayKey,
    }));
  }
  for (const l of leads) {
    const w = leadWorkflow({ lead: l, now });
    if (w) out.set("lead:" + l.id, w);
  }
  return out;
}

/**
 * The pipeline: per stage, how many jobs sit there, their contract value and
 * how many are stuck; where money is waiting; and what could go to a lender.
 * Values are contract value (full system price, pre-grant), the same figure
 * the dashboard's Pipeline KPI and the projects list sum.
 * @param {Iterable<object>} items  workflows (projects and leads)
 * @param {Map<string, number>} value  project id -> contract value in EUR
 */
export function pipelineSummary(items, value = new Map()) {
  const stages = Object.fromEntries(STAGES.map((s) => [s, { n: 0, value: 0, stuck: 0 }]));
  const money = {
    unbilled: { n: 0, value: 0, ids: [] },
    unconnected: { n: 0, value: 0, ids: [] },
    unmonitored: { n: 0, value: 0, ids: [] },
  };
  const lender = { packable: { n: 0, value: 0 }, ready: { n: 0, value: 0 }, inPortfolio: 0 };
  const stuck = { n: 0, value: 0 };
  let active = 0;
  for (const w of items) {
    if (!w || w.lost) continue;
    const v = w.kind === "project" ? Number(value.get(w.id)) || 0 : 0;
    const s = stages[w.stage];
    if (!s) continue;
    active++;
    s.n++; s.value += v;
    if (w.stuck) { s.stuck++; stuck.n++; stuck.value += v; }
    if (w.money && money[w.money]) { money[w.money].n++; money[w.money].value += v; money[w.money].ids.push(w.id); }
    if (w.kind === "project" && w.status === "won") {
      if (w.inPortfolio) lender.inPortfolio++;
      if (w.packable) {
        lender.packable.n++; lender.packable.value += v;
        if (w.financingReady) { lender.ready.n++; lender.ready.value += v; }
      }
    }
  }
  return { stages, money, lender, stuck, active };
}

function median(xs) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * The installer's own last N days against the N days before: no outside
 * benchmark, only their own quotes.
 *   sent        offers whose proposal link was created in the window
 *   signed      of those, how many are won now (and how many are still open)
 *   rate        signed / sent, the proposal-to-signature rate of that cohort
 *   quoteDays   median days from first contact (the lead, else the quote's
 *               creation) to the offer going out
 *   online      offers accepted on the proposal page in the window, and their value
 * The newer window has had less time to close, which is why `open` is returned
 * alongside the rate: the screen says how many are still undecided.
 */
export function periodCompare({ projects = [], stats = new Map(), leads = [], value = new Map(), now, days = 30 }) {
  const span = days * DAY;
  const leadByProject = new Map();
  for (const l of leads) if (l.project_id && !leadByProject.has(l.project_id)) leadByProject.set(l.project_id, l);
  const bucket = (from, to) => {
    let sent = 0, signed = 0, open = 0, online = 0, onlineValue = 0;
    const ttq = [];
    for (const p of projects) {
      const st = stats.get(p.id) || {};
      const s = ms(st.sentAt);
      if (Number.isFinite(s) && s >= from && s < to) {
        sent++;
        if (p.status === "won") signed++;
        else if (p.status !== "lost") open++;
        const start = ms(leadByProject.get(p.id)?.created_at || p.created_at);
        if (Number.isFinite(start) && s >= start) ttq.push((s - start) / DAY);
      }
      const a = ms(st.acceptedAt);
      if (Number.isFinite(a) && a >= from && a < to) { online++; onlineValue += Number(value.get(p.id)) || 0; }
    }
    return { sent, signed, open, rate: sent ? signed / sent : null, quoteDays: median(ttq), online, onlineValue };
  };
  return { days, cur: bucket(now - span, now + 1), prev: bucket(now - 2 * span, now - span) };
}

/**
 * A portfolio's quote list with one more id at the end, never twice, never
 * past the table's limit (supabase/add-portfolios.sql allows 500).
 * @returns {{ ids: string[], added: boolean, full: boolean }}
 */
export function appendUnique(ids, id, max = 500) {
  const list = Array.isArray(ids) ? ids.filter((x) => typeof x === "string" && x) : [];
  const uniq = [...new Set(list)];
  if (!id || uniq.includes(id)) return { ids: uniq, added: false, full: false };
  if (uniq.length >= max) return { ids: uniq, added: false, full: true };
  return { ids: [...uniq, id], added: true, full: false };
}
