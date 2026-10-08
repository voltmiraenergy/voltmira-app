// lib/gridData.js — the power grid around a point, from OpenStreetMap through
// the Overpass API: substations inside Moldova at 35 kV and above (or marked
// transmission) within 40 km, and the lines at 35 kV and above within 20 km
// with their routes. The main instance gives each address two query slots
// with a cool-down after each query: when it answers "busy" (429), its status
// page says when a slot frees, and the query waits for it (up to 25 s) and
// runs once more; the public kumi.systems mirror is the last try. Overpass asks
// for an identifying User-Agent and light use; one query per click,
// rate-limited per user (lib/plantActions.js). Server-only.
import { parseGrid, keepGrid } from "./gridNear.js";
import { crossingsQuery, parseCrossings, routeKey } from "./gridCrossings.js";

const MAIN = "https://overpass-api.de/api";
const MIRROR = "https://overpass.kumi.systems/api/interpreter";
const EMAIL = process.env.GEOCODER_EMAIL || "contact@voltmira.com";
const HEADERS = { "user-agent": `VoltMira/1.0 (${EMAIL})` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Seconds until the main instance frees a slot for this address, from its status page; null when it cannot say. */
export function slotWait(statusText) {
  const t = String(statusText || "");
  const free = t.match(/(\d+) slots? available now/i);
  if (free && Number(free[1]) > 0) return 0;
  const m = t.match(/in (\d+) seconds/i);
  return m ? Number(m[1]) : null;
}

/** The Overpass query: Moldova's substations at 35 kV and above near the point, and the lines near it. */
export function gridQuery(lat, lon, { subsKm = 40, linesKm = 20 } = {}) {
  const at = `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
  return `[out:json][timeout:30];
area["ISO3166-1"="MD"][admin_level=2]->.md;
(
  nwr["power"="substation"]["voltage"~"(35|110|150|220|330|400|750)000"](area.md)(around:${subsKm * 1000},${at});
  nwr["power"="substation"]["substation"="transmission"](area.md)(around:${subsKm * 1000},${at});
);
out tags center qt;
way["power"="line"]["voltage"~"(35|110|150|220|330|400|750)000"](around:${linesKm * 1000},${at});
out tags geom qt;
node["place"~"^(city|town|village)$"](area.md)(around:${subsKm * 1000},${at});
out qt;`;
}

/**
 * The grid around a point.
 * @returns {Promise<{ grid: object, paths: object[] }>} the record kept on the plant, and the lines' full routes for the map
 */
export async function fetchGridNear(lat, lon) {
  const at = { lat: Number(lat), lon: Number(lon) };
  const parsed = await overpass(gridQuery(at.lat, at.lon), (json) => parseGrid(json, at));
  return { grid: keepGrid(parsed, at, new Date().toISOString().slice(0, 10)), paths: parsed.paths };
}

/** What a route crosses (lib/gridCrossings.js), with the route's key and the date. */
export async function fetchCrossings(points) {
  const items = await overpass(crossingsQuery(points), parseCrossings);
  return { key: routeKey(points), fetched: new Date().toISOString().slice(0, 10), items };
}

/** One Overpass query, waiting for a slot when the main instance is busy, the mirror last. */
async function overpass(query, parse) {
  const body = "data=" + encodeURIComponent(query);
  const ask = (url, ms) => fetch(url, {
    method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(ms),
    headers: { ...HEADERS, "content-type": "application/x-www-form-urlencoded" },
  });
  const done = async (res) => parse(await res.json());
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ask(`${MAIN}/interpreter`, 30000);
      if (res.ok) return await done(res);
      lastErr = new Error(`overpass_${res.status}`);
      // busy: wait for the slot the status page names, once
      if (attempt === 0 && (res.status === 429 || res.status === 504)) {
        const st = await fetch(`${MAIN}/status`, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(5000) }).then((r) => r.text()).catch(() => "");
        const wait = slotWait(st);
        await sleep(Math.min(25, wait == null ? 8 : wait + 1) * 1000);
        continue;
      }
      break;
    } catch (e) {
      lastErr = e;
      break;
    }
  }
  try {
    const res = await ask(MIRROR, 15000);
    if (res.ok) return await done(res);
    lastErr = new Error(`overpass_mirror_${res.status}`);
  } catch (e) {
    lastErr = e;
  }
  throw lastErr || new Error("overpass_unavailable");
}
