// app/api/proposal/[code]/email/route.js — send the proposal PDF to the client.
//
// This is the capability browser-printing made impossible: the PDF only existed
// after a human clicked through a print dialog on their own machine, so nothing
// server-side could ever attach it. Now it renders on demand and goes out with
// the covering note.
//
// AUTHORISATION MATTERS HERE. /p/<code> is a capability URL — anyone holding the
// link can read the proposal — but sending mail in an installer's name is not a
// read. The caller must be signed in AND the proposal must belong to their
// company, otherwise a leaked code would let a stranger email arbitrary
// recipients under that installer's brand.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { currentUser, currentCompany, currentActor } from "../../../../../lib/session.js";
import { renderProposalPdf } from "../../../../../lib/renderProposalPdf.js";
import { sendEmail, proposalEmail, emailConfigured } from "../../../../../lib/email.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { logActivity } from "../../../../../lib/activity.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Deliberately simple: a full RFC 5322 regex rejects addresses people actually
// use. This catches typos; Resend is the real validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req, { params }) {
  if (!emailConfigured()) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  }
  if (await isRateLimited(`pdfmail:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  const code = params.code;
  if (!/^[a-z0-9]{4,32}$/i.test(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const to = String(body?.to || "").trim();
  const note = String(body?.note || "").slice(0, 1000);
  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: "bad_email" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: prop } = await admin.from("proposals")
    .select("code, company_id, project_id, snapshot").eq("code", code).maybeSingle();
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // The ownership check. Without it, a capability URL would become a licence to
  // send mail as someone else's company.
  if (prop.company_id !== co.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  let pdf;
  try {
    ({ pdf } = await renderProposalPdf(code, base));
  } catch (e) {
    console.error("[pdfmail] render failed:", e?.message || e);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }

  const snap = prop.snapshot || {};
  const { subject, html } = proposalEmail({
    clientName: snap.client || "",
    companyName: co.name,
    liveUrl: `${base}/p/${code}`,
    kw: snap.kw != null ? Number(snap.kw).toFixed(1) : "",
    note,
  });

  const res = await sendEmail({
    to, subject, html,
    // Replies reach the installer, not VoltMira's notify mailbox.
    replyTo: user.email || undefined,
    attachments: [{ filename: `proposal-${code}.pdf`, content: pdf.toString("base64") }],
  });
  if (!res.sent) {
    return NextResponse.json({ error: res.error || "send_failed" }, { status: 502 });
  }

  // Same feed the rest of the app writes to, so "I emailed this" is visible to
  // the whole team rather than living only in the sender's memory.
  try {
    await logActivity(admin, {
      companyId: co.id, kind: "sent", key: "act_emailed",
      params: { b: snap.title || code, to },
      text: `Emailed the proposal for <b>${snap.title || code}</b> to ${to}`,
      actor: await currentActor(),
    });
  } catch { /* the mail already went; never fail the request on the log */ }

  return NextResponse.json({ ok: true, to });
}
