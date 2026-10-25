// lib/estimateCore.js — the free solar estimate for a homeowner: address and
// monthly bill in, recommended system and honest payback bands out. Geocode ->
// real PVGIS yield for that roof -> the same engine as the paid product.
// Shared by the public estimator (app/api/estimate) and the lead assistant
// (lib/leadAgent.js), so the website widget and the chat can never quote
// different numbers for the same house.
import { getSolarYield, geocode } from "@voltmira/engine/pvgis";
import { quote, defaultEngineSettings, MARKETS, FX, amortizedMonthlyPayment } from "@voltmira/engine";
import { annualConsFromBill, sizeSystemKw } from "./leadSizing.js";

// Retail electricity price (EUR/kWh) used to value self-consumption, per market,
// plus the display currency. The price is the market's own default (engine MARKETS), the very one a quote made
// from this estimate starts with (lib/actions.js), so a bill read here gives the same kWh there: a second,
// lower Moldovan price once made the quote's consumption 29% smaller than the estimate's.
export const MARKET_CFG = {
  RO: { price: MARKETS.RO.defaultPrice, currency: "RON" },
  MD: { price: MARKETS.MD.defaultPrice, currency: "MDL" },
  UA: { price: MARKETS.UA.defaultPrice, currency: "UAH" },
  DE: { price: 0.32, currency: "EUR" },
};

const round1 = (v) => Math.round(v * 10) / 10;

// Cache resilient enough that a DB hiccup can't fail a public estimate.
export function dbCache(admin) {
  const TTL = 30 * 24 * 3600 * 1000;
  return {
    async get(k) {
      try {
        const { data } = await admin.from("pvgis_cache").select("value, created_at").eq("key", k).single();
        if (!data) return null;
        if (Date.now() - new Date(data.created_at).getTime() > TTL) return null;
        return data.value;
      } catch { return null; }
    },
    async set(k, v) {
      try { await admin.from("pvgis_cache").upsert({ key: k, value: v, created_at: new Date().toISOString() }); }
      catch { /* best-effort */ }
    },
  };
}

/**
 * A place the client picked from the address suggestions: used as it is when it lies in Moldova or Romania. The house
 * itself when the street part carries a number ("Strada Ceucari 2/4, Chișinău"), else the street.
 * @returns {{ lat, lon, display, kind } | null}
 */
export function pickedPlace(address, lat, lon) {
  const la = Number(lat), lo = Number(lon);
  if (lat == null || lon == null || lat === "" || lon === "" || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < 43.5 || la > 48.5 || lo < 20 || lo > 30.5) return null;
  const street = String(address || "").split(",")[0];
  return { lat: Math.round(la * 1e6) / 1e6, lon: Math.round(lo * 1e6) / 1e6, display: String(address || "").trim(), kind: /\d/.test(street) ? "house" : "road" };
}

export class EstimateError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

/**
 * @param {{ address: string, bill?: number, country?: string, admin: object }} a
 * @returns the estimate (see app/api/estimate for the shape)
 * @throws {EstimateError} no_address | not_found | upstream
 */
export async function estimateSavings({ address, bill, kwh, country = "RO", admin, monthlyPayment = false, lat = null, lon = null }) {
  const addr = String(address || "").trim().slice(0, 200);
  const cc = String(country || "RO").toUpperCase();
  if (!addr) throw new EstimateError("no_address", "Enter an address.", 400);
  const cfg = MARKET_CFG[cc] || MARKET_CFG.RO;
  const mkt = MARKETS[cc] || MARKETS.RO;
  const fx = FX[cfg.currency] || 1;
  // a monthly use in kWh instead of a bill: priced at the market's own tariff, as the lead assistant does
  const kwhRaw = parseFloat(kwh);
  const billRaw = parseFloat(bill) > 0 ? parseFloat(bill) : kwhRaw > 0 ? Math.round(kwhRaw * cfg.price * fx) : NaN;

  try {
    // 1) address -> coordinates: the place the client picked from the suggestions (inside Moldova or Romania), else
    //    the geocoder's best match for the text
    const g = pickedPlace(addr, lat, lon) || await geocode(addr, { email: process.env.GEOCODER_EMAIL });
    if (!g) throw new EstimateError("not_found", "We couldn't find that address — try adding the city.", 404);

    // 2) real PVGIS yield for that roof (south, 35° tilt — sensible residential default)
    const { yieldPerKwp, monthlyShape } = await getSolarYield(g.lat, g.lon, { angle: 35, aspect: 0, cache: dbCache(admin) });

    // 3) derive annual consumption from the monthly bill (or a typical household),
    //    and 4) size the system to roughly cover it — lib/leadSizing.js, so this
    //    stays identical to how lib/actions.js sizes the same lead later if it's
    //    converted into a project.
    const annualCons = annualConsFromBill(billRaw, cfg.price, fx);
    const recommendedKw = sizeSystemKw(annualCons, yieldPerKwp);

    // 5) run the SAME engine as the paid product
    const E = defaultEngineSettings();
    const p = {
      kw: recommendedKw, price: cfg.price, cons: annualCons, batt: false,
      market: cc in MARKETS ? cc : "RO",
      yieldOverride: yieldPerKwp, monthlyYieldShape: monthlyShape,
    };
    const q = quote(p, E);
    const pb = (x) => (x.payback == null ? null : round1(x.payback));

    return {
      location: g.display,
      lat: g.lat, lon: g.lon,
      // how exact the place is: "house" or "building" is the house itself, "road" the street, anything else the town
      precision: ["house", "building", "residential", "detached", "apartments"].includes(g.kind) ? "house" : g.kind === "road" ? "street" : "area",
      market: cc, marketName: mkt.name, scheme: mkt.scheme,
      currency: cfg.currency,
      yieldPerKwp: Math.round(yieldPerKwp),
      recommendedKw,
      annualConsKwh: Math.round(annualCons),
      prodKwh: Math.round(q.e.prod0),
      // the year's production month by month, January first (PVGIS's own monthly shape for this roof)
      monthlyKwh: (Array.isArray(monthlyShape) && monthlyShape.length === 12 ? monthlyShape : Array(12).fill(1)).map((f) => Math.round((q.e.prod0 * f) / 12)),
      cost: { eur: Math.round(q.e.cost), local: Math.round(q.e.cost * fx) },
      annualSavings: { eur: Math.round(q.e.year1), local: Math.round(q.e.year1 * fx) },
      payback: { pess: pb(q.p), expc: pb(q.e), opti: pb(q.o) },
      // an indicative loan payment, only where the offer shows financing (the caller decides)
      ...(monthlyPayment ? {
        monthly: (() => {
          const eur = amortizedMonthlyPayment(q.e.cost, E.financeRatePct, E.financeTermYears);
          return eur > 0 ? { eur: Math.round(eur), local: Math.round(eur * fx), years: E.financeTermYears, ratePct: E.financeRatePct } : null;
        })(),
      } : {}),
      savingsMonthly: { eur: Math.round(q.e.year1 / 12), local: Math.round((q.e.year1 / 12) * fx) },
    };
  } catch (e) {
    if (e instanceof EstimateError) throw e;
    const err = new EstimateError("upstream", "The sun-data service is busy — try again in a moment.", 502);
    err.detail = String(e && e.message || e);
    throw err;
  }
}
