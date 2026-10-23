import test from "node:test";
import assert from "node:assert/strict";
import { cleanPlace, metersPerPixel, startPlace, projectToPhoto, handleLatLon, placeFromHandle, placeAt, photoCorners } from "./photoPlace.js";
import { unproject } from "./roofLayout.js";

const base = { lat: 47.0105, lon: 28.8638, widthM: 100, rotDeg: 0, opacity: 0.7, aspect: 2 };
const at = (e, n, place = base) => unproject([[e, n]], place.lat, place.lon)[0];

test("cleanPlace keeps good numbers and bounds the rest", () => {
  const p = cleanPlace({ lat: "47.01", lon: 28.86, widthM: 9999, rotDeg: 540, opacity: 5, aspect: -1 });
  assert.equal(p.widthM, 600);
  assert.equal(p.rotDeg, -180);
  assert.equal(p.opacity, 1);
  assert.equal(p.aspect, 1.3333);
  assert.equal(cleanPlace({ lat: 47, lon: 28, widthM: 1 }).widthM, 5);
});

test("cleanPlace refuses what cannot be placed", () => {
  assert.equal(cleanPlace(null), null);
  assert.equal(cleanPlace({ lat: 47, lon: 28 }), null);
  assert.equal(cleanPlace({ lat: 120, lon: 28, widthM: 50 }), null);
  assert.equal(cleanPlace({ lat: "x", lon: 28, widthM: 50 }), null);
});

test("a ground metre is half as many pixels one zoom in", () => {
  assert.ok(Math.abs(metersPerPixel(47, 19) * 2 - metersPerPixel(47, 18)) < 1e-9);
  assert.ok(metersPerPixel(47, 19) < metersPerPixel(0, 19));
});

test("the photo's centre falls on the middle of the picture and its right edge on x = 1", () => {
  const c = projectToPhoto(base, base.lat, base.lon);
  assert.ok(Math.abs(c.x - 0.5) < 1e-6 && Math.abs(c.y - 0.5) < 1e-6);
  const [lat, lon] = at(50, 0);
  const r = projectToPhoto(base, lat, lon);
  assert.ok(Math.abs(r.x - 1) < 1e-3 && Math.abs(r.y - 0.5) < 1e-3);
});

test("north is up on an unturned photo; its height follows the picture's shape", () => {
  // 100 m wide at 2:1 is 50 m high, so 25 m north is the top edge
  const [lat, lon] = at(0, 25);
  const r = projectToPhoto(base, lat, lon);
  assert.ok(Math.abs(r.y - 0) < 1e-3 && Math.abs(r.x - 0.5) < 1e-3);
});

test("a photo turned 90 degrees clockwise has its top edge pointing east", () => {
  const turned = { ...base, rotDeg: 90 };
  const [lat, lon] = at(25, 0, turned); // 25 m east
  const r = projectToPhoto(turned, lat, lon);
  assert.ok(Math.abs(r.y - 0) < 1e-3 && Math.abs(r.x - 0.5) < 1e-3);
});

test("the right-edge handle round-trips the width and the turn", () => {
  for (const rot of [0, 30, 90, -120, 179]) {
    const p = cleanPlace({ ...base, rotDeg: rot, widthM: 80 });
    const [lat, lon] = handleLatLon(p);
    const back = placeFromHandle(p, lat, lon);
    assert.ok(Math.abs(back.widthM - 80) < 0.2, `width at ${rot}`);
    assert.ok(Math.abs(back.rotDeg - p.rotDeg) < 0.2, `turn at ${rot}`);
  }
});

test("dragging the handle onto the centre changes nothing", () => {
  const p = cleanPlace(base);
  assert.deepEqual(placeFromHandle(p, p.lat, p.lon), p);
});

test("moving the centre keeps the size, the turn and the opacity", () => {
  const p = cleanPlace({ ...base, rotDeg: 40 });
  const moved = placeAt(p, 47.011, 28.865);
  assert.equal(moved.lat, 47.011);
  assert.equal(moved.widthM, p.widthM);
  assert.equal(moved.rotDeg, p.rotDeg);
  assert.equal(moved.opacity, p.opacity);
});

test("a first place covers about two thirds of what the map shows", () => {
  const p = startPlace({ lat: 47.01, lon: 28.86 }, 90, 1.5);
  assert.equal(p.widthM, 59.4);
  assert.equal(p.rotDeg, 0);
  assert.equal(p.aspect, 1.5);
});

test("the corners are the photo's own corners, whatever its turn", () => {
  for (const rot of [0, 33, -100]) {
    const p = cleanPlace({ ...base, rotDeg: rot });
    const [tl, tr, br, bl] = photoCorners(p).map(([lat, lon]) => projectToPhoto(p, lat, lon));
    assert.ok(Math.abs(tl.x) < 1e-3 && Math.abs(tl.y) < 1e-3, `top left at ${rot}`);
    assert.ok(Math.abs(tr.x - 1) < 1e-3 && Math.abs(tr.y) < 1e-3, `top right at ${rot}`);
    assert.ok(Math.abs(br.x - 1) < 1e-3 && Math.abs(br.y - 1) < 1e-3, `bottom right at ${rot}`);
    assert.ok(Math.abs(bl.x) < 1e-3 && Math.abs(bl.y - 1) < 1e-3, `bottom left at ${rot}`);
  }
});
