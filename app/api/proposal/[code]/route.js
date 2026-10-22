// app/api/proposal/[code]/route.js
// The feature that sells VoltMira Pro: a public, tracked proposal link.
// GET  → proposal snapshot + computed quote (no auth: the client has the code)
// POST → tracking events: open, heartbeat(seconds), toggle_batt, accept, request
//
// Security model: the 6+ char random code IS the capability. We rate-limit,
// never expose company internals, and use the service role with explicit
// code filtering (RLS stays closed to anonymous users).

import { NextResponse } from "next/server";
import { nt, CALL_TIMES } from "../../../../lib/notifyText.js";
import { supabaseAdmin, supabaseServer } from "../../../../lib/supabase.js";
import { escapeHtml } from "../../../../lib/safe.js";
import { logActivity } from "../../../../lib/activity.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { sendEmail, proposalOpenedEmail, emailConfigured, ownerAlertEmail } from "../../../../lib/email.js";
import { sendCrmWebhook } from "../../../../lib/crmWebhook.js";
import { openNow } from "../../../../lib/openDigest.js";
import { acceptProposal } from "../../../../lib/acceptProposal.js";
import { acceptIo } from "../../../../lib/acceptIo.js";
import { publicProposalResponse } from "../../../../lib/proposalPublic.js";

/**
 * Email the company owner that a client asked for a call. Never breaks the
 * request: a missing email setup only means no email.
 */
async function notifyCallRequested(db, prop, { who, title, phone, when, lang }) {
  try {
    if (!emailConfigured()) return;
    const [{ data: co }, { data: owner }] = await Promise.all([
      db.from("companies").select("*").eq("id", prop.company_id).single(),
      db.from("profiles").select("email").eq("company_id", prop.company_id)
        .eq("role", "owner").not("email", "eq", "").limit(1).single(),
    ]);
    // the call alert has its own switch once add-notify-more.sql has run; until then it is on
    if (co && co.notify_calls === false) return;
    if (!owner?.email) return;
    const { html } = ownerAlertEmail({
      lang, kicker: nt("call_kicker", lang), heading: nt("call_heading", lang, { client: who, title }),
      rows: [[nt("call_phone", lang), phone || nt("no_phone", lang)], [nt("call_when", lang), nt("when_" + when, lang)]],
      lead: nt("call_lead", lang), cta: { label: nt("call_cta", lang), href: `/projects/${prop.project_id}` },
      foot: nt("foot", lang), appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    await sendEmail({ to: owner.email, subject: nt("call_subject", lang, { client: who }), html });
  } catch (err) {
    console.error("call-request notify failed", err?.message);
  }
}

/**
 * The installer looking at their own offer (signed in to the company that
 * sent it): not a client's view, so it is neither counted nor emailed about.
 */
async function isOwnView(db, companyId) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data: me } = await db.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    return !!me && me.company_id === companyId;
  } catch {
    return false;
  }
}

/** One email per proposal per this window, no matter how many opens. */
const NOTIFY_THROTTLE_MS = 4 * 60 * 60 * 1000;

/**
 * Email the company owner that their proposal was opened. Fire-and-forget
 * semantics: any failure here must never break the tracking request.
 */
async function notifyProposalOpened(db, prop) {
  try {
    if (!emailConfigured()) return;
    // the morning email (lib/openDigest.js) takes it when the company chose one, or in quiet hours
    const { data: pref } = await db.from("companies").select("*").eq("id", prop.company_id).maybeSingle();
    if (!openNow(pref)) return;

    // Throttle check + claim in one update: only proceed if we win the row.
    const cutoff = new Date(Date.now() - NOTIFY_THROTTLE_MS).toISOString();
    const { data: claimed } = await db.from("proposals")
      .update({ notify_last_at: new Date().toISOString() })
      .eq("code", prop.code)
      .or(`notify_last_at.is.null,notify_last_at.lt.${cutoff}`)
      .select("opens, seconds")
      .single();
    if (!claimed) return; // someone was notified within the window already

    const [{ data: co }, { data: proj }, { data: owner }] = await Promise.all([
      db.from("companies").select("notify_open, lang").eq("id", prop.company_id).single(),
      db.from("projects").select("title, client_name").eq("id", prop.project_id).single(),
      db.from("profiles").select("email").eq("company_id", prop.company_id)
        .eq("role", "owner").not("email", "eq", "").limit(1).single(),
    ]);
    if (!co?.notify_open || !owner?.email) return;

    const { subject, html } = proposalOpenedEmail({
      projectTitle: proj?.title,
      clientName: proj?.client_name,
      code: prop.code,
      opens: claimed.opens,
      seconds: claimed.seconds,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      lang: co.lang,
    });
    await sendEmail({ to: owner.email, subject, html });
  } catch (err) {
    console.error("proposal-open notify failed", err?.message);
  }
}

