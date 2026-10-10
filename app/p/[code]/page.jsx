// app/p/[code]/page.jsx — the page your installer's CLIENT opens on their phone.
// Server-renders the proposal from the API, then small client components send
// real tracking events (open, heartbeat every 15s, accept, request, referral)
// and run the interactive parts (cash/monthly, the self-audit, signing, Q&A).
//
// The story, top to bottom: the cover (whose offer this is, what it costs,
// saves and pays back, and the one button), Ukraine's outage plan when it is a
// Ukrainian quote, the options, what they are buying, their energy month by
// month, the money in three honest scenarios with the tool to re-run it on
// their own figures, paying monthly, then accept and sign, questions, and the
// validity date. From 1040px a sticky summary keeps price and button in view;
// below that a bar at the bottom of the screen does the same job.
// Visible words: lib/i18n.js where it already says it, ./text.js otherwise
// (formal address in every language). Styles: ./proposal.css.
import "./proposal.css";
import Tracker from "./tracker.jsx";
import QaWidget from "./QaWidget.jsx";
import AutoPrint from "./AutoPrint.jsx";
import PrintSheet, { RoofSnapshotSVG } from "./PrintSheet.jsx";
import ClientAudit from "./ClientAudit.jsx";
import { MonthlySVG, CashflowSVG, CHART, monthNames } from "./charts.jsx";
import FinanceToggle from "./FinanceToggle.jsx";
import { notFound } from "next/navigation";
import OfferBanner from "./OfferBanner.jsx";
import UaSection from "./UaSection.jsx";
import LivePrice from "./LivePrice.jsx";
import AcceptLink from "./AcceptLink.jsx";
import StickyCta from "./StickyCta.jsx";
import HtmlLang from "../../../lib/HtmlLang.jsx";
import { moneyFormatter, numFor } from "../../../lib/money.js";
import { t, normLang } from "../../../lib/i18n.js";
import { isPlaceholderTitle } from "../../../lib/quoteTitle.js";
import { fmtDate } from "../../../lib/tz.js";
import { kindLabel, bomLineText, surplusRevenue } from "../../../lib/quoteAnalysis.js";
import { findWarrantyInfo } from "../../../lib/supplierCatalog.js";
import { backupHours } from "../../../lib/batteryBackup.js";
import { designCheck, designCheckRows } from "../../../lib/designCheck.js";
import { compassLabel } from "../../../lib/roofLayout.js";
import { weightedExportPriceMdl } from "../../../lib/prosumerPrice.js";
import { SOLAR_SEASON, FX, effectiveConsumption, amortizedMonthlyPayment } from "@voltmira/engine";
import { ppt, yearsN, kwhUnit, kwUnit } from "./text.js";
import {
  ArrowUpRight, BatteryCharging, CalendarClock, ChevronDown, Info, Moon, Package, Phone, Plug, Scale,
  Snowflake, SolarPanel, ThermometerSun, TrendingUp, TriangleAlert, Wrench, Zap,
} from "lucide-react";

