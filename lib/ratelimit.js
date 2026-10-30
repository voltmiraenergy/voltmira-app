// lib/ratelimit.js — rate limiting that actually works on serverless.
//
// Vercel runs many short-lived function instances, so an in-memory Map is NOT a reliable limiter across the fleet.
// Three counters, the first that answers wins:
//   1. Upstash Redis, when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set (fastest, shared).
//   2. Postgres, in production without Upstash: one atomic call (supabase/add-rate-limits.sql rate_limit_hit), shared
//      by every instance, so a limit means the same thing on all of them.
//   3. In memory, per instance: local development, and the last resort when both above fail (logged once).
// Setup for Upstash (5 min, free tier): create a database at https://upstash.com, copy the REST URL + token into
// Vercel env vars, redeploy. Without it, run add-rate-limits.sql so production still has a shared counter.

const mem = new Map();
let warned = false;

function memLimited(key, max, windowMs, now = Date.now()) {
  // forget the keys whose window is over, so the map cannot grow without end
  if (mem.size > 5000) for (const [k, r] of mem) if (now - r.t > 3_600_000) mem.delete(k);
  const rec = mem.get(key) || { n: 0, t: now };
  if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
  rec.n++; mem.set(key, rec);
  return rec.n > max;
}

async function upstashLimited(key, max, windowMs, env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  const windowSec = Math.ceil(windowMs / 1000);
  // The key is created with its expiry (SET ... EX ... NX) before it is counted, so a failure between the
  // two calls can never leave a counter that does not expire and blocks a caller for good.
  const headers = { Authorization: `Bearer ${token}` };
  await fetch(`${url}/set/${encodeURIComponent(key)}/0/EX/${windowSec}/NX`, { headers, cache: "no-store" });
  const incr = await fetch(`${url}/incr/${encodeURIComponent(key)}`, { headers, cache: "no-store" }).then((r) => r.json());
  const count = Number(incr.result);
  if (!Number.isFinite(count)) throw new Error("upstash_incr");
  return count > max;
}

async function dbLimited(key, max, windowMs, db) {
  const { data, error } = await db.rpc("rate_limit_hit", { p_key: String(key).slice(0, 200), p_max: max, p_window_ms: Math.round(windowMs) });
  if (error || typeof data !== "boolean") throw new Error(error?.message || "rate_limit_hit");
  return data;
}

/** Which shared counter is used: "upstash", "postgres" (production without Upstash) or "memory". */
export function rateLimitBackend(env = process.env) {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) return "upstash";
  if (env.NODE_ENV === "production" && env.SUPABASE_SERVICE_ROLE_KEY && env.RATE_LIMIT_DB !== "off") return "postgres";
  return "memory";
}

/**
 * Returns true if the caller identified by `key` has EXCEEDED `max` requests within `windowMs`.
 * @param {object} [deps]  for tests: { env, db } (db: a Supabase client with rpc)
 */
export async function isRateLimited(key, max = 60, windowMs = 60_000, deps = {}) {
  const env = deps.env || process.env;
  const backend = rateLimitBackend(env);
  try {
    if (backend === "upstash") return await upstashLimited(key, max, windowMs, env);
    if (backend === "postgres") {
      const db = deps.db || (await import("./supabase.js")).supabaseAdmin();
      return await dbLimited(key, max, windowMs, db);
    }
  } catch (e) {
    // the shared counter did not answer: counted in this instance instead (never "no limit at all")
    if (!warned) { warned = true; console.error(`[ratelimit] ${backend} unavailable, counting per instance:`, e?.message); }
  }
  return memLimited(key, max, windowMs);
}

/** Extract a best-effort client IP from the request (Vercel sets x-forwarded-for to the real client first). */
export function clientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}
