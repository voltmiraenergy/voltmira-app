import { test } from "node:test";
import assert from "node:assert/strict";
import { energyCredit, blackoutPlan, ENERGY_CREDIT } from "./uaMarket.js";
import { suggestUaOperator, UA_OPERATORS, UA_GRID_STAGES } from "./uaGrid.js";

test("Energy Credit: the programme rate follows the loan length", () => {
  // €5,000 at 50 UAH/EUR = 250,000 UAH, under the 480,000 cap.
  const one = energyCredit({ costEur: 5000, fxUah: 50, years: 1 });
  assert.equal(one.ratePct, 0);
  assert.ok(Math.abs(one.monthlyEur - 5000 / 12) < 1e-9, "0% is the principal over 12 months");
  assert.equal(energyCredit({ costEur: 5000, fxUah: 50, years: 2 }).ratePct, 5);
  assert.equal(energyCredit({ costEur: 5000, fxUah: 50, years: 3 }).ratePct, 7);
  assert.equal(energyCredit({ costEur: 5000, fxUah: 50, years: 5, bankRatePct: 18 }).ratePct, 18);
});

test("Energy Credit: up to 30% of the principal back, and the 480,000 UAH cap", () => {
  const r = energyCredit({ costEur: 5000, fxUah: 50, years: 3 });
  assert.equal(r.compensationEur, 1500);
  assert.equal(r.capped, false);
  // €12,000 × 50 = 600,000 UAH: the loan stops at 480,000 UAH = €9,600.
  const big = energyCredit({ costEur: 12000, fxUah: 50, years: 3 });
  assert.equal(big.loanEur, 9600);
  assert.equal(big.capped, true);
  assert.equal(ENERGY_CREDIT.banks.length, 6);
});

test("Blackout plan: hours on the battery, and the size a typical outage needs", () => {
  // 10 kWh × 0.9 = 9 kWh for a 0.6 kW essential load = 15 hours.
  const p = blackoutPlan({ battKwh: 10, essentialKw: 0.6, outageHours: 8 });
  assert.equal(p.hours, 15);
  assert.equal(p.covers, true);
  // 8 h × 1.5 kW / 0.9 = 13.3 kWh, next common size 15.
  const q = blackoutPlan({ battKwh: 5, essentialKw: 1.5, outageHours: 8 });
  assert.equal(q.covers, false);
  assert.ok(Math.abs(q.needKwh - 13.333333) < 1e-5);
  assert.equal(q.suggestKwh, 15);
  // No battery: zero hours, never a guess.
  assert.equal(blackoutPlan({ battKwh: 0, essentialKw: 1, outageHours: 4 }).hours, 0);
  assert.equal(blackoutPlan({ battKwh: 10, essentialKw: 0 }).hours, null);
});

test("the oblenergo is suggested from the address, Kyiv oblast before Kyiv city", () => {
  assert.equal(suggestUaOperator("вул. Хрещатик 22, Київ"), "dtek_kyiv");
  assert.equal(suggestUaOperator("вул. Шевченка 5, Бровари, Київська обл."), "dtek_kyiv_reg");
  assert.equal(suggestUaOperator("вул. Городоцька 10, Львів"), "lviv");
  assert.equal(suggestUaOperator("Odesa, Derybasivska 1"), "dtek_odesa");
  assert.equal(suggestUaOperator("вул. Соборна 3, Івано-Франківськ"), "prykarpattia");
  assert.equal(suggestUaOperator("село без назви"), null);
  assert.ok(Object.keys(UA_OPERATORS).length >= 24);
  assert.equal(UA_GRID_STAGES[0].id, "ua_installed");
});

test("the Ukraine plan falls back to a 4 h outage, 0.5 kW, no generator, 3 years", async () => {
  const { uaPlanDefaults } = await import("./uaMarket.js");
  assert.deepEqual(uaPlanDefaults(null), { outageHours: 4, essentialKw: 0.5, generatorKw: 0, creditYears: 3 });
  // a field cleared in the editor ("") or nonsense keeps the default
  assert.deepEqual(uaPlanDefaults({ outageHours: "", essentialKw: -1, generatorKw: "x", creditYears: 4 }),
    { outageHours: 4, essentialKw: 0.5, generatorKw: 0, creditYears: 3 });
  assert.deepEqual(uaPlanDefaults({ outageHours: 8, essentialKw: 1.2, generatorKw: 5, creditYears: 10 }),
    { outageHours: 8, essentialKw: 1.2, generatorKw: 5, creditYears: 10 });
});

test("oblenergo suggestion: Kyiv oblast towns are not Kyiv city", () => {
  assert.equal(suggestUaOperator("вул. Шевченка 5, Бровари, Київська обл."), "dtek_kyiv_reg");
  assert.equal(suggestUaOperator("Київ, вул. Хрещатик 1"), "dtek_kyiv");
  assert.equal(suggestUaOperator("Lviv, Horodotska 10"), "lviv");
  assert.equal(suggestUaOperator("м. Ів-Франківськ"), null, "an unknown spelling suggests nothing rather than a guess");
  assert.equal(suggestUaOperator(""), null);
  for (const id of Object.keys(UA_OPERATORS)) assert.equal(UA_OPERATORS[id].id, id);
});

test("grid file: each market gets its own operators and stages", async () => {
  const { gridFor } = await import("./gridFile.js");
  const { gridFileStatus } = await import("./mdGrid.js");
  assert.equal(gridFor("RO"), null);
  assert.equal(gridFor("MD").market, "MD");
  const ua = gridFor("UA");
  assert.equal(ua.stages, UA_GRID_STAGES);
  // installed and notice handed in on 1 September; the meter is due 14 days later
  const file = { operator: "lviv", stages: { ua_installed: "2026-09-01", ua_notice: "2026-09-01" } };
  const early = gridFileStatus(file, "2026-09-10", ua.stages);
  assert.equal(early.next, "ua_meter");
  assert.equal(early.chase, false);
  const late = gridFileStatus(file, "2026-09-16", ua.stages);
  assert.equal(late.chase, true);
  assert.equal(late.waitingDays, 15);
  // Moldovan stage ids on a quote switched to Ukraine don't count there
  assert.equal(gridFileStatus({ stages: { applied: "2026-09-01" } }, "2026-09-10", ua.stages).done, 0);
});

test("start year: a month after the quote, as a fractional year", async () => {
  const { startYearOf } = await import("./quoteInput.js");
  assert.equal(startYearOf("2026-09-29T10:00:00Z"), 2026.75);
  assert.equal(startYearOf("2029-12-15T10:00:00Z"), 2030);
  assert.ok(Number.isFinite(startYearOf("not a date")));
});
