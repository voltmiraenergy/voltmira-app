import { test } from "node:test";
import assert from "node:assert/strict";
import { nearbyProof, lastTwelveMonths, systemYield } from "./nearbyProof.js";

const NOW = new Date("2026-10-24T10:00:00Z");
const months = lastTwelveMonths(NOW);
const flat = (kwhPerMonth) => months.map((m) => ({ month: m, kwh: kwhPerMonth }));
// every system west of 28.5 is in "orhei" for the test, the rest in "cahul"
const districtOf = (lat, lon) => (lon < 28.5 ? "orhei" : "cahul");
const sys = (companyId, kw, perMonth, lon = 28.0, extra = {}) => ({ companyId, kw, lat: 47, lon, readings: flat(perMonth), ...extra });

test("the window is the 12 full months before today", () => {
  assert.equal(months.length, 12);
  assert.equal(months[0], "2025-10");
  assert.equal(months[11], "2026-09");
});

test("a system needs a reading for every month of the window", () => {
  assert.equal(systemYield(sys("a", 5, 600), months), 1440);
  const gap = sys("a", 5, 600); gap.readings.splice(3, 1);
  assert.equal(systemYield(gap, months), null);
  assert.equal(systemYield({ ...sys("a", 0, 600) }, months), null);
});

test("3 systems from 2 installers in the district: the median kWh per kWp", () => {
  const r = nearbyProof("orhei", [sys("a", 5, 600), sys("a", 10, 1100), sys("b", 6, 650), sys("c", 5, 700, 29)], districtOf, NOW);
  assert.deepEqual(r, { district: "orhei", systems: 3, kwhPerKwp: 1320, from: "2025-10", to: "2026-09" });
});

test("too few systems, or all from one installer, shows nothing", () => {
  assert.equal(nearbyProof("orhei", [sys("a", 5, 600), sys("b", 6, 650)], districtOf, NOW), null);
  assert.equal(nearbyProof("orhei", [sys("a", 5, 600), sys("a", 6, 650), sys("a", 7, 700)], districtOf, NOW), null);
  assert.equal(nearbyProof(null, [sys("a", 5, 600)], districtOf, NOW), null);
});

test("a demo workspace's sample systems may show their own", () => {
  const s = { sample: true };
  assert.ok(nearbyProof("orhei", [sys("d", 5, 600, 28, s), sys("d", 6, 650, 28, s), sys("d", 7, 700, 28, s)], districtOf, NOW));
});

test("a figure no roof gives is left out", () => {
  const r = nearbyProof("orhei", [sys("a", 5, 600), sys("b", 6, 650), sys("c", 1, 9000)], districtOf, NOW);
  assert.equal(r, null);
});
