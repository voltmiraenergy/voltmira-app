// lib/shortCode.js — the random codes in public links (an offer's /p/<code>) and small ids.
// A random code from 31 characters with no lookalikes, drawn without bias (a byte past the last whole multiple of
// 31 is drawn again). An offer's link is its only key, so new offers get 12 characters (about 59 bits; it was 8,
// about 40, guessable by a patient script); links already sent keep working.
export function shortCode(len = 12) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const limit = 256 - (256 % chars.length);
  let s = "";
  while (s.length < len) {
    const buf = new Uint8Array(len * 2);
    crypto.getRandomValues(buf);
    for (const b of buf) if (b < limit && s.length < len) s += chars[b % chars.length];
  }
  return s;
}
