import { test } from "node:test";
import assert from "node:assert/strict";
import { SVT, svt } from "./serviceText.js";
import { REQUEST_KINDS, REQUEST_STATUSES, WARRANTY_ITEMS } from "./service.js";
import { SEVERITY } from "./fleetHealth.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
  for (const [k, e] of Object.entries(SVT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].trim(), `${k} ${l}`);
      assert.equal(holes(e[l]), holes(e.en), `${k} ${l} placeholders`);
      assert.ok(!/[—–·✓✔…]/.test(e[l]), `${k} ${l} has a banned mark`);
    }
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
  for (const k of REQUEST_KINDS) assert.ok(SVT["rk_" + k], k);
  for (const s of REQUEST_STATUSES) assert.ok(SVT["rs_" + s], s);
  for (const w of WARRANTY_ITEMS) assert.ok(SVT["wi_" + w], w);
  for (const h of Object.keys(SEVERITY)) assert.ok(SVT["h_" + h], h);
  for (const c of ["no_reading", "sudden_drop", "soiling", "overvoltage", "snow", "low"]) assert.ok(SVT["c_" + c], c);
});

test("the client's page and emails are formal in Romanian", () => {
  for (const k of Object.keys(SVT).filter((k) => /^(cp_|cm_)/.test(k))) assert.ok(!/(?<!\p{L})(tu|ai|trimite-ne|sună-ne)(?!\p{L})/iu.test(SVT[k].ro), k);
  assert.equal(svt("cp_sent_p", "ro", { company: "SolarTech" }), "SolarTech vă va contacta în curând.");
});
