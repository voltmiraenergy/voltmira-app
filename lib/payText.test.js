import { test } from "node:test";
import assert from "node:assert/strict";
import { PT, pt, money, dayName } from "./payText.js";
import { MILESTONE_TRIGGERS, REMINDER_STEPS } from "./milestones.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
  for (const [k, e] of Object.entries(PT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].trim(), `${k} ${l}`);
      assert.equal(holes(e[l]), holes(e.en), `${k} ${l} placeholders`);
      assert.ok(!/[—–·✓✔…]/.test(e[l]), `${k} ${l} has a banned mark`);
    }
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
  for (const t of MILESTONE_TRIGGERS) assert.ok(PT["tr_" + t], t);
  for (const s of REMINDER_STEPS) assert.ok(PT["m_s_" + s] && PT["m_l_" + s], s);
});

test("the client's page and emails are formal in Romanian", () => {
  for (const k of Object.keys(PT).filter((k) => /^(pp_|m_)/.test(k))) assert.ok(!/(?<!\p{L})(tu|ai plătit|plătește|trimite-ne)(?!\p{L})/iu.test(PT[k].ro), k);
  assert.equal(pt("pp_stage", "ro", { n: 1, t: 3, s: pt("tr_signed", "ro") }), "Etapa 1 din 3: La semnare");
});

test("amounts and days", () => {
  assert.equal(money(1250000, "MDL", "ro"), "12.500 lei");
  assert.equal(money(125050, "MDL", "en"), "1,250.5 lei");
  assert.match(money(125000, "EUR", "en"), /€1,250/);
  assert.equal(dayName("2026-11-01", "ro"), "1 nov. 2026");
});
