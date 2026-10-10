import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectWorkflow, leadWorkflow, workflowsFor, pipelineSummary, periodCompare, portfolioIndex,
  stageOrder, STAGES, STUCK_AFTER, PHASE, OPTIONAL,
} from "./workflow.js";

const NOW = Date.parse("2026-10-02T09:00:00Z");
const TODAY = "2026-10-02";
const ago = (d) => new Date(NOW - d * 864e5).toISOString();
const day = (d) => ago(d).slice(0, 10);
const P = (o = {}) => ({
  id: "p1", title: "Casa Rusu, Chișinău", client_name: "Ion", market: "MD", status: "draft",
  created_at: ago(10), updated_at: ago(1), install_progress: {}, ...o,
});
const run = (project, more = {}) => projectWorkflow({ project, now: NOW, todayKey: TODAY, ...more });
const ALL6 = (d) => Object.fromEntries(["deposit", "permit", "order", "install", "grid", "commission"].map((k) => [k, day(d)]));

test("every stage belongs to a phase, and the two optional ones are the visit and the portfolio", () => {
  for (const s of STAGES) assert.ok(PHASE[s], s);
  assert.deepEqual([...OPTIONAL].sort(), ["financed", "visit"]);
});

test("Moldova applies for the grid approval before installing, Ukraine installs first", () => {
  const md = stageOrder("MD"), ua = stageOrder("UA");
  assert.ok(md.indexOf("apply") < md.indexOf("installed"));
  assert.ok(ua.indexOf("apply") > ua.indexOf("installed"));
  assert.equal(md.length, ua.length);
  assert.deepEqual([...md].sort(), [...ua].sort());
});

test("a draft sits at 'quote drafted', the next action is to send it, stuck after three untouched days", () => {
  const w = run(P({ updated_at: ago(1) }));
  assert.equal(w.stage, "quote");
  assert.equal(w.target, "sent");
  assert.equal(w.next.key, "send");
  assert.equal(w.next.act.type, "send");
  assert.equal(w.waitingOn, "you");
  assert.equal(w.stuck, false);
  const old = run(P({ updated_at: ago(STUCK_AFTER.draft) }));
  assert.equal(old.stuck, true);
  assert.equal(old.rule, "draft");
  // days in the stage count from the quote's creation, not its last edit
  assert.equal(old.days, 10);
});

test("exactly one stage is current, and progress counts required steps only", () => {
  const w = run(P({ status: "sent" }), { stats: { opens: 2, sentAt: ago(4), lastOpen: ago(1) } });
  assert.equal(w.stages.filter((s) => s.state === "current").length, 1);
  assert.equal(w.stages.find((s) => s.state === "current").id, "signed");
  assert.equal(w.total, 10);
  // lead, quote, sent, opened (the visit is optional and was skipped)
  assert.equal(w.done, 4);
  assert.equal(w.stages.find((s) => s.id === "visit").state, "skipped");
});

test("a sent offer nobody opened waits on the client and is stuck after three days", () => {
  const fresh = run(P({ status: "sent" }), { stats: { opens: 0, sentAt: ago(1) } });
  assert.equal(fresh.stage, "sent");
  assert.equal(fresh.next.key, "resend");
  assert.equal(fresh.waitingOn, "client");
  assert.equal(fresh.stuck, false);
  const late = run(P({ status: "sent" }), { stats: { opens: 0, sentAt: ago(4) } });
  assert.equal(late.stuck, true);
  assert.equal(late.rule, "unopened");
});

test("an opened offer: call, and say it plainly when it was opened several times in two days", () => {
  const w = run(P({ status: "sent" }), { stats: { opens: 5, sentAt: ago(6), lastOpen: ago(0.2) }, recentOpens: 4 });
  assert.equal(w.stage, "opened");
  assert.equal(w.next.key, "call_hot");
  assert.deepEqual(w.next.vars, { n: 4 });
  assert.equal(w.blockers[0].key, "why_hot");
  // with the lead's phone the action is a call, not a link
  const withPhone = run(P({ status: "sent" }), { stats: { opens: 1, sentAt: ago(6), lastOpen: ago(1) }, lead: { phone: "+373 68 000 000", created_at: ago(20) } });
  assert.deepEqual(withPhone.next.act, { type: "tel", phone: "+373 68 000 000" });
});

