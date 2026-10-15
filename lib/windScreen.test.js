import { test } from "node:test";
import assert from "node:assert/strict";
import { histogram, histMean, hubFactor, curve, windEnergy, p90From, sigmaFrom, BIN } from "./windScreen.js";

test("hourly speeds become a histogram; fill values and nonsense are skipped", () => {
  const h = histogram([0.2, 0.7, 5.1, 5.4, -999, "x", 80]);
  assert.equal(h.hours, 4);
  assert.equal(h.counts[0], 1);
  assert.equal(h.counts[1], 1);
  assert.equal(h.counts[10], 2);
  assert.ok(Math.abs(histMean(h) - (0.25 + 0.75 + 5.25 * 2) / 4) < 1e-9);
});

test("the power law lifts 50 m speeds to the hub", () => {
  assert.equal(hubFactor(50, 0.2), 1);
  assert.ok(Math.abs(hubFactor(120, 0.2) - Math.pow(2.4, 0.2)) < 1e-12);
  assert.ok(hubFactor(120, 0.3) > hubFactor(120, 0.1));
});

test("the generic curve: nothing below cut-in, full power from rated, nothing from cut-out", () => {
  assert.equal(curve(2.9), 0);
  assert.equal(curve(3), 0);
  assert.ok(curve(7) > 0 && curve(7) < 1);
  assert.equal(curve(11), 1);
  assert.equal(curve(24.9), 1);
  assert.equal(curve(25), 0);
  // monotone between cut-in and rated
  for (let v = 3; v < 11; v += 0.5) assert.ok(curve(v + 0.5) >= curve(v));
});

test("a constant 11 m/s at the hub runs a farm at full power, less the losses", () => {
  // every hour at 50 m is the speed that becomes exactly 11 m/s at a 50 m hub
  const hist = histogram(Array.from({ length: 8760 }, () => 11.1));
  const r = windEnergy({ hist, mw: 10, hubM: 50, shear: 0.2, lossesPct: 10 });
  assert.ok(Math.abs(r.grossMwh - 87600) < 1);
  assert.ok(Math.abs(r.netMwh - 78840) < 1);
  assert.ok(Math.abs(r.cfPct - 90) < 0.01);
});

test("the year is scaled to the long-term mean, and a short sample still stands for a full year", () => {
  const speeds = Array.from({ length: 4380 }, (_, i) => (i % 2 ? 4 : 8));
  const hist = histogram(speeds);
  const plain = windEnergy({ hist, mw: 20, hubM: 100, lossesPct: 0 });
  const windier = windEnergy({ hist, mw: 20, hubM: 100, lossesPct: 0, climMean: histMean(hist) * 1.1 });
  assert.ok(windier.netMwh > plain.netMwh);
  assert.ok(Math.abs(windier.scale - 1.1) < 1e-9);
  // 4,380 hours count as a whole year
  const doubled = windEnergy({ hist: histogram([...speeds, ...speeds]), mw: 20, hubM: 100, lossesPct: 0 });
  assert.ok(Math.abs(doubled.netMwh - plain.netMwh) < 1e-6);
});

test("a higher hub and a bigger farm produce more; no capacity or no data produces nothing", () => {
  const hist = histogram(Array.from({ length: 8760 }, (_, i) => 3 + (i % 9)));
  assert.ok(windEnergy({ hist, mw: 10, hubM: 140 }).netMwh > windEnergy({ hist, mw: 10, hubM: 90 }).netMwh);
  assert.ok(Math.abs(windEnergy({ hist, mw: 20 }).netMwh - 2 * windEnergy({ hist, mw: 10 }).netMwh) < 1e-6);
  assert.equal(windEnergy({ hist, mw: 0 }).netMwh, 0);
  assert.equal(windEnergy({ hist: null, mw: 10 }).netMwh, 0);
});

test("P90 from a sigma, and the sigma a study's P50 and P90 imply", () => {
  assert.ok(Math.abs(p90From(100, 10) - 87.184) < 1e-9);
  assert.ok(Math.abs(sigmaFrom(100, 87.184) - 10) < 1e-9);
  assert.equal(sigmaFrom(100, 120), null);
  assert.equal(sigmaFrom(0, 50), null);
  assert.equal(BIN, 0.5);
});
