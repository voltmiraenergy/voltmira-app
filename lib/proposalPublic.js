// lib/proposalPublic.js — what the public offer link shows: the frozen snapshot of a sent offer and
// the quote computed from it, for the client who holds its code. Server only. The route
// (app/api/proposal/[code]/route.js) and the offer page (app/p/[code]/page.jsx) both read it from
// here, so the page no longer makes an HTTP call to its own API (which put every client behind the
// server's own address in the rate limiter).
//
// The code IS the capability: nothing here reaches a company's internals, the purchase prices are
// stripped from the bill of materials, and the service role is used with the code as the filter.
import { NextResponse } from "next/server";
import { cnedEnabled } from "./cnedData.js";
import { isCnedQualified } from "./cnedInstallers.js";
import { supabaseAdmin } from "./supabase.js";
import { quote, SOLAR_SEASON } from "@voltmira/engine";
import { journeySteps, nextStep, productionSeries, journeyFacts } from "./clientJourney.js";
import { ensureServiceToken } from "./serviceServer.js";
import { snapshotEngine } from "./engineSettings.js";
import { bomHasBattery } from "./quoteInput.js";
import { offerQuoteInput, offerTariffNote } from "./offerInput.js";
import { offerFinancing } from "./financeServer.js";
import { loadOffers, offerFigures } from "./proposalOffers.js";
import { qsignMode } from "./qsignFlow.js";
import { effectiveOfferCurrency } from "./offerCurrency.js";
import { cleanPlace } from "./photoPlace.js";
import { offerFinancingOn, offerSupportOn } from "./offerSwitches.js";
import { siteOf } from "./roofSite.js";
import { siteFromAddress } from "./roofSiteServer.js";
import { nearbyFor } from "./nearbyServer.js";
import { offerNearbyOn, offerTrackingOn } from "./offerSwitches.js";
import { RAION } from "./mdRaions.js";
import { pvgisDbCache } from "./pvgisCache.js";
import { isDemoCompany } from "./demoServer.js";

