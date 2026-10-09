import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEquipment, totalsOf, designAngles, inverterMw, moduleMwp, catalogueConflicts, DEFAULT_ANGLES } from "./equipment.js";
import { normalizePlant } from "./plantFinance.js";
import { solarExport } from "./clipping.js";
import { normalizeClimate, climateDriftKm } from "./siteClimate.js";

const base = (eq, extra = {}) => ({ id: "p", name: "P", solar: { mwp: 10, yieldKwhKwp: 1300 }, equipment: eq, ...extra });

test("nothing entered is nothing stored, and a part with only blanks is dropped", () => {
  assert.equal(normalizeEquipment(null), null);
  assert.equal(normalizeEquipment({}), null);
  assert.equal(normalizeEquipment({ modules: { maker: "", model: "", count: "", wp: 0 }, inverters: {}, mounting: { kind: "fixed" } }), null);
  const e = normalizeEquipment({ modules: { maker: " ABB ", model: "CS3W", count: "23420", wp: "440" }, inverters: { maker: "", count: "" } });
  assert.equal(e.modules.maker, "ABB"); assert.equal(e.modules.count, 23420); assert.equal(e.modules.wp, 440);
  assert.equal(e.inverters, null);
});

test("numbers are kept in range: negatives and nonsense become zero, angles and loads are clamped, blanks stay blank", () => {
  const e = normalizeEquipment({ modules: { count: -5, wp: "x", maker: "M", productYears: 99 }, mounting: { kind: "tracker", tiltDeg: 120, azimuthDeg: "" }, design: { windMs: 250, snowKnM2: "", tMinC: -90, standard: " CR " } });
  assert.equal(e.modules.count, 0); assert.equal(e.modules.wp, 0); assert.equal(e.modules.productYears, 50);
  assert.equal(e.mounting.kind, "tracker"); assert.equal(e.mounting.tiltDeg, 90); assert.equal(e.mounting.azimuthDeg, null);
  assert.equal(e.design.windMs, 100); assert.equal(e.design.snowKnM2, null); assert.equal(e.design.tMinC, -60); assert.equal(e.design.standard, "CR");
});

test("a flat tilt of zero and a south azimuth of zero are entries, not blanks", () => {
  const e = normalizeEquipment({ mounting: { kind: "fixed", tiltDeg: 0, azimuthDeg: 0 } });
  assert.equal(e.mounting.tiltDeg, 0); assert.equal(e.mounting.azimuthDeg, 0);
  assert.deepEqual(designAngles(normalizePlant(base({ mounting: { kind: "fixed", tiltDeg: 0, azimuthDeg: 0 } }))), { tilt: 0, azimuth: 0 });
});

test("the totals: count times unit rating, against what the plant declares", () => {
  const pl = normalizePlant(base({ modules: { maker: "A", model: "B", count: 23420, wp: 440 }, inverters: { count: 26, kw: 330 }, transformers: { count: 2, mva: 5 } }, { solar: { mwp: 10.3048, yieldKwhKwp: 1300, acMw: 8.58 } }));
  assert.ok(Math.abs(moduleMwp(pl.equipment) - 10.30480) < 1e-9);
  assert.equal(inverterMw(pl.equipment), 8.58);
  const t = Object.fromEntries(totalsOf(pl).map((x) => [x.id, x]));
  assert.ok(Math.abs(t.modules.gapPct) < 1e-6); assert.ok(Math.abs(t.inverters.gapPct) < 1e-6);
  assert.equal(t.transformers.total, 10); assert.equal(t.transformers.declared, 8.58);
  // a count without a unit rating gives no total
  assert.deepEqual(totalsOf(normalizePlant(base({ modules: { maker: "A", count: 100 } }))), []);
});

test("the angles PVGIS is asked for: the design's fixed angles, else 35 degrees south; a tracker has none", () => {
  assert.deepEqual(designAngles(normalizePlant(base(null))), DEFAULT_ANGLES);
  assert.deepEqual(designAngles(normalizePlant(base({ mounting: { kind: "fixed", tiltDeg: 20, azimuthDeg: -10 } }))), { tilt: 20, azimuth: -10 });
  assert.deepEqual(designAngles(normalizePlant(base({ mounting: { kind: "fixed", tiltDeg: 20 } }))), DEFAULT_ANGLES, "an azimuth is needed too");
  assert.deepEqual(designAngles(normalizePlant(base({ mounting: { kind: "tracker" } }))), DEFAULT_ANGLES);
});

test("the inverter total stands in for an AC rating that is not typed", () => {
  const pl = normalizePlant(base({ inverters: { count: 20, kw: 400 } }));
  const ex = solarExport(pl);
  assert.equal(ex.acMw, 8); assert.equal(ex.dcAc, 1.25);
  // a typed rating wins
  assert.equal(solarExport(normalizePlant(base({ inverters: { count: 20, kw: 400 } }, { solar: { mwp: 10, yieldKwhKwp: 1300, acMw: 9 } }))).acMw, 9);
});

test("a catalogue model at another rating is a conflict; the catalogue's own rating and an unknown model are not", () => {
  const hit = (wp, model = "Hi-MO 6 Explorer LR5-54HTH") => catalogueConflicts(normalizeEquipment({ modules: { maker: "LONGi", model, count: 1000, wp } }));
  assert.deepEqual(hit(400), [{ part: "modules", entered: 400, catalogue: 435, unit: "Wp" }]);
  assert.deepEqual(hit(435), []);
  assert.deepEqual(hit(400, "Made-up 9000"), []);
  assert.deepEqual(catalogueConflicts(normalizeEquipment({ inverters: { maker: "Huawei", model: "SUN2000-100KTL-M2", count: 4, kw: 100 } })), []);
  assert.equal(catalogueConflicts(normalizeEquipment({ inverters: { maker: "Huawei", model: "SUN2000-100KTL-M2", count: 4, kw: 330 } }))[0].catalogue, 100);
});

test("the climate is kept only when it is plausible, and flagged when the site has moved", () => {
  assert.equal(normalizeClimate(null), null);
  assert.equal(normalizeClimate({ tMinC: -200, tMaxC: 500, wind10MaxMs: 900 }), null, "every figure out of range");
  const c = normalizeClimate({ at: { lat: 46, lon: 28.5 }, fetched: "2026-10-09", elevationM: 198.4, horizon: [1.1, "x", 2], tMinC: -24.6, tMaxC: 41.2, snowDepthMaxCm: 30, period: "2001-2020", db: "NASA POWER (MERRA-2)" });
  assert.equal(c.elevationM, 198.4); assert.deepEqual(c.horizon, [1.1, 2]); assert.equal(c.fetched, "2026-10-09");
  assert.equal(climateDriftKm(normalizePlant({ ...base(null), lat: 46.001, lon: 28.5, climate: c })), null, "a hundred metres is the same place");
  assert.ok(climateDriftKm(normalizePlant({ ...base(null), lat: 46.3, lon: 28.5, climate: c })) > 30);
  assert.equal(climateDriftKm(normalizePlant({ ...base(null), lat: 46, lon: 28.5 })), null, "no climate, nothing to compare");
});
