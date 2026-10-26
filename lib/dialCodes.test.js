import { test } from "node:test";
import assert from "node:assert/strict";
import { searchDial, splitIntl, toE164, defaultIso } from "./dialCodes.js";

test("finding a country by its code or its name", () => {
  assert.deepEqual(searchDial("+373").map((x) => x[0]), ["MD"]);
  assert.deepEqual(searchDial("373").map((x) => x[0]), ["MD"]);
  assert.ok(searchDial("mold", "ro").some((x) => x[0] === "MD"));
  assert.ok(searchDial("Румын", "ru").some((x) => x[0] === "RO"));
  assert.equal(searchDial("").length > 50, true);
});

test("a number pasted with its code picks the country; the stored form", () => {
  assert.deepEqual(splitIntl("+40 721 234 567"), { iso: "RO", national: "721234567" });
  assert.deepEqual(splitIntl("00373 69 123 456"), { iso: "MD", national: "69123456" });
  assert.equal(splitIntl("069 123 456"), null);
  assert.equal(toE164("MD", "069 123 456"), "+37369123456");
  assert.equal(toE164("UA", "050 123 4567"), "+380501234567");
  assert.equal(toE164("MD", ""), "", "optional");
  assert.equal(toE164("MD", "123"), null, "too short");
  assert.deepEqual([defaultIso("uk"), defaultIso("ro"), defaultIso("en")], ["UA", "MD", "MD"]);
});
