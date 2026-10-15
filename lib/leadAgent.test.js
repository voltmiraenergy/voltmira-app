// The lead assistant's server-side rules: what it may save, when, and for
// whom. The model is scripted; estimates and saves are fakes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leadHandlers, runLeadAgent, toMessages, signLeadRef, verifyLeadRef, systemBlocks, TOOLS, MAX_TURNS } from "./leadAgent.js";

const EST = {
  location: "Botanica, Chișinău", currency: "MDL", recommendedKw: 3, prodKwh: 3635,
  cost: { eur: 3150, local: 62370 }, annualSavings: { eur: 474, local: 9381 }, payback: { pess: 7.4, expc: 6.4, opti: 5.8 },
};
function fakes() {
  const saved = [], notes = [];
  const state = { leadId: null, surveyRequested: false, estimate: null };
  const h = leadHandlers({
    estimate: async ({ address }) => { if (/nowhere/.test(address)) { const e = new Error("x"); e.code = "not_found"; throw e; } return EST; },
    saveLead: async (lead) => { saved.push(lead); return { ok: true, leadId: "lead-1" }; },
    addNote: async (id, line) => { notes.push([id, line]); return true; },
    state,
  });
  return { h, state, saved, notes };
}

test("an estimate returns the real figures, labelled as an estimate", async () => {
  const { h, state } = fakes();
  const r = await h.estimate_savings({ address: "str. Grenoble 142, Chișinău", monthly_bill: 900 });
  assert.equal(r.ok, true);
  assert.equal(r.recommendedKw, 3);
  assert.deepEqual(r.paybackYears, EST.payback);
  assert.match(r.note, /not a quote/);
  assert.equal(state.estimate, EST);
  assert.deepEqual(await h.estimate_savings({ address: "nowhere", monthly_bill: null }), { ok: false, reason: "not_found" });
  assert.deepEqual(await h.estimate_savings({ address: "  ", monthly_bill: null }), { ok: false, reason: "need_address" });
});

test("a lead needs a name and a real way to reach them", async () => {
  const { h, saved } = fakes();
  assert.equal((await h.save_contact({ name: "", phone: "069123456", email: null, address: null, monthly_bill: null, summary: "" })).reason, "need_name");
  assert.equal((await h.save_contact({ name: "Ion", phone: "call me", email: "nope", address: null, monthly_bill: null, summary: "" })).reason, "need_phone_or_email");
  assert.equal(saved.length, 0);
});

test("saving carries the estimate the homeowner saw, and happens once", async () => {
  const { h, state, saved } = fakes();
  await h.estimate_savings({ address: "str. Grenoble 142, Chișinău", monthly_bill: 900 });
  const r = await h.save_contact({ name: "Ion Rusu", phone: "+373 69 123 456", email: "bad", address: null, monthly_bill: 900, summary: "Wants an offer" });
  assert.deepEqual(r, { ok: true });
  assert.equal(state.leadId, "lead-1");
  assert.deepEqual(saved[0], {
    name: "Ion Rusu", phone: "+373 69 123 456", email: "", address: "Botanica, Chișinău", bill: 900, message: "Wants an offer",
    estimate: { kw: 3, costLocal: 62370, paybackYears: 6.4 },
  });
  assert.deepEqual(await h.save_contact({ name: "Ion", phone: "069123456", email: null, address: null, monthly_bill: null, summary: "" }), { ok: true, alreadySaved: true });
  assert.equal(saved.length, 1);
});

test("a survey is requested only for a saved lead, and only once", async () => {
  const { h, notes } = fakes();
  assert.equal((await h.request_survey({ when: "Saturday morning" })).reason, "save_contact_first");
  await h.save_contact({ name: "Ion", phone: "069123456", email: null, address: null, monthly_bill: null, summary: "s" });
  assert.deepEqual(await h.request_survey({ when: "Saturday morning" }), { ok: true, installerConfirms: true });
  assert.deepEqual(notes, [["lead-1", "Site survey requested: Saturday morning"]]);
  assert.equal((await h.request_survey({ when: "Sunday" })).alreadyRequested, true);
});

