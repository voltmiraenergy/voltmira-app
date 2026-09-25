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
  const [m] = run({ projects: [P({ status: "won" })] });
  assert.equal(m.kind, "won_start");
  assert.equal(m.group, "jobs");
  assert.deepEqual(m.actions[0], { type: "step", projectId: "p1", step: "deposit", label: 'dx_act_step{"step":"step:deposit"}' });
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
