import { test } from "node:test";
import assert from "node:assert/strict";
import { XT, xt, efReason } from "./integrationText.js";

const LANGS = ["en", "ro", "ru", "uk"];
const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");

test("every key has all four languages, the same placeholders, and no banned punctuation", () => {
  for (const [k, e] of Object.entries(XT)) {
    for (const l of LANGS) {
      assert.ok(typeof e[l] === "string" && e[l].trim(), `${k} ${l}`);
      assert.equal(holes(e[l]), holes(e.en), `${k} ${l} placeholders`);
      assert.ok(!/[—–·✓✔]/.test(e[l]), `${k} ${l} has a banned mark`);
    }
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
});

test("every reason e-Factura can give has words, and an unknown one a fallback", () => {
  for (const c of ["invoice_number", "invoice_date", "currency_not_mdl", "seller_name", "seller_idno", "seller_vat_no", "buyer_name", "buyer_idno", "no_amount", "totals", "not_configured", "in_progress", "already_accepted", "no_invoice_no", "not_sent"]) {
    assert.notEqual(efReason(c, "ro"), xt("ef_e_other", "ro"), c);
  }
  assert.equal(efReason("weird", "ro"), xt("ef_e_other", "ro"));
  assert.equal(xt("bl_sub", "ro", { no: "PF-1", total: "100 lei" }), "Factura PF-1, 100 lei");
});