test("an opened offer that went quiet is stuck, unless the installer planned a follow-up", () => {
  const quiet = run(P({ status: "sent" }), { stats: { opens: 2, sentAt: ago(20), lastOpen: ago(8) } });
  assert.equal(quiet.stuck, true);
  assert.equal(quiet.rule, "undecided");
  const planned = run(P({ status: "sent", next_follow_up: "2026-10-05" }), { stats: { opens: 2, sentAt: ago(20), lastOpen: ago(8) } });
  assert.equal(planned.stuck, false);
  assert.equal(planned.rule, "planned");
  const due = run(P({ status: "sent", next_follow_up: TODAY }), { stats: { opens: 2, sentAt: ago(20), lastOpen: ago(8) } });
  assert.equal(due.next.key, "followup");
});

test("signed with no deposit invoice: the next action is the invoice, and the money counts as waiting", () => {
  const w = run(P({ status: "won" }), { stats: { opens: 3, sentAt: ago(12), acceptedAt: ago(2) } });
  assert.equal(w.stage, "signed");
  assert.equal(w.target, "deposit");
  assert.equal(w.next.key, "invoice");
  assert.equal(w.next.act.type, "invoice");
  assert.deepEqual(w.next.alt, { type: "step", projectId: "p1", step: "deposit" });
  assert.equal(w.money, "unbilled");
  assert.equal(w.days, 2);
  assert.equal(w.stuck, false);
  assert.equal(run(P({ status: "won" }), { stats: { acceptedAt: ago(9) } }).stuck, true);
});

test("once the deposit invoice is out, the ball is with the client and nothing is unbilled", () => {
  const w = run(P({ status: "won", invoice_no: "STC-2026-0048" }), { stats: { acceptedAt: ago(3) } });
  assert.equal(w.next.key, "deposit_paid");
  assert.deepEqual(w.next.act, { type: "step", projectId: "p1", step: "deposit" });
  assert.equal(w.waitingOn, "client");
  assert.equal(w.money, null);
});

test("Moldova after the deposit: apply to the operator the address points to", () => {
  const w = run(P({ status: "won", title: "Casa Bejan, Ungheni", install_progress: { deposit: day(2) } }), { stats: { acceptedAt: ago(5) } });
  assert.equal(w.stage, "deposit");
  assert.equal(w.target, "apply");
  assert.equal(w.next.key, "apply_md");
  assert.equal(w.next.vars.op, "RED Nord");
  assert.deepEqual(w.next.act, { type: "grid", projectId: "p1", stage: "applied", operator: "rednord" });
  assert.equal(w.days, 2);
  const chis = run(P({ status: "won", install_progress: { deposit: day(2) } }));
  assert.equal(chis.op, "Premier Energy");
});

test("Moldova: an application waiting on the operator becomes a call at the grid file's own rule", () => {
  const fresh = run(P({ status: "won", install_progress: { deposit: day(9), gridFile: { operator: "premier", stages: { applied: day(3) } } } }));
  assert.equal(fresh.next.key, "approval");
  assert.equal(fresh.waitingOn, "operator");
  assert.equal(fresh.stuck, false);
  const late = run(P({ status: "won", install_progress: { deposit: day(20), gridFile: { operator: "premier", stages: { applied: day(12) } } } }));
  // the button records what it says (the approval came); the call is the advice
  assert.equal(late.next.key, "approval");
  assert.equal(late.next.chase, true);
  assert.deepEqual(late.next.act, { type: "grid", projectId: "p1", stage: "approval", operator: "premier" });
  assert.equal(late.next.vars.op, "Premier Energy");
  assert.ok(late.blockers.some((b) => b.key === "why_chase" && b.vars.op === "Premier Energy"));
  assert.equal(late.stuck, true);
  assert.equal(late.limit, 10);
  assert.equal(late.idle, 12);
});

