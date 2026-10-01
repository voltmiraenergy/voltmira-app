// lib/secretBox.js — encrypt third-party credentials before they are stored.
//
// Inverter-portal logins and Telegram bot tokens are the installer's own
// accounts with other services. They are sealed with AES-256-GCM under a key
// that lives only in the server's environment (CREDENTIALS_SECRET_KEY, 32 bytes
// as base64 or hex; INVERTER_SECRET_KEY, its earlier name, still works), and
// stored in tables the browser has no access to at all
// (supabase/add-inverter-portals.sql, add-lead-agent.sql). A leaked database
// dump alone doesn't reveal them.
//
// Fails closed: with no key configured, keyFromEnv() returns null and callers
// refuse to store anything, rather than saving a credential in the clear.
// Server-only (node:crypto).
import crypto from "node:crypto";

const VERSION = "v1";

/** The 32-byte key from the environment, or null when none is configured. */
export function keyFromEnv(raw = process.env.CREDENTIALS_SECRET_KEY || process.env.INVERTER_SECRET_KEY) {
  if (!raw) return null;
  const s = String(raw).trim();
  const buf = /^[0-9a-f]{64}$/i.test(s) ? Buffer.from(s, "hex") : Buffer.from(s, "base64");
  return buf.length === 32 ? buf : null;
}

/** Seal a JSON-serialisable value. Output: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function seal(value, key) {
  if (!key || key.length !== 32) throw new Error("no_secret_key");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Open a sealed value. Throws on a wrong key or any tampering. */
export function open(sealed, key) {
  if (!key || key.length !== 32) throw new Error("no_secret_key");
  const [v, iv, tag, ct] = String(sealed || "").split(".");
  if (v !== VERSION || !iv || !tag || !ct) throw new Error("bad_secret_format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]);
  return JSON.parse(pt.toString("utf8"));
}

/** "ion.popescu@example.com" -> "io•••••@example.com": enough to recognise, not to reuse. */
export function maskLogin(login) {
  const s = String(login || "").trim();
  if (!s) return "";
  const at = s.indexOf("@");
  if (at > 0) return s.slice(0, Math.min(2, at)) + "•••••" + s.slice(at);
  return s.length <= 3 ? s[0] + "••" : s.slice(0, 2) + "•••••" + s.slice(-1);
}
