// app/api/portfolios/[id]/pack/route.js — the paid bank pack of one plant
// (?plant=<id>), or of the portfolio's own documents (no plant: the report,
// the teaser, the Excel model, the data room), for the paywall
// (components/portfolio/PackPay.jsx): lib/packPricing.js, lib/packAccess.js.
//   GET                      -> { paywall, open, reason, tier, priceEur, renewal, expiresAt, requestedAt,
//                                 scope: "plant"|"project"|"portfolio", payPlantId }
//     scope "project": a portfolio of one plant, whose documents that plant's pack opens
//   POST { plant, billing }  -> asks VoltMira for an invoice, to pay by bank
//                               transfer; the platform admins are emailed and
//                               the pack is unlocked when the transfer arrives
// The caller must be signed in and see the portfolio (lib/portfolioLoad.js).
import { NextResponse } from "next/server";
import { loadPortfolio } from "../../../../../lib/portfolioLoad.js";
import { findPlant } from "../../../../../lib/bankPack.js";
import { loadPackAccess, loadPortfolioAccess, openRequest } from "../../../../../lib/packAccess.js";
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
  const plants = Array.isArray(d.portfolio.assets?.[PLANTS_KEY]) ? d.portfolio.assets[PLANTS_KEY].filter((p) => p && p.id) : [];
  const real = localSwitch("PACK_LOCK_SAMPLES") ? plants : plants.filter((p) => !p.sample);
  if (plant) {
    const access = await loadPackAccess({ companyId: d.portfolio.company_id, portfolioId: id, plant, email: user?.email });
    // a portfolio of this plant alone: its pack also opens the portfolio's documents
    return { d, plant, user, real, access: { ...access, scope: real.length === 1 && String(real[0].id) === String(plant.id) ? "project" : "plant", payPlantId: String(plant.id) } };
  }
  const access = await loadPortfolioAccess({ portfolio: d.portfolio, email: user?.email });
  return { d, plant: null, user, real, access: { ...access, scope: access.payPlantId ? "project" : "portfolio" } };
}

export async function GET(req, props) {
  const { id } = await props.params;
  const s = await scope(id, new URL(req.url).searchParams.get("plant") || "");
  if (s.res) return s.res;
  const { d, plant, real, access } = s;
  const payPlantId = access.payPlantId || null;
  const pending = paywallOn() && !access.open ? await openRequest(d.portfolio.company_id, id, payPlantId) : null;
  return NextResponse.json({
    paywall: paywallOn(), open: access.open, reason: access.reason, tier: access.tier, priceEur: access.priceEur, renewal: access.renewal,
    expiresAt: access.unlock?.expires_at || null, requestedAt: pending?.created_at || null,
    scope: access.scope, payPlantId, plantName: plant?.name || (payPlantId ? real.find((p) => String(p.id) === payPlantId)?.name || "" : ""),
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
