// lib/inverters/growatt.js — Growatt, via its OpenAPI v1.
//
// Built to Growatt's published OpenAPI:
//   GET /v1/plant/list?page=&perpage=          -> data.plants[] { plant_id, name, peak_power (kW) }
//   GET /v1/plant/energy?plant_id=&start_date=&end_date=&time_unit=month
//                                              -> data.energys[] { date: "YYYY-MM", energy (kWh) }
// Auth is a single API token (header `token`) that Growatt issues to the
// installer's account. Every answer carries error_code (0 = OK) and error_msg.
// Read defensively; confirm against a live account.
import { PortalError, getJson, kwhOrNull } from "./common.js";

export const GROWATT_HOSTS = ["openapi.growatt.com"];

/** Plant list -> [{ id, name, capacityKw }]. */
export function parseGrowattPlants(json) {
  if (!json || Number(json.error_code) !== 0) return null;
  const list = Array.isArray(json.data?.plants) ? json.data.plants : [];
  return list
    .filter((p) => p && p.plant_id != null)
    .map((p) => ({ id: String(p.plant_id), name: String(p.name || p.plant_id), capacityKw: kwhOrNull(p.peak_power) }));
}

/** Energy by month -> [{ month, kwh }], only months of `year`. */
export function parseGrowattMonths(json, year) {
  if (!json || Number(json.error_code) !== 0) return [];
  const rows = Array.isArray(json.data?.energys) ? json.data.energys : [];
  return rows
    .map((r) => ({ month: String(r?.date || "").slice(0, 7), kwh: kwhOrNull(r?.energy) }))
    .filter((r) => /^\d{4}-\d{2}$/.test(r.month) && r.month.startsWith(String(year)) && r.kwh != null);
}

function refused(json, what) {
  const code = Number(json?.error_code);
  if (code === 10011 || /token/i.test(json?.error_msg || "")) return new PortalError("auth", "Growatt rejected the API token.");
  return new PortalError("bad_response", `Growatt refused ${what}: ${json?.error_msg || `error ${json?.error_code ?? "?"}`}`);
}

export function createGrowatt({ token, host }, fetchImpl = fetch) {
  const h = host || GROWATT_HOSTS[0];
  if (!GROWATT_HOSTS.includes(h)) throw new PortalError("config", "Unknown Growatt server.");
  if (!token) throw new PortalError("config", "Growatt needs an API token.");
  const base = `https://${h}/v1`;
  const get = async (path, what) => {
    const { json } = await getJson(fetchImpl, `${base}${path}`, { headers: { token } });
    if (Number(json?.error_code) !== 0) throw refused(json, what);
    return json;
  };

  return {
    async listStations() {
      const all = [];
      for (let page = 1; page <= 20; page++) {
        const json = await get(`/plant/list?page=${page}&perpage=100`, "the plant list");
        const rows = parseGrowattPlants(json) || [];
        all.push(...rows);
        if (all.length >= (Number(json.data?.count) || 0) || rows.length < 100) break;
      }
      return all;
    },
    async monthly(ids, year) {
      const out = new Map();
      for (const id of ids) {
        const json = await get(`/plant/energy?plant_id=${encodeURIComponent(id)}&start_date=${year}-01-01&end_date=${year}-12-31&time_unit=month&page=1&perpage=100`, "the monthly energy");
        out.set(String(id), parseGrowattMonths(json, year));
      }
      return out;
    },
  };
}
