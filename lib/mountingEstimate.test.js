import { test } from "node:test";
import assert from "node:assert/strict";
import { railLengthM, clampCount } from "./mountingEstimate.js";

test("railLengthM sums two rails per row over every row's real length", () => {
  const rows = [{ count: 4, lengthM: 5 }, { count: 2, lengthM: 2.5 }];
  assert.equal(railLengthM(rows), 2 * 5 + 2 * 2.5);
});

test("railLengthM is 0 for no rows, never NaN or a crash on junk input", () => {
  assert.equal(railLengthM([]), 0);
  assert.equal(railLengthM(null), 0);
  assert.equal(railLengthM(undefined), 0);
});

test("clampCount: a single row of N panels is 4 end clamps + 2*(N-1) mid clamps", () => {
  // 2 rails per row, N+1 clamp positions per rail: 2 end + (N-1) mid, doubled.
  assert.deepEqual(clampCount([{ count: 5 }]), { end: 4, mid: 8, total: 12 });
});

test("clampCount: a single panel has no mid clamps, only the 4 end clamps", () => {
  assert.deepEqual(clampCount([{ count: 1 }]), { end: 4, mid: 0, total: 4 });
});

test("clampCount sums across multiple rows independently", () => {
  const rows = [{ count: 3 }, { count: 1 }, { count: 4 }];
  // row1: end4 mid4 | row2: end4 mid0 | row3: end4 mid6
  assert.deepEqual(clampCount(rows), { end: 12, mid: 10, total: 22 });
});

test("clampCount ignores an empty/junk row rather than crashing", () => {
  assert.deepEqual(clampCount([{ count: 0 }, { count: 3 }]), { end: 4, mid: 4, total: 8 });
  assert.deepEqual(clampCount([]), { end: 0, mid: 0, total: 0 });
  assert.deepEqual(clampCount(null), { end: 0, mid: 0, total: 0 });
});
