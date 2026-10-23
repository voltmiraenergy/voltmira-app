import { test } from "node:test";
import assert from "node:assert/strict";
import { pvgisAngles } from "./pvgisAngles.js";

test("the tilt and facing stay in range and whole, with the usual defaults", () => {
  assert.deepEqual(pvgisAngles(null, null), { angle: 35, aspect: 0 });
  assert.deepEqual(pvgisAngles("30", "-45"), { angle: 30, aspect: -45 });
  assert.deepEqual(pvgisAngles("35.0001", "0.4"), { angle: 35, aspect: 0 });
  assert.deepEqual(pvgisAngles("500", "-900"), { angle: 90, aspect: -180 });
  assert.deepEqual(pvgisAngles("-20", "999"), { angle: 0, aspect: 180 });
  assert.deepEqual(pvgisAngles("abc", ""), { angle: 35, aspect: 0 });
});
