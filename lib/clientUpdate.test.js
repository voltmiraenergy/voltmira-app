import { test } from "node:test";
import assert from "node:assert/strict";
import { monthVerdict, clientUpdate } from "./clientUpdate.js";

test("the month's verdict: cloudy explains a low month, normal sun does not", () => {
  // 700 of a usual 1,000 under 72% of the usual sun: 97% of what the sky allowed, fine
  assert.deepEqual(monthVerdict({ kwh: 700, expected: 1000, sun: 0.72 }), { kind: "cloudy", pc: 70, sunLess: 28 });
  // the same 700 under a usual sky: low, and the sun is no excuse
  assert.equal(monthVerdict({ kwh: 700, expected: 1000, sun: 1.0 }).kind, "low_sunny");
  // cloudy, but even less than that sky allowed
  assert.equal(monthVerdict({ kwh: 500, expected: 1000, sun: 0.8 }).kind, "low_cloudy");
  // no sun data: judged against the plain estimate
  assert.equal(monthVerdict({ kwh: 700, expected: 1000 }).kind, "low");
  assert.equal(monthVerdict({ kwh: 980, expected: 1000 }).kind, "ok");
  assert.equal(monthVerdict({ kwh: null, expected: 1000 }).kind, "nodata");
});

test("the message: formal Romanian, the weather named, no savings line without savings", () => {
  const m = clientUpdate({ lang: "ro", kw: 6, month: 10, kwh: 700, expected: 1000, sun: 0.72 });
  assert.match(m, /^Bună ziua! Raportul lunar al sistemului dvs\. solar de 6 kW\./);
  assert.match(m, /noiembrie a produs 700 kWh, adică 70%/);
  assert.match(m, /cu 28% mai puțin soare/);
  assert.doesNotMatch(m, /Economie/);
  assert.doesNotMatch(m, /[—·]/, "no em dashes or middle dots");
  const low = clientUpdate({ lang: "en", kw: 6, month: 6, kwh: 600, expected: 1000, sun: 1 });
  assert.match(low, /usual level, so production should have been higher/);
  const saved = clientUpdate({ lang: "ru", kw: 6, month: 6, kwh: 1000, expected: 1000, saved: { month: 1201, ytd: 5002 } });
  assert.match(saved, /~1\s201 лей за июль/u, "Russian groups thousands with a no-break space");
  assert.match(clientUpdate({ lang: "uk", kw: 5, pending: true }), /перший щомісячний звіт|Перший щомісячний звіт/);
});
