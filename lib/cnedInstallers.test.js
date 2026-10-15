import { test } from "node:test";
import assert from "node:assert/strict";
import { isCnedQualified, CNED_QUALIFIED } from "./cnedInstallers.js";

const LIST = [{ idno: "1003600012345", name: "Exemplu SRL", until: "2027-12-31" }, { idno: "1003600099999", name: "Expirat SRL", until: "2025-01-01" }];

test("a workspace qualifies only by an exact IDNO on the register, while the entry is valid", () => {
  assert.equal(isCnedQualified("1003600012345", "2026-10-11", LIST), true);
  assert.equal(isCnedQualified("1003 6000 12345", "2026-10-11", LIST), true);
  assert.equal(isCnedQualified("1003600099999", "2026-10-11", LIST), false);
  assert.equal(isCnedQualified("100360001234", "2026-10-11", LIST), false);
  assert.equal(isCnedQualified("", "2026-10-11", LIST), false);
});

test("the shipped list stays empty until CNED supplies its register", () => {
  assert.equal(CNED_QUALIFIED.length, 0);
  assert.equal(isCnedQualified("1003600012345"), false);
});
