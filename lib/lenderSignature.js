// lib/lenderSignature.js — signing and checking a lender's status webhook
// (app/api/lenders/webhook/[lender]). The header is
//   x-voltmira-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">
// with the lender's own secret (env LENDER_WEBHOOK_SECRET_<CODE>). A
// signature older than five minutes is refused, so a captured request cannot
// be replayed later; the event id makes a repeated delivery a no-op.
import crypto from "node:crypto";

export const SIGNATURE_HEADER = "x-voltmira-signature";
export const TOLERANCE_S = 300;

/** The header value for a body, as a lender sends it (and as tests do). */
export function signBody(raw, secret, t = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

/** @returns {{ ok: true } | { ok: false, error: "no_secret" | "no_signature" | "stale" | "bad_signature" }} */
export function verifyBody(raw, header, secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret) return { ok: false, error: "no_secret" };
  const parts = Object.fromEntries(String(header || "").split(",").map((p) => p.trim().split("=")).filter((p) => p.length === 2));
  const t = Number(parts.t);
  if (!t || !/^[0-9a-f]{64}$/.test(parts.v1 || "")) return { ok: false, error: "no_signature" };
  if (Math.abs(now - t) > TOLERANCE_S) return { ok: false, error: "stale" };
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  const ok = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(parts.v1, "hex"));
  return ok ? { ok: true } : { ok: false, error: "bad_signature" };
}

/** The env name of a lender's webhook secret: maib -> LENDER_WEBHOOK_SECRET_MAIB. */
export const secretEnvName = (code) => `LENDER_WEBHOOK_SECRET_${String(code || "").toUpperCase()}`;

/** A portal token and the hash that is stored for it. */
export function newPortalToken() {
  const token = crypto.randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");