export async function GET(req, props) {
  const params = await props.params;
  const ip = clientIp(req);
  if (await isRateLimited(`prop:get:${ip}`, 60, 60_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });
  if (!/^[a-z0-9]{4,32}$/i.test(String(params.code || ""))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return publicProposalResponse(params.code);
}

export async function POST(req, props) {
  const params = await props.params;
  const ip = clientIp(req);
  if (await isRateLimited(`prop:post:${ip}`, 120, 60_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const kind = String(body.kind || "");
  const allowed = ["open", "heartbeat", "toggle_batt", "accept", "request", "referral"];
  if (!allowed.includes(kind)) return NextResponse.json({ error: "bad_kind" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals")
    .select("code, project_id, company_id, accepted_at, signer_name")
    .eq("code", params.code).single();
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Referral answer is stored on the project, not the append-only events log
  // (proposal_events.kind is CHECK-constrained), so early-return before that insert.
  if (kind === "referral") {
    const set = ["recommend", "google", "social", "installer", "other"];
    const src = set.includes(body.source) ? body.source : "other";
    await db.from("projects").update({ referral_source: src }).eq("id", prop.project_id);
    return NextResponse.json({ ok: true });
  }

  // the installer previewing their own offer is not the client reading it
  if (["open", "heartbeat", "toggle_batt"].includes(kind) && await isOwnView(db, prop.company_id)) {
    return NextResponse.json({ ok: true, own: true });
  }

  const seconds = Math.max(0, Math.min(3600, parseInt(body.seconds || 0, 10) || 0));
  await db.from("proposal_events").insert({
    code: prop.code, company_id: prop.company_id, kind, seconds,
    meta: { ua: (req.headers.get("user-agent") || "").slice(0, 200) },
  });

  if (kind === "open") {
    await db.rpc("bump_proposal_stat", { p_code: prop.code, p_field: "opens", p_by: 1 });
    // The deal is won: the client rereading their own offer is not a buying signal, and must not
    // tell the installer to "call now" about a job already signed.
    if (prop.accepted_at) return NextResponse.json({ ok: true, signed: true });
    // Repeat opens are the strongest buying signal we capture — word the activity
    // so a 3rd/4th open reads as "call them NOW", not just another open event.
    const [{ data: pr }, { data: proj }] = await Promise.all([
      db.from("proposals").select("opens").eq("code", prop.code).single(),
      db.from("projects").select("title, client_name").eq("id", prop.project_id).single(),
    ]);
    const n = pr?.opens || 1;
    const rawWho = proj?.client_name || "The client";
    const rawTitle = proj?.title || prop.code;
    const who = escapeHtml(rawWho);
    const title = escapeHtml(rawTitle);
    let text, actKind = "open", key;
    if (n <= 1) { text = `<b>${who}</b> opened “${title}”`; key = "act_opened"; }
    else if (n >= 3) { text = `<b>${who}</b> opened “${title}” again, ${n}× total. Worth a call now.`; actKind = "lead"; key = "act_opened_hot"; }
    else { text = `<b>${who}</b> opened “${title}” again (${n}×)`; key = "act_opened_again"; }
    await logActivity(db, { companyId: prop.company_id, kind: actKind, key, params: { b: rawWho, title: rawTitle, n }, text, link: `/projects/${prop.project_id}` });
    // Retention feature: tell the installer while the client is still reading.
    await notifyProposalOpened(db, prop);
    // CRM webhook: fire ONLY on the very first open (n<=1), not every reload —
    // a proposal a client reopens five times must not post five identical
    // "opened" events to their Bitrix24/amoCRM/Zapier hook (lib/crmWebhook.js).
    if (n <= 1) {
      await sendCrmWebhook(prop.company_id, "proposal.opened", {
        project_id: prop.project_id, code: prop.code, client_name: rawWho, title: rawTitle,
      });
    }
  }
  if (kind === "heartbeat" && seconds > 0) {
    await db.rpc("bump_proposal_stat", { p_code: prop.code, p_field: "seconds", p_by: seconds });
  }
  if (kind === "toggle_batt") {
    await db.rpc("bump_proposal_stat", { p_code: prop.code, p_field: "batt_toggles", p_by: 1 });
  }
  if (kind === "accept" && prop.accepted_at) {
    // only the first signature counts; the second signer is shown whose it is, not their own name
    return NextResponse.json({ ok: true, already: true, signedName: prop.signer_name || null });
  }
  if (kind === "accept" && !prop.accepted_at) {
    // E-signature + audit trail. What gives an electronic signature evidentiary
    // weight is WHO signed, WHEN, and from WHERE: so the drawn image is stored
    // alongside the typed name, IP and device. This is the simple level; the
    // qualified one (MSign) goes through /api/proposal/[code]/qsign. Both end
    // in lib/acceptProposal.js, which accepts an offer only once.
    const rawSig = typeof body.signature === "string" ? body.signature : "";
    const okSig = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(rawSig) && rawSig.length <= 260_000;
    const signerName = String(body.signerName || "").trim().slice(0, 120);
    // a signature is a name and a drawing; the page asks for both, and the server does not take less
    if (signerName.length < 2 || !okSig) return NextResponse.json({ error: "signature_required" }, { status: 400 });
    await acceptProposal(db, prop, {
      signature: rawSig,
      signerName,
      ip: ip || null,
      ua: String(req.headers.get("user-agent") || "").slice(0, 300) || null,
      level: "simple",
    }, acceptIo);
  }
  if (kind === "request") {
    // A call request: one per offer per day (a second tap only updates the
    // phone and time), a hot lead, an Activity line, an email to the owner and
    // the CRM webhook. Any write that fails answers an error, so the client
    // never reads "sent" for a request that went nowhere.
    const phone = String(body.phone || "").replace(/[^\d+()\s-]/g, "").trim().slice(0, 30);
    const when = CALL_TIMES.includes(body.when) ? body.when : "any";
    const { data: proj } = await db.from("projects").select("title, client_name, client_email").eq("id", prop.project_id).single();
    const rawReqTitle = (proj?.title || prop.code).slice(0, 200);
    const who = (proj?.client_name || "Client").slice(0, 120);
    const { data: co } = await db.from("companies").select("lang").eq("id", prop.company_id).maybeSingle();
    const lang = co?.lang || "ro";
    const note = `${nt("call_kicker", lang)}: ${rawReqTitle}. ${nt("call_when", lang)}: ${nt("when_" + when, lang)}`;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: open } = await db.from("leads").select("id").eq("project_id", prop.project_id)
      .eq("source", "proposal").gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const write = open
      ? await db.from("leads").update({ ...(phone ? { phone } : {}), note, hot: true }).eq("id", open.id)
      : await db.from("leads").insert({
        company_id: prop.company_id, project_id: prop.project_id, name: who,
        email: proj?.client_email || "", phone, note, hot: true, source: "proposal",
      });
    if (write.error) {
      console.error("[proposal] call request not saved:", write.error.message);
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }
    if (!open) {
      await logActivity(db, {
        companyId: prop.company_id, kind: "lead", key: "act_call_requested",
        params: { b: who, title: rawReqTitle },
        text: `<b>${escapeHtml(who)}</b> asked for a call about <b>${escapeHtml(rawReqTitle)}</b>`,
        link: `/projects/${prop.project_id}`,
      });
      await sendCrmWebhook(prop.company_id, "lead.created", {
        project_id: prop.project_id, name: who, phone, email: proj?.client_email || "", source: "call_request", best_time: when, title: rawReqTitle,
      });
      await notifyCallRequested(db, prop, { who, title: rawReqTitle, phone, when, lang });
    }
    return NextResponse.json({ ok: true, again: !!open });
  }

  return NextResponse.json({ ok: true });
}
