import { test } from "node:test";
import assert from "node:assert/strict";
import { RO_URBAN_LOAD_SHAPE, hourlyLoadShape } from "./residentialLoadProfile.js";

test("every real DEER shape has 24 hours and sums to 1 (real published weights, not invented)", () => {
  for (const key of ["ZL_SR", "ZNL_SR", "ZL_SC", "ZNL_SC"]) {
    const arr = RO_URBAN_LOAD_SHAPE[key];
    assert.equal(arr.length, 24, key);
    const sum = arr.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6, `${key} sum=${sum}`);
    for (const v of arr) assert.ok(v > 0, key);
  }
});

test("every shape peaks in the real evening window (18:00-20:00), not at some other hour", () => {
  for (const key of ["ZL_SR", "ZNL_SR", "ZL_SC", "ZNL_SC"]) {
    const arr = RO_URBAN_LOAD_SHAPE[key];
    const peakHour = arr.indexOf(Math.max(...arr));
    assert.ok(peakHour >= 17 && peakHour <= 20, `${key} peak at hour ${peakHour}`);
  }
});

test("every shape troughs overnight (02:00-05:00)", () => {
  for (const key of ["ZL_SR", "ZNL_SR", "ZL_SC", "ZNL_SC"]) {
    const arr = RO_URBAN_LOAD_SHAPE[key];
    const minHour = arr.indexOf(Math.min(...arr));
    assert.ok(minHour >= 1 && minHour <= 5, `${key} trough at hour ${minHour}`);
  }
});

test("hourlyLoadShape picks cold season for Oct-Mar, warm for Apr-Sep", () => {
  assert.equal(hourlyLoadShape(0, true), RO_URBAN_LOAD_SHAPE.ZL_SR);  // Jan
  assert.equal(hourlyLoadShape(9, true), RO_URBAN_LOAD_SHAPE.ZL_SR);  // Oct
  assert.equal(hourlyLoadShape(6, true), RO_URBAN_LOAD_SHAPE.ZL_SC);  // Jul
  assert.equal(hourlyLoadShape(3, true), RO_URBAN_LOAD_SHAPE.ZL_SC);  // Apr
});

test("hourlyLoadShape picks the non-working column when told it's a non-working day", () => {
  assert.equal(hourlyLoadShape(0, false), RO_URBAN_LOAD_SHAPE.ZNL_SR);
  assert.equal(hourlyLoadShape(6, false), RO_URBAN_LOAD_SHAPE.ZNL_SC);
});

test("hourlyLoadShape defaults to a working day and a real shape on invalid month input", () => {
  const s = hourlyLoadShape(NaN);
  assert.equal(s, RO_URBAN_LOAD_SHAPE.ZL_SR);
});
