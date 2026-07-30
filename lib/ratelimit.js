// lib/ratelimit.js — rate limiting that actually works on serverless.
//
// Vercel runs many short-lived function instances, so an in-memory Map is NOT
// a reliable limiter across the fleet. When UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set, we use Upstash Redis (a shared counter that
// works across all instances). Without them we fall back to a best-effort
// in-memory limiter so local/dev still works — but set Upstash before you rely
// on rate limiting in production.
//
// Setup (5 min, free tier): create a database at https://upstash.com, copy the
// REST URL + token into Vercel env vars, redeploy. No code change needed.

const mem = new Map();

function memLimited(key, max, windowMs) {
  const now = Date.now();
  const rec = mem.get(key) || { n: 0, t: now };
  if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
  rec.n++; mem.set(key, rec);
  return rec.n > max;
}

async function upstashLimited(key, max, windowMs) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const windowSec = Math.ceil(windowMs / 1000);
  // INCR then set EXPIRE on first hit — atomic enough for rate limiting.
  const incr = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).then((r) => r.json());
  const count = incr.result;
  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSec}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  }
  return count > max;
}

/**
 * Returns true if the caller identified by `key` has EXCEEDED `max` requests
 * within `windowMs`. Uses Upstash when configured, else in-memory best-effort.
 */
export async function isRateLimited(key, max = 60, windowMs = 60_000) {
  const hasUpstash =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    if (hasUpstash) return await upstashLimited(key, max, windowMs);
  } catch {
    // If Upstash is unreachable, fall through to in-memory rather than failing open.
  }
  return memLimited(key, max, windowMs);
}

/** Extract a best-effort client IP from the request. */
export function clientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}