test("the grid approval or the checklist's permit tick both count as the Moldovan apply stage", () => {
  const viaFile = run(P({ status: "won", install_progress: { deposit: day(20), gridFile: { stages: { applied: day(15), approval: day(5) } } } }));
  assert.equal(viaFile.stage, "apply");
  assert.equal(viaFile.next.key, "order");
  assert.equal(viaFile.days, 5);
  const viaTick = run(P({ status: "won", install_progress: { deposit: day(20), permit: day(4), order: day(2) } }));
  assert.equal(viaTick.next.key, "install");
  assert.equal(viaTick.waitingOn, "you");
});

test("Moldova: a tracked application still waiting on the operator outweighs the checklist's permit tick", () => {
  const w = run(P({ status: "won", created_at: ago(80), install_progress: {
    deposit: day(55), permit: day(49), order: day(43),
    gridFile: { operator: "premier", stages: { applied: day(14) } },
  } }));
  assert.equal(w.stage, "deposit");
  assert.equal(w.target, "apply");
  assert.equal(w.next.key, "approval");
  assert.equal(w.next.chase, true);
  assert.equal(w.waitingOn, "operator");
  assert.equal(w.idle, 14);
  // once the approval is in, the build goes on, and the order restarts the idle clock
  const later = run(P({ status: "won", created_at: ago(80), install_progress: {
    deposit: day(55), permit: day(49), order: day(10),
    gridFile: { operator: "premier", stages: { applied: day(40), approval: day(30) } },
  } }));
  assert.equal(later.next.key, "install");
  assert.equal(later.days, 30);
  assert.equal(later.idle, 10);
  assert.equal(later.stuck, false);
});

test("Ukraine: after the deposit the job is built first, then the notice goes to the supplier", () => {
  const dep = run(P({ market: "UA", title: "Будинок, Київ", status: "won", install_progress: { deposit: day(3) } }));
  assert.equal(dep.target, "installed");
  assert.equal(dep.next.key, "order");
  const up = run(P({ market: "UA", title: "Будинок, Київ", status: "won", install_progress: { deposit: day(30), order: day(20), install: day(8) } }));
  assert.equal(up.stage, "installed");
  assert.equal(up.target, "apply");
  assert.equal(up.next.key, "notice_ua");
  assert.deepEqual(up.next.act, { type: "grid", projectId: "p1", stage: "ua_notice", operator: "dtek_kyiv" });
  assert.equal(up.stuck, true);
  assert.equal(up.money, "unconnected");
});

test("Ukraine: the meter and the green-tariff contract are chased from the notice", () => {
  const w = run(P({ market: "UA", title: "Будинок, Львів", status: "won", install_progress: {
    deposit: day(60), order: day(50), install: day(40),
    gridFile: { operator: "lviv", stages: { ua_installed: day(40), ua_notice: day(20) } },
  } }));
  assert.equal(w.target, "connected");
  assert.equal(w.next.key, "meter");
  assert.equal(w.next.chase, true);
  assert.equal(w.next.act.stage, "ua_meter");
  assert.equal(w.op, "Львівобленерго");
  assert.equal(w.idle, 20);
  assert.equal(w.limit, 14);
  assert.equal(w.stuck, true);
});

test("Moldova: meter in, waiting for the prosumer contract", () => {
  const w = run(P({ status: "won", install_progress: {
    deposit: day(60), permit: day(50), order: day(45), install: day(30),
    gridFile: { operator: "premier", stages: { applied: day(55), approval: day(50), installed: day(30), meter: day(5) } },
  } }));
  assert.equal(w.next.key, "contract");
  assert.equal(w.idle, 5);
  assert.equal(w.stuck, false);
  assert.equal(w.money, "unconnected");
});

