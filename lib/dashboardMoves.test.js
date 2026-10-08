import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMoves, flowStages, LIVE_WINDOW_MIN } from "./dashboardMoves.js";

const NOW = Date.parse("2026-09-25T09:00:00Z");
const ago = (days) => new Date(NOW - days * 864e5).toISOString();
const agoMin = (m) => new Date(NOW - m * 6e4).toISOString();
const f = {
  tr: (k, v) => (v ? `${k}${JSON.stringify(v)}` : k),
  when: (iso) => `when(${iso.slice(0, 10)})`,
  dur: (n, unit = "day") => `${n} ${unit}`,
  date: (iso) => iso.slice(0, 10),
  month: (d) => d.toISOString().slice(0, 7),
  step: (k) => `step:${k}`,
  channel: (l) => l.channel || "other",
  visit: (iso) => `visit(${iso.slice(11, 16)})`,
  day: (iso) => iso.slice(0, 10),
};
const run = (over) => buildMoves({ now: NOW, todayKey: "2026-09-25", f, ...over });
const P = (o) => ({ id: "p1", title: "Casa Rusu", client_name: "Ion", status: "sent", updated_at: ago(1), install_progress: {}, ...o });

test("a client reading the proposal right now outranks everything, one row per quote", () => {
  const moves = run({
    projects: [P({})],
    stats: new Map([["p1", { opens: 4, lastOpen: agoMin(1), sentAt: ago(5) }]]),
    lastEvent: new Map([["p1", agoMin(1)]]),
  });
  assert.equal(moves.length, 1);
  assert.equal(moves[0].kind, "live");
  assert.equal(moves[0].group, "sales");
});

test("the live window closes after the heartbeat stops", () => {
  const moves = run({
    projects: [P({})],
    stats: new Map([["p1", { opens: 2, lastOpen: agoMin(LIVE_WINDOW_MIN + 3), sentAt: ago(5) }]]),
    lastEvent: new Map([["p1", agoMin(LIVE_WINDOW_MIN + 3)]]),
  });
  assert.equal(moves[0].kind, "hot");
});

test("a battery toggle changes the reason to a storage conversation", () => {
  const [m] = run({ projects: [P({})], stats: new Map([["p1", { opens: 3, lastOpen: ago(1), sentAt: ago(6), battToggles: 2 }]]) });
  assert.equal(m.kind, "hot");
  assert.match(m.reason, /^mv_hot_batt/);
});

test("an unopened proposal is only flagged after three days", () => {
  assert.equal(run({ projects: [P({})], stats: new Map([["p1", { opens: 0, sentAt: ago(2) }]]) }).length, 0);
  const [m] = run({ projects: [P({})], stats: new Map([["p1", { opens: 0, sentAt: ago(4) }]]) });
  assert.equal(m.kind, "unopened");
});

test("a proposal that went quiet after being read is flagged", () => {
  const [m] = run({ projects: [P({})], stats: new Map([["p1", { opens: 2, lastOpen: ago(10), sentAt: ago(20) }]]) });
  assert.equal(m.kind, "quiet");
  assert.match(m.reason, /"dur":"10 day"/);
});

test("a follow-up date the installer set surfaces on the day, not before", () => {
  assert.equal(run({ projects: [P({ status: "draft", next_follow_up: "2026-09-26" })] }).length, 0);
  const [m] = run({ projects: [P({ status: "draft", next_follow_up: "2026-09-25", updated_at: ago(0) })] });
  assert.equal(m.kind, "followup");
});

test("a won job that has not started offers the first step as a one-tap action", () => {
  // the deposit invoice is already out: ticking the deposit is the move
  const [m] = run({ projects: [P({ status: "won", invoice_no: "STC-2026-0048" })] });
  assert.equal(m.kind, "won_start");
  assert.equal(m.group, "jobs");
  assert.deepEqual(m.actions[0], { type: "step", projectId: "p1", step: "deposit", label: 'dx_act_step{"step":"step:deposit"}' });
});

