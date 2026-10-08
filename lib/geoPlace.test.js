import { test } from "node:test";
import assert from "node:assert/strict";
import { townFromTitle, placeQueries, placeKey, precisionOf, spread, savedPos } from "./geoPlace.js";

test("the town comes from the part of the title after the last comma", () => {
  assert.equal(townFromTitle("Casa Bejan, Ungheni"), "Ungheni");
  assert.equal(townFromTitle("Pensiunea Butuceni, Orhei"), "Orhei");
  assert.equal(townFromTitle("Hala Industrială"), null);
  assert.equal(townFromTitle("Casa, 12"), null);
  assert.equal(townFromTitle(""), null);
});

test("ask for the address first (with the town when it is missing), then the town alone", () => {
  assert.deepEqual(placeQueries({ address: "Str. Costiujeni 14, Codru", title: "Vila Andrieș, Codru", market: "MD" }), [
    { q: "Str. Costiujeni 14, Codru, Republica Moldova", kind: "address", country: "md" },
    { q: "Codru, Republica Moldova", kind: "locality", country: "md" },
  ]);
  assert.deepEqual(placeQueries({ address: "Str. Independenței 5", title: "Casa Bejan, Ungheni", market: "MD" })[0].q,
    "Str. Independenței 5, Ungheni, Republica Moldova");
  assert.deepEqual(placeQueries({ title: "Будинок, Львів", market: "UA" }), [{ q: "Львів, Україна", kind: "locality", country: "ua" }]);
  assert.deepEqual(placeQueries({ title: "Fără oraș" }), []);
  assert.equal(placeKey({ title: "Casa Bejan, Ungheni" }), "Ungheni, Republica Moldova");
});

test("only a building or street answer to an address search counts as the address", () => {
  assert.equal(precisionOf("house", "address"), "address");
  assert.equal(precisionOf("road", "address"), "address");
  assert.equal(precisionOf("village", "address"), "locality");
  assert.equal(precisionOf("house", "locality"), "locality");
});

test("points on the same spot are spread apart, others stay where they are", () => {
  const pts = [{ id: "a", lat: 47, lon: 28.8 }, { id: "b", lat: 47, lon: 28.8 }, { id: "c", lat: 46, lon: 28 }];
  const s = spread(pts);
  assert.equal(s.length, 3);
  assert.notDeepEqual([s[0].lat, s[0].lon], [s[1].lat, s[1].lon]);
  assert.deepEqual([s[2].lat, s[2].lon], [46, 28]);
  assert.ok(Math.abs(s[0].lat - 47) < 0.01 && Math.abs(s[1].lon - 28.8) < 0.02);
  assert.equal(s[1].id, "b");
});

test("a saved position is used only while it still matches the quote", () => {
  const q = { title: "Casa Bejan, Ungheni", market: "MD" };
  const pos = { lat: 47.2, lon: 27.8, precision: "locality", q: "Ungheni, Republica Moldova" };
  assert.deepEqual(savedPos(pos, q), { lat: 47.2, lon: 27.8, precision: "locality", q: "Ungheni, Republica Moldova" });
  assert.equal(savedPos(pos, { ...q, address: "Str. Noua 3" }), null);
  assert.equal(savedPos({ lat: "x", lon: 1 }, q), null);
  assert.equal(savedPos(null, q), null);
});
