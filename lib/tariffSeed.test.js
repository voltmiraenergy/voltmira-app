import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOLAR_SEASON, FX } from "@voltmira/engine";
import { TARIFF_SEED } from "./tariffSeed.js";
import { SUBSIDY_SEED } from "./subsidySeed.js";
import { PROGRAMS } from "./greenData.js";
import { pickRule, ruleQuoteInputs } from "./tariffRules.js";
import { weightedExportPriceEur } from "./prosumerPrice.js";

const sql = readFileSync(new URL("../supabase/add-tariffs-subsidies.sql", import.meta.url), "utf8");

test("version 1 prices exports exactly as the app did before rules were versioned", () => {
  const before = weightedExportPriceEur(SOLAR_SEASON, FX.MDL);
  for (const op of ["premier", "rednord"]) {
    const qi = ruleQuoteInputs(pickRule(TARIFF_SEED, { market: "MD", operator: op, date: "2026-10-17" }));
    assert.equal(qi.feedOverride, before, `${op}: the same feed price to the last digit`);
  }
});

test("the SQL seeds the same tariff rows as the code", () => {
  for (const r of TARIFF_SEED) {
    assert.ok(sql.includes(`'${JSON.stringify(r.export_monthly).replace(/,/g, ",")}'`), `${r.operator}: export months`);
    assert.ok(sql.includes(`${r.retail_day_minor_per_mwh}, ${r.retail_night_minor_per_mwh}`), `${r.operator}: day/night`);
    assert.ok(sql.includes(`('MD', '${r.operator}', 1, '${r.effective_from}'`), `${r.operator}: version and date`);
  }
});

test("the programmes are the four the support card showed, never Casa Verde", () => {
  assert.deepEqual(SUBSIDY_SEED.map((p) => p.code).sort(), PROGRAMS.map((p) => p.id).sort());
  assert.ok(!/casa.?verde/i.test(JSON.stringify(SUBSIDY_SEED)) && !/casa.?verde/i.test(sql));
  for (const p of SUBSIDY_SEED) {
    assert.ok(sql.includes(`('${p.code}', 1, 'MD', '${p.kind}'`), `${p.code} seeded in SQL`);
    assert.ok(sql.includes(JSON.stringify(p.eligibility)), `${p.code}: same eligibility in SQL`);
    for (const l of ["en", "ro", "ru", "uk"]) assert.ok(p.name[l], `${p.code} name ${l}`);
    for (const d of p.required_documents) for (const l of ["en", "ro", "ru", "uk"]) assert.ok(d.name[l], `${p.code} doc ${d.id} ${l}`);
  }
});
