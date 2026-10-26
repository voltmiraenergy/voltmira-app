import { test } from "node:test";
import assert from "node:assert/strict";
import { termsFor, cleanOfferTerms, warrantyRows, inverterFacts, paymentStages, performanceOf, extensionOf } from "./offerTerms.js";
import { autoBom } from "./supplierCatalog.js";

test("the scope: the installer's own lists when saved, else the standard ones in the offer's language", () => {
  const std = termsFor(null, "ro");
  assert.equal(std.standard, true);
  assert.ok(std.include.some((s) => /racordare/.test(s)));
  assert.ok(std.exclude.some((s) => /Schela/.test(s)));
  assert.equal(termsFor(null, "ru").include.length, std.include.length);
  const own = termsFor({ include: ["  Montaj  ", ""], exclude: ["Schela"] }, "ro");
  assert.deepEqual([own.include, own.exclude, own.standard], [["Montaj"], ["Schela"], false]);
  assert.equal(cleanOfferTerms({ include: Array(30).fill("x") }).include.length, 15);
});

test("warranties: only what the catalog verified, the panels' power warranty read from the maker's note, and the installer's work", () => {
  const bom = autoBom(9, 10);
  const rows = warrantyRows(bom, { installYears: 5, company: "SolarTech", lang: "ro" });
  const kinds = rows.map((r) => r[0]);
  assert.ok(kinds.includes("Panouri, produs") && kinds.includes("Invertor") && kinds.includes("Lucrările de montaj"));
  const perf = rows.find((r) => r[0] === "Panouri, putere");
  assert.ok(perf && /^\d+ ani, cel puțin [\d,]+% din putere în anul \d+$/.test(perf[1]), perf?.[1]);
  // a hand-typed product is left out, never guessed
  assert.deepEqual(warrantyRows([{ kind: "panel", brand: "Noname", model: "X1", qty: 10 }], { lang: "ro" }), []);
  assert.deepEqual(performanceOf("30yr performance warranty, 87.4% guaranteed @ yr30"), { years: 30, pct: 87.4, pctYear: 30 });
  assert.deepEqual(extensionOf("extendable to 10/15/20yr (paid)"), { years: 20, paid: true, free: false });
});

test("the inverter: a battery later only on a hybrid, and the maker's app when its name is certain", () => {
  const hyb = inverterFacts(autoBom(9, 10));
  assert.equal(hyb.hybrid, true);
  assert.ok(hyb.app);
  assert.equal(inverterFacts([{ kind: "inverter", brand: "Unknown", model: "Z", qty: 1, spec: "5 kW" }]).hybrid, null);
  assert.equal(inverterFacts([]), null);
});

test("payment stages: the job's, else the workspace's, else 50 / 40 / 10", () => {
  assert.deepEqual(paymentStages(null, null).map((s) => s.pct), [50, 40, 10]);
  assert.deepEqual(paymentStages(null, { steps: [{ trigger: "signed", pct: 30 }, { trigger: "install", pct: 70 }] }).map((s) => s.pct), [30, 70]);
});
