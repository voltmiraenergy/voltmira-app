// app/api/proposal/[code]/loan/route.js — a homeowner applies for a loan
// from their offer (docs/FINANCING.md). The amount is recomputed here from
// the offer's frozen price and support (lib/offerFinance.js); the browser
// only picks the offer and the term, gives its details and its consent, and
// an idempotency key so a double click is one application. The application
// goes to the lender through its adapter (lib/lenderAdapters.js); the
// installer is told (Activity, an email under the call-request switch, the
// CRM webhook). Rate-limited by address.
//   POST { offerId, termMonths, name, phone, email?, locality?, consent: true, idempotencyKey }
//     -> { ok, status, duplicate? } | { error }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { snapshotEngine } from "../../../../../lib/engineSettings.js";
import { offerFinanceBasis } from "../../../../../lib/offerFinance.js";
import { createApplication } from "../../../../../lib/loanFlow.js";
import { samplesAllowed } from "../../../../../lib/financeServer.js";
import { sendEmail, emailConfigured, ownerAlertEmail } from "../../../../../lib/email.js";
import { renderHtmlPdf } from "../../../../../lib/renderProposalPdf.js";
import { logActivity } from "../../../../../lib/activity.js";
import { escapeHtml } from "../../../../../lib/safe.js";
import { sendCrmWebhook } from "../../../../../lib/crmWebhook.js";
import { lt } from "../../../../../lib/loanText.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const money = (minor) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(Math.round(minor / 100)) + " lei";

export async function POST(req, props) {
  const { code } = await props.params;
  if (await isRateLimited(`loan:${clientIp(req)}`, 5, 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!/^[a-z0-9]{6,16}$/i.test(String(code || ""))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals").select("code, project_id, company_id, snapshot").eq("code", code).maybeSingle();
  if (!prop?.snapshot || prop.snapshot.market !== "MD") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [{ data: co }, { data: pj }] = await Promise.all([
    db.from("companies").select("*").eq("id", prop.company_id).maybeSingle(),
    db.from("projects").select("title, kw").eq("id", prop.project_id).maybeSingle(),
  ]);
  const basis = offerFinanceBasis(prop.snapshot, snapshotEngine(prop.snapshot.engine, co));

  const r = await createApplication(db, {
    prop, priceMinor: basis.priceMinor, supportMinor: basis.supportMinor, input: body,
    meta: { ip: clientIp(req), ua: req.headers.get("user-agent") || "" },
    io: { sendEmail, emailConfigured, buildPdf: renderHtmlPdf },
    company: { name: co?.name, legal_name: co?.legal_name }, project: { title: pj?.title, kw: pj?.kw },
    samples: await samplesAllowed(db, prop.company_id),
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
  const a = r.application;

  if (!r.duplicate) {
    const lang = co?.lang || "ro";
    const who = a.applicant?.name || "";
    const lender = r.lender?.name || "";
    await logActivity(db, {
      companyId: a.company_id, kind: "lead", key: "act_loan", params: { b: who, lender, x: money(a.amount_minor) },
      text: `<b>${escapeHtml(who)}</b> applied for a loan of ${escapeHtml(money(a.amount_minor))} at ${escapeHtml(lender)}`, link: `/projects/${a.project_id}`,
    });
    await sendCrmWebhook(a.company_id, "loan.created", { applicationId: a.id, projectId: a.project_id, lender, amountMinor: a.amount_minor, currency: a.currency, termMonths: a.term_months, status: a.status });
    try {
      if (emailConfigured() && co?.notify_calls !== false) {
        const { data: owner } = await db.from("profiles").select("email").eq("company_id", a.company_id).eq("role", "owner").not("email", "eq", "").limit(1).maybeSingle();
        if (owner?.email) {
          const { html } = ownerAlertEmail({
            lang, kicker: lt("ln_mail_kicker", lang), heading: lt("ln_mail_heading", lang, { name: who, lender }),
            rows: [[lt("doc_amount", lang), money(a.amount_minor)], [lt("doc_term", lang), lt("months_n", lang, { n: a.term_months })], [lt("doc_monthly", lang), money(a.monthly_minor)], [lt("st_" + a.status, lang), a.lender_ref || ""]],
            lead: lt("ln_mail_lead", lang), cta: { label: lt("ln_mail_cta", lang), href: `/projects/${a.project_id}` }, appUrl: process.env.NEXT_PUBLIC_APP_URL,
          });
          await sendEmail({ to: owner.email, subject: lt("ln_mail_subject", lang, { name: who }), html });
        }
      }
    } catch (e) { console.error("[loan] installer email:", e?.message); }
  }
  return NextResponse.json({ ok: true, status: a.status, duplicate: !!r.duplicate });
}
