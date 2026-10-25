import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEstimateLead } from "./estimateLead.js";

const good = { name: "Ion Popescu", phone: "069 123 456", email: "Ion@Mail.md", address: "Str. Vasile Lupu 15, Orhei", consent: true, bill: "850", timeline: "now", wantsFinancing: true };

test("a complete request is kept, the phone written the international way", () => {
  const r = validateEstimateLead(good);
  assert.equal(r.ok, true);
  assert.equal(r.lead.phone, "+37369123456");
  assert.equal(r.lead.email, "ion@mail.md");
  assert.equal(r.lead.bill, 850);
  assert.equal(r.lead.kwh, null);
  assert.equal(r.lead.timeline, "now");
  assert.equal(r.lead.wantsFinancing, true);
});

test("name, a phone from the installer's country, the address and consent are required", () => {
  const r = validateEstimateLead({ name: "I", phone: "0721 234 567", address: "x", consent: false });
  assert.deepEqual(r, { ok: false, errors: ["name", "phone", "address", "consent"] });
  assert.equal(validateEstimateLead({ ...good, phone: "12" }).ok, false);
  assert.equal(validateEstimateLead({ ...good, consent: "yes" }).ok, false);
});

test("an email is optional, but when given it must look like one", () => {
  assert.equal(validateEstimateLead({ ...good, email: "" }).ok, true);
  assert.deepEqual(validateEstimateLead({ ...good, email: "nope" }).errors, ["email"]);
});

test("a timeline that is not one of the choices is dropped, not trusted", () => {
  assert.equal(validateEstimateLead({ ...good, timeline: "tomorrow" }).lead.timeline, null);
  assert.equal(validateEstimateLead({ ...good, wantsFinancing: "true" }).lead.wantsFinancing, false);
});

test("a Romanian installer takes a Romanian number", () => {
  assert.equal(validateEstimateLead({ ...good, phone: "0721 234 567" }, { market: "RO" }).lead.phone, "+40721234567");
});
