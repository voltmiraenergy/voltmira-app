import { test } from "node:test";
import assert from "node:assert/strict";
import { GT, gt, gridSmsText } from "./gridText.js";
import { GRID_STATUSES } from "./gridSubmission.js";
import { XT } from "./integrationText.js";

const LANGS = ["en", "ro", "ru", "uk"];
const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(GT)) {
    for (const l of LANGS) {
      assert.ok(typeof e[l] === "string" && e[l].trim(), `${k} ${l}`);
      assert.equal(holes(e[l]), holes(e.en), `${k} ${l} placeholders`);
      assert.ok(!/[—–·✓✔…]/.test(e[l]), `${k} ${l} has a banned mark`);
    }
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
});

test("every step has a status name, a button, a client email and a text message that fits 160 characters", () => {
  const vars = { company: "SolarTech Chișinău", op: "Premier Energy", ref: "VM-P-261024-7F3A" };
  for (const s of GRID_STATUSES) {
    assert.ok(XT["gs_st_" + s], "status name " + s);
    assert.ok(XT["gc_" + s] && XT["gc_" + s + "_l"], "client email " + s);
    if (s !== "submitted") assert.ok(XT["gs_to_" + s], "button " + s);
    for (const l of LANGS) {
      const t = gridSmsText(s, l, vars);
      assert.ok(t.length > 20 && t.length <= 160, `${s} ${l} is ${t.length} characters`);
      assert.ok(!t.includes("{"), `${s} ${l} left a placeholder`);
    }
  }
  assert.equal(gridSmsText("weird", "ro"), "");
});

test("the homeowner's text messages speak formally", () => {
  for (const s of GRID_STATUSES) assert.ok(!/\b(tu|ta|tău|tale|ai)\b/i.test(GT["sms_" + s].ro), s);
  assert.equal(gt("go_days", "ro", { d: 12, e: 10 }), "12 din 10");
});
