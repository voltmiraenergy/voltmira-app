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
import { cnedEnabled } from "../../../../lib/cnedData.js";
import { isCnedQualified } from "../../../../lib/cnedInstallers.js";
import { supabaseAdmin, supabaseServer } from "../../../../lib/supabase.js";
import { escapeHtml } from "../../../../lib/safe.js";
import { logActivity } from "../../../../lib/activity.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { sendEmail, proposalOpenedEmail, emailConfigured, ownerAlertEmail } from "../../../../lib/email.js";
import { sendCrmWebhook } from "../../../../lib/crmWebhook.js";
import { openNow } from "../../../../lib/openDigest.js";
import { quote, SOLAR_SEASON } from "@voltmira/engine";
import { journeySteps, nextStep, productionSeries, journeyFacts } from "../../../../lib/clientJourney.js";
import { snapshotEngine } from "../../../../lib/engineSettings.js";
import { bomHasBattery } from "../../../../lib/quoteInput.js";
import { loadOffers, offerFigures, acceptOffers } from "../../../../lib/proposalOffers.js";
import { effectiveOfferCurrency } from "../../../../lib/offerCurrency.js";

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
 * Email the company owner that a client accepted the offer online. Never
 * breaks the acceptance: a missing email setup only means no email.
 */
async function notifyAccepted(db, prop, { who, title, signer, pct }) {
  try {
    if (!emailConfigured()) return;
    const [{ data: co }, { data: owner }] = await Promise.all([
      db.from("companies").select("*").eq("id", prop.company_id).single(),
      db.from("profiles").select("email").eq("company_id", prop.company_id)
        .eq("role", "owner").not("email", "eq", "").limit(1).single(),
    ]);
    // its own switch once add-notify-more.sql has run; until then it is on
    if (!co || co.notify_accepted === false || !owner?.email) return;
    const lang = co.lang || "ro";
    const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "ro-RO";
    const when = new Date().toLocaleString(loc, { timeZone: "Europe/Chisinau", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    const { html } = ownerAlertEmail({
      lang, kicker: nt("acc_kicker", lang), heading: nt("acc_heading", lang, { client: who, title }),
      rows: [[nt("acc_signer", lang), signer || who], [nt("acc_when", lang), when], ...(pct ? [[nt("acc_discount", lang), `${pct}%`]] : [])],
      lead: nt("acc_lead", lang), cta: { label: nt("acc_cta", lang), href: `/projects/${prop.project_id}` },
      foot: nt("foot", lang), appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    await sendEmail({ to: owner.email, subject: nt("acc_subject", lang, { client: who }), html });
  } catch (err) {
    console.error("accept notify failed", err?.message);
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

  const db = supabaseAdmin();
  // select("*") so the signature columns come through when present but a
  // workspace that hasn't run add-proposal-signature.sql yet still works.
  const { data: prop } = await db.from("proposals")
    .select("*")
    .eq("code", params.code).single();
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Graceful before add-install-warranty.sql runs: retry without the column
  // rather than 500ing every client-facing proposal link on a missing column.
  let { data: co, error: coErr } = await db.from("companies")
    .select("name, short_name, logo_url, engine, currency, lang, plan, install_warranty_years")
    .eq("id", prop.company_id).single();
  if (coErr && /install_warranty_years/i.test(coErr.message || "")) {
    ({ data: co } = await db.from("companies")
      .select("name, short_name, logo_url, engine, currency, lang, plan")
      .eq("id", prop.company_id).single());
  }

  // Social proof, computed rather than typed: the installer's real count of won
  // projects. A hand-entered "trusted by N homeowners" is an unverifiable claim;
  // this one is true by construction, cannot be inflated, and grows on its own —
  // which is the only kind of badge that belongs on a document whose whole pitch
  // is that the client can check it. head:true = count only, no rows shipped.
  const { count: wonCount } = await db.from("projects")
    .select("id", { count: "exact", head: true })
    .eq("company_id", prop.company_id).eq("status", "won");

  // "Prepared by": the rep who owns the quote, so the client can reach the actual
  // person. Live lookup via the service role (no RLS recursion). Falls back to the
  // frozen snapshot value for very old proposals if present.
  let preparedBy = prop.snapshot?.preparedBy || null;
  if (!preparedBy && prop.project_id) {
    const { data: proj } = await db.from("projects").select("owner_id").eq("id", prop.project_id).maybeSingle();
    if (proj?.owner_id) {
      const { data: pf } = await db.from("profiles").select("*").eq("id", proj.owner_id).maybeSingle();
      if (pf?.name) preparedBy = { name: pf.name, phone: pf.phone || "" };
    }
  }

  // Frozen-snapshot integrity: proposals created after 2026-07 carry the engine
  // settings they were computed with, so later Settings changes can never alter
  // what the client was shown. Older proposals (no snapshot.engine) fall back
  // to the company's current engine — same behaviour they always had.
  const E = snapshotEngine(prop.snapshot.engine, co);
  // Snapshots store the BOM itself, so this is derived rather than frozen — an
  // older snapshot with no BOM simply has no costOverride and is unaffected.
  prop.snapshot.bomHasBattery = bomHasBattery(prop.snapshot.bom);
  const q = quote(prop.snapshot, E);

  // Side-by-side options: extra configs the installer attached (base snapshot with
  // kw / battery overridden). We return only what the comparison cards need; the
  // primary quote above stays the recommended one.
  const options = (Array.isArray(prop.snapshot.options) ? prop.snapshot.options : [])
    .slice(0, 3)
    .filter(o => Number(o?.kw) > 0)
    .map(o => {
      const kw = Number(o.kw), battKwh = Math.max(0, Number(o.battKwh) || 0);
      const oq = quote({ ...prop.snapshot, kw, batt: battKwh > 0, battKwh }, E).e;
      return { label: String(o.label || "").slice(0, 40), kw, battKwh,
        cost: oq.cost, payback: oq.payback, year1: oq.year1 };
    });

  // CNED's register (a local preview while CNED_DATA is on, lib/cnedData.js):
  // the area line frozen with this offer, and the qualified-installer badge
  // checked by the workspace's IDNO. Off, neither field is sent.
  let cned = null;
  if (cnedEnabled()) {
    const { data: reg } = await db.from("companies").select("reg_no").eq("id", prop.company_id).maybeSingle();
    cned = { raionLine: prop.snapshot?.raionLine || null, qualified: isCnedQualified(reg?.reg_no) };
  }

  // after signing, the client's own page: the installation's steps and the
  // system's production against the offer (lib/clientJourney.js)
  let after = null;
  if (prop.accepted_at) {
    const [{ data: pj }, { data: reads }] = await Promise.all([
      db.from("projects").select("install_progress").eq("id", prop.project_id).maybeSingle(),
      db.from("production_readings").select("month, kwh").eq("project_id", prop.project_id).order("month", { ascending: false }).limit(24),
    ]);
    const steps = journeySteps({ signedAt: prop.accepted_at, progress: pj?.install_progress });
    const shape = Array.isArray(prop.snapshot?.monthlyYieldShape) && prop.snapshot.monthlyYieldShape.length === 12 ? prop.snapshot.monthlyYieldShape : SOLAR_SEASON;
    const prod0 = Number(q.e.solar0) || Number(q.e.prod0) || 0;
    const production = productionSeries(reads || [], prod0, shape);
    after = { steps, next: nextStep(steps), production, facts: journeyFacts(steps, production, { year1: q.e.year1, prod0 }) };
  }

  return NextResponse.json({
    code: prop.code,
    accepted: !!prop.accepted_at,
    after,
    // proof-of-signing only (name + timestamp). The drawn signature IMAGE is
    // sensitive and NOT returned on this public link — the installer views it
    // from their authenticated pipeline.
    signedName: prop.signer_name || null,
    signedAt: prop.accepted_at || null,
    sentAt: prop.created_at,   // when the link was created, drives "valid until"
    // lang drives the client-facing proposal copy — the client reads it in the
    // installer's chosen language, not always English.
    // currency is the OFFER's, frozen in the snapshot (hryvnia for a client in
    // Ukraine even when the workspace is in lei); a proposal sent before the
    // snapshot carried one keeps the workspace's, as it always showed. The
    // page, its PDF and the emailed copy all format money with this.
    company: { name: co?.name, shortName: co?.short_name, logoUrl: co?.logo_url, currency: effectiveOfferCurrency(prop.snapshot?.offerCurrency, co?.currency, prop.snapshot?.market), lang: co?.lang, plan: co?.plan || "free", wonCount: wonCount || 0, installWarrantyYears: co?.install_warranty_years || null },
    preparedBy,
    cned,
    // the exchange rates frozen with the proposal, so a client in Moldova reads
    // the same lei figure on every visit (lib/money.js)
    fx: E?.fx || null,
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
      // the frozen bill-of-materials total: without it the client-side audit
      // panel recomputes a BOM quote from kW x EUR/kW and disagrees with the
      // headline price the client is actually being shown.
      costOverride: Number(prop.snapshot.costOverride) || 0,
      // Derived from the frozen BOM's own line kinds, so the client-side audit
      // panel prices the battery exactly the way the server did.
      bomHasBattery: bomHasBattery(prop.snapshot.bom),
      // Ukraine: when the system starts (the green tariff ends with 2029) and
      // the outage and loan plan the installer chose (lib/uaMarket.js).
      startYear: Number(prop.snapshot.startYear) || undefined,
      uaPlan: prop.snapshot.uaPlan || undefined,
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
      assumptions: E, // full transparency, the honesty engine, server-verified
      // the yield actually used (PVGIS override when the roof was looked up)
      yieldPerKwp: prop.snapshot.yieldOverride || E.baseYield,
      afmSubsidy: !!prop.snapshot.afmSubsidy,
    },
    options,
    // What the proposal assistant agreed and is still open (lib/proposalOffers.js):
    // the price with the discount applied, and the option the client chose.
    ...(await (async () => {
      const st = await loadOffers(db, prop.code, Date.now(), { signed: !!prop.accepted_at });
      const d = st.discount ? offerFigures({ grossEur: q.e.grossCost, costEur: q.e.cost }, st.discount) : null;
      return {
        offer: d ? { pct: d.pct, priceEur: d.costEur, discountEur: d.discountEur, since: st.discount.created_at } : null,
        chosenOption: st.option ? st.option.option_no : null,
      };
    })()),
    // Never the installer's purchase cost or margin — this is a public,
    // capability-URL endpoint (the code IS the auth), and unit_price/
    // cost_price were never meant to reach it. Nothing client-facing has
    // ever rendered them (PrintSheet.jsx/page.jsx only read kind/brand/
    // model/spec/qty), so this was a latent leak in the raw JSON response
    // rather than something anything legitimate depended on.
    bom: (Array.isArray(prop.snapshot.bom) ? prop.snapshot.bom : [])
      .map(({ unit_price, cost_price, ...safe }) => safe),
    // Real, drawn roof area/orientation (Site Designer), frozen at "Generate
    // offer" time same as everything else here — undefined on any proposal
    // made before that plane existed, or with no single unambiguous plane.
    roofAreaM2: prop.snapshot.roofAreaM2 || undefined,
    roofOrientation: prop.snapshot.roofOrientation || undefined,
    // The real drawn geometry itself (outline + obstacles + fitted panel
    // rectangles, already projected to local meters) — undefined on any
    // proposal made before this existed or where nothing was ever drawn.
    roofPlanes: Array.isArray(prop.snapshot.roofPlanes) ? prop.snapshot.roofPlanes : undefined,
    roofSat: prop.snapshot.roofSat && Array.isArray(prop.snapshot.roofSat.planes) ? prop.snapshot.roofSat : undefined,
    roofPhoto: /^https:\/\//.test(String(prop.snapshot.roofPhoto || "")) ? prop.snapshot.roofPhoto : undefined,
  });
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
  if (kind === "accept" && !prop.accepted_at) {
    // E-signature + audit trail. What gives an electronic signature evidentiary
    // weight is WHO signed, WHEN, and from WHERE — so the drawn image is stored
    // alongside the typed name, IP and device. All optional: an acceptance still
    // succeeds without them (and before add-proposal-signature.sql has run).
    const rawSig = typeof body.signature === "string" ? body.signature : "";
    const okSig = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(rawSig) && rawSig.length <= 260_000;
    const signature = okSig ? rawSig : null;
    const signerName = String(body.signerName || "").trim().slice(0, 120) || null;

    const stamp = new Date().toISOString();
    const full = {
      accepted_at: stamp,
      signature,
      signer_name: signerName,
      signed_ip: ip || null,
      signed_ua: String(req.headers.get("user-agent") || "").slice(0, 300) || null,
    };
    // Richest write first; fall back if the signature columns aren't there yet.
    const { error: sigErr } = await db.from("proposals").update(full).eq("code", prop.code);
    if (sigErr) await db.from("proposals").update({ accepted_at: stamp }).eq("code", prop.code);
    await db.from("projects").update({ status: "won" }).eq("id", prop.project_id).eq("status", "sent");
    // Name the human, not the URL slug — "Casa Popescu accepted…" reads far better
    // than "…proposal crppgt6x".
    const { data: proj } = await db.from("projects").select("title, client_name").eq("id", prop.project_id).maybeSingle();
    const who = proj?.client_name || proj?.title || prop.code;
    // Whatever the proposal assistant agreed (a discount, an attached option)
    // becomes part of what was signed.
    const agreed = await acceptOffers(db, prop.code);
    const pct = Number(agreed.discount?.pct) || 0;
    await logActivity(db, {
      companyId: prop.company_id, kind: "won", key: pct ? "act_accepted_offer" : "act_proposal_accepted",
      params: { b: who, ...(pct ? { n: pct } : {}) },
      text: pct
        ? `<b>${escapeHtml(who)}</b> accepted your proposal with the ${pct}% discount the assistant offered`
        : `<b>${escapeHtml(who)}</b> accepted your proposal`,
      link: `/projects/${prop.project_id}`,
    });
    await notifyAccepted(db, prop, { who, title: proj?.title || prop.code, signer: signerName, pct });
    await sendCrmWebhook(prop.company_id, "proposal.won", { projectId: prop.project_id, title: proj?.title || "", client_name: proj?.client_name || "", via: "client" });
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
