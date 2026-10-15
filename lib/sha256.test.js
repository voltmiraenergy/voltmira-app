import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { sha256 } from "./sha256.js";

test("known vectors", () => {
  assert.equal(sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
});

test("agrees with node's own on lengths around the block edges, on bytes and on UTF-8", () => {
  for (const n of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000, 70000]) {
    const b = new Uint8Array(randomBytes(n));
    assert.equal(sha256(b), createHash("sha256").update(b).digest("hex"), `length ${n}`);
  }
  const s = "Parcul hibrid Sud: Racordarea la rețea, Договір, ✓";
  assert.equal(sha256(s), createHash("sha256").update(s, "utf8").digest("hex"));
});
