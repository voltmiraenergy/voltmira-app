// app/api/estimate/route.js — PUBLIC free estimator behind the landing widget.
// GET ?address=...&bill=<monthly bill, local currency>&country=RO|MD|DE
//
// Flow (lib/estimateCore.js, shared with the lead assistant): geocode the
// address -> real PVGIS yield for that exact roof (cached in pvgis_cache, 30-day
// TTL) -> the SAME engine as the paid product -> honest pessimistic/expected/
// optimistic payback. No auth; rate-limited by IP.
//
// CORS: responses are open (Access-Control-Allow-Origin: *) so the widget works
// even from a sandboxed/preview context or an embed. The endpoint is read-only,
// stores nothing about the visitor, and only touches the shared pvgis_cache.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";
import { estimateSavings, EstimateError } from "../../../lib/estimateCore.js";
import { offerFinancingOn, offerNearbyOn } from "../../../lib/offerSwitches.js";
import { nearbyFor } from "../../../lib/nearbyServer.js";
import { RAION } from "../../../lib/mdRaions.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
};
const J = (body, status = 200) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req) {
  const ip = clientIp(req);
  if (await isRateLimited(`estimate:${ip}`, 15, 60_000))
    return J({ error: "rate", message: "Too many requests, give it a minute." }, 429);

  const url = new URL(req.url);
  try {
    const admin = supabaseAdmin();
    const est = await estimateSavings({
      address: url.searchParams.get("address") || "",
      // the place the client picked from the suggestions, when they did (lib/estimateCore.js checks it)
      lat: url.searchParams.get("lat"), lon: url.searchParams.get("lon"),
      bill: url.searchParams.get("bill") || "",
      kwh: url.searchParams.get("kwh") || "",
      monthlyPayment: offerFinancingOn(),
      country: url.searchParams.get("country") || "RO",
      admin,
    });
    // what monitored systems in the same district really produced (OFFER_NEARBY, lib/nearbyProof.js); the district
    // is all the address has to be right about
    if (offerNearbyOn()) {
      const proof = await nearbyFor(admin, { lat: est.lat, lon: est.lon });
      if (proof) est.nearby = { ...proof, name: RAION[proof.district]?.name || null };
    }
    return J(est);
  } catch (e) {
    if (e instanceof EstimateError) return J({ error: e.code, message: e.message, ...(e.detail ? { detail: e.detail } : {}) }, e.status);
    return J({ error: "upstream", message: "The sun-data service is busy, try again in a moment." }, 502);
  }
}
