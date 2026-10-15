// lib/inverters/solarman.js — Solarman, the cloud behind Deye, Sofar, Afore and
// other inverters sold with Solarman loggers.
//
// Built to Solarman's published OpenAPI:
//   POST /account/v1.0/token?appId=…   { appSecret, email|username, password: sha256 hex } -> access_token
//   POST /station/v1.0/list            { page, size }  -> stationList[] { id, name, installedCapacity (kW) }
//   POST /station/v1.0/history         { stationId, timeType: 3, startTime: "YYYY-MM", endTime: "YYYY-MM" }
//                                      -> stationDataItems[] { year, month, generationValue (kWh) }
// Every answer carries { success, code, msg }. The appId/appSecret come from
// Solarman's developer programme (one per installer company); the login is the
// installer's normal Solarman account. Read defensively; confirm against a live
// account.
import crypto from "node:crypto";
import { PortalError, getJson, kwhOrNull, monthKey } from "./common.js";

export const SOLARMAN_HOSTS = ["globalapi.solarmanpv.com"];

/** Station list -> [{ id, name, capacityKw }]. */
export function parseSolarmanStations(json) {
  if (!json || json.success === false) return null;
  const list = Array.isArray(json.stationList) ? json.stationList : [];
  return list
    .filter((s) => s && s.id != null)
    .map((s) => ({ id: String(s.id), name: String(s.name || s.id), capacityKw: kwhOrNull(s.installedCapacity) }));
}

/** Monthly history -> [{ month, kwh }], only months of `year`. */
export function parseSolarmanMonths(json, year) {
  if (!json || json.success === false) return [];
  const items = Array.isArray(json.stationDataItems) ? json.stationDataItems : [];
  return items
    .map((it) => ({ y: Number(it?.year), m: Number(it?.month), kwh: kwhOrNull(it?.generationValue) }))
    .filter((r) => r.y === year && r.m >= 1 && r.m <= 12 && r.kwh != null)
    .map((r) => ({ month: monthKey(r.y, r.m), kwh: r.kwh }));
}

export function createSolarman({ appId, appSecret, login, password, host }, fetchImpl = fetch) {
  const h = host || SOLARMAN_HOSTS[0];
  if (!SOLARMAN_HOSTS.includes(h)) throw new PortalError("config", "Unknown Solarman server.");
  if (!appId || !appSecret) throw new PortalError("config", "Solarman needs an App ID and App Secret.");
  const base = `https://${h}`;
  let token = null;

  async function auth() {
    const body = {
      appSecret,
      password: crypto.createHash("sha256").update(String(password || "")).digest("hex"),
      ...(String(login || "").includes("@") ? { email: login } : { username: login }),
    };
    const { json } = await getJson(fetchImpl, `${base}/account/v1.0/token?appId=${encodeURIComponent(appId)}&language=en`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!json?.access_token) throw new PortalError("auth", json?.msg ? `Solarman: ${json.msg}` : "Solarman rejected the app or the login.");
    token = json.access_token;
  }

  async function call(path, body) {
    if (!token) await auth();
    const { json } = await getJson(fetchImpl, `${base}${path}?language=en`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (json?.success === false) throw new PortalError("bad_response", `Solarman: ${json.msg || json.code || "request refused"}`);
    return json;
  }

  return {
    async listStations() {
      const all = [];
      for (let page = 1; page <= 20; page++) {
        const json = await call("/station/v1.0/list", { page, size: 100 });
        const rows = parseSolarmanStations(json) || [];
        all.push(...rows);
        if (all.length >= (Number(json.total) || 0) || rows.length < 100) break;
      }
      return all;
    },
    async monthly(ids, year) {
      const out = new Map();
      for (const id of ids) {
        const json = await call("/station/v1.0/history",
          { stationId: Number(id) || id, timeType: 3, startTime: `${year}-01`, endTime: `${year}-12` });
        out.set(String(id), parseSolarmanMonths(json, year));
      }
      return out;
    },
  };
}