test("installed with no grid file tracked: tick the connection when it happens", () => {
  const w = run(P({ status: "won", install_progress: { deposit: day(40), permit: day(35), order: day(30), install: day(10) }, invoice_no: "X" }));
  assert.equal(w.target, "connected");
  assert.equal(w.next.key, "connect");
  assert.deepEqual(w.next.act, { type: "step", projectId: "p1", step: "grid" });
  assert.equal(w.waitingOn, "operator");
  assert.equal(w.money, "unconnected");
});

test("meter and contract in the grid file count as connected, and it is financing-ready", () => {
  const w = run(P({ status: "won", install_progress: {
    deposit: day(60), permit: day(50), order: day(45), install: day(30),
    gridFile: { stages: { applied: day(55), approval: day(50), meter: day(10), contract: day(4) } },
  } }));
  assert.equal(w.stage, "connected");
  assert.equal(w.next.key, "commission");
  assert.equal(w.gridPapers, true);
  assert.equal(w.financingReady, true);
  assert.equal(w.days, 4);
});

test("commissioned with no readings: connect monitoring, stuck after a month", () => {
  const w = run(P({ status: "won", install_progress: ALL6(40) }));
  assert.equal(w.stage, "live");
  assert.equal(w.next.key, "monitor");
  assert.equal(w.next.href, "/studio/monitoring");
  assert.equal(w.money, "unmonitored");
  assert.equal(w.stuck, true);
  assert.equal(run(P({ status: "won", install_progress: ALL6(10) })).stuck, false);
});

test("producing and monitored: package it for a lender, or nothing left when it already is", () => {
  const w = run(P({ status: "won", install_progress: ALL6(90) }), { hasReadings: true });
  assert.equal(w.next.key, "package");
  assert.equal(w.target, "financed");
  assert.equal(w.stages.find((s) => s.id === "financed").state, "current");
  assert.equal(w.blockers[0].key, "why_package_ready");
  assert.equal(w.stuck, false);
  assert.equal(w.money, null);
  const pf = run(P({ status: "won", install_progress: ALL6(90) }), { hasReadings: true, inPortfolio: true });
  assert.equal(pf.stage, "financed");
  assert.equal(pf.next, null);
  assert.equal(pf.done, pf.total);
});

test("a signed job already in a portfolio still shows where its build stands", () => {
  const w = run(P({ status: "won", install_progress: { deposit: day(5) } }), { inPortfolio: true });
  assert.equal(w.stage, "deposit");
  assert.equal(w.inPortfolio, true);
  assert.equal(w.packable, false);
});

test("a later step ticked with an earlier one missing: the gap comes first", () => {
  const w = run(P({ status: "won", install_progress: { install: day(3) } }));
  assert.equal(w.stage, "installed");
  assert.equal(w.target, "deposit");
  assert.equal(w.gap, true);
  assert.equal(w.blockers[0].key, "why_gap");
  assert.equal(w.stages.find((s) => s.id === "deposit").state, "gap");
  assert.equal(w.stages.find((s) => s.id === "apply").state, "gap");
  assert.equal(w.money, "unbilled");
});

test("Romania (no grid file, no portfolio model): the checklist's permit, and nothing to package", () => {
  const w = run(P({ market: "RO", status: "won", install_progress: { deposit: day(3) } }));
  assert.equal(w.next.key, "permit");
  const live = run(P({ market: "RO", status: "won", install_progress: ALL6(90) }), { hasReadings: true });
  assert.equal(live.packable, false);
  assert.equal(live.next, null);
});

test("a lost quote has no next action and is never stuck", () => {
  const w = run(P({ status: "lost" }), { stats: { opens: 1, sentAt: ago(60), lastOpen: ago(50) } });
  assert.equal(w.lost, true);
  assert.equal(w.next, null);
  assert.equal(w.stuck, false);
  assert.equal(w.stages.some((s) => s.state === "current"), false);
});

test("a won quote marked by hand (no proposal) still reads as signed", () => {
  const w = run(P({ status: "won", updated_at: ago(1) }));
  assert.equal(w.stage, "signed");
  assert.equal(w.stages.find((s) => s.id === "signed").state, "done");
});

