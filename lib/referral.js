// lib/referral.js — the link a signed client shares with friends (/r/<token>) is NOT the offer's own
// code. The code opens the whole offer (name, address, price, equipment, signature name, the PDF), so a
// link forwarded from friend to friend gave all of it away. The recommendation page and its form
// look an offer up by proposals.referral_token (add-security-hardening.sql), a random value that opens
// nothing else. Until that column exists (a database that has not run the file) the offer's code is
// used as before, so nothing stops working in between. Server only.

/**
 * @param {object} db   service-role client
 * @param {string} key  the value from /r/<key> or the form
 * @param {string} cols columns to read (must include accepted_at)
 * @returns {Promise<object|null>} the proposal row, or null
 */
export async function findByReferral(db, key, cols) {
  const k = String(key || "");
  if (!/^[a-z0-9]{6,40}$/i.test(k)) return null;
  const byToken = await db.from("proposals").select(cols).eq("referral_token", k).maybeSingle();
  if (!byToken.error) return byToken.data || null;   // the column exists: only the token counts
  if (!/referral_token|column|schema cache/i.test(byToken.error.message || "")) return null;
  const legacy = await db.from("proposals").select(cols).eq("code", k).maybeSingle();
  return legacy.data || null;
}
