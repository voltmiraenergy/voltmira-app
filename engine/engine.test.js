/**
 * Engine test suite. Reference values are computed BY HAND in the comments,
 * not by running the engine — so a regression in the engine cannot silently
 * update its own expectations.
 *
 * Run: node --test engine/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  simulate, quote, effectiveConsumption,
  defaultEngineSettings, formatMoney, FX,
} from "./engine.js";

const E = defaultEngineSettings();

const BASE = {
  kw: 6, price: 0.21, cons: 5000,
  batt: false, useMonthly: false,
  afmSubsidy: false, market: "RO",
};

/* ------------------------------------------------------------------ *
 * Wind formula — exact spec numbers
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 * Base solar case — every intermediate verified by hand:
 *   cost   = 6 * 1050 = 6300
 *   solar0 = 6 * 1100 * 1.0 = 6600
 *   baseSelf = min(.85, max(.2, (5000/6600)*.55)) = 0.416666…
 *   year1: selfK = 6600*0.41666 = 2750, expK = 3850
 *          imports = 5000-2750 = 2250 → credited 2250, residual 1600
 *          val = 2750*.21 + 2250*.21 + 1600*.036 = 577.5+472.5+57.6 = 1107.6
 *          opex = 6300*0.005 = 31.5 → net year1 = 1076.1
 * ------------------------------------------------------------------ */
test("base case: cost, production, year-1 savings match hand calculation", () => {
  const r = simulate(BASE, E, "expc");
  assert.equal(r.cost, 6300);
  assert.equal(r.prod0, 6600);
  assert.ok(Math.abs(r.year1 - 1076.1) < 0.05, `year1=${r.year1}`);
  assert.ok(Math.abs(r.self - 5000 / 6600 * 0.55) < 1e-9);
});

test("base case: payback lands between 5 and 6 years (savings grow with 3% inflation)", () => {
  const r = simulate(BASE, E, "expc");
  assert.ok(r.payback > 5 && r.payback < 6, `payback=${r.payback}`);
});

test("bands are ordered: pessimistic ≥ expected ≥ optimistic payback", () => {
  const q = quote(BASE, E);
  assert.ok(q.p.payback >= q.e.payback);
  assert.ok(q.e.payback >= q.o.payback);
});

test("rows length equals horizon and is cumulative-increasing after year 1", () => {
  const r = simulate(BASE, E, "expc");
  assert.equal(r.rows.length, E.horizon);
  for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i] > r.rows[i - 1]);
});

/* ------------------------------------------------------------------ *
 * Battery
 * ------------------------------------------------------------------ */
test("battery: default 10 kWh adds capacity × €/kWh to cost, and lifts self-consumption", () => {
  const noB = simulate({ ...BASE, batt: false }, E, "expc");
  const r = simulate({ ...BASE, batt: true }, E, "expc"); // defaults to 10 kWh
  assert.equal(r.cost, 6300 + 10 * E.batteryCostPerKwh);
  assert.ok(r.self > noB.self, "battery must raise self-consumption");
});

/* ------------------------------------------------------------------ *
 * Wind hybrid: cost = 6300 + 3*2500 = 13800; prod0 = 6600 + 3153.6
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 * Markets: MD net-billing must value exports far lower than RO 1:1.
 * ------------------------------------------------------------------ */
test("markets: year-1 savings RO 1:1 > MD net-billing for identical system", () => {
  // At the same price, RO's 1:1 net metering credits exports at retail while
  // MD's net billing pays the low feed rate — so RO must save more.
  const ro = simulate({ ...BASE, market: "RO" }, E, "expc").year1;
  const md = simulate({ ...BASE, market: "MD" }, E, "expc").year1;
  assert.ok(ro > md, `RO ${ro} vs MD ${md}`);
});

test("markets: RO 1:1 credit is capped at what the household imports", () => {
  // Oversized system: 15kW → solar0 = 16500, selfK small share, exports huge.
  // Credit cannot exceed imports (cons - selfK), rest paid at 0.036.
  const r = simulate({ ...BASE, kw: 15 }, E, "expc");
  // Hand: solar0=16500, baseSelf=max(.2, (5000/16500)*.55)=0.2 (floor)
  // selfK=3300, expK=13200, imports=1700, credited=1700, residual=11500
  // val = 3300*.21 + 1700*.21 + 11500*.036 = 693+357+414 = 1464
  // opex = 15750*.005 = 78.75 → year1 = 1385.25
  assert.ok(Math.abs(r.year1 - 1385.25) < 0.05, `year1=${r.year1}`);
});

