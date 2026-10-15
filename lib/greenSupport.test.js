import { test } from "node:test";
import assert from "node:assert/strict";
import { supportFor, tagsFor, batteryEur, CLIENT_KINDS } from "./greenSupport.js";

const ids = (r) => r.items.map((i) => i.id);
const item = (r, id) => r.items.find((i) => i.id === id);

test("only Moldovan quotes have programmes, and nothing is shown before the client type is chosen", () => {
  assert.deepEqual(supportFor({ market: "UA", clientKind: "household", costMdl: 200000, batteryMdl: 60000 }).items, []);
  assert.equal(supportFor({ market: "UA", clientKind: "household" }).market, false);
  const r = supportFor({ market: "MD", clientKind: null, costMdl: 200000, batteryMdl: 60000 });
  assert.equal(r.needsKind, true);
  assert.deepEqual(r.items, []);
  assert.deepEqual(CLIENT_KINDS, ["household", "sme", "company"]);
});

test("Casa Verde pays half of a household's PV with battery, at most 200,000 lei", () => {
  const small = supportFor({ market: "MD", clientKind: "household", costMdl: 240000, batteryMdl: 80000, insulated: true });
  const cv = item(small, "casa_verde");
  assert.equal(cv.state, "applies");
  assert.equal(cv.amountMdl, 120000);
  assert.equal(cv.clientPaysMdl, 120000);
  assert.equal(cv.capped, false);
  const big = item(supportFor({ market: "MD", clientKind: "household", costMdl: 500000, batteryMdl: 150000, insulated: true }), "casa_verde");
  assert.equal(big.amountMdl, 200000);
  assert.equal(big.capped, true);
  assert.equal(big.halfMdl, 250000);
  assert.equal(big.clientPaysMdl, 300000);
});

test("Casa Verde waits on the insulation: unknown is conditional, no insulation pays nothing", () => {
  const unknown = item(supportFor({ market: "MD", clientKind: "household", costMdl: 240000, batteryMdl: 80000 }), "casa_verde");
  assert.equal(unknown.state, "conditional");
  assert.equal(unknown.amountMdl, 120000);
  const no = item(supportFor({ market: "MD", clientKind: "household", costMdl: 240000, batteryMdl: 80000, insulated: false }), "casa_verde");
  assert.equal(no.state, "blocked");
  assert.equal(no.amountMdl, 0);
  assert.equal(no.clientPaysMdl, 240000);
});

test("panels without a battery: Casa Verde does not pay, and the card says what a battery would unlock", () => {
  const r = supportFor({ market: "MD", clientKind: "household", costMdl: 150000, batteryMdl: 0, insulated: true });
  assert.deepEqual(r.items, []);
  assert.equal(r.hint.id, "add_battery");
  assert.equal(r.hint.capMdl, 200000);
  assert.deepEqual(r.tags, []);
});

test("a business recovers the VAT inside the battery's price, only when the invoice carries VAT", () => {
  const r = supportFor({ market: "MD", clientKind: "company", costMdl: 600000, batteryMdl: 120000, vatRatePct: 20 });
  const vat = item(r, "law112_vat");
  assert.equal(vat.amountMdl, 20000); // 120,000 includes 20% VAT: 120,000 x 20 / 120
  assert.equal(vat.state, "conditional");
  const none = item(supportFor({ market: "MD", clientKind: "company", costMdl: 600000, batteryMdl: 120000, vatRatePct: 0 }), "law112_vat");
  assert.equal(none.state, "none_on_invoice");
  assert.equal(none.amountMdl, 0);
  // households are not VAT payers
  assert.equal(item(supportFor({ market: "MD", clientKind: "household", costMdl: 240000, batteryMdl: 80000, vatRatePct: 20 }), "law112_vat"), undefined);
});

test("0% customs is information for every battery job; FACEM is for small businesses only", () => {
  for (const k of CLIENT_KINDS) {
    const r = supportFor({ market: "MD", clientKind: k, costMdl: 300000, batteryMdl: 90000 });
    assert.equal(item(r, "law112_customs").state, "info");
    assert.equal(item(r, "law112_customs").fromPct, 8);
  }
  const sme = item(supportFor({ market: "MD", clientKind: "sme", costMdl: 300000, batteryMdl: 90000 }), "facem_373");
  assert.equal(sme.upToMdl, 27000);
  assert.equal(sme.state, "conditional");
  assert.equal(item(supportFor({ market: "MD", clientKind: "company", costMdl: 300000, batteryMdl: 90000 }), "facem_373"), undefined);
});

test("the loan guarantee covers half the loan and stops at 30 million lei, without refusing a bigger project", () => {
  const none = item(supportFor({ market: "MD", clientKind: "company", costMdl: 2e6, batteryMdl: 1e6 }), "bess_guarantee");
  assert.equal(none.state, "needs_loan");
  assert.equal(none.amountMdl, 0);
  const some = item(supportFor({ market: "MD", clientKind: "company", costMdl: 2e6, batteryMdl: 1e6, loanMdl: 1.5e6 }), "bess_guarantee");
  assert.equal(some.amountMdl, 750000);
  assert.equal(some.capped, false);
  const huge = supportFor({ market: "MD", clientKind: "company", costMdl: 150e6, batteryMdl: 90e6, loanMdl: 100e6 });
  const g = item(huge, "bess_guarantee");
  assert.equal(g.amountMdl, 30e6);
  assert.equal(g.capped, true);
  assert.equal(g.maxMonths, 120);
  assert.equal(g.feePctYear, 1);
  // the project itself is still listed with every other programme
  assert.ok(ids(huge).includes("law112_vat"));
});

test("a business quote without a battery gets the hint, not empty programmes", () => {
  const r = supportFor({ market: "MD", clientKind: "sme", costMdl: 300000, batteryMdl: 0 });
  assert.deepEqual(r.items, []);
  assert.equal(r.hint.id, "battery_programmes");
});

test("the battery never counts for more than the whole price", () => {
  const r = supportFor({ market: "MD", clientKind: "company", costMdl: 100000, batteryMdl: 400000, vatRatePct: 20 });
  assert.equal(item(r, "law112_vat").baseMdl, 100000);
});

test("tags follow what applies: a battery, and each programme that can still pay", () => {
  const r = supportFor({ market: "MD", clientKind: "sme", costMdl: 300000, batteryMdl: 90000, vatRatePct: 20, loanMdl: 200000 });
  assert.deepEqual(r.tags, ["#BESS", "#VAT_reimbursement", "#customs_0", "#FACEM", "#BESS_guarantee"]);
  assert.deepEqual(tagsFor([{ id: "casa_verde", state: "blocked" }], true), ["#BESS"]);
});

test("the battery's price comes from its size at the workspace's EUR per kWh", () => {
  assert.equal(batteryEur({ batt: true, battKwh: 10, batteryCostPerKwh: 450 }), 4500);
  assert.equal(batteryEur({ batt: false, battKwh: 10, batteryCostPerKwh: 450 }), 0);
  assert.equal(batteryEur({ batt: true, battKwh: 10 }), 5000);
});
