import { test } from "node:test";
import assert from "node:assert/strict";
import { kmBetween, roundPos, parseCoords, placeFromAddress, siteDrift, DRIFT_KM } from "./sitePick.js";
import { normalizePlant } from "./plantFinance.js";
import { stillMissing, gapText } from "./bankPack.js";

test("distances on the ground", () => {
  // Chisinau to Cahul is about 150 km as the crow flies
  const km = kmBetween({ lat: 47.0105, lon: 28.8638 }, { lat: 45.9075, lon: 28.1944 });
  assert.ok(km > 130 && km < 140, String(km));
  assert.equal(kmBetween({ lat: 46, lon: 28 }, { lat: 46, lon: 28 }), 0);
  assert.equal(roundPos(46.123456789), 46.12346);
});

test("coordinates typed or pasted are recognised; a place name is not", () => {
  assert.deepEqual(parseCoords("46.95, 28.85"), { lat: 46.95, lon: 28.85 });
  assert.deepEqual(parseCoords("46.95 28.85"), { lat: 46.95, lon: 28.85 });
  assert.deepEqual(parseCoords("46,95; 28,85"), { lat: 46.95, lon: 28.85 });
  assert.deepEqual(parseCoords("46,95 28,85"), { lat: 46.95, lon: 28.85 });
  assert.deepEqual(parseCoords("45.9075° N, 28.1944° E"), { lat: 45.9075, lon: 28.1944 });
  assert.deepEqual(parseCoords("https://www.google.com/maps/@45.90751,28.19442,14z"), { lat: 45.90751, lon: 28.19442 });
  assert.equal(parseCoords("Cahul"), null);
  assert.equal(parseCoords("Satul 2, 15"), null);
  assert.equal(parseCoords("95, 28"), null, "no latitude past the pole");
  assert.equal(parseCoords(""), null);
});

test("the village, the district and the country from a reverse lookup", () => {
  assert.deepEqual(placeFromAddress({ village: "Crihana Veche", county: "Raionul Cahul", country_code: "MD" }),
    { locality: "Crihana Veche", district: "Raionul Cahul", country: "md" });
  assert.equal(placeFromAddress({ town: "Cahul" }).locality, "Cahul");
  assert.equal(placeFromAddress({ city: "Chișinău", state: "Municipiul Chișinău" }).district, "Municipiul Chișinău");
  assert.deepEqual(placeFromAddress(null), { locality: "", district: "", country: "" });
});

const base = {
  id: "p", name: "Park", lat: 45.95, lon: 28.33,
  wind: { mw: 20, turbines: 4, screening: { hist: { counts: [1], hours: 1 }, lat: 45.95, lon: 28.33 } },
  solar: { mwp: 10, yieldKwhKwp: 1250, yieldSource: "pvgis", yieldAt: { lat: 45.95, lon: 28.33 } },
};

test("public figures looked up for another point are noticed after the plant moves", () => {
  assert.deepEqual(siteDrift(normalizePlant(base)), { wind: null, solar: null, grid: null });
  const moved = normalizePlant({ ...base, lat: 46.2, lon: 28.6 });
  const d = siteDrift(moved);
  assert.ok(d.wind > 30 && d.solar > 30);
  // within a kilometre is the same site
  const nudged = siteDrift(normalizePlant({ ...base, lat: 45.955 }));
  assert.equal(nudged.wind, null);
  assert.ok(DRIFT_KM === 1);
  // a study replaces the public figures, so its own site counts, not theirs
  const studied = normalizePlant({ ...base, lat: 46.2, wind: { ...base.wind, study: { p50Mwh: 60000, p90Mwh: 52000 } } });
  assert.equal(siteDrift(studied).wind, null);
  // a yield typed by hand, or looked up before positions were kept, cannot be told apart
  assert.equal(siteDrift(normalizePlant({ ...base, lat: 46.2, solar: { mwp: 10, yieldKwhKwp: 1250, yieldSource: "manual" } })).solar, null);
  assert.equal(siteDrift(normalizePlant({ ...base, lat: 46.2, solar: { mwp: 10, yieldKwhKwp: 1250, yieldSource: "pvgis" } })).solar, null);
  assert.deepEqual(siteDrift(normalizePlant({ ...base, lat: null })), { wind: null, solar: null, grid: null });
});

test("the bank pack lists figures left behind at the old site", () => {
  const m = stillMissing({ ...base, lat: 46.2, lon: 28.6 }, "2026-10-04");
  const moved = m.gaps.filter((g) => g.id === "moved");
  assert.deepEqual(moved.map((g) => g.part), ["wind", "solar"]);
  assert.match(gapText(moved[0], "ro"), /^Cifrele publice pentru vânt au fost căutate pentru un punct aflat la \d+,\d km de amplasament/);
  assert.match(gapText(moved[1], "en"), /public solar figures were looked up for a point \d+\.\d km from the site/);
  assert.equal(stillMissing(base, "2026-10-04").gaps.filter((g) => g.id === "moved").length, 0);
});

test("a PVGIS lookup keeps the point it was made for", () => {
  assert.deepEqual(normalizePlant(base).solar.yieldAt, { lat: 45.95, lon: 28.33 });
  assert.equal(normalizePlant({ ...base, solar: { mwp: 10, yieldAt: { lat: "x" } } }).solar.yieldAt, null);
});
