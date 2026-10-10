// lib/plantStart.js — the guided start of a developer's plant (app/(app)/
// portfolios/start): the form's fields read into a plant and the loan terms,
// and what is missing before a credit summary can mean anything. Nothing is
// filled in for the developer: every cost and price is theirs, because a
// pack built on figures VoltMira made up would mislead a bank. Pure; no I/O.
import { blankPlant } from "./plantSample.js";

const num = (v) => {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export const REVENUE_KINDS = ["auction", "ppa", "merchant"];

/**
 * @param {Record<string,string>} f  the form's fields
 * @returns {{ plant: object|null, finance: object|null, errors: string[] }}
 *   errors are text keys (lib/plantText.js st_err_*), in the form's order
 */
export function parsePlantStart(f) {
  const errors = [];
  const name = String(f.name || "").trim().slice(0, 160);
  if (!name) errors.push("st_err_name");
  const lat = num(f.lat), lon = num(f.lon);
  const located = lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  if (!located) errors.push("st_err_site");

  const has = (k) => f[k] === "on" || f[k] === "1" || f[k] === true;
  const wantSolar = has("hasSolar"), wantWind = has("hasWind"), wantBess = has("hasBess");
  if (!wantSolar && !wantWind) errors.push("st_err_parts");

  // a figure that must be above zero when its part is built
  const need = (key, err, { int = false, max = Infinity } = {}) => {
    const v = num(f[key]);
    if (v == null || Number.isNaN(v) || !(v > 0) || v > max || (int && !Number.isInteger(v))) { errors.push(err); return null; }
    return v;
  };
  // a figure that may be zero (a cost the developer has none of), never negative
  const may = (key, err) => {
    const v = num(f[key]);
    if (v == null) return 0;
    if (Number.isNaN(v) || v < 0) { errors.push(err); return 0; }
    return v;
  };

  const costs = {};
  let solar = null, wind = null, bess = null;
  if (wantSolar) {
    const mwp = need("solarMwp", "st_err_solar_mwp", { max: 2000 });
    costs.solarEurPerKw = need("solarCapex", "st_err_solar_capex", { max: 10000 });
    costs.opexSolarEurPerKwYr = need("solarOpex", "st_err_solar_opex", { max: 500 });
    solar = { mwp: mwp || 0, yieldKwhKwp: 0 };
  }
  if (wantWind) {
    const mw = need("windMw", "st_err_wind_mw", { max: 2000 });
    const turbines = need("windTurbines", "st_err_wind_turbines", { int: true, max: 500 });
    const hubM = need("windHub", "st_err_wind_hub", { max: 250 });
    costs.windEurPerKw = need("windCapex", "st_err_wind_capex", { max: 10000 });
    costs.opexWindEurPerKwYr = need("windOpex", "st_err_wind_opex", { max: 500 });
    wind = { mw: mw || 0, turbines: turbines || 1, hubM: hubM || 0 };
  }
  if (wantBess) {
    const mw = need("bessMw", "st_err_bess_mw", { max: 2000 });
    const mwh = need("bessMwh", "st_err_bess_mwh", { max: 8000 });
    costs.bessEurPerKwh = need("bessCapex", "st_err_bess_capex", { max: 5000 });
    bess = { mw: mw || 0, mwh: mwh || 0 };
  }
  costs.gridEur = may("gridEur", "st_err_grid");

  const kind = REVENUE_KINDS.includes(f.revKind) ? f.revKind : "auction";
  const price = need("revPrice", "st_err_price", { max: 1000 });
  const years = kind === "merchant" ? 0 : need("revYears", "st_err_years", { int: true, max: 30 });
  const after = kind === "merchant" ? 0 : may("revAfter", "st_err_after");
  const revenue = { kind, priceEurMwh: price || 0, years: years || 0, indexPct: 0, afterEurMwh: after, currency: "EUR", bessEurPerMwYr: 0 };

  const gearingPct = need("gearingPct", "st_err_gearing", { max: 95 });
  const ratePct = need("ratePct", "st_err_rate", { max: 40 });
  const tenorYears = need("tenorYears", "st_err_tenor", { int: true, max: 25 });

  if (errors.length) return { plant: null, finance: null, errors };
  const plant = {
    ...blankPlant(name),
    locality: String(f.locality || "").trim().slice(0, 120), lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6,
    solar, wind, bess, revenue, costs,
  };
  return { plant, finance: { gearingPct, ratePct, tenorYears }, errors: [] };
}