/* ------------------------------------------------------------------ *
 * AFM subsidy
 * ------------------------------------------------------------------ */
test("defaults: quoteValidityDays is 30", () => {
  assert.equal(defaultEngineSettings().quoteValidityDays, 30);
});

test("subsidy: reduces cost by subsidyAmountRon/4.97", () => {
  const r = simulate({ ...BASE, afmSubsidy: true }, E, "expc");
  const expected = 6300 - 20000 / FX.RON; // 6300 - 4024.14 = 2275.86
  assert.ok(Math.abs(r.cost - expected) < 0.01, `cost=${r.cost}`);
});

test("subsidy: caps cost at 0 and payback is immediate", () => {
  const r = simulate(
    { ...BASE, kw: 2, afmSubsidy: true },
    { ...E, subsidyAmountRon: 100000 },
    "expc"
  );
  assert.equal(r.cost, 0);
  assert.equal(r.payback, 0);
  assert.equal(r.immediate, true);
});

/* ------------------------------------------------------------------ *
 * Monthly profiling
 * ------------------------------------------------------------------ */
test("monthly: effectiveConsumption sums the 12 values, overriding cons", () => {
  const p = { ...BASE, useMonthly: true, consMonthly: Array(12).fill(400) };
  assert.equal(effectiveConsumption(p), 4800);
});

test("monthly: flat profile ≈ annual formula; winter-heavy profile lowers self-consumption", () => {
  const flat = simulate({ ...BASE, useMonthly: true, consMonthly: Array(12).fill(5000 / 12) }, E, "expc");
  // Heavy winter use (heating) when solar is weak → less self-consumed
  const winter = simulate({
    ...BASE, useMonthly: true,
    consMonthly: [900, 800, 500, 300, 150, 100, 100, 150, 300, 500, 800, 900], // 5500 total, winter-skewed
  }, E, "expc");
  assert.ok(winter.self < flat.self, `winter ${winter.self} vs flat ${flat.self}`);
});

/* ------------------------------------------------------------------ *
 * PVGIS override
 * ------------------------------------------------------------------ */
test("yieldOverride replaces baseYield exactly", () => {
  const r = simulate({ ...BASE, yieldOverride: 1287 }, E, "expc");
  assert.equal(r.prod0, 6 * 1287);
});

/* ------------------------------------------------------------------ *
 * Currency display
 * ------------------------------------------------------------------ */
test("formatMoney: EUR / RON / MDL per spec rates", () => {
  assert.equal(formatMoney(1000, "EUR"), "\u20AC1,000");
  assert.equal(formatMoney(1000, "RON"), "lei " + (4970).toLocaleString("ro-RO"));
  assert.equal(formatMoney(1000, "MDL"), "lei " + (19800).toLocaleString("ro-MD"));
});

/* ------------------------------------------------------------------ *
 * Determinism: same inputs → identical outputs (no hidden state)
 * ------------------------------------------------------------------ */
test("engine is pure: repeated calls give identical results", () => {
  const a = JSON.stringify(simulate(BASE, E, "expc"));
  const b = JSON.stringify(simulate(BASE, E, "expc"));
  assert.equal(a, b);
});

/* ------------------------------------------------------------------ *
 * Launch-audit regression tests (2026-07-25). Each locks in a fix.
 * ------------------------------------------------------------------ */

test("self-consumption never exceeds consumption (oversized system)", () => {
  // 20 kW on a 1000 kWh/yr client: solar0 = 20*1100 = 22000. Uncapped selfRatio
  // would credit 0.20*22000 = 4400 kWh at retail; must be capped at 1000.
  const r = simulate({ ...BASE, kw: 20, cons: 1000 }, E, "expc");
  const selfK = r.solar0 * r.self;
  assert.ok(selfK <= 1000 + 1e-9, `selfK ${selfK} must not exceed cons 1000`);
});

