import { test } from "node:test";
import assert from "node:assert/strict";
import { pickedPlace } from "./estimateCore.js";

test("a place picked from the suggestions is used as it is, in Moldova or Romania only", () => {
  assert.deepEqual(pickedPlace("Strada Ceucari 2/4, Chișinău", "47.0105", "28.8638"), { lat: 47.0105, lon: 28.8638, display: "Strada Ceucari 2/4, Chișinău", kind: "house" });
  assert.equal(pickedPlace("Strada Ceucari, Chișinău", 47.01, 28.86).kind, "road", "no number: the street, not the house");
  assert.equal(pickedPlace("Somewhere", 52.5, 13.4), null, "outside Moldova and Romania");
  assert.equal(pickedPlace("Strada Ceucari 2/4, Chișinău", null, null), null, "nothing picked: the geocoder answers");
  assert.equal(pickedPlace("x", "", ""), null);
  assert.equal(pickedPlace("x", "abc", "28.8"), null);
});
