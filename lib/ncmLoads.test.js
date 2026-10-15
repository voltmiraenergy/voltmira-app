/**
 * lib/ncmLoads.test.js — real Eurocode EN 1991-1-3/1-4 formulas. Reference
 * values are hand-computed from the documented expressions, not re-derived
 * by calling the functions under test.
 *
 * Run: node --test lib/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { snowShapeCoeff, snowLoad, windPeakPressure, windLoad, TERRAIN_CATEGORIES, FLAT_ROOF_CPE_ZONES, MD_WIND_ZONES_MPS, MD_SNOW_EXAMPLE } from "./ncmLoads.js";

test("snowShapeCoeff: flat/normal pitch up to 30° is the full 0.8, tapering to 0 at 60°", () => {
  assert.equal(snowShapeCoeff(0), 0.8);
  assert.equal(snowShapeCoeff(30), 0.8);
  assert.ok(Math.abs(snowShapeCoeff(45) - 0.4) < 1e-9); // 0.8 * (60-45)/30 = 0.4
  assert.equal(snowShapeCoeff(60), 0);
  assert.equal(snowShapeCoeff(75), 0);
  assert.equal(snowShapeCoeff(-10), 0.8); // clamped, never negative pitch
});

test("snowLoad: hand-computed case (sk=1.5, pitch=35°) matches exactly", () => {
  // mu1 = 0.8 * (60-35)/30 = 0.66666...; s = mu1 * 1 * 1 * 1.5 = 1.0 exactly
  const s = snowLoad({ sk: 1.5, pitchDeg: 35 });
  assert.ok(Math.abs(s - 1.0) < 1e-9, `s=${s}`);
});

test("snowLoad: ce/ct scale the result linearly", () => {
  const base = snowLoad({ sk: 2, pitchDeg: 20 }); // mu1=0.8 -> s=1.6
  const exposed = snowLoad({ sk: 2, pitchDeg: 20, ce: 0.8 });
  const sheltered = snowLoad({ sk: 2, pitchDeg: 20, ce: 1.2 });
  assert.ok(Math.abs(exposed - base * 0.8) < 1e-9);
  assert.ok(Math.abs(sheltered - base * 1.2) < 1e-9);
});

test("snowLoad returns null, not zero, for an unset/non-positive sk — never a fabricated load", () => {
  assert.equal(snowLoad({ sk: 0, pitchDeg: 30 }), null);
  assert.equal(snowLoad({ sk: -1, pitchDeg: 30 }), null);
  assert.equal(snowLoad({ pitchDeg: 30 }), null);
});

test("windPeakPressure: hand-computed case (terrain II, z=10m, vb0=22 m/s)", () => {
  // kr = 0.19*(0.05/0.05)^0.07 = 0.19
  // cr(10) = 0.19 * ln(10/0.05) = 0.19 * ln(200) = 0.19 * 5.298317... = 1.006680...
  // vm = cr * 22 = 22.14696...
  // Iv(10) = 1 / ln(200) = 0.188735...
  // qp = (1 + 7*Iv) * 0.5 * 1.25 * vm^2, in Pa, /1000 for kN/m²
  const kr = 0.19;
  const cr = kr * Math.log(10 / 0.05);
  const vm = cr * 22;
  const Iv = 1 / Math.log(10 / 0.05);
  const expectedKNm2 = ((1 + 7 * Iv) * 0.5 * 1.25 * vm * vm) / 1000;
  const qp = windPeakPressure({ vb0: 22, height: 10, terrainCategory: "II" });
  assert.ok(Math.abs(qp - expectedKNm2) < 1e-9, `qp=${qp} expected=${expectedKNm2}`);
  assert.ok(qp > 0.6 && qp < 0.8, `sanity range: qp=${qp}`); // ~0.71 kN/m², a plausible mid-rise value
});

test("windPeakPressure: a rougher terrain category (more sheltered) gives a LOWER pressure at the same height/speed", () => {
  const open = windPeakPressure({ vb0: 22, height: 10, terrainCategory: "II" });
  const urban = windPeakPressure({ vb0: 22, height: 10, terrainCategory: "IV" });
  assert.ok(urban < open, `urban ${urban} should be lower than open ${open}`);
});

test("windPeakPressure: height is clamped to each terrain's zmin, never computed below it", () => {
  const atZmin = windPeakPressure({ vb0: 22, height: 2, terrainCategory: "II" }); // zmin=2 for II
  const belowZmin = windPeakPressure({ vb0: 22, height: 0.5, terrainCategory: "II" });
  assert.ok(Math.abs(atZmin - belowZmin) < 1e-9);
});

test("windLoad multiplies the peak pressure by cpe, and can be negative (suction)", () => {
  const qp = windPeakPressure({ vb0: 22, height: 10, terrainCategory: "II" });
  const pressure = windLoad({ vb0: 22, height: 10, terrainCategory: "II", cpe: 0.2 });
  const suction = windLoad({ vb0: 22, height: 10, terrainCategory: "II", cpe: -1.2 });
  assert.ok(Math.abs(pressure - qp * 0.2) < 1e-9);
  assert.ok(Math.abs(suction - qp * -1.2) < 1e-9);
  assert.ok(suction < 0);
});

test("wind/snow functions return null, not NaN or a crash, on missing/zero vb0 or cpe", () => {
  assert.equal(windPeakPressure({ vb0: 0, height: 10, terrainCategory: "II" }), null);
  assert.equal(windLoad({ vb0: 22, height: 10, terrainCategory: "II", cpe: 0 }), null);
  assert.equal(windLoad({ vb0: 0, height: 10, terrainCategory: "II", cpe: 0.2 }), null);
});

test("FLAT_ROOF_CPE_ZONES matches EN 1991-1-4 Table 7.2's real flat-roof values, worst zone first", () => {
  assert.equal(FLAT_ROOF_CPE_ZONES.F.cpe, -1.8);
  assert.equal(FLAT_ROOF_CPE_ZONES.G.cpe, -1.2);
  assert.equal(FLAT_ROOF_CPE_ZONES.H.cpe, -0.7);
  assert.equal(FLAT_ROOF_CPE_ZONES.I.cpe, 0.2);
  // F (corner) is the worst suction, tapering inward toward the field.
  assert.ok(FLAT_ROOF_CPE_ZONES.F.cpe < FLAT_ROOF_CPE_ZONES.G.cpe);
  assert.ok(FLAT_ROOF_CPE_ZONES.G.cpe < FLAT_ROOF_CPE_ZONES.H.cpe);
  assert.ok(FLAT_ROOF_CPE_ZONES.H.cpe < FLAT_ROOF_CPE_ZONES.I.cpe);
  for (const key of ["F", "G", "H", "I"]) {
    const z = FLAT_ROOF_CPE_ZONES[key];
    assert.ok(z.label.ro && z.label.en && z.label.ru, key);
  }
});

test("MD_WIND_ZONES_MPS holds the National Annex's real 5 default base wind velocities, ascending", () => {
  assert.deepEqual(MD_WIND_ZONES_MPS, [22.5, 25.0, 27.5, 30.0, 36.0]);
  for (let i = 1; i < MD_WIND_ZONES_MPS.length; i++) assert.ok(MD_WIND_ZONES_MPS[i] > MD_WIND_ZONES_MPS[i - 1]);
});

test("MD_SNOW_EXAMPLE is the one real documented worked-example value, labeled as an example not a zone table", () => {
  assert.equal(MD_SNOW_EXAMPLE.skKNm2, 0.7);
  assert.ok(MD_SNOW_EXAMPLE.site.ro && MD_SNOW_EXAMPLE.site.en && MD_SNOW_EXAMPLE.site.ru);
  // Sanity: feeding it through the real snowLoad formula at a typical 35° pitch
  // gives a plausible, non-crazy residential design value.
  const s = snowLoad({ sk: MD_SNOW_EXAMPLE.skKNm2, pitchDeg: 35 });
  assert.ok(s > 0 && s < 1, `s=${s}`);
});

test("every terrain category has a real z0/zmin/label", () => {
  for (const key of ["0", "I", "II", "III", "IV"]) {
    const t = TERRAIN_CATEGORIES[key];
    assert.ok(t.z0 > 0, key);
    assert.ok(t.zmin > 0, key);
    assert.ok(t.label.ro && t.label.en && t.label.ru, key);
  }
});