test("both paths agree exactly when consumption is the binding cap", () => {
  // Deliberately oversized (22 MWh produced against 1.2 MWh used): both paths are
  // clamped to consumption, so this proves the CAP agrees — not the formulas.
  // The formulas themselves are compared in the next test.
  const p = { ...BASE, kw: 20, cons: 1200 };
  const annual = simulate(p, E, "expc");
  const monthly = simulate({ ...p, useMonthly: true, consMonthly: Array(12).fill(100) }, E, "expc");
  assert.ok(Math.abs(annual.self - monthly.self) < 1e-9,
    `annual self ${annual.self} vs monthly ${monthly.self}`);
});

test("KNOWN GAP: on a normal system a flat monthly profile ≠ the annual formula", () => {
  // Documents real current behaviour rather than hiding it. The annual path takes
  // min(0.85, max(0.2, cons/prod * 0.55)) once; the monthly path applies that same
  // clamped expression twelve times against a seasonal production curve. Because
  // the expression is non-linear, the twelve monthly answers do not average back to
  // the annual one (Jensen), so switching the monthly toggle ON with a perfectly
  // flat profile shifts the numbers by a few percent.
  //
  // The monthly path is the more physically honest of the two (summer surplus
  // genuinely cannot be self-consumed), so it reads LOWER. Unifying on it would
  // move every existing quote, which is why it is recorded here rather than
  // silently changed.
  //
  // MD (net billing) on purpose: only there does the self-consumption ratio carry
  // money. Under RO's 1:1 netting a self-consumed and an exported kWh are worth
  // the same, so the same divergence in `self` produces no divergence in savings.
  const MD = { ...BASE, market: "MD", price: 0.18 };
  const flat = simulate({ ...MD, cons: 6000 }, E, "expc");
  const even = simulate({ ...MD, cons: 6000, useMonthly: true, consMonthly: Array(12).fill(500) }, E, "expc");
  const gap = Math.abs(flat.year1 - even.year1) / flat.year1;
  assert.ok(even.year1 < flat.year1, "the monthly path should be the more conservative one");
  assert.ok(gap > 0.005 && gap < 0.05,
    `expected a small known divergence, got ${(gap * 100).toFixed(2)}% (flat €${flat.year1.toFixed(0)} vs monthly €${even.year1.toFixed(0)})`);
});

test("zero consumption yields zero self-consumption (no phantom savings)", () => {
  const r = simulate({ ...BASE, cons: 0 }, E, "expc");
  assert.equal(r.self, 0);
});

test("O&M inflates at the band rate (payback longer than a flat-O&M rebuild)", () => {
  // With infl=3%, inflated O&M costs more over time than flat O&M, so cumulative
  // savings are lower and payback strictly later than the old flat-O&M behaviour.
  const r = simulate(BASE, E, "expc");
  const b = E.bands.expc;
  const opex0 = BASE.kw * E.costPerKw * (E.opexPct / 100);
  // rebuild total with FLAT opex; its payback must be earlier (smaller) than r.payback
  let cum = -r.cost, flatPayback = null;
  for (let y = 1; y <= E.horizon; y++) {
    const prod = r.solar0 * Math.pow(1 - b.degr / 100, y - 1);
    const priceY = BASE.price * Math.pow(1 + b.infl / 100, y - 1);
    const selfK = Math.min(prod * (r.self), BASE.cons);
    const expK = prod - selfK;
    const imports = Math.max(0, BASE.cons - selfK);
    const credited = Math.min(expK, imports);
    const val = selfK * priceY + credited * priceY + (expK - credited) * 0.036;
    const prev = cum; cum += val - opex0;
    if (flatPayback === null && cum >= 0) flatPayback = (y - 1) + (0 - prev) / (cum - prev);
  }
  assert.ok(r.payback > flatPayback, `inflated payback ${r.payback} should exceed flat ${flatPayback}`);
});

test("garbage inputs never leak NaN into the result", () => {
  const cases = [
    { ...BASE, kw: NaN },
    { ...BASE, price: undefined },
    { ...BASE, cons: null },
    { ...BASE, kw: -5 },
    { ...BASE, price: -0.2 },
    { ...BASE, market: "XX" },
  ];
  for (const p of cases) {
    const r = simulate(p, E, "expc");
    for (const k of ["cost", "year1", "self", "solar0"]) {
      assert.ok(Number.isFinite(r[k]), `${k} is ${r[k]} for input ${JSON.stringify(p.kw ?? p.price ?? p.cons)}`);
    }
    // payback and roi are deliberately nullable: no break-even inside the horizon,
    // and no outlay to earn a return on. Anything else must be a finite number.
    if (r.payback !== null) assert.ok(Number.isFinite(r.payback));
    if (r.roi !== null) assert.ok(Number.isFinite(r.roi), `roi is ${r.roi}`);
  }
});

