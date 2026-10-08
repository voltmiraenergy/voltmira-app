// lib/geoPlace.js — where a quote is, for the portfolio map, when the
// installer has not pinned it in the quote. Pure; no I/O. The lookup itself is
// lib/geoActions.js (OpenStreetMap's Nominatim, the geocoder the app already
// uses); this decides what to ask it and how sure the answer is.
//
// The order of questions: the quote's address (with the town from the title
// when the address does not name it), then the town alone. A town-level
// answer is marked "locality" and shown as approximate on the map.
//
// These positions are kept on the PORTFOLIO (portfolios.assets[id].pos), never
// written to the quote: the quote's own lat/lon drive its PVGIS yield and the
// roof designer, and a town centre must not stand in for a roof.

export const COUNTRY = {
  MD: { code: "md", name: "Republica Moldova" },
  UA: { code: "ua", name: "Україна" },
  RO: { code: "ro", name: "România" },
};

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 160);

/** "Casa Bejan, Ungheni" -> "Ungheni"; null when the title names no town after a comma. */
export function townFromTitle(title) {
  const parts = clean(title).split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const t = parts[parts.length - 1];
  if (t.length < 2 || t.length > 48 || !/\p{L}/u.test(t) || /^\d/.test(t)) return null;
  return t;
}

/**
 * The searches to try, in order.
 * @param {{ address?: string, title?: string, market?: string }} q
 * @returns {Array<{ q: string, kind: "address"|"locality", country: string }>}
 */
export function placeQueries({ address, title, market } = {}) {
  const c = COUNTRY[market] || COUNTRY.MD;
  const addr = clean(address);
  const town = townFromTitle(title);
  const out = [];
  if (addr) {
    const withTown = town && !addr.toLowerCase().includes(town.toLowerCase()) ? `${addr}, ${town}` : addr;
    out.push({ q: `${withTown}, ${c.name}`, kind: "address", country: c.code });
  }
  if (town) out.push({ q: `${town}, ${c.name}`, kind: "locality", country: c.code });
  return out;
}

/** What a saved position was looked up from: when the quote changes, it is looked up again. */
export const placeKey = (q) => placeQueries(q)[0]?.q || "";

// Nominatim's addresstype for answers that point at a building or a street
const ADDRESS_LEVEL = new Set(["house", "building", "road", "street", "amenity", "shop", "office", "craft", "tourism", "leisure", "man_made", "industrial", "commercial", "retail"]);

/** "address" when the answer points at a building or street from an address search; else "locality". */
export function precisionOf(addresstype, kind) {
  if (kind !== "address") return "locality";
  return ADDRESS_LEVEL.has(String(addresstype || "").toLowerCase()) ? "address" : "locality";
}

/**
 * Points that share a spot (several jobs in one town looked up at its centre)
 * are spread on a small circle so each marker can be seen and clicked. Order
 * and every other field are kept.
 * @param {Array<{lat:number, lon:number}>} points
 * @param {number} [radius]  degrees of latitude; about 600 m by default
 */
export function spread(points, radius = 0.0055) {
  const groups = new Map();
  points.forEach((p, i) => {
    const k = `${Number(p.lat).toFixed(4)},${Number(p.lon).toFixed(4)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  const out = points.map((p) => ({ ...p }));
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    idx.forEach((i, j) => {
      const a = (2 * Math.PI * j) / idx.length;
      const lat = Number(points[i].lat);
      out[i].lat = lat + radius * Math.sin(a);
      // a degree of longitude is shorter away from the equator
      out[i].lon = Number(points[i].lon) + (radius * Math.cos(a)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    });
  }
  return out;
}

/** A saved position, if it is usable and still matches the quote. */
export function savedPos(pos, query) {
  if (!pos || typeof pos !== "object") return null;
  const lat = Number(pos.lat), lon = Number(pos.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  if (query && pos.q && pos.q !== placeKey(query)) return null;
  return { lat, lon, precision: pos.precision === "address" ? "address" : "locality", q: pos.q || "" };
}
