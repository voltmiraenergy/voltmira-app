import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStudy, readStudy, studyPrompt, STUDY_SCHEMA, STUDY_MAX_PDF_BYTES } from "./studyReader.js";

const P1 = "Energy Yield Assessment. Parcul hibrid Sud. Prepared by Windtest SRL. Issued 2026-05-14.";
const P7 = "Table 8.1 Net energy yield. P50 net AEP 153.3 GWh/year. P90 (1 year) 128.4 GWh/year. P90 (10 years) 139.1 GWh/year. 8 turbines, hub height 150 m, 40 MW. Total losses 15.2%. Total uncertainty 10.8%.";
const texts = { 1: P1, 7: P7 };
const e = (value, unit, page, quote) => ({ value, unit, page, quote });
const f = (value, page, quote) => ({ value, page, quote });
const none = { value: null, page: null, quote: "" };

const RAW = {
  is_yield_study: true, technology: "wind",
  p50: e(153.3, "GWh", 7, "P50 net AEP 153.3 GWh/year"),
  p90_1y: e(128.4, "GWh", 7, "P90 (1 year) 128.4 GWh/year"),
  p90_10y: e(139.1, "GWh", 7, "P90 (10 years) 139.1 GWh/year"),
  capacity_mw: f(40, 7, "8 turbines, hub height 150 m, 40 MW"),
  turbines: f(8, 7, "8 turbines, hub height 150 m"),
  hub_height_m: f(150, 7, "hub height 150 m, 40 MW"),
  mean_wind_ms: none,
  losses_pct: f(15.2, 7, "Total losses 15.2%"),
  uncertainty_pct: f(10.8, 7, "Total uncertainty 10.8%"),
  turbine_model: none,
  prepared_by: f("Windtest SRL", 1, "Prepared by Windtest SRL"),
  report_date: f("2026-05-14", 1, "Issued 2026-05-14"),
  measurement: none,
  notes: "P90 horizons are stated.",
};

test("a good read: units become MWh, every quote is checked against its page", () => {
  const r = checkStudy(RAW, { kind: "wind", texts, plant: { mw: 40 } });
  assert.equal(r.ok, true);
  const s = r.study;
  assert.equal(s.fields.p50.value, 153300);
  assert.equal(s.fields.p90_1y.value, 128400);
  assert.equal(s.fields.p90_10y.value, 139100);
  assert.equal(s.fields.p50.check, "verified");
  assert.equal(s.fields.by.check, "verified");
  assert.equal(s.fields.turbines.value, 8);
  assert.equal(s.isoDate, "2026-05-14");
  assert.equal(s.fields.meanWind, null);
  assert.deepEqual(s.warnings, []);
});

test("a quote not on its page, or without the number, is flagged, not trusted", () => {
  const r = checkStudy({ ...RAW, p50: e(163.3, "GWh", 7, "P50 net AEP 163.3 GWh/year") }, { kind: "wind", texts, plant: { mw: 40 } });
  assert.equal(r.study.fields.p50.check, "unverified");
  const q = checkStudy({ ...RAW, p50: e(160, "GWh", 7, "P50 net AEP 153.3 GWh/year") }, { kind: "wind", texts, plant: { mw: 40 } });
  assert.equal(q.study.fields.p50.check, "quote_only");
  // a page that was never sent cannot be cited
  const p = checkStudy({ ...RAW, p50: e(153.3, "GWh", 12, "P50 net AEP 153.3 GWh/year") }, { kind: "wind", texts, plant: { mw: 40 } });
  assert.equal(p.study.fields.p50.page, null);
  assert.equal(p.study.fields.p50.check, "unverified");
  assert.ok(p.study.warnings.some((w) => w.id === "unchecked" && w.n === 1));
});

test("a P90 above the P50 is dropped; no P50 or not a study is an error", () => {
  const r = checkStudy({ ...RAW, p90_1y: e(160, "GWh", 7, "x") }, { kind: "wind", texts });
  assert.equal(r.study.fields.p90_1y, null);
  assert.ok(r.study.warnings.some((w) => w.id === "p90_high"));
  assert.deepEqual(checkStudy({ ...RAW, p50: e(null, "GWh", null, "") }, { kind: "wind", texts }), { ok: false, code: "no_p50" });
  assert.deepEqual(checkStudy({ ...RAW, is_yield_study: false, p50: e(null, "none", null, "") }, { kind: "wind", texts }), { ok: false, code: "not_study" });
  // a value without a known unit is not guessed
  assert.deepEqual(checkStudy({ ...RAW, p50: e(153.3, "none", 7, "153.3") }, { kind: "wind", texts }), { ok: false, code: "no_p50" });
  assert.deepEqual(checkStudy(null, { kind: "wind", texts }), { ok: false, code: "unreadable" });
});

