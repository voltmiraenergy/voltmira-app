// app/api/projects/[id]/invoice/route.js — the proforma as a server-rendered PDF,
// and optionally emailed to the client.
//
// GET  ?deposit=30            -> download the PDF
// POST { to, deposit, note }  -> email it to the client with the PDF attached
//
// Why not just print the page? The invoice page used PrintNow -> window.print(),
// so every printed copy carried Chrome's header: the page title and the raw
// /projects/<uuid>/invoice URL. That is worse on an invoice than on a proposal —
// this is the document that reaches a bank or an accountant, and it was leaking
// an internal app URL. Browser printing also meant the proforma could never be
// emailed, which is exactly when you want to send it: the moment a client says yes.
//
// AUTH: unlike the public proposal, the invoice is auth-scoped and RLS-filtered.
// The caller must be signed in and own the project, and the headless browser
// replays THEIR session cookies so it can never render more than they may see.
import { NextResponse } from "next/server";
import { renderPdf, requestOrigin } from "../../../../../lib/renderProposalPdf.js";
import { supabaseServer } from "../../../../../lib/supabase.js";
import { currentUser, currentCompany, currentActor } from "../../../../../lib/session.js";
import { sendEmail, proformaEmail, emailConfigured } from "../../../../../lib/email.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { logActivity } from "../../../../../lib/activity.js";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { projectVisibility } from "../../../../../lib/projectAccess.js";
import { projectInvoice } from "../../../../../lib/invoiceServer.js";
import { issueInvoiceFor } from "../../../../../lib/invoiceIssue.js";
import { sendCrmWebhook } from "../../../../../lib/crmWebhook.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Only the Supabase auth cookies are replayed — nothing else is needed. */
function authCookies(req) {
  return req.cookies.getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => ({ name: c.name, value: c.value }));
}

/** Shared guard: signed in, owns the project. Returns { project, co } or a Response. */
async function authorize(req, id) {
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });
  // RLS-scoped read: a project outside the caller's company simply isn't there.
  const { data: project } = await (await supabaseServer())
    .from("projects").select("id, title, client_name, company_id, owner_id, invoice_no").eq("id", id).maybeSingle();
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // a Sales member does not take a colleague's proforma by its address
  if (!(await projectVisibility(user, co))(project)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return { user, co, project };
}

function depositOf(v) {
  return Math.min(100, Math.max(0, Number(v) || 0));
}

function targetUrl(req, id, dep) {
  // the caller's own host: the render replays THEIR session cookies, which
  // mean nothing on another host NEXT_PUBLIC_APP_URL might name
  const base = requestOrigin(req);
  // pdf=1 tells the page to skip PrintNow: window.print() inside headless
  // Chromium blocks rather than returning, and we drive printing via CDP.
  return `${base}/projects/${id}/invoice?pdf=1${dep > 0 ? `&deposit=${dep}` : ""}`;
}

export async function GET(req, props) {
  const params = await props.params;
  if (await isRateLimited(`inv:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }
  const auth = await authorize(req, params.id);
  if (auth instanceof NextResponse) return auth;

  // Downloading never draws a number: the invoice is issued first (the invoice page, or the editor's Download).
  if (!auth.project.invoice_no) return NextResponse.json({ error: "not_issued" }, { status: 409 });
  const dep = depositOf(new URL(req.url).searchParams.get("deposit"));
  try {
    const { pdf, timings } = await renderPdf(targetUrl(req, params.id, dep), { cookies: authCookies(req), ready: ".inv-page" });
    const name = `${auth.project.invoice_no || "proforma"}.pdf`.replace(/[^\w.-]+/g, "-");
    return new NextResponse(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${name}"`,
        "cache-control": "private, max-age=0, must-revalidate",
        "server-timing": Object.entries(timings).map(([k, v]) => `${k};dur=${v}`).join(", "),
      },
    });
  } catch (e) {
    console.error("[invoice-pdf] failed:", e?.message || e);
    // The invoice page prints itself (PrintNow): a usable fallback, not raw JSON.
    return NextResponse.redirect(`${requestOrigin(req)}/projects/${params.id}/invoice${dep > 0 ? `?deposit=${dep}` : ""}`, 303);
  }
}

export async function POST(req, props) {
  const params = await props.params;
  if (!emailConfigured()) return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  if (await isRateLimited(`invmail:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }
  const auth = await authorize(req, params.id);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const to = String(body?.to || "").trim();
  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: "bad_email" }, { status: 400 });
  // a day's cap for the workspace and for one recipient (the mail goes out from VoltMira's own domain)
  if (await isRateLimited(`invmail-co:${auth.co.id}`, 100, 86_400_000) || await isRateLimited(`invmail-to:${auth.co.id}:${to.toLowerCase()}`, 5, 86_400_000)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }
  const dep = depositOf(body?.deposit);

  // Sending the proforma is an explicit act, so it issues the invoice if it is not yet (the PDF then carries the number)
  let invoiceNo = auth.project.invoice_no;
  if (!invoiceNo) {
    const sb = await supabaseServer();
    const { data: full } = await sb.from("projects").select("*").eq("id", params.id).maybeSingle();
    if (!full) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const inv = await projectInvoice(full, auth.co, { depositPct: dep });
    const r = await issueInvoiceFor({ sb, co: auth.co, project: full, inv, webhook: (ev, payload) => sendCrmWebhook(auth.co.id, ev, payload) });
    if (!r.ok) return NextResponse.json({ error: "issue_failed" }, { status: 500 });
    invoiceNo = r.invoiceNo;
  }

  let pdf;
  try {
    ({ pdf } = await renderPdf(targetUrl(req, params.id, dep), { cookies: authCookies(req), ready: ".inv-page" }));
  } catch (e) {
    console.error("[invoice-mail] render failed:", e?.message || e);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }

  const { subject, html } = proformaEmail({
    clientName: auth.project.client_name || "",
    companyName: auth.co.name,
    depositPct: dep,
    note: String(body?.note || "").slice(0, 1000),
    lang: auth.co.lang,
  });
  const res = await sendEmail({
    to, subject, html,
    replyTo: auth.user.email || undefined,
    attachments: [{ filename: `${invoiceNo || "proforma"}.pdf`.replace(/[^\w.-]+/g, "-"), content: pdf.toString("base64") }],
  });
  if (!res.sent) return NextResponse.json({ error: res.error || "send_failed" }, { status: 502 });

  try {
    await logActivity(supabaseAdmin(), {
      companyId: auth.co.id, kind: "sent", key: "act_proforma",
      params: { b: auth.project.title || "", to },
      text: `Emailed the proforma for <b>${auth.project.title || ""}</b> to ${to}`,
      actor: await currentActor(),
    });
  } catch { /* the mail already went; never fail the request on the log */ }

  return NextResponse.json({ ok: true, to });
}
