// app/api/portfolios/[id]/pack/route.js — the paid bank pack of one plant
// (?plant=<id>), or of the portfolio's data room (no plant), for the plant
// card: lib/packPricing.js.
//   GET                      -> { paywall, open, reason, tier, priceEur, renewal, expiresAt, requestedAt }
//   POST { plant, billing }  -> asks VoltMira for an invoice, to pay by bank
//                               transfer; the platform admins are emailed and
//                               the pack is unlocked when the transfer arrives
// The caller must be signed in and see the portfolio (lib/portfolioLoad.js).
import { NextResponse } from "next/server";
import { loadPortfolio } from "../../../../../lib/portfolioLoad.js";
import { findPlant } from "../../../../../lib/bankPack.js";
import { loadPackAccess, openRequest } from "../../../../../lib/packAccess.js";
import { paywallOn, PACK_TIERS, localSwitch } from "../../../../../lib/packPricing.js";
import { currentUser } from "../../../../../lib/session.js";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { sendEmail } from "../../../../../lib/email.js";
import { platformAdmins } from "../../../../../lib/platformAdmin.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { PLANTS_KEY } from "../../../../../lib/portfolioModel.js";

export const dynamic = "force-dynamic";

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

async function scope(id, plantParam) {
  const d = await loadPortfolio(id);
  if (d.state === "unauthorized") return { res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (d.state !== "ok") return { res: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  const plant = plantParam ? findPlant(d.portfolio, plantParam) : null;
  if (plantParam && !plant) return { res: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  const user = await currentUser();
  let access = await loadPackAccess({ companyId: d.portfolio.company_id, portfolioId: id, plant, email: user?.email });
  // the data room is the portfolio pack only for a portfolio that holds real
  // plants; rooftop quotes and sample plants keep it free (as the route does)
  if (!plant) {
    const plants = Array.isArray(d.portfolio.assets?.[PLANTS_KEY]) ? d.portfolio.assets[PLANTS_KEY] : [];
    if (!plants.length || (!localSwitch("PACK_LOCK_SAMPLES") && plants.every((p) => p?.sample))) access = { ...access, open: true, reason: "free" };
  }
  return { d, plant, user, access };
}

export async function GET(req, props) {
  const { id } = await props.params;
  const s = await scope(id, new URL(req.url).searchParams.get("plant") || "");
  if (s.res) return s.res;
  const { d, plant, access } = s;
  const pending = paywallOn() && !access.open ? await openRequest(d.portfolio.company_id, id, plant ? String(plant.id) : null) : null;
  return NextResponse.json({
    paywall: paywallOn(), open: access.open, reason: access.reason, tier: access.tier, priceEur: access.priceEur, renewal: access.renewal,
    expiresAt: access.unlock?.expires_at || null, requestedAt: pending?.created_at || null,
    // a local machine may try the card payment without Paddle (lib/packPricing.js localSwitch)
    testPay: localSwitch("PACK_TEST_PAY"),
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req, props) {
  const { id } = await props.params;
  if (await isRateLimited(`packreq:${clientIp(req)}`, 10, 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let body = {};
  try { body = await req.json(); } catch { /* an empty body */ }
  const s = await scope(id, String(body.plant || ""));
  if (s.res) return s.res;
  const { d, plant, user, access } = s;
  if (access.open) return NextResponse.json({ ok: true, open: true });
  if (!PACK_TIERS.includes(access.tier)) return NextResponse.json({ error: "tier" }, { status: 400 });
  const plantId = plant ? String(plant.id) : null;
  const existing = await openRequest(d.portfolio.company_id, id, plantId);
  if (existing) return NextResponse.json({ ok: true, requestedAt: existing.created_at });
  const billing = String(body.billing || "").slice(0, 1000).trim();
  const row = {
    company_id: d.portfolio.company_id, portfolio_id: id, plant_id: plantId, plant_name: String(plant?.name || d.portfolio.name || "").slice(0, 200),
    tier: access.tier, amount_eur: access.priceEur, billing, requested_by: String(user?.email || "").slice(0, 200),
  };
  const { data, error } = await supabaseAdmin().from("pack_requests").insert(row).select("created_at").maybeSingle();
  if (error) return NextResponse.json({ error: "needs_db" }, { status: 503 });
  // tell VoltMira; the request stands even when no email can be sent
  const to = platformAdmins();
  if (to.length) {
    await sendEmail({
      to, replyTo: user?.email || undefined,
      subject: `Invoice request: ${row.plant_name} (${row.tier}, EUR ${row.amount_eur})`,
      html: `<p><b>${esc(d.co?.name || "")}</b> asks for an invoice for the bank pack of <b>${esc(row.plant_name)}</b>.</p>`
        + `<p>Tier: ${esc(row.tier)}<br>Amount: EUR ${esc(row.amount_eur)}<br>Requested by: ${esc(row.requested_by)}</p>`
        + `<p>Billing details:<br>${esc(billing || "(none given)").replace(/\n/g, "<br>")}</p>`
        + "<p>Send the invoice, then unlock the pack on the Traction page when the transfer arrives.</p>",
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, requestedAt: data?.created_at || new Date().toISOString() });
}
