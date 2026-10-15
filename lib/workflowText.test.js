import { test } from "node:test";
import assert from "node:assert/strict";
import { WT, wt, durText, stageName, describe } from "./workflowText.js";
import { projectWorkflow, leadWorkflow, STAGES } from "./workflow.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(WT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      // unit spellings such as "кВт·год" are standard; any other middle dot is decoration
      const text = e[l].replace(/(к|М)Вт·(ч|год)|А·(ч|год)/g, "");
      assert.ok(!/[—–·✓✔]/.test(text), `${k} ${l} has a dash, middle dot or check mark`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ from English`);
  }
});

test("Ukrainian text carries no Russian-only letters", () => {
  for (const [k, e] of Object.entries(WT)) assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
});

test("every stage, every next action and every reason the model can produce has words", () => {
  for (const s of STAGES) {
    if (s === "apply") continue;
    assert.ok(WT["st_" + s] && WT["sl_" + s], s);
  }
  for (const k of ["apply_md", "apply_ua", "apply"]) assert.ok(WT["st_" + k] && WT["sl_" + k], k);
  const keys = ["call_lead", "visit", "quote", "send", "resend", "call_hot", "call", "followup", "invoice", "deposit_paid",
    "apply_md", "approval", "chase_op", "mark_signed", "undo", "permit", "order", "install", "notice_ua", "meter", "contract", "connect",
    "commission", "monitor", "package", "none"];
  for (const k of keys) assert.ok(WT["do_" + k], "do_" + k);
  const why = ["lead_new", "lead_open", "visit", "visit_done", "draft", "unopened", "opened", "hot", "signed", "invoiced",
    "apply_md", "await_op", "notice_ua", "permit", "order", "install", "connect", "commission", "monitor", "package",
    "package_ready", "gap", "done", "done_pf", "lost"];
  for (const k of why) assert.ok(WT["why_" + k], "why_" + k);
});

test("wt fills placeholders and falls back to English, then to the key", () => {
  assert.equal(wt("pp_jobs", "uk", { n: 3 }), "об’єктів: 3");
  assert.equal(wt("rl_step", "ro", { i: 4, n: 10 }), "Pasul 4 din 10");
  assert.equal(wt("nope", "en"), "nope");
  // singular where the language has one
  assert.equal(wt("pp_jobs", "en", { n: 1 }), "1 job");
  assert.equal(wt("pp_jobs", "ro", { n: 1 }), "1 lucrare");
  assert.equal(wt("pp_jobs", "en", { n: 2 }), "2 jobs");
  assert.equal(wt("pp_lender_ready", "en", { n: 1 }), "1 has complete grid papers, so it counts as financing-ready.");
  assert.equal(wt("pp_money", "xx"), "Money waiting");
});

test("durations and stage names read naturally in each language", () => {
  assert.equal(durText(3, "en"), "3 days");
  assert.equal(durText(1, "ro"), "1 zi");
  assert.match(durText(5, "uk"), /^5 дн/);
  assert.equal(stageName("apply", "en", "MD"), "Grid approval");
  assert.equal(stageName("apply", "en", "UA"), "Grid notice");
  assert.equal(stageName("apply", "en", "RO"), "Permit");
  assert.equal(stageName("live", "ro", "MD", true), "Pus în funcțiune și monitorizat");
});

const NOW = Date.parse("2026-10-02T09:00:00Z");
const ago = (d) => new Date(NOW - d * 864e5).toISOString();

test("describe words a Moldovan grid wait with the operator, the grid stage and the rule", () => {
  const w = projectWorkflow({
    project: { id: "p", market: "MD", status: "won", title: "Casa", created_at: ago(40), updated_at: ago(1),
      install_progress: { deposit: "2026-09-10", gridFile: { operator: "rednord", stages: { applied: "2026-09-20" } } } },
    now: NOW, todayKey: "2026-10-02",
  });
  const d = describe(w, "en", NOW);
  // the button says what it records; the call is the advice in the reason
  assert.equal(d.next, "Approval received");
  assert.equal(d.wait, "Waiting on the operator");
  assert.equal(d.why, "With RED Nord for 12 days. Next milestone: Connection approval received. Call RED Nord to move it along.");
  assert.equal(d.stuck, "Stuck: 12 days without a move, the rule here is 10 days.");
  assert.equal(d.stuckShort, "Stuck 12 days");
  assert.equal(d.stage, "Deposit");
});

test("a wait on the operator that started today does not say 0 days", () => {
  const w = projectWorkflow({
    project: { id: "p", market: "MD", status: "won", title: "Casa", created_at: ago(40), updated_at: ago(1),
      install_progress: { deposit: "2026-09-10", gridFile: { operator: "premier", stages: { applied: "2026-10-02" } } } },
    now: NOW, todayKey: "2026-10-02",
  });
  const d = describe(w, "ro", NOW);
  assert.equal(d.why, "La Premier Energy de azi. Următorul pas: Avizul de racordare primit.");
  assert.equal(d.next, "Avizul a venit");
});

test("describe falls back to the generic oblenergo when a Ukrainian address names no area", () => {
  const w = projectWorkflow({
    project: { id: "p", market: "UA", status: "won", title: "Будинок", created_at: ago(40), updated_at: ago(1),
      install_progress: { deposit: "2026-09-01", order: "2026-09-05", install: "2026-09-20" } },
    now: NOW, todayKey: "2026-10-02",
  });
  assert.equal(w.op, null);
  const d = describe(w, "uk", NOW);
  assert.equal(d.next, "Подати повідомлення");
  assert.equal(d.stage, "Монтаж");
  assert.equal(d.stageLong, "Систему змонтовано");
});

test("describe words a lead, a lost quote and a finished job", () => {
  const lead = describe(leadWorkflow({ lead: { id: "l", name: "Ana", phone: "+373", status: "new", created_at: ago(3) }, now: NOW }), "ro", NOW);
  assert.equal(lead.next, "Sună clientul");
  assert.equal(lead.alt, "Fă oferta");
  assert.equal(lead.stuckShort, "Blocat de 3 zile");
  const lost = describe(projectWorkflow({ project: { id: "x", market: "MD", status: "lost", install_progress: {} }, now: NOW }), "en", NOW);
  assert.equal(lost.stage, "Lost");
  assert.equal(lost.next, "");
  assert.equal(lost.why, "Marked lost.");
  const all = Object.fromEntries(["deposit", "permit", "order", "install", "grid", "commission"].map((k) => [k, "2026-06-01"]));
  const done = describe(projectWorkflow({ project: { id: "y", market: "MD", status: "won", install_progress: all }, hasReadings: true, inPortfolio: true, now: NOW }), "en", NOW);
  assert.equal(done.next, "Nothing to do");
  assert.equal(done.why, "Producing, monitored and in a portfolio.");
  assert.equal(done.days, "");
});

test("actLabel words every fix the workflow can offer, with the operator filled in", async () => {
  const { actLabel } = await import("./workflowText.js");
  assert.equal(actLabel("mark_signed", null, "ro"), "Marchează semnată");
  assert.equal(actLabel("apply_md", { op: "Premier Energy" }, "en"), "Apply to Premier Energy");
  // no operator known yet: the generic word, never a bare {op}
  assert.ok(!actLabel("apply_md", { op: null }, "uk").includes("{op}"));
  const w = projectWorkflow({ project: { id: "p", market: "MD", status: "sent", title: "Casa", created_at: ago(40), updated_at: ago(1), install_progress: {} },
    stats: { code: "c", opens: 1, lastOpen: ago(2), sentAt: ago(5) }, now: NOW, todayKey: "2026-10-02" });
  for (const st of w.stages) for (const f of st.fix || []) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      const s = actLabel(f.key, f.vars, l);
      assert.ok(s && !s.startsWith("do_") && !/\{\w+\}/.test(s), `${st.id} ${f.key} ${l}: ${s}`);
    }
  }
});
