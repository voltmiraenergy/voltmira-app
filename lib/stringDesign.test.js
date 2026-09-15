/**
 * lib/stringDesign.test.js — this is the check that stands between a quote
 * and an inverter an installer actually destroys on site. Wrong in either
 * direction is a real failure: too permissive lets a bad string through, too
 * strict blocks a perfectly buildable system.
 *
 * Run: node --test lib/stringDesign.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stringRange, stringCurrentOk, validateStringDesign, isCompatible,
  compatibleInverters, compatiblePanels, T_HOT_CELL,
} from "./stringDesign.js";
import { T_COLD, T_STC } from "./designCheck.js";

// A plain, well-behaved 435W panel and a mid-size hybrid inverter — the
// reference pair every test starts from unless it's deliberately probing an
// edge.
const PANEL = { voc: 39.6, vmp: 33.2, isc: 13.9, tempCoeff: -0.29 };
const INV = { maxDcV: 800, minMpptV: 150, maxInputCurrentA: 16 };

test("stringRange matches a hand-computed cold-Voc ceiling and hot-Vmpp floor", () => {
  const r = stringRange(PANEL, INV);
  const vocCold = PANEL.voc * (1 + (PANEL.tempCoeff / 100) * (T_COLD - T_STC));
  const vmppHot = PANEL.vmp * (1 + (PANEL.tempCoeff / 100) * (T_HOT_CELL - T_STC));
  assert.ok(Math.abs(r.vocCold - vocCold) < 1e-9);
  assert.ok(Math.abs(r.vmppHot - vmppHot) < 1e-9);
  assert.equal(r.max, Math.floor(INV.maxDcV / vocCold));
  assert.equal(r.min, Math.max(1, Math.ceil(INV.minMpptV / vmppHot)));
  assert.equal(r.possible, r.min <= r.max);
});

test("cold Voc is HIGHER than STC Voc, and hot Vmpp is LOWER than STC Vmp — the physics the whole module rests on", () => {
  const r = stringRange(PANEL, INV);
  assert.ok(r.vocCold > PANEL.voc, "voltage must rise as temperature falls below 25°C");
  assert.ok(r.vmppHot < PANEL.vmp, "voltage must fall as temperature rises above 25°C");
});

test("a normal panel/inverter pair yields a sane, buildable window", () => {
  const r = stringRange(PANEL, INV);
  assert.equal(r.possible, true);
  assert.ok(r.min >= 1 && r.max >= r.min);
  // sanity: this specific pair should land somewhere in the typical
  // residential range, not e.g. "1 to 1" or "40 to 2"
  assert.ok(r.max >= 8 && r.max <= 24, `max=${r.max} looks implausible for 800V/39.6Voc`);
});

test("a panel whose cold Voc alone exceeds the inverter's max DC input is impossible at any length", () => {
  const hugeVoc = { ...PANEL, voc: 900, vmp: 750 };
  const r = stringRange(hugeVoc, INV);
  assert.equal(r.max, 0, "even ONE module already exceeds 800V cold");
  assert.equal(r.possible, false);
});

test("a very low minMpptV against a very high maxDcV still returns a usable range, not an inverted one", () => {
  const r = stringRange(PANEL, { maxDcV: 1000, minMpptV: 60 });
  assert.ok(r.possible);
  assert.ok(r.min <= r.max);
});

test("min is never below 1, even with no minMpptV on file", () => {
  const r = stringRange(PANEL, { maxDcV: 800, minMpptV: 0 });
  assert.equal(r.min, 1);
  assert.equal(r.possible, true);
});

test("missing or zero panel/inverter data returns impossible, not a crash", () => {
  assert.deepEqual(stringRange(null, INV), { min: 0, max: 0, possible: false, vocCold: 0, vmppHot: 0 });
  assert.deepEqual(stringRange(PANEL, null), { min: 0, max: 0, possible: false, vocCold: 0, vmppHot: 0 });
  assert.equal(stringRange({ ...PANEL, voc: 0 }, INV).possible, false);
  assert.equal(stringRange(PANEL, { ...INV, maxDcV: 0 }).possible, false);
});

// ---- current / Isc ------------------------------------------------------

test("current check passes when combined Isc sits under the rated max", () => {
  // 13.9A x 1 string = 13.9A, under 16A
  assert.equal(stringCurrentOk(PANEL, INV, 1), true);
});

test("current check fails once enough parallel strings push Isc over the limit", () => {
  // 13.9A x 2 = 27.8A, over a 16A input
  assert.equal(stringCurrentOk(PANEL, INV, 2), false);
});

test("current check is exact at the boundary — equal to the max passes, a hair over fails", () => {
  const inv = { maxInputCurrentA: 13.9 };
  assert.equal(stringCurrentOk({ isc: 13.9 }, inv, 1), true, "exactly at the limit must pass");
  assert.equal(stringCurrentOk({ isc: 13.91 }, inv, 1), false, "even slightly over must fail");
});

test("no maxInputCurrentA on file means 'unknown', not 'fail' — never invent a failure from a missing spec", () => {
  assert.equal(stringCurrentOk(PANEL, { maxDcV: 800 }, 5), true);
  assert.equal(stringCurrentOk(PANEL, {}, 100), true);
});

test("parallelStrings is clamped to a sane minimum of 1, not 0 or negative", () => {
  assert.equal(stringCurrentOk(PANEL, INV, 0), stringCurrentOk(PANEL, INV, 1));
  assert.equal(stringCurrentOk(PANEL, INV, -3), stringCurrentOk(PANEL, INV, 1));
});

// ---- validateStringDesign -------------------------------------------------

test("a layout inside the voltage window and under the current cap validates ok", () => {
  const r = stringRange(PANEL, INV);
  const midLength = Math.round((r.min + r.max) / 2);
  const v = validateStringDesign({ panel: PANEL, inverter: INV, modulesPerString: midLength, parallelStrings: 1 });
  assert.equal(v.lenOk, true);
  assert.equal(v.currentOk, true);
  assert.equal(v.ok, true);
});

test("a string one module short of the minimum fails length, independent of current", () => {
  const r = stringRange(PANEL, INV);
  const v = validateStringDesign({ panel: PANEL, inverter: INV, modulesPerString: r.min - 1, parallelStrings: 1 });
  assert.equal(v.lenOk, false);
  assert.equal(v.ok, false);
});

test("a string one module past the maximum fails length too", () => {
  const r = stringRange(PANEL, INV);
  const v = validateStringDesign({ panel: PANEL, inverter: INV, modulesPerString: r.max + 1, parallelStrings: 1 });
  assert.equal(v.lenOk, false);
  assert.equal(v.ok, false);
});

test("correct string length but too many parallel strings fails on current alone", () => {
  const r = stringRange(PANEL, INV);
  const mid = Math.round((r.min + r.max) / 2);
  const v = validateStringDesign({ panel: PANEL, inverter: INV, modulesPerString: mid, parallelStrings: 3 });
  assert.equal(v.lenOk, true, "the length itself is fine");
  assert.equal(v.currentOk, false, "3 strings of 13.9A overloads a 16A input");
  assert.equal(v.ok, false, "ok must require BOTH, not just one");
});

test("junk modulesPerString (string, undefined, NaN) never throws and never passes", () => {
  for (const bad of [undefined, null, "x", NaN]) {
    const v = validateStringDesign({ panel: PANEL, inverter: INV, modulesPerString: bad });
    assert.equal(v.lenOk, false, `modulesPerString=${String(bad)} must not validate`);
  }
});

// ---- compatibility lookups -------------------------------------------------

test("isCompatible mirrors stringRange.possible exactly", () => {
  assert.equal(isCompatible(PANEL, INV), stringRange(PANEL, INV).possible);
  const incompatible = { ...PANEL, voc: 900 };
  assert.equal(isCompatible(incompatible, INV), false);
});

test("compatibleInverters only returns inverters this panel can actually be strung to", () => {
  const smallInv = { id: "tiny", maxDcV: 60, minMpptV: 0 }; // no length of a 39.6V-Voc panel fits under 60V... actually 1 module (39.6V*coldfactor) might just fit; use a truly impossible one
  const impossible = { id: "impossible", maxDcV: 30, minMpptV: 0 };
  const fine = { id: "fine", maxDcV: 800, minMpptV: 150, maxInputCurrentA: 16 };
  const rows = compatibleInverters(PANEL, [impossible, fine]);
  assert.deepEqual(rows.map((r) => r.id), ["fine"]);
});

test("compatiblePanels only returns panels this inverter can actually take", () => {
  const tiny = { voc: 5, vmp: 4, isc: 1, tempCoeff: -0.29 }; // trivially fits any real inverter, no upper issue
  const huge = { voc: 900, vmp: 750, isc: 10, tempCoeff: -0.29 };
  const rows = compatiblePanels(INV, [tiny, huge]);
  assert.equal(rows.includes(huge), false, "a 900V-Voc panel must never be called compatible with an 800V inverter");
});

test("omitting the catalog arg falls back to the REAL shipped catalog, not an empty list", () => {
  // `panels = PANELS` is a default parameter: it only fires on undefined, and
  // it's there so callers don't have to import and pass the catalog by hand.
  const rows = compatiblePanels(INV); // no second arg at all
  assert.ok(rows.length > 0, "omitting the arg must use the real catalog, which has compatible panels");
});

test("an explicitly non-array catalog (null, a string, an object) degrades to empty, never throws", () => {
  assert.deepEqual(compatibleInverters(PANEL, null), []);
  assert.deepEqual(compatiblePanels(INV, "not an array"), []);
  assert.deepEqual(compatiblePanels(INV, {}), []);
  assert.doesNotThrow(() => compatibleInverters(null, [INV]));
});

test("the real catalog: at least one panel/inverter pair is compatible (a basic sanity check on the shipped data)", async () => {
  const { PANELS, INVERTERS } = await import("./supplierCatalog.js");
  const anyMatch = PANELS.some((p) => compatibleInverters(p, INVERTERS).length > 0);
  assert.ok(anyMatch, "the shipped catalog must not be entirely mutually incompatible");
});