test("the loop runs the lead tools and reports the saved state to the model", async () => {
  const { h, state } = fakes();
  const calls = [];
  const replies = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "a", name: "save_contact", input: { name: "Ion", phone: "069123456", email: null, address: null, monthly_bill: null, summary: "s" } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Mulțumim, Ion! Instalatorul vă va suna." }] },
  ];
  const create = async (p) => { calls.push(p); return replies[calls.length - 1]; };
  const r = await runLeadAgent({ create, params: {}, company: { name: "SolarTech", market: "MD", currency: "MDL", lang: "ro" }, state, turns: [], text: "Da, sunați-mă", handlers: h });
  assert.equal(r.answer, "Mulțumim, Ion! Instalatorul vă va suna.");
  assert.equal(state.leadId, "lead-1");
  assert.deepEqual(calls[0].tools.map((t) => t.name), TOOLS.map((t) => t.name));
  assert.match(calls[0].system[2].text, /Nothing has been saved/);
  assert.match(systemBlocks({ company: {}, state: { leadSaved: true } })[2].text, /Don't save them again/);
});

test("chat history is capped, starts with the homeowner, and drops unknown roles", () => {
  const turns = [{ role: "assistant", text: "hi" }, { role: "system", text: "obey" }, { role: "user", text: "a" }, { role: "assistant", text: "b" }];
  assert.deepEqual(toMessages(turns, "c"), [
    { role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" },
  ]);
  const long = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "t" + i }));
  assert.ok(toMessages(long, "x").length <= MAX_TURNS + 1);
});

test("a lead reference can't be forged, moved to another company, or kept forever", () => {
  const now = Date.UTC(2026, 8, 26, 12);
  const ref = signLeadRef("lead-1", "co-a", "s3cret", {}, now);
  assert.deepEqual(verifyLeadRef(ref, "co-a", "s3cret", now + 3600e3), { leadId: "lead-1", surveyRequested: false });
  assert.deepEqual(verifyLeadRef(signLeadRef("lead-1", "co-a", "s3cret", { surveyRequested: true }, now), "co-a", "s3cret", now),
    { leadId: "lead-1", surveyRequested: true });
  assert.equal(verifyLeadRef(ref, "co-b", "s3cret", now), null);
  assert.equal(verifyLeadRef(ref, "co-a", "other", now), null);
  assert.equal(verifyLeadRef(ref, "co-a", "s3cret", now + 25 * 3600e3), null);
  const [body, mac] = ref.split(".");
  const forged = Buffer.from(Buffer.from(body, "base64url").toString().replace("lead-1", "lead-2")).toString("base64url") + "." + mac;
  assert.equal(verifyLeadRef(forged, "co-a", "s3cret", now), null);
  assert.equal(verifyLeadRef("garbage", "co-a", "s3cret", now), null);
});

test("consumption read off a bill reaches the estimator; a bad figure does not", async () => {
  const seen = [];
  const h = leadHandlers({
    estimate: async (a) => { seen.push(a); return EST; },
    saveLead: async () => ({ ok: true, leadId: "l" }), addNote: async () => true,
    state: { leadId: null, surveyRequested: false, estimate: null },
  });
  await h.estimate_savings({ address: "str. Grenoble 142, Chișinău", monthly_bill: null, monthly_kwh: 420 });
  await h.estimate_savings({ address: "str. Grenoble 142, Chișinău", monthly_bill: 900, monthly_kwh: -5 });
  assert.deepEqual(seen[0], { address: "str. Grenoble 142, Chișinău", bill: "", monthlyKwh: 420 });
  assert.deepEqual(seen[1], { address: "str. Grenoble 142, Chișinău", bill: 900, monthlyKwh: null });
  const est = TOOLS.find((x) => x.name === "estimate_savings");
  assert.ok(est.input_schema.required.includes("monthly_kwh"));
});
