// lib/notifySign.js — a link in an email that acts without signing in (the
// reading alert's "checked, remind me in 30 days"), signed so that only the
// email VoltMira sent can make it: an HMAC of the action and the quote's id,
// keyed by a server secret (NOTIFY_SECRET, else the Supabase service key,
// which every deployment has). Server-only.
import { createHmac, timingSafeEqual } from "node:crypto";

const key = () => process.env.NOTIFY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** The signature of one action on one quote, or "" with no secret. */
export function signAction(action, projectId) {
  const k = key();
  return k ? createHmac("sha256", k).update(`${action}:${projectId}`).digest("base64url").slice(0, 32) : "";
}

/** True when `sig` was made by signAction for this action and quote. */
export function verifyAction(action, projectId, sig) {
  const want = signAction(action, projectId);
  if (!want || typeof sig !== "string" || sig.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