test("roi is null (not a 999 sentinel) when a grant covers the whole system", () => {
  const r = simulate({ ...BASE, kw: 1, market: "RO", afmSubsidy: true }, E, "expc");
  assert.equal(r.cost, 0);
  assert.equal(r.roi, null);        // 999 used to render as a literal "ROI 999%"
  assert.equal(r.payback, 0);
  assert.equal(r.immediate, true);
});

test("negative system size is clamped to zero, not treated as a discount", () => {
  const r = simulate({ ...BASE, kw: -6 }, E, "expc");
  assert.equal(r.cost, 0);           // no negative cost
  assert.equal(r.solar0, 0);         // no negative production
});

test("battery: cost and self-consumption scale with capacity, then payback worsens when oversized", () => {
  const P = (kwh) => ({ ...BASE, market: "MD", price: 0.14, batt: kwh > 0, battKwh: kwh });
  const b0 = simulate(P(0), E, "expc");
  const b5 = simulate(P(5), E, "expc");
  const b10 = simulate(P(10), E, "expc");
  const b20 = simulate(P(20), E, "expc");
  // cost scales linearly with kWh (€/kWh)
  assert.ok(b5.cost < b10.cost && b10.cost < b20.cost, "battery cost must scale with kWh");
  assert.equal(Math.round(b10.cost - b0.cost), 10 * E.batteryCostPerKwh);
  // self-consumption rises with capacity but saturates (can't shift more than evening use)
  assert.ok(b5.self < b10.self, "more capacity → more self-consumption (until saturated)");
  assert.ok(Math.abs(b20.self - b10.self) < 0.03, "self-consumption saturates past evening usage");
  // an oversized battery adds cost with no extra benefit → strictly worse payback
  assert.ok(b20.payback > b10.payback, "oversized battery must lengthen payback");
});

test("battery: legacy batt=true with no capacity falls back to 10 kWh", () => {
  const legacy = simulate({ ...BASE, batt: true }, E, "expc");
  const explicit = simulate({ ...BASE, batt: true, battKwh: 10 }, E, "expc");
  assert.equal(legacy.cost, explicit.cost);
  assert.ok(Math.abs(legacy.self - explicit.self) < 1e-9);
});

test("costOverride: a BOM total replaces the kW x rate estimate", () => {
  const base = simulate({ ...BASE }, E, "expc");
  const over = simulate({ ...BASE, costOverride: 9999 }, E, "expc");
  assert.equal(over.cost, 9999);                                // override wins
  assert.notEqual(base.cost, 9999);
  // zero / missing override falls back to the estimate (backward compatible)
  assert.equal(simulate({ ...BASE, costOverride: 0 }, E, "expc").cost,
               simulate({ ...BASE }, E, "expc").cost);
});

test("costOverride + battery: the BOM only covers the battery if it prices one", () => {
  // A BOM that DOES contain a battery line already includes its cost.
  const priced = simulate({ ...BASE, batt: true, battKwh: 10, costOverride: 9999, bomHasBattery: true }, E, "expc");
  assert.equal(priced.cost, 9999);

  // A BOM of panels + inverter with the battery toggle ON must still be charged
  // for the battery. Otherwise the client is quoted the battery's extra
  // self-consumption for free and the payback comes out years too short.
  const unpriced = simulate({ ...BASE, batt: true, battKwh: 10, costOverride: 9999 }, E, "expc");
  assert.equal(unpriced.cost, 9999 + 10 * E.batteryCostPerKwh);
  assert.ok(unpriced.payback > priced.payback,
    `unpaid-for battery must not shorten payback (${unpriced.payback} vs ${priced.payback})`);

  // Both see the same energy benefit — only the cost differs.
  assert.ok(Math.abs(unpriced.self - priced.self) < 1e-9);

  // No battery at all: the flag is irrelevant.
  assert.equal(simulate({ ...BASE, costOverride: 9999 }, E, "expc").cost,
               simulate({ ...BASE, costOverride: 9999, bomHasBattery: true }, E, "expc").cost);
});