/** @param {string} code @returns {Promise<Response>} the JSON answer: 200 with the offer, 404 when there is none */
export async function publicProposalResponse(code) {
  const params = { code };
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

  // the fine print of the printed offer (PrintSheet.jsx): the company's legal details for the footer, and the
  // payment stages (the job's own, else the workspace's). select("*"): a column a pending file adds is just absent.
  const [{ data: coAll }, { data: pjAll }] = await Promise.all([
    db.from("companies").select("*").eq("id", prop.company_id).maybeSingle(),
    db.from("projects").select("*").eq("id", prop.project_id).maybeSingle(),
  ]);
  const legal = coAll && (coAll.legal_name || coAll.name)
    ? { name: coAll.legal_name || coAll.name, idno: coAll.idno || coAll.reg_no || "", address: coAll.legal_address || "", iban: coAll.iban || "" }
    : null;
  const paySchedule = pjAll?.pay_schedule || coAll?.pay_schedule || null;
  // Snapshots store the BOM itself, so this is derived rather than frozen — an
  // older snapshot with no BOM simply has no costOverride and is unaffected.
  // and since tariff rules are versioned, the export price of the rule the
  // offer was issued under (lib/offerInput.js); older offers are unchanged
  const input = offerQuoteInput(prop.snapshot);
  const q = quote(input, E);

  // Side-by-side options: extra configs the installer attached (base snapshot with
  // kw / battery overridden). We return only what the comparison cards need; the
  // primary quote above stays the recommended one.
  const options = (Array.isArray(prop.snapshot.options) ? prop.snapshot.options : [])
    .slice(0, 3)
    .filter(o => Number(o?.kw) > 0)
    .map(o => {
      const kw = Number(o.kw), battKwh = Math.max(0, Number(o.battKwh) || 0);
      const oq = quote({ ...input, kw, batt: battKwh > 0, battKwh }, E).e;
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
    // once the system runs, the client's "report a problem" link (Phase 5); nothing before add-service.sql
    if (!after.next) {
      const { data: tk, error: tkErr } = await db.from("projects").select("id, service_token").eq("id", prop.project_id).maybeSingle();
      const token = !tkErr && tk ? await ensureServiceToken(db, tk) : null;
      if (token) after.serviceUrl = `/s/${token}`;
    }
  }

  // green financing: partner lenders' offers that fit this quote, and any
  // application already sent from it (lib/financeServer.js); Moldova only
  let financing = null;
  // only while the section is switched on (lib/offerSwitches.js): not asked for otherwise
  if (offerFinancingOn()) try {
    const { data: pk } = await db.from("projects").select("client_kind").eq("id", prop.project_id).maybeSingle();
    financing = await offerFinancing(db, { prop, snapshot: prop.snapshot, E, clientKind: pk?.client_kind || null });
  } catch (e) { console.error("[financing] offer page:", e?.message); }

  // The property from above, for an offer with no drawn roof: the place frozen with it, or for one sent before that
  // existed the quote's own pin (a place is not a priced figure, and the picture is of the same house).
  const drawn = !!(prop.snapshot.roofSat && Array.isArray(prop.snapshot.roofSat.planes));
  let roofSite = drawn ? undefined : siteOf(prop.snapshot.roofSite);
  if (!drawn && !roofSite) {
    try {
      const { data: loc } = await db.from("projects").select("lat, lon").eq("id", prop.project_id).maybeSingle();
      roofSite = siteOf({ lat: loc?.lat, lon: loc?.lon });
    } catch { /* no picture */ }
    // never pinned: the address, found once and kept; the offer then shows the area, not a house
    if (!roofSite) roofSite = await siteFromAddress(prop.snapshot.address, { cache: pvgisDbCache(db) });
  }

  // What monitored systems in the same district really produced (lib/nearbyProof.js), when switched on: the place
  // is the drawn roof's, else the property's; never an approximate place found from the address.
  let nearby = null;
  if (offerNearbyOn()) {
    const corner = drawn ? prop.snapshot.roofSat.planes[0]?.outline?.[0] : null;
    const place = corner ? { lat: corner[0], lon: corner[1] } : roofSite && !roofSite.approx ? roofSite : null;
    const proof = place ? await nearbyFor(db, place) : null;
    if (proof) nearby = { ...proof, name: RAION[proof.district]?.name || null, ownYield: Math.round(Number(prop.snapshot.yieldOverride) || Number(E.baseYield) || 0) };
  }

  // the signature's legal level (simple or qualified) and, for a qualified
  // one, whether it was the simulation (lib/qsignFlow.js); before signing,
  // whether qualified signing is offered here at all
  let signature = null;
  if (prop.accepted_at) {
    signature = { level: prop.signature_level === "qualified" ? "qualified" : "simple", simulated: false };
    if (signature.level === "qualified") {
      const { data: qs } = await db.from("qualified_signatures").select("verification").eq("proposal_code", prop.code).eq("status", "signed").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      signature.simulated = qs?.verification?.simulated !== false;
    }
  }

  return NextResponse.json({
    code: prop.code,
    accepted: !!prop.accepted_at,
    // the link the client shares with friends: its own token, never the offer's code (lib/referral.js)
    referral: prop.accepted_at ? (prop.referral_token || null) : null,
    signature,
    qsign: prop.accepted_at ? null : qsignMode(),
    // made in /demo: an example, shown as one, and nobody signs it (lib/demoServer.js)
    demo: await isDemoCompany(db, prop.company_id),
    after,
    financing,
    // the tariff rule and the support programmes the offer was issued under,
    // frozen with it (lib/tariffRules.js, lib/eligibility.js); null on older offers
    tariff: offerTariffNote(prop.snapshot),
    support: offerSupportOn() ? prop.snapshot.support || null : null,
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
      // the day/night plan of the offer: left out, the audit panel priced a flat tariff and its payback
      // disagreed with the headline
      tariffMode: prop.snapshot.tariffMode || "flat",
      afmSubsidy: !!prop.snapshot.afmSubsidy,
      // the frozen tariff rule's export price, so the audit panel recomputes with it
      feedOverride: input.feedOverride,
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
    roofSides: Array.isArray(prop.snapshot.roofSides) ? prop.snapshot.roofSides : undefined,
    roofStatus: prop.snapshot.roofStatus && ["satellite", "verified"].includes(prop.snapshot.roofStatus.kind) ? prop.snapshot.roofStatus : undefined,
    roofSat: prop.snapshot.roofSat && Array.isArray(prop.snapshot.roofSat.planes) ? prop.snapshot.roofSat : undefined,
    roofSite,
    nearby,
    // the reading time per section is recorded (with a notice and a way out) only when switched on
    tracking: offerTrackingOn(),
    legal,
    paySchedule,
    // past its validity window (the PDF says "expired on" instead of "valid until")
    expired: !prop.accepted_at && Date.now() > Date.parse(prop.created_at) + (Number(E?.quoteValidityDays) || 30) * 864e5,
    // the installer's "included / not included" lists, frozen with the offer's settings (lib/offerTerms.js)
    terms: E?.offerTerms || null,
    roofPhoto: /^https:\/\//.test(String(prop.snapshot.roofPhoto || "")) ? prop.snapshot.roofPhoto : undefined,
    roofPhotoPlace: /^https:\/\//.test(String(prop.snapshot.roofPhoto || "")) ? cleanPlace(prop.snapshot.roofPhotoPlace) || undefined : undefined,
  });
}
