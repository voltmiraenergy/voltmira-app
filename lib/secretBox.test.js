import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { keyFromEnv, seal, open, maskLogin } from "./secretBox.js";

const key = crypto.randomBytes(32);

test("a sealed value opens back to the same thing", () => {
  const creds = { userName: "api-user", systemCode: "s3cret!" };
  const box = seal(creds, key);
  assert.match(box, /^v1\./);
  assert.ok(!box.includes("s3cret"));
  assert.deepEqual(open(box, key), creds);
});

test("the same value seals differently every time (random IV)", () => {
  assert.notEqual(seal({ a: 1 }, key), seal({ a: 1 }, key));
});

test("a wrong key or a tampered box is rejected", () => {
  const box = seal({ a: 1 }, key);
  assert.throws(() => open(box, crypto.randomBytes(32)));
  const parts = box.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => open(parts.join("."), key));
});

test("no key configured means nothing is sealed", () => {
  assert.equal(keyFromEnv(""), null);
  assert.equal(keyFromEnv("too-short"), null);
  assert.throws(() => seal({ a: 1 }, null), /no_secret_key/);
});

test("keys are read from hex or base64", () => {
  assert.equal(keyFromEnv(key.toString("hex")).length, 32);
  assert.equal(keyFromEnv(key.toString("base64")).length, 32);
});

test("logins are masked for display", () => {
  assert.equal(maskLogin("ion.popescu@example.com"), "io•••••@example.com");
  assert.equal(maskLogin("installer42"), "in•••••2");
});
