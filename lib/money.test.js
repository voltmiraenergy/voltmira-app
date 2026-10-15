import { test } from "node:test";
import assert from "node:assert/strict";
import { moneyFormatter, numFor, rateFor } from "./money.js";

// Node's ICU uses a no-break space (U+00A0 or U+202F) as the Russian thousands
// separator; compare with plain spaces.
const plain = (s) => s.replace(/[  ]/g, " ");

test("a Moldovan workspace reads lei at the frozen rate, a euro one reads euros", () => {
  const md = moneyFormatter({ currency: "MDL", lang: "ro", fx: { MDL: 20 } });
  assert.equal(md(11300), "226.000 lei");
  assert.equal(md.perKwh(0.21), "4,20 lei/kWh");
  assert.equal(md.local, true);
  const eur = moneyFormatter({ currency: "EUR", lang: "en" });
  assert.equal(eur(11300), "€11,300");
  assert.equal(eur.perKwh(0.21), "€0.210/kWh");
  assert.equal(plain(moneyFormatter({ currency: "MDL", lang: "ru", fx: { MDL: 20 } })(1000)), "20 000 лей");
});

test("no frozen rate falls back to the engine's table; unknown currencies stay euro", () => {
  assert.equal(rateFor("MDL", null), 19.8);
  assert.equal(rateFor("USD", { USD: 1.1 }), 1);
  assert.equal(moneyFormatter({ currency: "USD", lang: "ro" })(10), "€10");
});

test("short amounts, negatives and the round trip for inputs", () => {
  const md = moneyFormatter({ currency: "MDL", lang: "ro", fx: { MDL: 20 } });
  assert.equal(md.compact(3940), "78,8 mii lei");
  assert.equal(md.compact(80000), "1,6 mil. lei");
  assert.equal(md(-50), "−1.000 lei");
  assert.equal(md.fromLocal(md.toLocal(0.185)), 0.185);
  assert.equal(moneyFormatter({ currency: "EUR", lang: "en" }).compact(78800), "€78.8k");
});

test("decimals in the reader's language", () => {
  assert.equal(numFor("ro")(11.4), "11,4");
  assert.equal(numFor("en")(11.4), "11.4");
  assert.equal(numFor("ro")(6, 1), "6,0");
});

test("a Ukrainian workspace reads hryvnia at the frozen NBU rate", () => {
  const ua = moneyFormatter({ currency: "UAH", lang: "uk", fx: { UAH: 50 } });
  assert.equal(plain(ua(1000)), "50 000 грн");
  assert.equal(plain(ua.perKwh(0.0864)), "4,32 грн/кВт·год");
  assert.equal(plain(ua.compact(4000)), "200 тис. грн");
  assert.equal(ua.local, true);
  assert.equal(rateFor("UAH", null), 51);
  assert.equal(moneyFormatter({ currency: "UAH", lang: "en", fx: { UAH: 50 } })(10), "500 UAH");
});
