// lib/inverters/fusionsolar.js — Huawei FusionSolar, via its Northbound
// ("thirdData") API for installers.
//
// Built to Huawei's published Northbound interface:
//   POST /thirdData/login               { userName, systemCode } -> xsrf-token header
//   POST /thirdData/stations            { pageNo }               -> data.list[] { plantCode, plantName, capacity (kWp) }
//   POST /thirdData/getKpiStationMonth  { stationCodes, collectTime } -> data[] { stationCode, collectTime, dataItemMap }
// Each call answers { success, failCode, data }. failCode 305 means the session
// expired (log in again once); 407 means too many calls.
//
// The account is an API ("Northbound") user the installer creates in
// FusionSolar, on their own regional host (eu5.fusionsolar.huawei.com, …).
// Response fields are read defensively; confirm against a live account.
import { PortalError, getJson, kwhOrNull, monthKey } from "./common.js";

// Only Huawei's own hosts: the host is typed by the installer, and must never
// point our server at anything else.
const HOST_RE = /^[a-z0-9-]+\.fusionsolar\.huawei\.com$/i;

export function validFusionHost(host) {
  return HOST_RE.test(String(host || "").trim());
}

/** Stations page -> [{ id, name, capacityKw }]. */
export function parseFusionStations(json) {
  if (!json || json.success !== true) return null;
  const list = Array.isArray(json.data?.list) ? json.data.list : [];
  return list
    .filter((s) => s && s.plantCode)
    .map((s) => ({ id: String(s.plantCode), name: String(s.plantName || s.plantCode), capacityKw: kwhOrNull(s.capacity) }));
}

// collectTime is midnight on the 1st of the month in the station's own time
// zone, e.g. 2026-01-01T00:00+02:00 = 2025-12-31T22:00Z. Reading it as UTC would
// file January under December; half a day later is safely inside the month
// for every European zone.
export function monthOfCollectTime(ms) {
  const d = new Date(Number(ms) + 12 * 3600_000);
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** getKpiStationMonth -> Map(stationCode -> [{ month, kwh }]). */
export function parseFusionMonths(json) {
  const out = new Map();
  if (!json || json.success !== true) return out;
  for (const row of Array.isArray(json.data) ? json.data : []) {
    if (!row || !row.stationCode || row.collectTime == null) continue;
    const m = row.dataItemMap || {};
    // PVYield is the newer key; inverter_power the older one. Both are kWh.
    const kwh = kwhOrNull(m.PVYield ?? m.inverter_power);
    if (kwh == null) continue;
    const id = String(row.stationCode);
    if (!out.has(id)) out.set(id, []);
    out.get(id).push({ month: monthOfCollectTime(row.collectTime), kwh });
  }
  return out;
}

function failure(json, what) {
  const code = Number(json?.failCode);
  if (code === 305 || code === 20001) return new PortalError("auth", "FusionSolar session expired.");
  if (code === 407) return new PortalError("rate_limited", "FusionSolar allows only a few calls per hour. Try again later.");
  return new PortalError("bad_response", `FusionSolar refused ${what} (failCode ${json?.failCode ?? "?"}).`);
}

export function createFusionSolar({ domain, userName, systemCode }, fetchImpl = fetch) {
  const host = String(domain || "").trim();
  if (!validFusionHost(host)) throw new PortalError("config", "Use your FusionSolar host, like eu5.fusionsolar.huawei.com.");
  const base = `https://${host}/thirdData`;
  let token = null;

  async function login() {
    const { res, json } = await getJson(fetchImpl, `${base}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName, systemCode }),
    });
    if (json?.success !== true) throw new PortalError("auth", "FusionSolar rejected the API user or password.");
    const fromHeader = res.headers.get("xsrf-token");
    const fromCookie = /XSRF-TOKEN=([^;]+)/i.exec(res.headers.get("set-cookie") || "")?.[1];
    token = fromHeader || fromCookie || null;
    if (!token) throw new PortalError("bad_response", "FusionSolar logged in but sent no session token.");
  }

  async function call(path, body, what, retried = false) {
    if (!token) await login();
    const { json } = await getJson(fetchImpl, `${base}/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", "XSRF-TOKEN": token },
      body: JSON.stringify(body),
    });
    if (json?.success === true) return json;
    const err = failure(json, what);
    if (err.code === "auth" && !retried) { token = null; return call(path, body, what, true); }
    throw err;
  }

  return {
    async listStations() {
      const all = [];
      for (let pageNo = 1; pageNo <= 20; pageNo++) {
        const json = await call("stations", { pageNo }, "the station list");
        const page = parseFusionStations(json) || [];
        all.push(...page);
        const pages = Number(json.data?.pageCount) || 1;
        if (pageNo >= pages || !page.length) break;
      }
      return all;
    },
    async monthly(ids, year) {
      const out = new Map();
      // The interface takes up to 100 station codes per call.
      for (let i = 0; i < ids.length; i += 100) {
        const json = await call("getKpiStationMonth",
          { stationCodes: ids.slice(i, i + 100).join(","), collectTime: Date.UTC(year, 6, 1) }, "the monthly yield");
        for (const [id, rows] of parseFusionMonths(json)) out.set(id, rows.filter((r) => r.month.startsWith(String(year))));
      }
      return out;
    },
  };
}
