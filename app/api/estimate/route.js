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
    return J({ error: "rate", message: "Too many requests — give it a minute." }, 429);

  const url = new URL(req.url);
  try {
    return J(await estimateSavings({
      address: url.searchParams.get("address") || "",
      bill: url.searchParams.get("bill") || "",
      country: url.searchParams.get("country") || "RO",
      admin: supabaseAdmin(),
    }));
  } catch (e) {
    if (e instanceof EstimateError) return J({ error: e.code, message: e.message, ...(e.detail ? { detail: e.detail } : {}) }, e.status);
    return J({ error: "upstream", message: "The sun-data service is busy — try again in a moment." }, 502);
  }
}