test("does it fit the plant: capacity, capacity factor, technology", () => {
  const cap = checkStudy(RAW, { kind: "wind", texts, plant: { mw: 50 } });
  assert.ok(cap.study.warnings.some((w) => w.id === "cap" && w.study === 40 && w.plant === 50));
  // 153.3 MWh read as MWh for 40 MW: a capacity factor of 0.04%
  const cf = checkStudy({ ...RAW, p50: e(153.3, "MWh", 7, "P50 net AEP 153.3 GWh/year") }, { kind: "wind", texts, plant: { mw: 40 } });
  assert.ok(cf.study.warnings.some((w) => w.id === "cf"));
  const tech = checkStudy({ ...RAW, technology: "solar" }, { kind: "wind", texts, plant: { mw: 40 } });
  assert.ok(tech.study.warnings.some((w) => w.id === "tech"));
  assert.ok(!checkStudy({ ...RAW, technology: "hybrid" }, { kind: "wind", texts, plant: { mw: 40 } }).study.warnings.some((w) => w.id === "tech"));
  // a solar study keeps no turbine fields
  const sol = checkStudy({ ...RAW, technology: "solar", p50: e(24.9, "GWh", 7, "P50 net AEP 153.3 GWh/year"), capacity_mw: f(20, 7, "40 MW") }, { kind: "solar", texts, plant: { mw: 20 } });
  assert.equal(sol.study.fields.turbines, null);
  assert.equal(sol.study.fields.hub, null);
});

test("a scan maps its pages back to the original and is marked for checking", () => {
  const r = checkStudy({ ...RAW, p50: e(153.3, "GWh", 2, "P50 net AEP 153.3 GWh/year") }, { kind: "wind", texts: null, pageMap: [6, 7], plant: { mw: 40 } });
  assert.equal(r.study.scan, true);
  assert.equal(r.study.fields.p50.page, 7);
  assert.equal(r.study.fields.p50.check, "scan");
  assert.ok(!r.study.warnings.some((w) => w.id === "unchecked"));
});

test("a date the plant cannot store is shown but not offered", () => {
  const r = checkStudy({ ...RAW, report_date: f("May 2026", 1, "Issued 2026-05-14") }, { kind: "wind", texts });
  assert.equal(r.study.isoDate, null);
  assert.equal(r.study.fields.date.value, "May 2026");
});

test("the call: structured output, the pages as a text document, errors mapped", async () => {
  let sent;
  const ok = { messages: { create: async (p) => { sent = p; return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(RAW) }] }; } } };
  const r = await readStudy(ok, { kind: "wind", pages: [{ n: 1, text: P1 }, { n: 7, text: P7 }], fileName: "EYA.pdf", plant: { mw: 40 }, lang: "ro", model: "claude-opus-5" });
  assert.equal(r.ok, true);
  assert.equal(r.study.fields.p50.check, "verified");
  assert.equal(sent.output_config.format.type, "json_schema");
  assert.equal(sent.output_config.format.schema, STUDY_SCHEMA);
  const [doc, ask] = sent.messages[0].content;
  assert.equal(doc.source.type, "text");
  assert.match(doc.source.data, /=== Page 7 ===/);
  assert.match(ask.text, /written in Romanian/);
  const say = (resp) => ({ messages: { create: async () => resp } });
  const fail = (status) => ({ messages: { create: async () => { const x = new Error("x"); x.status = status; throw x; } } });
  const args = { kind: "wind", pages: [{ n: 7, text: P7 }] };
  assert.equal((await readStudy(say({ stop_reason: "refusal", content: [] }), args)).code, "declined");
  assert.equal((await readStudy(say({ stop_reason: "max_tokens", content: [] }), args)).code, "unreadable");
  assert.equal((await readStudy(say({ content: [{ type: "text", text: "not json" }] }), args)).code, "unreadable");
  assert.equal((await readStudy(fail(401), args)).code, "auth");
  assert.equal((await readStudy(fail(429), args)).code, "rate");
  assert.equal((await readStudy(fail(500), args)).code, "failed");
});

test("a scan goes as a PDF, and an oversized one never costs a call", async () => {
  let calls = 0, sent;
  const client = { messages: { create: async (p) => { calls++; sent = p; return { content: [{ type: "text", text: JSON.stringify(RAW) }] }; } } };
  const big = Buffer.alloc(STUDY_MAX_PDF_BYTES + 10).toString("base64");
  assert.deepEqual(await readStudy(client, { kind: "wind", pdf: big }), { ok: false, code: "too_large" });
  assert.deepEqual(await readStudy(client, { kind: "wind" }), { ok: false, code: "unreadable" });
  assert.equal(calls, 0);
  const r = await readStudy(client, { kind: "wind", pdf: Buffer.from("%PDF-1.7").toString("base64"), pageMap: [5, 6, 7] });
  assert.equal(r.ok, true);
  assert.equal(sent.messages[0].content[0].source.media_type, "application/pdf");
  assert.match(sent.messages[0].content[1].text, /numbered from 1 in the order of this document/);
});

test("the prompt asks for transcription only, for the right technology", () => {
  assert.match(studyPrompt("wind"), /never compute, estimate, round or convert/);
  assert.match(studyPrompt("solar"), /DC capacity in MWp/);
  assert.match(studyPrompt("solar"), /null for a solar study/);
  assert.match(studyPrompt("wind", { lang: "uk" }), /written in Ukrainian/);
});

test("the schema requires every field, so the answer always has the same shape", () => {
  assert.equal(STUDY_SCHEMA.additionalProperties, false);
  assert.deepEqual([...STUDY_SCHEMA.required].sort(), Object.keys(STUDY_SCHEMA.properties).sort());
});
