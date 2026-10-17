import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEligibility, latestPrograms, supportTotals, estimateOf } from "./eligibility.js";
import { SUBSIDY_SEED } from "./subsidySeed.js";
import { supportFor } from "./greenSupport.js";

const L = 100; // bani per leu
const base = { market: "MD", kw: 10, systemMinor: 300000 * L, batteryMinor: 120000 * L, loanMinor: 0, vatRatePct: 20, currency: "MDL", date: "2026-10-17" };
const by = (rs) => Object.fromEntries(rs.map((r) => [r.code, r]));

test("a household with a battery: only the 0% duty applies", () => {
  const r = by(checkEligibility(SUBSIDY_SEED, { ...base, clientKind: "household" }));
  assert.equal(r.law112_customs.status, "eligible");
  assert.equal(r.law112_customs.estimateMinor, null, "information, no amount");
  assert.equal(r.law112_vat.status, "not_eligible");
  assert.equal(r.facem_373.status, "not_eligible");
  assert.equal(r.bess_guarantee.status, "not_eligible");
});

test("no battery: nothing applies", () => {
  const rs = checkEligibility(SUBSIDY_SEED, { ...base, batteryMinor: 0, clientKind: "sme" });
  assert.ok(rs.every((x) => x.status === "not_eligible" && x.reasons.includes("battery")));
});

test("a small business: conditional until the profile confirms, then eligible", () => {
  const open = by(checkEligibility(SUBSIDY_SEED, { ...base, clientKind: "sme" }));
  assert.equal(open.law112_vat.status, "conditional");
  assert.deepEqual(open.law112_vat.reasons, ["vat_payer"]);
  assert.equal(open.facem_373.status, "conditional");
  assert.equal(open.bess_guarantee.status, "conditional", "no loan yet");

  const sure = by(checkEligibility(SUBSIDY_SEED, { ...base, clientKind: "sme", loanMinor: 200000 * L },
    { vatPayer: true, netMetering: true, documentsHave: ["battery_invoice"] }));
  assert.equal(sure.law112_vat.status, "eligible");
  assert.equal(sure.law112_vat.estimateMinor, 20000 * L, "the VAT inside 120,000 lei at 20%");
  assert.equal(sure.facem_373.estimateMinor, 36000 * L, "up to 30% of the battery");
  assert.equal(sure.facem_373.upTo, true);
  assert.equal(sure.bess_guarantee.estimateMinor, 100000 * L, "half the loan");
  assert.deepEqual(sure.law112_vat.missingDocs.map((d) => d.id), ["vat_registration"], "the invoice is already there");

  const no = by(checkEligibility(SUBSIDY_SEED, { ...base, clientKind: "sme" }, { vatPayer: false, netMetering: false }));
  assert.equal(no.law112_vat.status, "not_eligible");
  assert.equal(no.facem_373.status, "not_eligible");
});

test("amounts agree with the installer's support card (lib/greenSupport.js)", () => {
  const card = supportFor({ market: "MD", clientKind: "sme", costMdl: 300000, batteryMdl: 120000, vatRatePct: 20, loanMdl: 200000 });
  const mine = by(checkEligibility(SUBSIDY_SEED, { ...base, clientKind: "sme", loanMinor: 200000 * L }, { vatPayer: true, netMetering: true }));
  const c = Object.fromEntries(card.items.map((i) => [i.id, i]));
  assert.equal(mine.law112_vat.estimateMinor, c.law112_vat.amountMdl * L);
  assert.equal(mine.facem_373.estimateMinor, c.facem_373.upToMdl * L);
  assert.equal(mine.bess_guarantee.estimateMinor, c.bess_guarantee.amountMdl * L);
});

test("the guarantee stops at its cap; a programme past its end date stops applying", () => {
  const big = by(checkEligibility(SUBSIDY_SEED, { ...base, clientKind: "company", loanMinor: 80000000 * L }, { vatPayer: true }));
  assert.equal(big.bess_guarantee.estimateMinor, 30000000 * L);
  assert.equal(big.bess_guarantee.capped, true);
  const late = by(checkEligibility(SUBSIDY_SEED, { ...base, clientKind: "company", loanMinor: 1, date: "2029-01-01" }, { vatPayer: true }));
  assert.equal(late.bess_guarantee.status, "not_eligible");
  assert.ok(late.bess_guarantee.reasons.includes("ended"));
});

test("only the latest active version of a programme counts", () => {
  const v2 = { ...SUBSIDY_SEED[2], id: "v2", version: 2, estimate: { type: "pct_of", base: "battery", pct: 40, upTo: true } };
  const off = { ...SUBSIDY_SEED[0], id: "off", version: 2, active: false };
  const latest = latestPrograms([...SUBSIDY_SEED, v2, off]);
  assert.equal(latest.find((p) => p.code === "facem_373").version, 2);
  assert.equal(latest.find((p) => p.code === "law112_vat").version, 1, "an inactive newer row is ignored");
  assert.equal(estimateOf(v2.estimate, base).estimateMinor, 48000 * L);
});

test("money totals: only grants and tax back, never the guarantee", () => {
  const rs = checkEligibility(SUBSIDY_SEED, { ...base, clientKind: "sme", loanMinor: 200000 * L }, { vatPayer: true, netMetering: true });
  const t = supportTotals(rs);
  assert.equal(t.sureMinor, 20000 * L, "the VAT back is sure once confirmed");
  assert.equal(t.upToMinor, 56000 * L, "plus FACEM's up-to 30%");
  assert.ok(Number.isInteger(t.sureMinor) && Number.isInteger(t.upToMinor));
});
