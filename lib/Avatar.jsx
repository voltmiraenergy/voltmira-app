// lib/Avatar.jsx — the initials tile used wherever a project or client is listed.
//
// One implementation, because there were already two copies of initials() in
// the tree (projects/page.jsx and activity/page.jsx) differing only in what
// they return for an empty string. Both now import from here.
//
// The colour is derived from the name, not stored: the same client is always
// the same colour, on every page and for every user, with nothing to migrate.
// A hash over the string picks one of ten brand-adjacent tones, so a list
// reads as distinct tiles rather than a column of identical squares.
//
// Deliberately a rounded square, not the circle .avatar uses in the sidebar and
// the owner column — those identify a *person* (you, a teammate), these identify
// a *project or client*. Keeping the two shapes apart keeps that readable.

/**
 * "Ion Popescu" → "IP"; "Popescu" → "PO"; "a@b.co" → "A@"; "" → fallback.
 *
 * The two copies this replaces returned a single letter for a one-word name,
 * which leaves a 38px tile looking half-empty. Two letters from the one word
 * reads better and is what every other initials tile does.
 */
export function initials(s, fallback = "—") {
  s = (s || "").trim();
  if (!s) return fallback;
  if (s.includes("@")) return s.slice(0, 2).toUpperCase();
  const p = s.split(/\s+/).filter(Boolean);
  if (p.length >= 2) return ((p[0][0] || "") + (p[1][0] || "")).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/**
 * Stable index into the palette. FNV-1a over the code points — small, no
 * dependencies, and well spread for short strings, which matters because most
 * of these names share a first letter ("Casa …", "Vila …", "Ferma …").
 *
 * Collisions are inherent: with ten tones a list of a dozen clients will
 * usually show a repeat somewhere. That is the accepted trade for the same
 * client being the same colour on every page and for every teammate, which is
 * the property that actually helps someone scan a list they see daily.
 */
export function avatarTone(s) {
  let h = 0x811c9dc5;
  const str = (s || "").trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 10;
}

/**
 * @param {string}  name   the project or client name the initials come from
 * @param {number} [size]  px; the tile is square and the type scales with it
 * @param {string} [title] tooltip — pass the full name, since the tile shows two letters
 */
export default function Avatar({ name, size = 38, title, className = "" }) {
  const label = initials(name, "•");
  return (
    <span
      className={`av-sq av-c${avatarTone(name)} ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), borderRadius: Math.round(size * 0.28) }}
      title={title ?? (name || undefined)}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
