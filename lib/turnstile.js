// lib/turnstile.js — check a Cloudflare Turnstile token on the server (the public forms: forgot password, the
// estimate page). Without TURNSTILE_SECRET_KEY it lets the request through, so a local copy or a preview works before
// Turnstile is set up; the rate limits still apply.

/**
 * @param {string} token  what the browser's Turnstile widget gave
 * @param {{secret?: string, fetchImpl?: Function, ip?: string}} [o]
 * @returns {Promise<boolean>}
 */
export async function turnstileOk(token, { secret = process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET, fetchImpl = globalThis.fetch, ip = "" } = {}) {
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: String(token) });
    if (ip) body.set("remoteip", ip);
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    const j = await res.json().catch(() => ({}));
    return !!j.success;
  } catch {
    return false;
  }
}
