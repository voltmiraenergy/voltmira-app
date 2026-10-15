/**
 * lib/kitTiers.test.js — the 4 fixed-size "Recommended Kits", each just
 * autoBom() at a fixed (kw, battKwh) totaled with bomTotal(). Mostly a sanity
 * net: these tiers were hand-picked to land in a size window the shipped
 * catalog's recommendInverter() can actually serve well — this is what
 * catches it if the catalog ever changes underneath them.
 * Run: node --test lib/kitTiers.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { KIT_TIERS, buildKit, recommendedKits } from "./kitTiers.js";
import { bomTotal } from "./quoteAnalysis.js";

test("every tier has a unique id and a positive kw", () => {
  const ids = KIT_TIERS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of KIT_TIERS) assert.ok(t.kw > 0);
});

test("buildKit returns a non-empty BOM with a panel and an inverter line for every tier", () => {
  for (const tier of KIT_TIERS) {
    const kit = buildKit(tier);
    assert.ok(Array.isArray(kit.bom) && kit.bom.length > 0, `${tier.id} must have a BOM`);
    assert.ok(kit.bom.some((l) => l.kind === "panel"), `${tier.id} must include a panel line`);
    assert.ok(kit.bom.some((l) => l.kind === "inverter"), `${tier.id} must include an inverter line`);
    assert.ok(kit.bom.every((l) => (Number(l.qty) || 0) > 0), `${tier.id}: every line must have a positive quantity`);
  }
});

test("a tier with battKwh > 0 gets a battery line; a tier with battKwh 0 does not", () => {
  const withBatt = buildKit({ id: "x", kw: 8, battKwh: 10 });
  assert.ok(withBatt.bom.some((l) => l.kind === "battery"));
  const noBatt = buildKit({ id: "y", kw: 6, battKwh: 0 });
  assert.ok(!noBatt.bom.some((l) => l.kind === "battery"));
});

test("total is exactly bomTotal() of the kit's own BOM — no separate pricing logic to drift", () => {
  for (const tier of KIT_TIERS) {
    const kit = buildKit(tier);
    assert.equal(kit.total, bomTotal(kit.bom));
    assert.ok(kit.total > 0, `${tier.id} must price out to something positive`);
  }
});

test("buildKit is pure: the same tier always yields the same BOM and total", () => {
  const a = buildKit({ id: "z", kw: 6, battKwh: 0 });
  const b = buildKit({ id: "z", kw: 6, battKwh: 0 });
  assert.deepEqual(a.bom, b.bom);
  assert.equal(a.total, b.total);
});

test("recommendedKits() returns one sized kit per tier, in order", () => {
  const kits = recommendedKits();
  assert.equal(kits.length, KIT_TIERS.length);
  assert.deepEqual(kits.map((k) => k.id), KIT_TIERS.map((t) => t.id));
});

test("every shipped tier keeps recommendInverter() inside a sane DC/AC ratio — a kit shouldn't showcase a degenerate size", () => {
  for (const tier of KIT_TIERS) {
    const kit = buildKit(tier);
    const invLine = kit.bom.find((l) => l.kind === "inverter");
    const invKwMatch = invLine.spec.match(/^([\d.]+)\s*kW/);
    const invKw = Number(invKwMatch[1]);
    const dcac = tier.kw / invKw;
    assert.ok(dcac >= 0.5 && dcac <= 1.5, `${tier.id}: DC/AC ratio ${dcac.toFixed(2)} is out of a sane range`);
  }
});