// ---------------------------------------------------------------- leads
const L = (o = {}) => ({ id: "l1", name: "Ion Bivol", phone: "+373 68 512 003", status: "new", created_at: ago(1), ...o });

test("a new lead: call it, stuck after two days", () => {
  const w = leadWorkflow({ lead: L(), now: NOW });
  assert.equal(w.stage, "lead");
  assert.equal(w.next.key, "call_lead");
  assert.equal(w.next.act.type, "tel");
  assert.equal(w.next.alt.type, "lead_quote");
  assert.equal(w.next.href, "/leads?q=Ion%20Bivol");
  assert.equal(w.stuck, false);
  assert.equal(leadWorkflow({ lead: L({ created_at: ago(3) }), now: NOW }).stuck, true);
  // no phone: making the quote is the action
  assert.equal(leadWorkflow({ lead: L({ phone: "" }), now: NOW }).next.act.type, "lead_quote");
});

test("a booked visit is the next action and never stuck; after it, the quote is due within three days", () => {
  const booked = leadWorkflow({ lead: L({ status: "contacted", visit_at: new Date(NOW + 5 * 36e5).toISOString() }), now: NOW });
  assert.equal(booked.stage, "visit");
  assert.equal(booked.target, "visit");
  assert.equal(booked.next.key, "visit");
  assert.equal(booked.stuck, false);
  const done = leadWorkflow({ lead: L({ status: "contacted", visit_at: ago(4) }), now: NOW });
  assert.equal(done.next.key, "quote");
  assert.equal(done.stuck, true);
  assert.equal(done.rule, "visit_done");
});

test("converted and archived leads are off the line", () => {
  assert.equal(leadWorkflow({ lead: L({ status: "converted" }), now: NOW }), null);
  assert.equal(leadWorkflow({ lead: L({ status: "archived" }), now: NOW }), null);
  assert.equal(leadWorkflow({ lead: L({ project_id: "p1" }), now: NOW }), null);
});

// ---------------------------------------------------------------- the whole book
test("workflowsFor links each quote to its lead, readings and portfolio", () => {
  const projects = [
    P({ id: "a", status: "sent" }),
    P({ id: "b", status: "won", install_progress: ALL6(90) }),
  ];
  const leads = [
    { id: "l1", project_id: "a", phone: "+373 1", status: "converted", created_at: ago(30), visit_at: ago(25) },
    L({ id: "l2" }),
  ];
  const map = workflowsFor({
    projects, leads, now: NOW, todayKey: TODAY,
    stats: new Map([["a", { opens: 1, sentAt: ago(5), lastOpen: ago(1) }]]),
    readingsBy: new Set(["b"]),
    portfolios: [{ id: "pf", name: "Nord", project_ids: ["b"] }],
  });
  assert.equal(map.size, 3);
  assert.equal(map.get("a").stages.find((s) => s.id === "visit").state, "done");
  assert.equal(map.get("a").next.act.type, "tel");
  assert.equal(map.get("b").stage, "financed");
  assert.equal(map.get("lead:l2").kind, "lead");
});

test("portfolioIndex maps each quote to the portfolios that hold it", () => {
  const { ids, byProject } = portfolioIndex([{ id: "x", name: "A", project_ids: ["p1", "p2"] }, { id: "y", name: "B", project_ids: ["p2"] }, { id: "z" }]);
  assert.deepEqual([...ids].sort(), ["p1", "p2"]);
  assert.deepEqual(byProject.get("p2").map((p) => p.id), ["x", "y"]);
});

