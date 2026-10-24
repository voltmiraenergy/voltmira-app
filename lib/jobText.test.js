import { test } from "node:test";
import assert from "node:assert/strict";
import { JT } from "./jobText.js";
import { BOARD_COLUMNS } from "./jobBoard.js";
import { VISIT_KINDS } from "./crewVisits.js";
import { FIELD_ITEMS, SERIAL_KINDS, PHOTO_SLOTS } from "./siteRecord.js";

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
  for (const [k, e] of Object.entries(JT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].trim(), `${k} ${l}`);
      assert.equal(holes(e[l]), holes(e.en), `${k} ${l} placeholders`);
      assert.ok(!/[—–·✓✔…]/.test(e[l]), `${k} ${l} has a banned mark`);
    }
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
});

test("every column, visit kind, item, serial kind and photo slot has words", () => {
  for (const c of BOARD_COLUMNS) assert.ok(JT["col_" + c], c);
  for (const k of VISIT_KINDS) assert.ok(JT["k_" + k] && JT["ve_lead_" + k], k);
  for (const k of FIELD_ITEMS) assert.ok(JT["f_" + k], k);
  for (const k of SERIAL_KINDS) assert.ok(JT["s_" + k], k);
  for (const k of PHOTO_SLOTS) assert.ok(JT["p_" + k], k);
});

test("the client's emails and the handover speak formally", () => {
  for (const k of Object.keys(JT).filter((k) => /^(ve_|ho_)/.test(k))) assert.ok(!/\b(tu|ta|tău|tale|ai)\b/i.test(JT[k].ro), k);
});