test("a won job with no deposit invoice asks for the invoice first, the deposit tick stays one tap away", () => {
  const [m] = run({ projects: [P({ status: "won" })] });
  assert.equal(m.kind, "won_start");
  assert.equal(m.score, 72);
  assert.match(m.reason, /^wf:mv_won_invoice/);
  // the invoice chooser (30%, 50%, full) opens right on the row
  assert.deepEqual(m.actions[0], { type: "invoice", projectId: "p1", label: "wf:mv_act_invoice" });
  assert.equal(m.actions[1].type, "step");
  assert.equal(m.actions[1].step, "deposit");
});

test("opens in the last two days are named in the hot reason; the ranking does not change", () => {
  const stats = new Map([["p1", { opens: 6, lastOpen: ago(0.5), sentAt: ago(9) }]]);
  const [plain] = run({ projects: [P({})], stats });
  const [recent] = run({ projects: [P({})], stats, recentOpens: new Map([["p1", 4]]) });
  assert.equal(plain.kind, "hot");
  assert.equal(recent.kind, "hot");
  assert.equal(recent.score, plain.score);
  assert.match(plain.reason, /^mv_hot\{/);
  assert.match(recent.reason, /^wf:mv_hot_recent\{"n":4/);
});

test("a Ukrainian job is built before its notice: after the deposit the next tick is the order, not the permit", () => {
  const ua = run({ projects: [P({ status: "won", market: "UA", title: "Будинок, Київ", invoice_no: "1", install_progress: { deposit: "2026-09-20" } })] });
  assert.equal(ua[0].kind, "install");
  assert.equal(ua[0].actions[0].step, "order");
  const md = run({ projects: [P({ status: "won", market: "MD", invoice_no: "1", install_progress: { deposit: "2026-09-20" } })] });
  assert.equal(md[0].actions[0].step, "permit");
});

test("a system finished a month ago with no reading at all is flagged once, below the jobs", () => {
  const all = Object.fromEntries(["deposit", "permit", "order", "install", "grid", "commission"].map((s) => [s, "2026-08-01"]));
  const [m] = run({ projects: [P({ status: "won", install_progress: all, invoiced_at: ago(60), invoice_no: "1" })] });
  assert.equal(m.kind, "unmonitored");
  assert.equal(m.group, "systems");
  assert.equal(m.actions[0].href, "/studio/monitoring");
  // commissioned last week: not yet
  const fresh = Object.fromEntries(Object.keys(all).map((s) => [s, "2026-09-20"]));
  assert.equal(run({ projects: [P({ status: "won", install_progress: fresh, invoiced_at: ago(5), invoice_no: "1" })] }).length, 0);
  // readings exist: the health rules take over, this one stays quiet
  const healthy = run({ projects: [P({ status: "won", install_progress: all, invoiced_at: ago(60), invoice_no: "1" })],
    health: new Map([["p1", { ratio: 0.98, months: 2, lastMonth: new Date("2026-09-01") }]]) });
  assert.equal(healthy.length, 0);
});

test("installed but not invoiced outranks the next install step", () => {
  const prog = { deposit: "2026-09-01", permit: "2026-09-05", order: "2026-09-08", install: "2026-09-20" };
  const [m] = run({ projects: [P({ status: "won", install_progress: prog })] });
  assert.equal(m.kind, "invoice");
  const [m2] = run({ projects: [P({ status: "won", install_progress: prog, invoiced_at: ago(1) })] });
  assert.equal(m2.kind, "install");
  assert.equal(m2.actions[0].step, "grid");
});

test("new leads are listed, hot ones first, contacted ones not at all", () => {
  const moves = run({ leads: [
    { id: "a", name: "Cold", status: "new", created_at: ago(1), phone: "+373 1" },
    { id: "b", name: "Hot", status: "new", hot: true, created_at: ago(2) },
    { id: "c", name: "Done", status: "contacted", created_at: ago(1) },
  ] });
  assert.deepEqual(moves.map((m) => m.title), ["Hot", "Cold"]);
  assert.equal(moves[1].actions[0].type, "tel");
});

test("an underperforming system is flagged with its measured ratio", () => {
  const [m] = run({
    projects: [P({ status: "won", install_progress: Object.fromEntries(["deposit", "permit", "order", "install", "grid", "commission"].map((s) => [s, "2026-01-10"])), invoiced_at: ago(200) })],
    health: new Map([["p1", { ratio: 0.71, months: 6, lastMonth: new Date("2026-08-01") }]]),
  });
  assert.equal(m.kind, "health");
  assert.match(m.reason, /"p":71/);
});

test("lifecycle stages are exclusive and the open rate is measured on tracked proposals", () => {
  const all = ["deposit", "permit", "order", "install", "grid", "commission"];
  const projects = [
    { id: "d", status: "draft" },
    { id: "s", status: "sent" },
    { id: "o", status: "sent" },
    { id: "w", status: "won", install_progress: {} },
    { id: "i", status: "won", install_progress: { deposit: "x", permit: "x" } },
    { id: "l", status: "won", kw: 6, install_progress: Object.fromEntries(all.map((k) => [k, "x"])) },
    { id: "x", status: "lost" },
  ];
  const stats = new Map([
    ["s", { opens: 0, sentAt: ago(3) }], ["o", { opens: 4, sentAt: ago(9) }],
    ["w", { opens: 2, sentAt: ago(20) }], ["x", { opens: 1, sentAt: ago(40) }],
  ]);
  const { stages, openRate } = flowStages({ projects, stats, leads: [{ status: "new", hot: true }, { status: "archived" }] });
  assert.deepEqual([stages.leads.n, stages.drafts.n, stages.sent.n, stages.opened.n, stages.won.n, stages.installing.n, stages.live.n],
    [1, 1, 1, 1, 1, 1, 1]);
  assert.equal(stages.opened.engaged, 1);
  assert.equal(stages.installing.stepsLeft, 4);
  assert.equal(stages.live.kw, 6);
  assert.equal(openRate, 67);
});

test("a Moldovan grid file that has waited on the operator asks for a call", () => {
  const base = { id: "g1", title: "Casa Rusu", status: "won", market: "MD", updated_at: ago(30), invoiced_at: ago(1) };
  const late = run({ projects: [{ ...base, install_progress: { deposit: "2026-09-01", gridFile: { operator: "rednord", stages: { applied: "2026-09-10" } } } }] });
  const g = late.find((m) => m.kind === "grid");
  assert.ok(g, "grid move");
  assert.match(g.reason, /mv_grid/);
  assert.match(g.reason, /RED Nord/);
  const fresh = run({ projects: [{ ...base, install_progress: { deposit: "2026-09-01", gridFile: { operator: "premier", stages: { applied: "2026-09-22" } } } }] });
  assert.equal(fresh.some((m) => m.kind === "grid"), false);
  // a Romanian quote never gets a Moldovan grid reminder
  const ro = run({ projects: [{ ...base, market: "RO", install_progress: { deposit: "2026-09-01", gridFile: { stages: { applied: "2026-08-01" } } } }] });
  assert.equal(ro.some((m) => m.kind === "grid"), false);
  // no operator chosen yet: the one the editor suggests from the address
  const bejan = run({ projects: [{ ...base, title: "Casa Bejan, Ungheni", install_progress: { gridFile: { stages: { applied: "2026-09-10" } } } }] });
  assert.match(bejan.find((m) => m.kind === "grid").reason, /RED Nord/);
});

const inH = (h) => new Date(NOW + h * 36e5).toISOString();
const L = (o) => ({ id: "l1", name: "Ion Bivol", phone: "+373 68 512 003", status: "contacted", created_at: ago(9), ...o });

test("a site visit today sits near the top, with the address and a call button", () => {
  const moves = run({ leads: [L({ visit_at: inH(4), address: "Codru" })], projects: [P({})],
    stats: new Map([["p1", { opens: 3, lastOpen: ago(1), sentAt: ago(5) }]]) });
  assert.equal(moves[0].kind, "visit");
  assert.equal(moves[0].group, "leads");
  assert.equal(moves[0].note, "Codru");
  assert.match(moves[0].reason, /mv_visit.*visit\(13:00\)/);
  assert.equal(moves[0].actions[0].type, "tel");
});

test("tomorrow's visit ranks below today's", () => {
  const moves = run({ leads: [L({ id: "a", visit_at: inH(20) }), L({ id: "b", visit_at: inH(2) })] });
  assert.deepEqual(moves.map((m) => m.key), ["visit:b", "visit:a"]);
  assert.ok(moves[0].score > moves[1].score);
});

test("after the visit, the move is to send the quote, once per lead", () => {
  const moves = run({ leads: [L({ visit_at: ago(1), status: "new" })] });
  assert.equal(moves.length, 1);
  assert.equal(moves[0].kind, "visit_done");
  assert.equal(moves[0].actions[0].type, "lead_quote");
});

test("a visit far in the past or future falls back to the normal lead rules", () => {
  assert.equal(run({ leads: [L({ visit_at: inH(24 * 5), status: "new" })] })[0].kind, "lead");
  assert.equal(run({ leads: [L({ visit_at: ago(20), status: "contacted" })] }).length, 0);
});

test("a converted lead's visit is not a move", () => {
  assert.equal(run({ leads: [L({ visit_at: inH(3), status: "converted" })] }).length, 0);
});

test("every row's first button fixes something: send a draft, resend an unopened offer, record a signature", () => {
  const draft = run({ projects: [P({ status: "draft", updated_at: ago(5) })] })[0];
  assert.equal(draft.kind, "draft");
  assert.equal(draft.actions[0].type, "send");
  assert.equal(draft.actions.at(-1).type, "link");

  const unopened = run({ projects: [P({})], stats: new Map([["p1", { opens: 0, sentAt: ago(5) }]]) })[0];
  assert.equal(unopened.kind, "unopened");
  assert.equal(unopened.actions[0].type, "copy_link");

  const hot = run({ projects: [P({})], stats: new Map([["p1", { opens: 3, lastOpen: ago(1), sentAt: ago(4) }]]) })[0];
  assert.equal(hot.kind, "hot");
  assert.ok(hot.actions.some((a) => a.type === "won" && a.projectId === "p1"), "a signature taken offline is one tap away");
  assert.ok(hot.actions.length <= 3);
});

test("a later step recorded behind a missing one becomes a row whose button records the missing step", () => {
  const moves = run({ projects: [P({ status: "sent", install_progress: { deposit: ago(3).slice(0, 10) } })],
    stats: new Map([["p1", { opens: 2, lastOpen: ago(12), sentAt: ago(15) }]]),
    f: { ...f, stage: (id) => `stage:${id}` } });
  assert.equal(moves[0].kind, "gap");
  assert.equal(moves[0].group, "jobs");
  assert.equal(moves[0].actions[0].type, "won");
  assert.match(moves[0].actions[0].label, /^wf:do_mark_signed/);
  assert.match(moves[0].reason, /stage:signed/);
});

test("an operator wait past its rule records the stage the operator owes", () => {
  const m = run({ projects: [P({ status: "won", market: "MD", invoice_no: "F1", install_progress: {
    deposit: ago(30).slice(0, 10), gridFile: { operator: "premier", stages: { applied: ago(14).slice(0, 10) } } } })] })
    .find((x) => x.kind === "grid");
  assert.ok(m, "a grid row");
  assert.deepEqual({ type: m.actions[0].type, stage: m.actions[0].stage, operator: m.actions[0].operator }, { type: "grid", stage: "approval", operator: "premier" });
});
