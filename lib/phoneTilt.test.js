import { test } from "node:test";
import assert from "node:assert/strict";
import { tiltFromBeta, medianTilt } from "./phoneTilt.js";

test("a beta reading is the pitch: whole degrees, 0 to 60, whichever way up the phone lies", () => {
  assert.equal(tiltFromBeta(34.6), 35);
  assert.equal(tiltFromBeta(-28.2), 28);
  assert.equal(tiltFromBeta(0), 0);
  assert.equal(tiltFromBeta(85), 60);
  assert.equal(tiltFromBeta(null), null);
  assert.equal(tiltFromBeta("x"), null);
});

test("the middle reading wins over a shaky hand", () => {
  assert.equal(medianTilt([30, 31, 29, 55, 30]), 30);
  assert.equal(medianTilt([20, 30]), 25);
  assert.equal(medianTilt([]), null);
  assert.equal(medianTilt([NaN, 12]), 12);
});
