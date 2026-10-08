import { test } from "node:test";
import assert from "node:assert/strict";
import { separate } from "./portfolioMap.js";

test("overlapping markers end up clear of each other and inside the frame", () => {
  // eleven markers piled around one town, as in a portfolio of Chisinau rooftops
  const pts = Array.from({ length: 11 }, (_, i) => ({ x: 300 + (i % 3) * 2, y: 150 + (i % 4) * 2, r: 9 + (i % 3) * 3 }));
  const out = separate(pts, { width: 640, height: 300, gap: 3 });
  for (let a = 0; a < out.length; a++) {
    assert.ok(out[a].x >= out[a].r && out[a].x <= 640 - out[a].r, `x ${a}`);
    assert.ok(out[a].y >= out[a].r && out[a].y <= 300 - out[a].r, `y ${a}`);
    for (let b = a + 1; b < out.length; b++) {
      const d = Math.hypot(out[a].x - out[b].x, out[a].y - out[b].y);
      assert.ok(d >= out[a].r + out[b].r + 2.9, `${a} and ${b} overlap: ${d.toFixed(1)}`);
    }
  }
  assert.ok(out.some((p) => p.moved));
});

test("markers already apart do not move", () => {
  const out = separate([{ x: 50, y: 50, r: 10 }, { x: 200, y: 120, r: 12 }], { width: 640, height: 300 });
  assert.deepEqual(out.map((p) => [p.x, p.y, p.moved]), [[50, 50, false], [200, 120, false]]);
});

test("markers on exactly the same spot are split", () => {
  const out = separate([{ x: 100, y: 100, r: 9 }, { x: 100, y: 100, r: 9 }, { x: 100, y: 100, r: 9 }], { width: 640, height: 300 });
  assert.ok(Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y) >= 20.9);
  assert.ok(Math.hypot(out[1].x - out[2].x, out[1].y - out[2].y) >= 20.9);
});
