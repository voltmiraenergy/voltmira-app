import { test } from "node:test";
import assert from "node:assert/strict";
import { isRateLimited, rateLimitBackend } from "./ratelimit.js";

const PROD = { NODE_ENV: "production", SUPABASE_SERVICE_ROLE_KEY: "x" };

test("production without Upstash counts in Postgres, shared by every instance, not per instance", async () => {
  assert.equal(rateLimitBackend(PROD), "postgres");
  assert.equal(rateLimitBackend({ ...PROD, UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" }), "upstash");
  assert.equal(rateLimitBackend({ NODE_ENV: "development" }), "memory");
  // one shared counter, as rate_limit_hit keeps it: two "instances" (two calls with fresh state) see the same total
  const hits = new Map();
  const db = { rpc: async (fn, a) => { assert.equal(fn, "rate_limit_hit"); const n = (hits.get(a.p_key) || 0) + 1; hits.set(a.p_key, n); return { data: n > a.p_max, error: null }; } };
  const out = [];
  for (let i = 0; i < 4; i++) out.push(await isRateLimited("login:1.2.3.4", 3, 60_000, { env: PROD, db }));
  assert.deepEqual(out, [false, false, false, true]);
});

test("the shared counter down: counted per instance (still a limit), never waved through", async () => {
  const db = { rpc: async () => ({ data: null, error: { message: "connection lost" } }) };
  const out = [];
  for (let i = 0; i < 3; i++) out.push(await isRateLimited("k-down-" + process.pid, 2, 60_000, { env: PROD, db }));
  assert.deepEqual(out, [false, false, true]);
});
