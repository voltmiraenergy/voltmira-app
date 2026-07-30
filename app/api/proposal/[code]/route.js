// app/api/proposal/[code]/route.js
// The feature that sells VoltMira Pro: a public, tracked proposal link.
// GET  → proposal snapshot + computed quote (no auth: the client has the code)
// POST → tracking events: open, heartbeat(seconds), toggle_batt, accept, request
//
// Security model: the 6+ char random code IS the capability. We rate-limit,
// never expose company internals, and use the service role with explicit
// code filtering (RLS stays closed to anonymous users).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { escapeHtml } from "../../../../lib/safe.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { sendEmail, proposalOpenedEmail, emailConfigured } from "../../../../lib/email.js";
import { quote, defaultEngineSettings } from "@voltmira/engine";

/** One email per proposal per this window, no matter how many opens. */
const NOTIFY_THROTTLE_MS = 4 * 60 * 60 * 1000;

/**
 * Email the company owner that their proposal was opened. Fire-and-forget
 * semantics: any failure here must never break the tracking request.
 */
async function notifyProposalOpened(db, prop) {
  try {
    if (!emailConfigured()) return;

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
      db.from("companies").select("notify_open").eq("id", prop.company_id).single(),
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
    });
    await sendEmail({ to: owner.email, subject, html });
  } catch (err) {
    console.error("proposal-open notify failed", err?.message);
  }
}

export async function GET(req, { params }) {
  const ip = clientIp(req);
  if (await isRateLimited(`prop:get:${ip}`, 60, 60_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });

  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals")
    .select("code, snapshot, accepted_at, company_id, created_at")
    .eq("code", params.code).single();
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: co } = await db.from("companies")
    .select("name, short_name, logo_url, engine, currency, lang, plan")
    .eq("id", prop.company_id).single();

  // Frozen-snapshot integrity: proposals created after 2026-07 carry the engine
  // settings they were computed with, so later Settings changes can never alter
  // what the client was shown. Older proposals (no snapshot.engine) fall back
  // to the company's current engine — same behaviour they always had.
  const E = { ...defaultEngineSettings(), ...(prop.snapshot.engine || co?.engine || {}) };
  const q = quote(prop.snapshot, E);

  return NextResponse.json({
    code: prop.code,
    accepted: !!prop.accepted_at,
    sentAt: prop.created_at,   // when the link was created — drives "valid until"
    // lang drives the client-facing proposal copy — the client reads it in the
    // installer's chosen language, not always English.
    company: { name: co?.name, shortName: co?.short_name, logoUrl: co?.logo_url, currency: co?.currency, lang: co?.lang, plan: co?.plan || "free" },
    inputs: {
      title: prop.snapshot.title, client: prop.snapshot.client, address: prop.snapshot.address,
      kw: prop.snapshot.kw, batt: prop.snapshot.batt, battKwh: prop.snapshot.battKwh ?? 10,
      loan: prop.snapshot.loanMonthly ?? prop.snapshot.loan ?? 0,
      market: prop.snapshot.market || "RO",
      useMonthly: !!prop.snapshot.useMonthly,
      // exposed so the client-side "audit your assumptions" panel can recompute
      // the payback bands live from their own price/inflation (their own data).
      price: Number(prop.snapshot.price), cons: Number(prop.snapshot.cons),
      consMonthly: prop.snapshot.consMonthly || null,
      afmSubsidy: !!prop.snapshot.afmSubsidy,
      yieldOverride: prop.snapshot.yieldOverride || undefined,
      monthlyYieldShape: prop.snapshot.monthlyYieldShape || undefined,
    },
    quote: {
      cost: q.e.cost, prod0: q.e.prod0, year1: q.e.year1, self: q.e.self,
      // rows (cumulative cash position per year) power the print-mode chart
      bands: {
        pess: { payback: q.p.payback, roi: q.p.roi, rows: q.p.rows },
        expc: { payback: q.e.payback, roi: q.e.roi, rows: q.e.rows },
        opti: { payback: q.o.payback, roi: q.o.roi, rows: q.o.rows },
      },
      horizon: q.e.horizon,
      assumptions: E, // full transparency — the honesty engine, server-verified
      // the yield actually used (PVGIS override when the roof was looked up)
      yieldPerKwp: prop.snapshot.yieldOverride || E.baseYield,
      afmSubsidy: !!prop.snapshot.afmSubsidy,
    },
  });
}

export async function POST(req, { params }) {
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
    .select("code, project_id, company_id, accepted_at")
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

  const seconds = Math.max(0, Math.min(3600, parseInt(body.seconds || 0, 10) || 0));
  await db.from("proposal_events").insert({
    code: prop.code, company_id: prop.company_id, kind, seconds,
    meta: { ua: (req.headers.get("user-agent") || "").slice(0, 200) },
  });

  if (kind === "open") {
    await db.rpc("bump_proposal_stat", { p_code: prop.code, p_field: "opens", p_by: 1 });
    // Repeat opens are the strongest buying signal we capture — word the activity
    // so a 3rd/4th open reads as "call them NOW", not just another open event.
    const [{ data: pr }, { data: proj }] = await Promise.all([
      db.from("proposals").select("opens").eq("code", prop.code).single(),
      db.from("projects").select("title, client_name").eq("id", prop.project_id).single(),
    ]);
    const n = pr?.opens || 1;
    const who = escapeHtml(proj?.client_name || "The client");
    const title = escapeHtml(proj?.title || prop.code);
    let text, actKind = "open";
    if (n <= 1) text = `<b>${who}</b> opened “${title}”`;
    else if (n >= 3) { text = `🔥 <b>${who}</b> opened “${title}” again — ${n}× total. Worth a call now.`; actKind = "lead"; }
    else text = `<b>${who}</b> opened “${title}” again (${n}×)`;
    await db.from("activity").insert({ company_id: prop.company_id, kind: actKind, text });
    // Retention feature: tell the installer while the client is still reading.
    await notifyProposalOpened(db, prop);
  }
  if (kind === "heartbeat" && seconds > 0) {
    await db.rpc("bump_proposal_stat", { p_code: prop.code, p_field: "seconds", p_by: seconds });
  }
  if (kind === "toggle_batt") {
    await db.rpc("bump_proposal_stat", { p_code: prop.code, p_field: "batt_toggles", p_by: 1 });
  }
  if (kind === "accept" && !prop.accepted_at) {
    await db.from("proposals").update({ accepted_at: new Date().toISOString() }).eq("code", prop.code);
    await db.from("projects").update({ status: "won" }).eq("id", prop.project_id).eq("status", "sent");
    await db.from("activity").insert({
      company_id: prop.company_id, kind: "won",
      text: `Client accepted proposal <b>${escapeHtml(prop.code)}</b>`,
    });
  }
  if (kind === "request") {
    const { data: proj } = await db.from("projects").select("title, client_name").eq("id", prop.project_id).single();
    await db.from("leads").insert({
      company_id: prop.company_id, project_id: prop.project_id,
      name: (proj?.client_name || "Client via proposal").slice(0, 120),
      note: `Requested the quote for \u201C${(proj?.title || prop.code).slice(0, 200)}\u201D`,
      hot: true, source: "proposal",
    });
    await db.from("activity").insert({
      company_id: prop.company_id, kind: "lead",
      text: `Client requested the quote for <b>${escapeHtml((proj?.title || prop.code).slice(0, 200))}</b>`,
    });
  }

  return NextResponse.json({ ok: true });
}
