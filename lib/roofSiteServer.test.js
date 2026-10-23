import { test } from "node:test";
import assert from "node:assert/strict";
import { siteFromAddress, inTheTown } from "./roofSiteServer.js";

const memory = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } }; };

test("an address becomes an approximate place, asked once and then kept", async () => {
  let asked = 0;
  const lookup = async () => { asked++; return { lat: 47.0105, lon: 28.8638, display: "45, Strada Cartușa, Cartușa, Durlești, Municipiul Chișinău, MD-2003, Moldova" }; };
  const cache = memory();
  const a = await siteFromAddress("Str. Cartusa 45, Durlesti", { lookup, cache });
  assert.deepEqual(a, { lat: 47.0105, lon: 28.8638, tileZoom: 18, approx: true });
  const b = await siteFromAddress("str. cartusa 45,   durlesti", { lookup, cache });
  assert.deepEqual(b, a);
  assert.equal(asked, 1);
});

test("an address nobody can place gives nothing, and is not asked again at once", async () => {
  let asked = 0;
  const lookup = async () => { asked++; return null; };
  assert.equal(await siteFromAddress("Nowhere at all 99", { lookup, now: 1000 }), undefined);
  assert.equal(await siteFromAddress("Nowhere at all 99", { lookup, now: 2000 }), undefined);
  assert.equal(asked, 1);
  assert.equal(await siteFromAddress("Nowhere at all 99", { lookup, now: 1000 + 11 * 60 * 1000 }), undefined);
  assert.equal(asked, 2);
});

test("a place counts only when it is in the town the address names", () => {
  // the geocoder took the street in a village 17 km from Strășeni
  assert.equal(inTheTown("Str. Ștefan cel Mare 20, Strășeni", "Strada Ștefan cel Mare, Lozova, Raionul Strășeni, MD-3737, Moldova"), false);
  assert.equal(inTheTown("Str. Mihai Eminescu 5, Strășeni", "5, Strada Mihai Eminescu, Strășeni, Raionul Strășeni, MD-3701, Moldova"), true);
  // diacritics and case do not matter; the village counts as much as the city
  assert.equal(inTheTown("Str. Cartușa 45, Durlești, Chișinău", "45, Strada Cartușa, Cartușa, Durlesti, Municipiul Chișinău"), true);
  // no town in the address: nothing to check against
  assert.equal(inTheTown("Str. Mihai Eminescu 5", "5, Strada Mihai Eminescu, Strășeni"), false);
});

test("an address the geocoder puts in another town gives no picture", async () => {
  const lookup = async () => ({ lat: 47.1, lon: 28.5, display: "Strada Ștefan cel Mare, Lozova, Raionul Strășeni, MD-3737, Moldova" });
  assert.equal(await siteFromAddress("Str. Ștefan cel Mare 20, Strășeni", { lookup }), undefined);
});

test("a geocoder that fails or hangs never breaks the offer", async () => {
  assert.equal(await siteFromAddress("Failing street 12", { lookup: async () => { throw new Error("HTTP 429"); } }), undefined);
  assert.equal(await siteFromAddress("Hanging street 12", { lookup: () => new Promise(() => {}), wait: 20 }), undefined);
  assert.equal(await siteFromAddress("ab"), undefined);
});
