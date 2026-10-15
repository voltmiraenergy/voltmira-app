import { test } from "node:test";
import assert from "node:assert/strict";
import { isRateLimited, clientIp } from "./ratelimit.js";

// These exercise the in-memory fallback specifically — UPSTASH_REDIS_REST_URL/
// TOKEN must stay unset for the whole file, or isRateLimited would try a real
// network call to Upstash instead. Cleared explicitly (not just "assumed
// unset") so this file behaves the same however the shell it runs in was set up.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
test("isRateLimited allows requests under the limit, blocks once over it", async () => {
  const key = "test:" + Math.random();
  for (let i = 0; i < 5; i++) {
    assert.equal(await isRateLimited(key, 5, 60_000), false, `request ${i + 1} should be allowed`);
  }
  assert.equal(await isRateLimited(key, 5, 60_000), true, "the 6th request should be blocked");
});

test("isRateLimited tracks separate keys independently", async () => {
  const a = "test:a:" + Math.random();
  const b = "test:b:" + Math.random();
  for (let i = 0; i < 3; i++) await isRateLimited(a, 3, 60_000);
  assert.equal(await isRateLimited(b, 3, 60_000), false, "a fresh key must not inherit another key's count");
});

test("isRateLimited resets the count once the window has elapsed", async () => {
  const key = "test:window:" + Math.random();
  assert.equal(await isRateLimited(key, 1, 30), false); // 1st request, window 30ms
  assert.equal(await isRateLimited(key, 1, 30), true);  // 2nd, still inside the window
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(await isRateLimited(key, 1, 30), false, "a new window should allow a request again");
});

test("clientIp prefers x-forwarded-for, takes only the first hop", () => {
  const req = { headers: { get: (k) => (k === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null) } };
  assert.equal(clientIp(req), "1.2.3.4");
});

test("clientIp falls back to x-real-ip, then to 'anon'", () => {
  const withRealIp = { headers: { get: (k) => (k === "x-real-ip" ? "9.9.9.9" : null) } };
  assert.equal(clientIp(withRealIp), "9.9.9.9");
  const withNeither = { headers: { get: () => null } };
  assert.equal(clientIp(withNeither), "anon");
});
