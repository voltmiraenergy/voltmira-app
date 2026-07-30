// app/api/estimate/route.js — PUBLIC free estimator behind the landing widget.
// GET ?address=...&bill=<monthly bill, local currency>&country=RO|MD|DE
//
// Flow: geocode the address -> real PVGIS yield for that exact roof (cached in
// pvgis_cache, 30-day TTL) -> run the SAME engine as the paid product to produce
// honest pessimistic/expected/optimistic payback. No auth; rate-limited by IP.
//
// CORS: responses are open (Access-Control-Allow-Origin: *) so the widget works
// even from a sandboxed/preview context or an embed. The endpoint is read-only,
// stores nothing about the visitor, and only touches the shared pvgis_cache.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";
import { getSolarYield, geocode } from "@voltmira/engine/pvgis";
import { quote, defaultEngineSettings, MARKETS, FX } from "@voltmira/engine";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
};
const J = (body, status = 200) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// Retail electricity price (EUR/kWh) used to value self-consumption, per market,
// plus the display currency. Conservative 2026 consumer prices.
const MARKET_CFG = {
  RO: { price: 0.21, currency: "RON" },
  MD: { price: 0.14, currency: "MDL" },
  DE: { price: 0.32, currency: "EUR" },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

// Cache resilient enough that a DB hiccup can't fail a public estimate.
function dbCache(admin) {
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

export async function GET(req) {
  const ip = clientIp(req);
  if (await isRateLimited(`estimate:${ip}`, 15, 60_000))
    return J({ error: "rate", message: "Too many requests — give it a minute." }, 429);

  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").trim().slice(0, 200);
  const country = (url.searchParams.get("country") || "RO").toUpperCase();
  const billRaw = parseFloat(url.searchParams.get("bill") || "");

  if (!address) return J({ error: "no_address", message: "Enter an address." }, 400);
  const cfg = MARKET_CFG[country] || MARKET_CFG.RO;
  const mkt = MARKETS[country] || MARKETS.RO;
  const fx = FX[cfg.currency] || 1;

  try {
    // 1) address -> coordinates
    const g = await geocode(address, { email: process.env.GEOCODER_EMAIL });
    if (!g) return J({ error: "not_found", message: "We couldn't find that address — try adding the city." }, 404);

    // 2) real PVGIS yield for that roof (south, 35° tilt — sensible residential default)
    const admin = supabaseAdmin();
    const { yieldPerKwp, monthlyShape } = await getSolarYield(g.lat, g.lon, { angle: 35, aspect: 0, cache: dbCache(admin) });

    // 3) derive annual consumption from the monthly bill (or a typical household)
    const billEur = isFinite(billRaw) && billRaw > 0 ? billRaw / fx : null;
    const annualCons = billEur
      ? clamp((billEur * 12) / cfg.price, 800, 30000)
      : 4200; // sensible default household when no bill given

    // 4) size the system to roughly cover that consumption (residential band)
    const recommendedKw = clamp(Math.round((annualCons / yieldPerKwp) * 2) / 2, 2, 15);

    // 5) run the SAME engine as the paid product
    const E = defaultEngineSettings();
    const p = {
      kw: recommendedKw, price: cfg.price, cons: annualCons, batt: false,
      market: country in MARKETS ? country : "RO",
      yieldOverride: yieldPerKwp, monthlyYieldShape: monthlyShape,
    };
    const q = quote(p, E);
    const pb = (x) => (x.payback == null ? null : round1(x.payback));

    return J({
      location: g.display,
      lat: g.lat, lon: g.lon,
      market: country, marketName: mkt.name, scheme: mkt.scheme,
      currency: cfg.currency,
      yieldPerKwp: Math.round(yieldPerKwp),
      recommendedKw,
      annualConsKwh: Math.round(annualCons),
      cost: { eur: Math.round(q.e.cost), local: Math.round(q.e.cost * fx) },
      annualSavings: { eur: Math.round(q.e.year1), local: Math.round(q.e.year1 * fx) },
      payback: { pess: pb(q.p), expc: pb(q.e), opti: pb(q.o) },
    });
  } catch (e) {
    const msg = String(e && e.message || e);
    return J({ error: "upstream", message: "The sun-data service is busy — try again in a moment.", detail: msg }, 502);
  }
}
