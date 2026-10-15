// lib/inverters/common.js — shared pieces for the inverter-portal connectors.
//
// Every connector exposes the same small surface:
//   listStations()            -> [{ id, name, capacityKw }]
//   monthly(ids, year)        -> Map(id -> [{ month: "YYYY-MM", kwh }])
// and takes an injectable fetch, so the whole flow is testable without a live
// account (see *.test.js). Server-only.

export class PortalError extends Error {
  /** code: "auth" | "rate_limited" | "bad_response" | "network" | "config" */
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/** A finite, non-negative kWh figure, or null. Missing data stays missing:
 *  a gap must never be written as a zero-production month. */
export function kwhOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const monthKey = (year, month1) => `${year}-${String(month1).padStart(2, "0")}`;

/** fetch + JSON, turning network and HTTP failures into PortalErrors. */
export async function getJson(fetchImpl, url, init = {}) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal: init.signal ?? AbortSignal.timeout?.(20000) });
  } catch (e) {
    throw new PortalError("network", `Couldn't reach ${new URL(url).host}: ${e?.message || e}`);
  }
  if (res.status === 401 || res.status === 403) throw new PortalError("auth", `The portal refused the login (HTTP ${res.status}).`);
  if (res.status === 429) throw new PortalError("rate_limited", "The portal is limiting requests. Try again later.");
  if (!res.ok) throw new PortalError("bad_response", `The portal answered HTTP ${res.status}.`);
  let json;
  try { json = await res.json(); } catch { throw new PortalError("bad_response", "The portal's answer wasn't JSON."); }
  return { res, json };
}