async function getProposal(code) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/proposal/${code}`, { cache: "no-store" });
  if (res.status === 404) return { missing: true };
  if (!res.ok) return null;
  return res.json();
}

export const dynamic = "force-dynamic";

// Second layer behind the X-Robots-Tag header in next.config.mjs. These pages
// hold a named homeowner's address, consumption and price; they are reachable
// by anyone with the capability link, which is exactly why they must never be
// indexed. The title is deliberately generic so a leaked SERP entry (or a
// browser-history sync) cannot expose the client's name. Generic, but in the
// client's own language: the same request-memoized fetch the page makes.
export async function generateMetadata(props) {
  const params = await props.params;
  const data = await getProposal(params.code).catch(() => null);
  return {
    title: ppt("doc_title", normLang(data?.company?.lang)),
    robots: { index: false, follow: false, nocache: true },
  };
}

const KIND_ICON = { panel: SolarPanel, inverter: Zap, battery: BatteryCharging, mounting: Wrench };
const requestTime = () => Date.now();
const LOCS = { en: "en-IE", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

export default async function ProposalPage(props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  // ?print=1 = the INSTALLER exporting a PDF: no tracking (would inflate their
  // own open counts), no accept/request buttons, auto print dialog.
  const printMode = searchParams?.print === "1";
  const data = await getProposal(params.code);
  // A code that doesn't exist answers a real 404 (not-found.jsx), not a 200
  // page that says "not found", which search engines log as a soft 404.
  if (data?.missing) notFound();
  if (!data) {
    return (
      <main className="pp">
        <div className="pp-wrap" style={{ paddingTop: 64 }}>
          <h1 className="pp-h2">{t("pp_not_found", "en")}</h1>
          <p className="pp-lead">{t("pp_expired", "en")}</p>
        </div>
      </main>
    );
  }
  const { company, inputs, quote: q, accepted, sentAt, preparedBy = null, options = [], bom = [], signedName = null, signedAt = null, fx = null,
    offer = null, chosenOption = null,
    roofAreaM2 = null, roofOrientation = null, roofPlanes = null } = data;
  // The client reads this in the installer's language, not always English.
  const lang = normLang(company.lang);
  const signedDate = signedAt
    ? fmtDate(signedAt, { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  // ?print=1 → the branded PDF document (same layout as the demo's printProposal),
  // not the live proposal. AutoPrint fires the save-as-PDF dialog.
  if (printMode) {
    // No QR code here. Around 80% of clients open the proposal on a phone, and
    // a QR asks them to scan a screen with the device already holding it, the
    // link is simply a tap away. It only ever made sense on a printed copy,
    // which is the rarer case, so it was cost with no payoff on the common one.
    return (
      <main lang={lang} style={{ background: "#fff", minHeight: "100vh" }}>
        <HtmlLang lang={lang} />
        <PrintSheet company={company} inputs={inputs} quote={q} lang={lang} sentAt={sentAt} preparedBy={preparedBy} bom={bom}
          roofAreaM2={roofAreaM2} roofOrientation={roofOrientation} roofPlanes={roofPlanes}
          acceptUrl={`${(process.env.NEXT_PUBLIC_APP_URL || "https://voltmira.com").replace(/\/+$/, "")}/p/${params.code}`} fx={fx} />
        {/* The PDF route drives printing through CDP and passes auto=0:
            window.print() inside headless Chromium blocks rather than returns. */}
        {searchParams?.auto !== "0" && <AutoPrint />}
      </main>
    );
  }

  const loc = LOCS[lang] || LOCS.en;
  // Money in the offer's own currency (company.currency: lei, hryvnia or
  // euro) at the rate frozen with this proposal; decimals with the reader's
  // comma (lib/money.js).
  const fmt = moneyFormatter({ currency: company.currency, lang, fx });
  const nf = numFor(lang);
  const E = q.assumptions;
  const hz = q.horizon;
  const bands = q.bands;
  const yrs = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : nf(n, 1);
  const yrsUnit = (n) => (n === 0 ? "" : t("pp_years", lang));
  const kwU = kwUnit(lang), kwhU = kwhUnit(lang);
  const kw = Number(inputs.kw) || 0;
  const kwTxt = nf(kw, 1);
  const battKwh = inputs.batt ? (Number(inputs.battKwh) || 0) : 0;
  const n1 = (v) => Number(v).toLocaleString(loc, { maximumFractionDigits: 1 });
  const withBatt = battKwh > 0 ? ppt("with_batt", lang, { b: n1(battKwh) }) : "";
  const mSave = q.year1 / 12;
  const loan = Number(inputs.loan) || 0;
  const net = mSave - loan;
  const rowsE = bands.expc.rows || [], rowsP = bands.pess.rows || [], rowsO = bands.opti.rows || [];
  const lifeNet = rowsE.length ? rowsE[rowsE.length - 1] : 0;
  const lifeGross = lifeNet + q.cost;

  // Absent on any proposal frozen before this feature existed: old snapshots'
  // engine object simply doesn't have these keys, so the monthly figures only
  // show up once both are real numbers rather than silently assuming a rate.
  const financeRate = Number(E?.financeRatePct);
  const financeTerm = Number(E?.financeTermYears);
  const hasFinance = financeRate >= 0 && financeTerm > 0;
  const monthlyPayment = hasFinance ? amortizedMonthlyPayment(q.cost, financeRate, financeTerm) : 0;
  const rateTxt = hasFinance ? financeRate.toLocaleString(loc, { maximumFractionDigits: 2 }) : "";

  // Same derivation PrintSheet.jsx uses. PVGIS's own monthly shape for this
  // roof when it was looked up; the engine's seasonal curve is the honest
  // fallback otherwise.
  const shape = Array.isArray(inputs.monthlyYieldShape) && inputs.monthlyYieldShape.length === 12
    ? inputs.monthlyYieldShape : SOLAR_SEASON;
  const shapeSum = shape.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const prodMonthly = shape.map((f) => (q.prod0 * (Number(f) || 0)) / shapeSum);
  const consEff = Math.max(0, Number(effectiveConsumption(inputs)) || 0);
  const consMonthly = (inputs.useMonthly && Array.isArray(inputs.consMonthly) && inputs.consMonthly.length === 12)
    ? inputs.consMonthly.map((v) => Number(v) || 0)
    : new Array(12).fill(consEff / 12);
  const selfPct = Math.round((q.self || 0) * 100);
  const fromSolar = Math.min((q.self || 0) * q.prod0, consEff);
  const coverPct = consEff > 0 ? Math.round((fromSolar / consEff) * 100) : null;
  const months = monthNames(lang);

  // Cost of doing nothing: the client's own consumption bought from the grid
  // for the whole horizon, inflating at the expected band's rate (PrintSheet.jsx).
  const inflPct = Number(E?.bands?.expc?.infl ?? 0);
  const infl = inflPct / 100;
  const consY = Number(inputs.cons) || 0, priceY = Number(inputs.price) || 0;
  const doNothing = consY > 0 && priceY > 0 ? consY * priceY * (infl === 0 ? hz : ((Math.pow(1 + infl, hz) - 1) / infl)) : 0;
  const withSolar = Math.max(0, doNothing - lifeGross) + q.cost;
  const vsMax = Math.max(doNothing, withSolar, 1);

  // What the exported surplus earns (Moldova's net billing only).
  const surplus = inputs.market === "MD" ? surplusRevenue(q.prod0, q.self, FX.MDL) : null;

  // Valid for the company's validity window from when the link was created.
  // (A per-request server render: reading the clock once here is the point.)
  const now = requestTime();
  const validityDays = Number(E?.quoteValidityDays) || 30;
  const validTs = (sentAt ? new Date(sentAt).getTime() : now) + validityDays * 864e5;
  const validUntil = fmtDate(new Date(validTs), loc, { day: "numeric", month: "long", year: "numeric" });
  const expired = now > validTs;
  const validShort = expired ? ppt("expired_on", lang, { d: validUntil }) : ppt("valid_until", lang, { d: validUntil });

  const placeholderTitle = isPlaceholderTitle(inputs.title);
  const headline = placeholderTitle ? t("pdf_auto_title", lang, { kw: kwTxt }) : inputs.title;
  const sysLine = ppt("sys_line", lang, { kw: kwTxt, b: withBatt });
  const whoLine = [inputs.client ? ppt("for_client", lang, { c: inputs.client }) : "", inputs.address || ""].filter(Boolean).join(", ");
  const coName = company.name || "";
  const coShort = company.shortName || coName;
  const hasLogo = company.logoUrl && /^(https?:\/\/|data:image\/)/i.test(company.logoUrl);
  const initials = coName.split(/\s+/).filter((w) => /\p{L}/u.test(w)).slice(0, 2).map((w) => w.match(/\p{L}/u)[0]).join("").toUpperCase();
  const phone = preparedBy?.phone || "";
  const tel = phone.replace(/[^\d+]/g, "");

  // Equipment. A bill-of-materials line is {kind, brand, model, spec, qty};
  // warranties only where brand+model match a verified catalog SKU, never a
  // guess (lib/supplierCatalog.js findWarrantyInfo). Never the unit cost.
  const bomLines = bom.filter((l) => (Number(l.qty) || 0) > 0);
  const bomWarranty = bomLines.map((l) => findWarrantyInfo(l.brand, l.model));
  const installWarrantyYears = Number(company.installWarrantyYears) || 0;
  const hasRoof = Array.isArray(roofPlanes) && roofPlanes.length > 0;
  // Ukraine has its own outage plan above; elsewhere, the honest backup figure
  // is hours at the household's own average draw (lib/batteryBackup.js).
  const backupHrs = battKwh > 0 && inputs.market !== "UA" ? backupHours(battKwh, consEff) : null;

  // Designed for your home: the engineering checks, said plainly, only when
  // real equipment is chosen (same rows as PrintSheet.jsx).
  const dc = designCheck({ bom: bomLines, kw, battKwh, consKwh: consEff, market: inputs.market });
  const dcRows = designCheckRows(dc, { lang, battKwh });
  const realGear = Boolean(dc.fromBom?.panel && dc.fromBom?.inverter);
  const battIdx = 2 + (dc.stringRangeInfo ? 1 : 0);
  const fit = realGear ? [
    { icon: Scale, ok: dcRows[0].ok, warn: dcRows[0].warn, title: t("pdf2_fit_match", lang), line: t("pdf2_fit_match_l", lang, { dc: nf(dc.dcKw, 1), ac: nf(dc.acKw, 1) }) },
    { icon: Snowflake, ok: dcRows[1].ok, warn: dcRows[1].warn, title: t("pdf2_fit_cold", lang), line: t("pdf2_fit_cold_l", lang, { v: Math.round(dc.vString), t: dc.coldT, max: dc.maxDcV }) },
    ...(dc.stringRangeInfo ? [{ icon: ThermometerSun, ok: dcRows[2].ok, warn: dcRows[2].warn, title: t("pdf2_fit_hot", lang), line: t("pdf2_fit_hot_l", lang, { n: dc.perString, t: dc.hotT }) }] : []),
    ...(battKwh > 0 ? [{ icon: Moon, ok: dcRows[battIdx].ok, warn: dcRows[battIdx].warn, title: t("pdf2_fit_batt", lang), line: t("pdf2_fit_batt_l", lang, { b: nf(battKwh, 1), e: nf(dc.eveningKwh, 1) }) }] : []),
  ] : [];

  // The scenario line under each payback: the band's own figures, not adjectives.
  const scenDesc = (b) => {
    const ym = Number(b?.ym ?? 1), inf = Number(b?.infl ?? 0);
    const d = Math.round((ym - 1) * 100);
    const prod = ppt("sc_prod", lang, { y: d === 0 ? ppt("sc_asest", lang) : `${d > 0 ? "+" : "−"}${Math.abs(d)}%` });
    const price = inf === 0 ? ppt("sc_flat", lang) : ppt("sc_infl", lang, { i: n1(inf) });
    return `${prod}, ${price}`;
  };
  const scen = [
    ["sc_pess", bands.pess, E?.bands?.pess, CHART.pess, true, false],
    ["sc_expc", bands.expc, E?.bands?.expc, CHART.expc, false, true],
    ["sc_opti", bands.opti, E?.bands?.opti, CHART.opti, true, false],
  ];

  // Questions with answers this proposal can actually back up.
  const warrItems = bomLines.map((l, i) => (bomWarranty[i]
    ? `${kindLabel(l.kind, lang)}, ${[l.brand, l.model].filter(Boolean).join(" ")}: ${yearsN(bomWarranty[i].warrantyYears, lang)}`
    : null)).filter(Boolean);
  const surplusKey = { MD: "a_surplus_md", RO: "a_surplus_ro", UA: "a_surplus_ua" }[inputs.market];
  const faqs = [
    ["guar", ppt("q_guar", lang), ppt("a_guar", lang)],
    ["sign", ppt("q_sign", lang), ppt("a_sign", lang, { co: coShort })],
    ...(warrItems.length || installWarrantyYears ? [["warr", ppt("q_warr", lang), (
      <>
        {warrItems.length > 0 && ppt("a_warr", lang)}
        <ul>
          {warrItems.map((w) => <li key={w}>{w}</li>)}
          {installWarrantyYears > 0 && <li>{ppt("install_warr", lang, { co: coName, y: yearsN(installWarrantyYears, lang) })}</li>}
        </ul>
      </>
    )]] : []),
    ...(surplusKey ? [["surplus", ppt("q_surplus", lang), ppt(surplusKey, lang)]] : []),
    ...(hasFinance ? [["loan", ppt("q_loan", lang), ppt("a_loan", lang, { r: rateTxt, y: yearsN(financeTerm, lang) })]] : []),
    ["change", ppt("q_change", lang), ppt("a_change", lang)],
  ];

  const priceProps = { costEur: q.cost, offer, currency: fmt.currency, rate: fmt.rate, lang };
  const acceptLabel = ppt("cta_accept", lang), doneLabel = ppt("cta_done", lang);

  return (
    <main className="pp" lang={lang}>
      <HtmlLang lang={lang} />
      <div className="pp-wrap">

        {/* The cover: the installer's brand first, then what this is, what it
            costs, what it saves, when it has paid for itself, and the button. */}
        <header id="pp-hero" className="pp-hero">
          <div className="pp-hero-copy">
            <div className="pp-brand">
              <div className="pp-brand-id">
                {hasLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <span className="pp-logo"><img src={company.logoUrl} alt="" /></span>
                  : initials ? <span className="pp-mono" aria-hidden="true">{initials}</span> : null}
                <span className="pp-co">{coName}</span>
              </div>
              <span className={"pp-valid" + (expired ? " is-over" : "")}>
                <CalendarClock className="pp-ic" aria-hidden="true" />{validShort}
              </span>
            </div>
            <h1 className="pp-h1">{headline}</h1>
            <p className="pp-sub"><b>{sysLine}</b>{whoLine}</p>
          </div>

          <div className="pp-statement">
            <h2 className="pp-sr">{ppt("offer_h", lang)}</h2>
            {hasFinance ? (
              <FinanceToggle cash={fmt(q.cost)} monthly={`${fmt(monthlyPayment)}${t("pp_mo", lang)}`} lang={lang} />
            ) : (
              <div className="pp-price">
                <span className="pp-k">{ppt("k_price", lang)}</span>
                <b className="pp-price-v">{fmt(q.cost)}</b>
              </div>
            )}
            <dl className="pp-rows">
              <div className="pp-row">
                <dt>{ppt("k_save", lang)}<small>{ppt("k_save_s", lang, { v: fmt(mSave) })}</small></dt>
                <dd>{fmt(q.year1)}</dd>
              </div>
              <div className="pp-row">
                <dt>{ppt("k_payback", lang)}<small>{ppt("k_range", lang, { a: yrs(bands.opti.payback), b: yrs(bands.pess.payback) })}</small></dt>
                <dd>{yrs(bands.expc.payback)}<small>{yrsUnit(bands.expc.payback)}</small></dd>
              </div>
              <div className={"pp-row" + (lifeNet > 0 ? " is-pos" : "")}>
                <dt>{ppt("k_net", lang, { y: yearsN(hz, lang) })}<small>{ppt("k_net_s", lang)}</small></dt>
                <dd>{fmt(lifeNet)}</dd>
              </div>
            </dl>
          </div>

          <div className="pp-cta-row">
            <AcceptLink className="pp-btn pp-btn-accept" label={acceptLabel} doneLabel={doneLabel} accepted={accepted} />
          </div>
        </header>

        <div className="pp-layout">
          <div className="pp-main">

            {/* Ukraine: outages first, the way a Ukrainian household decides. */}
            {inputs.market === "UA" && (
              <section className="pp-sec">
                <UaSection inputs={inputs} quote={q} assumptions={E} fx={fx} money={fmt} lang={lang} />
              </section>
            )}

            {options.length > 0 && (
              <section className="pp-sec" aria-labelledby="pp-opt-h">
                <h2 className="pp-h2" id="pp-opt-h">{ppt("opt_h", lang)}</h2>
                <div className="pp-opts" style={{ marginTop: 18 }}>
                  {[
                    { key: "rec", rec: true, label: ppt("opt_rec", lang), kw, batt: battKwh, cost: q.cost, payback: bands.expc.payback, year1: q.year1 },
                    ...options.map((o, i) => ({ key: i, label: o.label || ppt("opt_n", lang, { n: i + 2 }), kw: o.kw, batt: o.battKwh, cost: o.cost, payback: o.payback, year1: o.year1 })),
                  ].map((o) => (
                    <article key={o.key} className={"pp-opt pp-card" + (o.rec ? " is-rec" : "")}>
                      <span className="pp-tag">{o.label}</span>
                      <h3 className="pp-opt-sys">{nf(o.kw, 1)} {kwU}{o.batt > 0 ? ppt("with_batt", lang, { b: n1(o.batt) }) : ""}</h3>
                      <dl className="pp-mini">
                        <div><dt>{ppt("k_price", lang)}</dt><dd>{fmt(o.cost)}</dd></div>
                        <div><dt>{ppt("k_payback", lang)}</dt><dd>{yrs(o.payback)} {yrsUnit(o.payback)}</dd></div>
                        <div><dt>{ppt("k_save_mo", lang)}</dt><dd>{fmt(o.year1 / 12)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* What they're actually buying, ahead of the money: a serious
                buyer compares equipment first (same reasoning as the PDF). */}
            <section className="pp-sec" aria-labelledby="pp-buy-h">
              <h2 className="pp-h2" id="pp-buy-h">{ppt("buy_h", lang)}</h2>
              <p className="pp-lead">{ppt("buy_lead", lang, { kw: kwTxt, b: withBatt, p: Math.round(q.prod0).toLocaleString(loc) })}</p>
              <ul className="pp-gear">
                {bomLines.length > 0 ? bomLines.map((l, i) => {
                  const w = bomWarranty[i];
                  const Icon = KIND_ICON[l.kind] || Package;
                  const name = [l.brand, l.model].filter(Boolean).join(" ") || bomLineText(l, lang);
                  const spec = [l.brand, l.model].filter(Boolean).length ? bomLineText({ spec: l.spec }, lang) : "";
                  return (
                    <li key={i}>
                      <span className="pp-tile" aria-hidden="true"><Icon className="pp-ic" /></span>
                      <div>
                        <span className="pp-gear-k">{kindLabel(l.kind, lang)}</span>
                        <span className="pp-gear-n">{name}</span>
                        {spec && <span className="pp-gear-s">{spec}</span>}
                        {w && (
                          <span className="pp-gear-m">
                            <span className="pp-chip">{ppt("warr_maker", lang, { y: yearsN(w.warrantyYears, lang) })}</span>
                            {w.productUrl && (
                              <a className="pp-link" href={w.productUrl} target="_blank" rel="noopener noreferrer">
                                {ppt("product_page", lang)}<ArrowUpRight className="pp-ic" aria-hidden="true" />
                                <span className="pp-sr"> ({ppt("new_tab", lang)})</span>
                              </a>
                            )}
                          </span>
                        )}
                      </div>
                      <span className="pp-qty"><span className="pp-sr">{ppt("qty", lang)}: </span>× {Number(l.qty)}</span>
                    </li>
                  );
                }) : (
                  // No bill of materials yet: the size-derived estimate, labelled as one.
                  [
                    [SolarPanel, t("pdf_panels", lang), t("pdf_panels_v", lang, { n: Math.max(1, Math.round(kw / 0.44)) })],
                    [Zap, t("pdf_inverter", lang), `~${kwTxt} ${kwU}`],
                    ...(inputs.batt ? [[BatteryCharging, t("pdf_batt_row", lang), battKwh ? `${n1(battKwh)} ${kwhU}` : t("pdf_included", lang)]] : []),
                  ].map(([Icon, k, v]) => (
                    <li key={k} style={{ gridTemplateColumns: "44px minmax(0,1fr)" }}>
                      <span className="pp-tile" aria-hidden="true"><Icon className="pp-ic" /></span>
                      <div><span className="pp-gear-k">{k}</span><span className="pp-gear-n">{v}</span></div>
                    </li>
                  ))
                )}
              </ul>

              {(installWarrantyYears > 0 || roofAreaM2 || roofOrientation) && (
                <div className="pp-chips">
                  {installWarrantyYears > 0 && <span className="pp-chip"><b>{ppt("install_warr", lang, { co: coName, y: yearsN(installWarrantyYears, lang) })}</b></span>}
                  {roofAreaM2 ? <span className="pp-chip">{t("pdf_roof_real", lang)}: <b>~{Math.round(roofAreaM2)} m²</b></span> : null}
                  {roofOrientation ? <span className="pp-chip">{t("pdf_orient", lang)}: <b>{Math.round(roofOrientation.tiltDeg)}°, {compassLabel(roofOrientation.azimuthDeg, lang)}</b></span> : null}
                </div>
              )}

              {hasRoof && (
                <figure className="pp-roof pp-card">
                  <RoofSnapshotSVG planes={roofPlanes} />
                  <figcaption>{t("pdf_roof_snap_note", lang, { n: roofPlanes.reduce((s, pl) => s + pl.panels.length, 0) })}</figcaption>
                </figure>
              )}

              {backupHrs != null && (
                <div className="pp-callout">
                  <span className="pp-tile" aria-hidden="true"><Plug className="pp-ic" /></span>
                  <div>
                    <h3 className="pp-h3">{ppt("backup_h", lang, { h: Math.round(backupHrs) })}</h3>
                    <p>{ppt("backup_p", lang, { b: n1(battKwh) })}</p>
                  </div>
                </div>
              )}

              {fit.length > 0 && (
                <div className="pp-fit-wrap">
                  <h3 className="pp-h3">{ppt("fit_h", lang)}</h3>
                  <p>{t("pdf2_fit_p", lang)}</p>
                  <div className="pp-fit">
                    {fit.map((f, i) => {
                      const Icon = f.ok ? f.icon : TriangleAlert;
                      return (
                        <div key={i} className={"pp-fit-i pp-card" + (f.ok ? "" : " is-warn")}>
                          <span className={"pp-tile is-sm" + (f.ok ? "" : " is-warn")} aria-hidden="true"><Icon className="pp-ic" /></span>
                          <div>
                            <b>{f.title}</b>
                            <span>{f.line}</span>
                            {!f.ok && f.warn ? <em>{f.warn}</em> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* The energy itself. */}
            <section className="pp-sec" aria-labelledby="pp-en-h">
              <h2 className="pp-h2" id="pp-en-h">{ppt("energy_h", lang)}</h2>
              <div className="pp-stats">
                <div className="pp-stat"><b>{Math.round(q.prod0).toLocaleString(loc)}<small>{kwhU}</small></b><span>{ppt("e_prod", lang)}</span></div>
                <div className="pp-stat"><b>{selfPct}%</b><span>{ppt("e_self", lang)}</span></div>
                {coverPct != null && <div className="pp-stat"><b>{coverPct}%</b><span>{ppt("e_cover", lang)}</span></div>}
              </div>
              <figure className="pp-chart pp-card">
                <div className="pp-legend">
                  <span className="pp-key"><i className="pp-sw" style={{ background: CHART.prod }} aria-hidden="true" />{t("pdf_m_prod", lang)}</span>
                  <span className="pp-key"><i className="pp-sw" style={{ background: CHART.cons }} aria-hidden="true" />{t("pdf_m_cons", lang)}</span>
                </div>
                <div className="pp-cw"><MonthlySVG prod={prodMonthly} cons={consMonthly} lang={lang} loc={loc} legend={false} labelScale={1.35} title={ppt("ch_monthly", lang, { u: kwhU })} /></div>
                <div className="pp-cn"><MonthlySVG prod={prodMonthly} cons={consMonthly} lang={lang} loc={loc} legend={false} narrow title={ppt("ch_monthly", lang, { u: kwhU })} /></div>
              </figure>
              <details className="pp-disc">
                <summary>{ppt("table_show", lang)}<ChevronDown className="pp-ic" aria-hidden="true" /></summary>
                <div className="pp-tbl-wrap">
                  <table className="pp-tbl">
                    <caption className="pp-sr">{ppt("ch_monthly", lang, { u: kwhU })}</caption>
                    <thead><tr><th scope="col">{ppt("month", lang)}</th><th scope="col">{t("pdf_m_prod", lang)}, {kwhU}</th><th scope="col">{t("pdf_m_cons", lang)}, {kwhU}</th></tr></thead>
                    <tbody>
                      {months.map((m, i) => (
                        <tr key={i}><th scope="row" style={{ fontWeight: 500 }}>{m}</th><td>{Math.round(prodMonthly[i]).toLocaleString(loc)}</td><td>{Math.round(consMonthly[i]).toLocaleString(loc)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              {surplus && surplus.totalKwh > 0 && (
                <p className="pp-note">{t("pdf2_surplus", lang, {
                  k: Math.round(surplus.totalKwh).toLocaleString(loc),
                  p: nf(weightedExportPriceMdl(SOLAR_SEASON), 2),
                  // already in lei when the offer is: say it once
                  v: fmt.currency === "MDL" ? fmt(surplus.eur) : `${Math.round(surplus.mdl).toLocaleString(loc)} lei (${fmt(surplus.eur)})`,
                })}</p>
              )}
            </section>

            {/* The money, as one continuous argument: scenarios, the
                year-by-year chart, what doing nothing costs, every assumption,
                then the live self-audit right where a skeptical reader wants it. */}
            <section className="pp-sec" aria-labelledby="pp-money-h">
              <h2 className="pp-h2" id="pp-money-h">{ppt("money_h", lang, { y: yearsN(hz, lang) })}</h2>
              <div className="pp-scen pp-card" style={{ marginTop: 18 }}>
                {scen.map(([key, b, bandE, color, dashed, isExp]) => (
                  <div key={key} className={"pp-scen-i" + (isExp ? " is-exp" : "")}>
                    <div>
                      <span className="pp-scen-k">
                        <i className={"pp-ln" + (dashed ? " is-dash" : "")} style={{ color }} aria-hidden="true" />
                        {ppt(key, lang)}
                      </span>
                      <span className="pp-scen-d">{scenDesc(bandE)}</span>
                    </div>
                    <div className="pp-scen-v">{yrs(b.payback)}<small>{yrsUnit(b.payback)}</small></div>
                    <div className="pp-scen-r">{ppt("sc_roi", lang, { y: yearsN(hz, lang) })}: <b>{b.roi == null ? "∞" : `${Math.round(b.roi)}%`}</b></div>
                  </div>
                ))}
              </div>

              <figure className="pp-chart pp-card">
                <div className="pp-legend">
                  <span className="pp-key"><i className="pp-ln" style={{ color: CHART.expc }} aria-hidden="true" />{ppt("sc_expc", lang)}</span>
                  <span className="pp-key"><i className="pp-ln is-dash" style={{ color: CHART.pess }} aria-hidden="true" />{ppt("sc_pess", lang)}</span>
                  <span className="pp-key"><i className="pp-ln is-dash" style={{ color: CHART.opti }} aria-hidden="true" />{ppt("sc_opti", lang)}</span>
                  <span className="pp-key"><i className="pp-dot" aria-hidden="true" />{ppt("be", lang)}</span>
                </div>
                <div className="pp-cw"><CashflowSVG bands={bands} cost={q.cost} horizon={hz} lang={lang} money={fmt} labelScale={1.35} title={ppt("ch_cash", lang)} /></div>
                <div className="pp-cn"><CashflowSVG bands={bands} cost={q.cost} horizon={hz} lang={lang} money={fmt} narrow title={ppt("ch_cash", lang)} /></div>
              </figure>
              <p className="pp-note">{ppt("cash_cap", lang, { v: fmt(lifeNet), n: hz })}</p>
              <details className="pp-disc">
                <summary>{ppt("table_show", lang)}<ChevronDown className="pp-ic" aria-hidden="true" /></summary>
                <div className="pp-tbl-wrap">
                  <table className="pp-tbl">
                    <caption className="pp-sr">{ppt("ch_cash", lang)}</caption>
                    <thead><tr><th scope="col">{ppt("year", lang)}</th><th scope="col">{ppt("sc_pess", lang)}</th><th scope="col">{ppt("sc_expc", lang)}</th><th scope="col">{ppt("sc_opti", lang)}</th></tr></thead>
                    <tbody>
                      {rowsE.map((v, i) => (
                        <tr key={i}><th scope="row" style={{ fontWeight: 500 }}>{i + 1}</th><td>{fmt(rowsP[i] ?? 0)}</td><td className="is-exp">{fmt(v)}</td><td>{fmt(rowsO[i] ?? 0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {doNothing > 0 && (
                <div className="pp-vs pp-card">
                  <h3 className="pp-h3">{ppt("vs_h", lang, { y: yearsN(hz, lang) })}</h3>
                  <div className="pp-vs-r">
                    <span>{ppt("vs_without", lang)}</span><b>{fmt(doNothing)}</b>
                    <i style={{ width: `${(doNothing / vsMax) * 100}%`, background: CHART.cons }} aria-hidden="true" />
                  </div>
                  <div className="pp-vs-r">
                    <span>{ppt("vs_with", lang)}</span><b>{fmt(withSolar)}</b>
                    <i style={{ width: `${(withSolar / vsMax) * 100}%`, background: CHART.prod }} aria-hidden="true" />
                  </div>
                  <p className="pp-note" style={{ marginTop: 12 }}>{ppt("vs_note", lang, { i: n1(inflPct) })}</p>
                </div>
              )}

              <details className="pp-disc" style={{ marginTop: 18 }}>
                <summary>{ppt("assump_h", lang)}<ChevronDown className="pp-ic" aria-hidden="true" /></summary>
                {/* readable, not a JSON dump: a homeowner must be able to check these */}
                <div className="pp-tbl-wrap">
                  <table className="pp-atbl"><tbody>
                    <tr><td>{t("pa_yield", lang)}</td>
                      <td>{t("pp_yield_v", lang, { n: Math.round(q.yieldPerKwp || E.baseYield) })}</td></tr>
                    <tr><td>{t("pa_cost", lang)}</td>
                      <td>{fmt(E.costPerKw)}/{kwU} + {fmt(E.batteryCost)} {t("pa_battery", lang)}</td></tr>
                    <tr><td>{t("pa_opex", lang)}</td>
                      <td>{t("pa_opex_v", lang, { n: E.opexPct })}</td></tr>
                    <tr><td>{t("pa_horizon", lang)}</td>
                      <td>{yearsN(hz, lang)}</td></tr>
                    <tr className="is-h"><td colSpan={2}>{t("pa_bands", lang)}</td></tr>
                    <tr><td>{t("pa_yieldrange", lang)}</td>
                      <td>{Math.round((E.bands.pess.ym - 1) * 100)}% / 0% / +{Math.round((E.bands.opti.ym - 1) * 100)}%</td></tr>
                    <tr><td>{t("pa_degr", lang)}</td>
                      <td>{t("pa_triple_yr", lang, { p: E.bands.pess.degr, e: E.bands.expc.degr, o: E.bands.opti.degr })}</td></tr>
                    <tr><td>{t("pa_infl", lang)}</td>
                      <td>{t("pa_triple_yr", lang, { p: E.bands.pess.infl, e: E.bands.expc.infl, o: E.bands.opti.infl })}</td></tr>
                  </tbody></table>
                </div>
              </details>

              <ClientAudit inputs={inputs} assumptions={E} lang={lang} currency={fmt.currency} rate={fmt.rate} />
            </section>

            {(hasFinance && monthlyPayment > 0) || loan > 0 ? (
              <section className="pp-sec" aria-labelledby="pp-fin-h">
                <h2 className="pp-h2" id="pp-fin-h" style={{ marginBottom: 18 }}>{ppt("fin_h", lang)}</h2>
                <div className={"pp-fin" + (hasFinance && monthlyPayment > 0 && loan > 0 ? " has-two" : "")}>
                  {hasFinance && monthlyPayment > 0 && (
                    <div className="pp-fin-b pp-card">
                      <span className="pp-k">{ppt("fin_est", lang)}</span>
                      <b className="pp-fin-v">{fmt(monthlyPayment)}<small>{t("pp_mo", lang)}</small></b>
                      <p>{ppt("fin_terms", lang, { r: rateTxt, y: yearsN(financeTerm, lang) })}</p>
                    </div>
                  )}
                  {loan > 0 && (
                    <div className="pp-fin-b pp-card">
                      <div className="pp-fin-cmp">
                        <div><b>{fmt(loan)}</b><span>{ppt("fin_loan", lang)}</span></div>
                        <div><b>{fmt(mSave)}</b><span>{ppt("fin_save", lang)}</span></div>
                      </div>
                      <p className={"pp-verdict " + (net >= 0 ? "is-good" : "is-bad")}>
                        {net >= 0 ? <TrendingUp className="pp-ic" aria-hidden="true" /> : <Info className="pp-ic" aria-hidden="true" />}
                        <span>{net >= 0 ? ppt("fin_good", lang, { v: fmt(net) }) : ppt("fin_bad", lang, { v: fmt(-net) })}</span>
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {/* Accept and sign: the entire point of the LIVE proposal versus
                the static PDF is that the client can act on it right here. */}
            <section id="accept" className="pp-accept pp-card" aria-labelledby="pp-acc-h">
              <div className="pp-accept-in">
                <h2 className="pp-h2" id="pp-acc-h" tabIndex={-1}>{ppt("next_h", lang)}</h2>
                <p>{ppt("next_p", lang, { co: coShort })}</p>
                <div className="pp-sum">
                  <div>
                    <span className="pp-k">{ppt("k_price", lang)}</span>
                    <LivePrice {...priceProps} />
                  </div>
                  <span className={"pp-sum-valid" + (expired ? " is-over" : "")}>
                    <CalendarClock className="pp-ic" aria-hidden="true" />{validShort}
                  </span>
                </div>
                <OfferBanner lang={lang} accepted={accepted} offer={offer} chosenOption={chosenOption} currency={fmt.currency} rate={fmt.rate}
                  optionLabels={Object.fromEntries(options.map((o, i) => [i + 2, o.label || ppt("opt_n", lang, { n: i + 2 })]))} />
                <Tracker code={params.code} accepted={accepted} lang={lang} signedName={signedName} signedDate={signedDate} />
              </div>
              <div className="pp-accept-foot">
                <div>
                  <h3 className="pp-h3">{ppt("steps_h", lang)}</h3>
                  <ol className="pp-steps">
                    <li>{ppt("step1", lang)}</li>
                    <li>{ppt("step2", lang)}</li>
                    <li>{ppt("step3", lang)}</li>
                    <li>{ppt("step4", lang)}</li>
                  </ol>
                </div>
                <div className="pp-contact">
                  <h3 className="pp-h3">{ppt("contact_h", lang)}</h3>
                  {preparedBy?.name && <span className="pp-contact-n">{preparedBy.name}</span>}
                  <span className="pp-contact-c">{coName}</span>
                  {tel && (
                    <a className="pp-btn pp-btn-ghost" href={`tel:${tel}`} aria-label={ppt("call_aria", lang, { phone })}>
                      <Phone className="pp-ic" aria-hidden="true" /><span className="pp-num">{phone}</span>
                    </a>
                  )}
                  {/* From 3 up: "1 system installed" undersells a new installer.
                      Computed from real won projects, never typed. */}
                  {company.wonCount >= 3 && <p className="pp-proof">{t("pdf_installed", lang, { n: company.wonCount, co: coName })}</p>}
                </div>
              </div>
            </section>

            {/* Questions: the answers this proposal can back up, then the
                assistant grounded in its real, frozen numbers (VoltMira's own,
                or the installer's Make.com scenario; see
                app/api/proposal/[code]/qa). Live view only, never on the PDF. */}
            <section className="pp-sec" aria-labelledby="pp-faq-h">
              <h2 className="pp-h2" id="pp-faq-h" style={{ marginBottom: 14 }}>{ppt("faq_h", lang)}</h2>
              <div className="pp-faq">
                {faqs.map(([k, qText, aText]) => (
                  <details key={k}>
                    <summary>{qText}<ChevronDown className="pp-ic" aria-hidden="true" /></summary>
                    <div className="pp-faq-a">{aText}</div>
                  </details>
                ))}
              </div>
              <QaWidget code={params.code} lang={lang} preparedBy={preparedBy} />
            </section>
          </div>

          {/* Wide screens: the offer stays in view while the client reads. */}
          <aside className="pp-rail" aria-label={ppt("rail_h", lang)}>
            <div className="pp-rail-card pp-card">
              <span className="pp-k">{ppt("k_price", lang)}</span>
              <LivePrice {...priceProps} />
              {hasFinance && monthlyPayment > 0 && <p className="pp-rail-mo">{ppt("or_monthly", lang, { v: fmt(monthlyPayment) })}</p>}
              <dl className="pp-mini">
                <div><dt>{ppt("k_payback", lang)}</dt><dd>{yrs(bands.expc.payback)} {yrsUnit(bands.expc.payback)}</dd></div>
                <div><dt>{ppt("k_save", lang)}</dt><dd>{fmt(q.year1)}</dd></div>
              </dl>
              <AcceptLink className="pp-btn pp-btn-accept pp-btn-block" label={acceptLabel} doneLabel={doneLabel} accepted={accepted} />
              <p className={"pp-rail-valid" + (expired ? " is-over" : "")}><CalendarClock className="pp-ic" aria-hidden="true" />{validShort}</p>
              {preparedBy?.name && (
                <div className="pp-rail-who">
                  <small>{ppt("contact_h", lang)}</small>
                  <div><b>{preparedBy.name}</b><span>{coName}</span></div>
                  {tel && (
                    <a className="pp-call" href={`tel:${tel}`} aria-label={ppt("call_aria", lang, { phone })}>
                      <Phone className="pp-ic" aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer className="pp-foot">
          <p>{expired ? ppt("expired_full", lang, { d: validUntil }) : ppt("valid_full", lang, { d: validUntil })}</p>
          {/* Growth loop: every free-plan proposal a homeowner opens carries a
              tasteful VoltMira credit. Pro/Team white-labels it away. The mark
              is drawn exactly as the brand's, never recoloured. */}
          {company.plan === "free" ? (
            <a className="pp-credit" href="https://voltmira.com" target="_blank" rel="noopener noreferrer">
              <span>
                <span style={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, borderRadius: 6, background: "#142A21" }} aria-hidden="true">
                  <svg width="13" height="13" viewBox="0 0 34 34"><path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="3" strokeLinecap="round" /><path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="3" strokeLinecap="round" /><path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="3" strokeLinecap="round" /></svg>
                </span>
                {t("powered_by", lang)}
              </span>
              <small>{t("powered_by_sub", lang)}</small>
            </a>
          ) : null /* Pro/Team: white-label, no VoltMira footer */}
          {/* This page tracks real opens/time-viewed on a real homeowner (see
              Privacy Policy's "Proposal analytics"): that disclosure has to stay
              reachable even when Pro/Team hides the branding above; transparency
              isn't a white-label option. Deliberately NOT hidden by company.plan. */}
          <a className="pp-privacy" href="https://voltmira.com/privacy" target="_blank" rel="noopener noreferrer">
            {ppt("privacy", lang)}
          </a>
        </footer>
      </div>

      {/* Phones: price and button in reach once the cover has scrolled away. */}
      {!accepted && (
        <StickyCta label={ppt("rail_h", lang)}>
          <LivePrice {...priceProps} note={ppt("k_price", lang)} />
          <AcceptLink className="pp-btn pp-btn-accept" label={acceptLabel} doneLabel={doneLabel} accepted={false} />
        </StickyCta>
      )}
    </main>
  );
}
