/**
 * Fleet-health tests. These verdicts send an installer out to a site or into a
 * call with a grid operator, so each rule is pinned to the pattern it claims to
 * recognise — and, just as important, to the patterns it must not claim.
 *
 * Run: node --test lib/fleetHealth.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessSystem, compareUrgency, fleetRatio, THRESH } from "./fleetHealth.js";

const P50 = [180, 260, 420, 560, 700, 760, 780, 700, 540, 400, 250, 160];
const AUG = 7;

/** Actual readings at the given per-month ratios; undefined slots stay empty. */
function readings(ratios) {
  return P50.map((p, i) => (ratios[i] == null ? "" : String(Math.round(p * ratios[i]))));
}

test("a system tracking its promise is ok, with honest year-to-date totals", () => {
  const a = assessSystem({ p50: P50, actual: readings([1, 1.02, 0.98, 1, 1.01, 0.99, 1, 1.03]), asOf: AUG });
  assert.equal(a.status, "ok");
  assert.equal(a.cause, null);
  assert.equal(a.months, 8);
  assert.ok(Math.abs(a.ratioYtd - 1) < 0.02);
  assert.equal(a.lostKwh, 0);
});

test("readings after the last complete month are ignored", () => {
  const act = readings([1, 1, 1, 1, 1, 1, 1, 1, 0.2]);   // a half-month of September typed in early
  const a = assessSystem({ p50: P50, actual: act, asOf: AUG });
  assert.equal(a.status, "ok");
  assert.equal(a.last.i, AUG);
});

test("a missing last month is flagged, two missing months is critical", () => {
  const one = assessSystem({ p50: P50, actual: readings([1, 1, 1, 1, 1, 1, 1]), asOf: AUG });
  assert.equal(one.status, "nodata");
  assert.equal(one.cause, "no_reading");
  assert.equal(one.evidence.missing, 1);

  const two = assessSystem({ p50: P50, actual: readings([1, 1, 1, 1, 1, 1]), asOf: AUG });
  assert.equal(two.status, "critical");
  assert.equal(two.evidence.missing, 2);
});

test("a system switched on after the last complete month is pending, not missing data", () => {
  const a = assessSystem({ p50: P50, actual: readings([]), asOf: AUG, firstMonth: 8 });
  assert.equal(a.status, "pending");
});

test("a mid-year start is measured only against its own months", () => {
  const a = assessSystem({ p50: P50, actual: readings([, , , , , , 1, 1]), asOf: AUG, firstMonth: 6 });
  assert.equal(a.status, "ok");
  assert.equal(a.months, 2);
  assert.equal(Math.round(a.ytdP50), 780 + 700);
});

test("a commissioned system with no readings at all is missing data", () => {
  const a = assessSystem({ p50: P50, actual: readings([]), asOf: AUG, firstMonth: 5 });
  assert.equal(a.cause, "no_reading");
  assert.equal(a.evidence.missing, 3);
  assert.equal(a.status, "critical");
});

test("summer-only shortfall on a Moldovan system with a clean spring reads as grid overvoltage", () => {
  const a = assessSystem({
    p50: P50, market: "MD", asOf: AUG,
    actual: readings([1, 1, 0.99, 0.97, 0.88, 0.8, 0.78, 0.82]),
  });
  assert.equal(a.cause, "overvoltage");
  assert.equal(a.status, "warn");
  assert.deepEqual(a.evidence.months, [4, 5, 6, 7]);
  assert.ok(a.lostKwh > 0);
});

test("the same shape in Romania is not blamed on Moldovan grid voltage", () => {
  const a = assessSystem({
    p50: P50, market: "RO", asOf: AUG,
    actual: readings([1, 1, 0.99, 0.97, 0.88, 0.8, 0.78, 0.82]),
  });
  assert.notEqual(a.cause, "overvoltage");
});

test("a system that was always weak is not blamed on summer overvoltage", () => {
  const a = assessSystem({
    p50: P50, market: "MD", asOf: AUG,
    actual: readings([0.84, 0.83, 0.84, 0.83, 0.82, 0.8, 0.81, 0.82]),
  });
  assert.equal(a.cause, "low");
});

test("a steady month-over-month slide reads as soiling", () => {
  const a = assessSystem({
    p50: P50, market: "MD", asOf: AUG,
    actual: readings([1, 1, 0.99, 1, 0.96, 0.92, 0.87, 0.82]),
  });
  assert.equal(a.cause, "soiling");
  assert.equal(a.evidence.to, AUG);
  assert.ok(a.evidence.fromRatio - a.evidence.toRatio >= 0.08);
});

test("a tiny slide is not called soiling", () => {
  const a = assessSystem({
    p50: P50, asOf: AUG,
    actual: readings([1, 1, 1, 0.97, 0.96, 0.95, 0.94, 0.93]),
  });
  assert.notEqual(a.cause, "soiling");
});

test("a healthy month followed by a collapse reads as a sudden fault", () => {
  const a = assessSystem({
    p50: P50, asOf: AUG,
    actual: readings([1, 1, 1, 1, 1, 0.99, 0.98, 0.64]),
  });
  assert.equal(a.cause, "sudden_drop");
  assert.equal(a.status, "critical");
});

test("a low winter month is snow, not a fault", () => {
  const a = assessSystem({ p50: P50, asOf: 0, actual: readings([0.6]) });
  assert.equal(a.cause, "snow");
});

test("thresholds map to statuses at their exact boundaries", () => {
  const at = (r) => assessSystem({ p50: P50, asOf: 0, actual: [String(P50[0] * r)] }).status;
  assert.equal(at(THRESH.healthy), "ok");
  assert.equal(at(THRESH.watch), "watch");
  assert.equal(at(THRESH.critical), "warn");
  assert.equal(at(THRESH.critical - 0.01), "critical");
});

test("junk readings (text, negatives, NaN) are treated as missing, never as zero", () => {
  const act = readings([1, 1, 1, 1, 1, 1, 1, 1]);
  act[3] = "abc"; act[4] = "-50"; act[5] = NaN;
  const a = assessSystem({ p50: P50, asOf: AUG, actual: act });
  assert.equal(a.months, 5);
  assert.equal(a.status, "ok");
});

test("lost energy only counts clearly-short months on flagged systems", () => {
  const watch = assessSystem({ p50: P50, asOf: AUG, actual: readings([1, 1, 1, 1, 1, 1, 0.9, 0.9]) });
  assert.equal(watch.status, "watch");
  assert.equal(watch.lostKwh, 0);
});

test("urgency puts critical first, then missing data, then warnings", () => {
  const list = [
    { status: "ok", last: { ratio: 1 } },
    { status: "warn", last: { ratio: 0.8 } },
    { status: "critical", last: { ratio: 0.6 } },
    { status: "nodata", last: null },
    { status: "warn", last: { ratio: 0.76 } },
  ].sort(compareUrgency);
  assert.deepEqual(list.map((a) => a.status), ["critical", "nodata", "warn", "warn", "ok"]);
  assert.equal(list[2].last.ratio, 0.76);
});

test("the fleet ratio is a median, so one broken system can't sink it", () => {
  assert.equal(fleetRatio([{ ratioYtd: 1 }, { ratioYtd: 1.02 }, { ratioYtd: 0.2 }]), 1);
  assert.equal(fleetRatio([{ ratioYtd: null }]), null);
});
