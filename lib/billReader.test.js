import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBill, billFacts, billMedia, readBill, BILL_MAX_BYTES } from "./billReader.js";

test("a monthly figure becomes an annual one, and the other way round", () => {
  const a = parseBill('{"annualKwh":null,"monthlyKwh":420,"amountDue":1250,"currency":"mdl","supplier":"Premier Energy","confidence":"high","notes":"x"}');
  assert.equal(a.annualKwh, 5040);
  assert.equal(a.monthlyKwh, 420);
  assert.equal(a.amountDue, 1250);
  assert.equal(a.currency, "MDL");
  const b = parseBill('here it is: {"annualKwh":3600,"monthlyKwh":null,"confidence":"medium"}');
  assert.equal(b.monthlyKwh, 300);
});

test("implausible or broken answers are rejected, not used", () => {
  assert.equal(parseBill("no json here"), null);
  assert.equal(parseBill("{broken"), null);
  const silly = parseBill('{"monthlyKwh":2,"annualKwh":24}');
  assert.equal(silly.monthlyKwh, null);
  assert.equal(silly.annualKwh, null);
  assert.equal(parseBill('{"currency":"USD"}').currency, null);
  assert.equal(parseBill('{"confidence":"certain"}').confidence, "low");
});

test("the assistant is told what the photo said, or nothing at all", () => {
  const f = billFacts(parseBill('{"monthlyKwh":420,"amountDue":1250,"currency":"MDL","supplier":"Premier Energy"}'));
  assert.match(f, /^\[Bill photo\]/);
  assert.match(f, /420 kWh/);
  assert.match(f, /5040 kWh a year/);
  assert.match(f, /1250 MDL/);
  assert.equal(billFacts(parseBill('{"supplier":"x"}')), null);
  assert.equal(billFacts(null), null);
});

test("photos and PDFs are read; anything else is refused before it costs a call", async () => {
  assert.equal(billMedia(Buffer.from("x"), "image/png").type, "image");
  assert.equal(billMedia(Buffer.from("x"), "image/jpg").source.media_type, "image/jpeg");
  assert.equal(billMedia(Buffer.from("x"), "application/pdf").type, "document");
  assert.equal(billMedia(Buffer.from("x"), "text/html"), null);
  let calls = 0;
  const client = { messages: { create: async () => { calls++; return {}; } } };
  assert.deepEqual(await readBill(client, { bytes: Buffer.from("x"), mime: "text/html" }), { ok: false, code: "type" });
  assert.deepEqual(await readBill(client, { bytes: Buffer.alloc(BILL_MAX_BYTES + 1), mime: "image/png" }), { ok: false, code: "too_large" });
  assert.equal(calls, 0);
});

test("a refusal, an API error and a good read", async () => {
  const say = (r) => ({ messages: { create: async () => r } });
  assert.equal((await readBill(say({ stop_reason: "refusal", content: [] }), { bytes: Buffer.from("x"), mime: "image/png" })).code, "declined");
  const failing = { messages: { create: async () => { const e = new Error("x"); e.status = 429; throw e; } } };
  assert.equal((await readBill(failing, { bytes: Buffer.from("x"), mime: "image/png" })).code, "rate");
  const good = await readBill(say({ content: [{ type: "text", text: '{"monthlyKwh":300}' }] }), { bytes: Buffer.from("x"), mime: "image/jpeg" });
  assert.equal(good.ok, true);
  assert.equal(good.bill.annualKwh, 3600);
});