test("the pipeline counts each job once, with its value, what is stuck, where money waits and what a lender could take", () => {
  const projects = [
    P({ id: "d", status: "draft", updated_at: ago(5) }),                                      // stuck draft
    P({ id: "s", status: "won" }),                                                            // signed, unbilled
    P({ id: "i", status: "won", invoice_no: "1", install_progress: { deposit: day(40), permit: day(35), order: day(30), install: day(10) } }), // unconnected
    P({ id: "l", status: "won", install_progress: ALL6(90) }),                                // live, unmonitored
    P({ id: "m", status: "won", install_progress: ALL6(90) }),                                // live, monitored, ready
    P({ id: "x", status: "lost" }),
  ];
  const value = new Map([["d", 100], ["s", 200], ["i", 300], ["l", 400], ["m", 500], ["x", 999]]);
  const map = workflowsFor({ projects, leads: [L()], readingsBy: new Set(["m"]), now: NOW, todayKey: TODAY });
  const sum = pipelineSummary(map.values(), value);
  assert.equal(sum.active, 6);
  assert.deepEqual([sum.stages.quote.n, sum.stages.signed.n, sum.stages.installed.n, sum.stages.live.n, sum.stages.lead.n], [1, 1, 1, 2, 1]);
  assert.equal(sum.stages.live.value, 900);
  assert.equal(sum.stages.quote.stuck, 1);
  assert.deepEqual([sum.money.unbilled.n, sum.money.unbilled.value], [1, 200]);
  assert.deepEqual([sum.money.unconnected.n, sum.money.unconnected.value], [1, 300]);
  assert.deepEqual([sum.money.unmonitored.n, sum.money.unmonitored.value], [1, 400]);
  assert.deepEqual(sum.money.unbilled.ids, ["s"]);
  // every won MD quote outside a portfolio can be packaged; the connected ones are financing-ready
  assert.deepEqual([sum.lender.packable.n, sum.lender.packable.value], [4, 1400]);
  assert.deepEqual([sum.lender.ready.n, sum.lender.ready.value], [2, 900]);
  // the lost quote is in none of it
  assert.equal(Object.values(sum.stages).reduce((s, x) => s + x.value, 0), 1500);
});

test("the last 30 days against the 30 before: offers sent, the signature rate of that cohort, time to quote, online signatures", () => {
  const projects = [
    P({ id: "a", status: "won", created_at: ago(14) }),
    P({ id: "b", status: "sent", created_at: ago(20) }),
    P({ id: "c", status: "lost", created_at: ago(12) }),
    P({ id: "d", status: "won", created_at: ago(50) }),
    P({ id: "e", status: "sent", created_at: ago(45) }),
  ];
  const stats = new Map([
    ["a", { sentAt: ago(10), acceptedAt: ago(3) }],
    ["b", { sentAt: ago(16) }],
    ["c", { sentAt: ago(9) }],
    ["d", { sentAt: ago(40), acceptedAt: ago(35) }],
    ["e", { sentAt: ago(44) }],
  ]);
  // a came from a lead that wrote in 20 days ago: 10 days to quote, not 4
  const leads = [{ id: "l", project_id: "a", created_at: ago(20) }];
  const value = new Map([["a", 1000], ["d", 700]]);
  const { cur, prev, days } = periodCompare({ projects, stats, leads, value, now: NOW });
  assert.equal(days, 30);
  assert.deepEqual([cur.sent, cur.signed, cur.open], [3, 1, 1]);
  assert.equal(Math.round(cur.rate * 100), 33);
  assert.equal(cur.quoteDays, 4);  // median of 10, 4, 3
  assert.deepEqual([cur.online, cur.onlineValue], [1, 1000]);
  assert.deepEqual([prev.sent, prev.signed, prev.open], [2, 1, 1]);
  assert.equal(prev.rate, 0.5);
  assert.equal(prev.quoteDays, 5.5); // median of 10 and 1
  assert.deepEqual([prev.online, prev.onlineValue], [1, 700]);
  const empty = periodCompare({ now: NOW });
  assert.equal(empty.cur.rate, null);
  assert.equal(empty.cur.quoteDays, null);
});

test("appendUnique adds once, keeps order, drops duplicates already there, and respects the limit", async () => {
  const { appendUnique } = await import("./workflow.js");
  assert.deepEqual(appendUnique(["a", "b"], "c"), { ids: ["a", "b", "c"], added: true, full: false });
  assert.deepEqual(appendUnique(["a", "b"], "a"), { ids: ["a", "b"], added: false, full: false });
  assert.deepEqual(appendUnique(["a", "a", "b"], "c").ids, ["a", "b", "c"]);
  assert.deepEqual(appendUnique(null, "x"), { ids: ["x"], added: true, full: false });
  assert.deepEqual(appendUnique(["a", "b"], "c", 2), { ids: ["a", "b"], added: false, full: true });
});

