// app/api/estimate-lead/route.js — a visitor on an installer's estimate page (/estimate/[slug]) asks for a proposal.
// POST { slug, name, phone, email?, address, bill?, kwh?, timeline?, wantsFinancing?, message?, consent, token, website }
//
// Off unless ESTIMATE_PAGE=on (lib/offerSwitches.js). Turnstile (lib/turnstile.js) and rate limits by address and by
// installer; a honeypot field drops bots quietly. The request is checked here (lib/estimateLead.js), the estimate is
// worked out again here from the address and the bill (never taken from the browser), and the lead is saved the one
// way every lead is (lib/leadCapture.js), with the district and what the visitor was shown. The installer gets an
// email unless they switched those alerts off.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../lib/ratelimit.js";
import { turnstileOk } from "../../../lib/turnstile.js";
import { validateEstimateLead } from "../../../lib/estimateLead.js";
import { estimateSavings, MARKET_CFG } from "../../../lib/estimateCore.js";
import { captureLead } from "../../../lib/leadCapture.js";
import { leadScore } from "../../../lib/leadScore.js";
import { estimatePageOn } from "../../../lib/offerSwitches.js";
import { companyForPage } from "../../../lib/estimateCompany.js";
import { raionFor } from "../../../lib/cnedStats.js";
import { SHAPES } from "../../../lib/data/mdRaionShapes.js";
import { emailConfigured, sendEmail, ownerAlertEmail } from "../../../lib/email.js";
import { nt } from "../../../lib/notifyText.js";
import { normLang } from "../../../lib/i18n.js";
import { FX } from "@voltmira/engine";

export const runtime = "nodejs";
const J = (body, status = 200) => NextResponse.json(body, { status });
const CUR = { MD: "MDL", RO: "RON", UA: "UAH" };

export async function POST(req) {
  if (!estimatePageOn()) return J({ error: "not_found" }, 404);
  const ip = clientIp(req);
  if (await isRateLimited(`estlead:${ip}`, 5, 10 * 60_000) || await isRateLimited(`estlead-day:${ip}`, 20, 86_400_000)) return J({ error: "rate" }, 429);

  let b; try { b = await req.json(); } catch { return J({ error: "bad_json" }, 400); }
  if (b?.website) return J({ ok: true });   // the honeypot: a bot filled the hidden field

  const db = supabaseAdmin();
  const co = await companyForPage(db, String(b?.slug || "").slice(0, 40));
  if (!co) return J({ error: "not_found" }, 404);
  if (await isRateLimited(`estlead-co:${co.id}`, 200, 86_400_000)) return J({ error: "rate" }, 429);

  if (!(await turnstileOk(b?.token, { ip }))) return J({ error: "captcha" }, 400);
  const market = co.default_market || "MD";
  const v = validateEstimateLead(b, { market });
  if (!v.ok) return J({ error: "invalid", fields: v.errors }, 400);
  const lead = v.lead;

  // the estimate, worked out again from what the visitor typed; a lead is saved even when this fails
  let est = null;
  try {
    est = await estimateSavings({ address: lead.address, bill: lead.bill ?? "", kwh: lead.kwh ?? "", country: market, admin: db });
  } catch { /* the address could not be placed, or the sun data is busy */ }
  const district = est ? raionFor(est.lat, est.lon, SHAPES) : null;
  const estimate = est ? {
    kw: est.recommendedKw, costLocal: est.cost.local, currency: est.currency, paybackYears: est.payback.expc,
    prodKwh: est.prodKwh, consKwh: est.annualConsKwh, lat: est.lat, lon: est.lon,
  } : null;
  // a monthly use in kWh stands for a bill at the market's tariff (as the estimate itself prices it)
  const fx = FX[CUR[market]] || 1;
  const monthlyBill = lead.bill ?? (lead.kwh ? Math.round(lead.kwh * (MARKET_CFG[market] || MARKET_CFG.MD).price * fx) : null);

  const saved = await captureLead(db, {
    companyId: co.id, name: lead.name, phone: lead.phone, email: lead.email, address: lead.address,
    bill: monthlyBill ?? "", message: lead.message || (lead.kwh ? `~${lead.kwh} kWh/mo` : ""),
    estimate: { kw: estimate?.kw, costLocal: estimate?.costLocal, paybackYears: estimate?.paybackYears },
    via: "estimate", channel: "estimate",
    extra: { timeline: lead.timeline, wantsFinancing: lead.wantsFinancing, district, estimate, lat: est?.lat, lon: est?.lon },
  });
  if (!saved.ok) return J({ error: "save_failed" }, 500);

  // the installer hears of it at once (the same switch as a client's call request)
  try {
    if (emailConfigured() && co.notify_calls !== false) {
      const { data: owner } = await db.from("profiles").select("email").eq("company_id", co.id)
        .eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
      if (owner?.email) {
        const lang = normLang(co.lang);
        const { score } = leadScore(
          { monthly_bill: monthlyBill, timeline: lead.timeline, phone: lead.phone, lat: est?.lat, lon: est?.lon, wants_financing: lead.wantsFinancing, district },
          { fx, serviceDistricts: co.service_districts || [] }, co.lead_score_weights,
        );
        const rows = [
          [nt("call_phone", lang), lead.phone],
          ...(lead.bill ? [[nt("elead_bill", lang), `${lead.bill} ${CUR[market] || ""}`.trim()]] : []),
          ...(estimate ? [[nt("elead_est", lang), `${estimate.kw} kW, ${Math.round(estimate.costLocal).toLocaleString("ro-RO")} ${estimate.currency}`]] : []),
          [nt("elead_when", lang), nt("when_" + (lead.timeline || "unset"), lang)],
          [nt("elead_fin", lang), nt(lead.wantsFinancing ? "yes" : "no", lang)],
          [nt("elead_score", lang), `${score} / 100`],
        ];
        const { html } = ownerAlertEmail({
          lang, kicker: nt("elead_kicker", lang), heading: nt("elead_heading", lang, { client: lead.name, place: lead.address }),
          rows, lead: nt("elead_lead", lang), cta: { label: nt("elead_cta", lang), href: "/leads" },
          foot: nt("foot", lang), appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        await sendEmail({ to: owner.email, subject: nt("elead_subject", lang, { client: lead.name }), html, replyTo: lead.email || undefined });
      }
    }
  } catch (err) {
    console.error("[estimate-lead] installer email failed:", err?.message);
  }
  return J({ ok: true });
}
