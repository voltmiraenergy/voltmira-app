// app/api/solar/request/route.js — the homeowner asks for offers
// (docs/MARKETPLACE.md). The form is checked, the estimate made again on the
// server (the browser's copy is never trusted), the consent recorded, and the
// request routed to verified installers (lib/marketFlow.js). One request per
// idempotency key. Overdue offers are swept first, so routing never waits on
// a nightly job.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { cleanRequestInput } from "../../../../lib/marketplace.js";
import { funnelEstimate } from "../../../../lib/solarFunnel.js";
import { createRequest, sweepOffers } from "../../../../lib/marketFlow.js";
import { marketIo, statusUrl } from "../../../../lib/marketServer.js";
import { EstimateError } from "../../../../lib/estimateCore.js";

export const maxDuration = 30;

export async function POST(req) {
  const ip = clientIp(req);
  if (await isRateLimited(`solar-req:${ip}`, 5, 60 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const c = cleanRequestInput(b);
  if (!c.ok) return NextResponse.json({ error: "invalid", fields: c.errors }, { status: 400 });
  const v = c.value;
  const db = supabaseAdmin();
  let est;
  try {
    est = await funnelEstimate({ address: v.address, monthlyBill: v.monthlyBill, consKwhYear: v.consKwhYear, admin: db });
  } catch (e) {
    return NextResponse.json({ error: e instanceof EstimateError ? e.code : "upstream" }, { status: e instanceof EstimateError ? e.status || 502 : 502 });
  }
  if (!est.raion) return NextResponse.json({ error: "md_only" }, { status: 422 });
  const io = marketIo(db);
  await sweepOffers(db, { io }).catch(() => null);
  const r = await createRequest(db, {
    input: {
      lang: v.lang, address: v.address, raion: est.raion, lat: est.lat, lon: est.lon,
      cons_kwh_year: est.annualConsKwh, kw: est.recommendedKw,
      estimate: { kw: est.recommendedKw, prodKwh: est.prodKwh, cost: est.cost, annualSavings: est.annualSavings, payback: est.payback, tariff: est.tariff },
      name: v.name, phone: v.phone, email: v.email, idempotencyKey: v.idempotencyKey,
    },
    ip, io,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "needs_db" ? 503 : 500 });
  if (r.duplicate) return NextResponse.json({ ok: true, duplicate: true });
  const hours = r.offers.length ? Math.round((Date.parse(r.offers[0].respond_by) - Date.parse(r.offers[0].offered_at)) / 3600e3) : null;
  return NextResponse.json({ ok: true, offered: r.offers.length, hours, statusUrl: statusUrl(r.statusToken) });
}