test("every open stage carries the actions that record it, the first one to press", () => {
  const w = run(P({ status: "sent" }), { stats: { code: "abc", opens: 2, lastOpen: ago(1), sentAt: ago(4) }, lead: { phone: "+373 69 000 111" } });
  const at = (id) => w.stages.find((s) => s.id === id);
  assert.equal(at("signed").state, "current");
  assert.deepEqual(at("signed").fix.map((f) => f.key), ["call", "mark_signed"]);
  assert.deepEqual(at("signed").fix[1].act, { type: "won", projectId: "p1" });
  // a future stage can be recorded straight away too
  assert.deepEqual(at("deposit").fix.map((f) => f.key), ["invoice", "deposit_paid"]);
  assert.deepEqual(at("apply").fix.map((f) => f.key), ["apply_md", "approval"]);
  assert.equal(at("apply").fix[0].vars.op, "Premier Energy");
  assert.deepEqual(at("installed").fix.map((f) => f.key), ["order", "install"]);
  assert.deepEqual(at("connected").fix.map((f) => f.key), ["meter", "connect"]);
  // done stages have nothing to fix; a portfolio only takes a signed job
  assert.deepEqual(at("quote").fix, []);
  assert.deepEqual(at("financed").fix, []);
});

test("a gap is fixed by recording it: a deposit behind an unsigned quote means mark it signed", () => {
  const w = run(P({ status: "sent", install_progress: { deposit: day(5) } }), { stats: { code: "abc", opens: 3, lastOpen: ago(9), sentAt: ago(12) } });
  assert.equal(w.target, "signed");
  assert.equal(w.gap, true);
  assert.equal(w.next.key, "mark_signed");
  assert.deepEqual(w.next.act, { type: "won", projectId: "p1" });
  assert.equal(w.waitingOn, "you");
  // a missing record is not a wait
  assert.equal(w.stuck, false);
  assert.equal(w.stages.find((s) => s.id === "signed").fix[0].key, "mark_signed");
});

test("a deposit gap behind a recorded install: mark the deposit, with the invoice as the other way", () => {
  const w = run(P({ status: "won", install_progress: { install: day(3) } }));
  assert.equal(w.target, "deposit");
  assert.equal(w.next.key, "deposit_paid");
  assert.deepEqual(w.next.act, { type: "step", projectId: "p1", step: "deposit" });
  assert.equal(w.next.altKey, "invoice");
  assert.deepEqual(w.stages.find((s) => s.id === "apply").fix.map((f) => f.key), ["approval"]);
});

test("undo is offered only where taking the tick back really reopens the stage", () => {
  const w = run(P({ status: "won", commissioned_at: ago(2), install_progress: {
    ...ALL6(20), gridFile: { operator: "premier", stages: { applied: day(40), approval: day(30), installed: day(20) } },
  } }));
  const at = (id) => w.stages.find((s) => s.id === id);
  assert.deepEqual(at("deposit").undo, { type: "step", projectId: "p1", step: "deposit", done: false });
  // the approval in the grid file holds the stage; the permit tick alone does not
  assert.deepEqual(at("apply").undo, { type: "grid", projectId: "p1", stage: "approval", clear: true });
  // the grid file's own install date still holds "installed"
  assert.equal(at("installed").undo, null);
  assert.deepEqual(at("connected").undo, { type: "step", projectId: "p1", step: "grid", done: false });
  // a commissioning date keeps it live whatever the checklist says
  assert.equal(at("live").undo, null);
  // open stages offer no undo
  assert.equal(at("financed").undo, null);
});

test("a lost quote offers no fixes", () => {
  const w = run(P({ status: "lost" }));
  assert.ok(w.stages.every((s) => !s.fix || s.fix.length === 0));
});
