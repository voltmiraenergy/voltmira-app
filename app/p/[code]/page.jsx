// app/p/[code]/page.jsx — the page your installer's CLIENT opens on their phone.
// Server-renders the proposal from the API, then a small client component
// sends real tracking events (open, heartbeat every 15s, battery toggle, accept).
import Tracker from "./tracker.jsx";
import QaWidget from "./QaWidget.jsx";
import AutoPrint from "./AutoPrint.jsx";
import PrintSheet from "./PrintSheet.jsx";
import ClientAudit from "./ClientAudit.jsx";
import { MonthlySVG, CashflowSVG } from "./charts.jsx";
import FinanceToggle from "./FinanceToggle.jsx";
import { t, normLang } from "../../../lib/i18n.js";
import { fmtDate } from "../../../lib/tz.js";
import { kindLabel, bomLineText } from "../../../lib/quoteAnalysis.js";
import { findWarrantyInfo } from "../../../lib/supplierCatalog.js";
import { SOLAR_SEASON, effectiveConsumption, amortizedMonthlyPayment } from "@voltmira/engine";

async function getProposal(code) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/proposal/${code}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export const dynamic = "force-dynamic";

// Second layer behind the X-Robots-Tag header in next.config.mjs. These pages
// hold a named homeowner's address, consumption and price; they are reachable
// by anyone with the capability link, which is exactly why they must never be
// indexed. The title is deliberately generic so a leaked SERP entry (or a
// browser-history sync) cannot expose the client's name.
export const metadata = {
  title: "Solar proposal",
  robots: { index: false, follow: false, nocache: true },
};

// A small filled numeral badge + title — the same device PrintSheet.jsx uses
// for its section spine. Reusing it here (same numbers, same PDF section
// titles where they line up) is deliberate: a client who opens both the
// phone link and the PDF should recognize it as the same document, not two
// unrelated designs.
function SecHead({ n, children }) {
  return (
    <div style={S.secHead}>
      {n != null && <span style={S.secBadge}>{n}</span>}
      <h2 style={S.h2}>{children}</h2>
    </div>
  );
}

export default async function ProposalPage({ params, searchParams }) {
  // ?print=1 = the INSTALLER exporting a PDF: no tracking (would inflate their
  // own open counts), no accept/request buttons, auto print dialog.
  const printMode = searchParams?.print === "1";
  const data = await getProposal(params.code);
  if (!data) {
    return <main style={S.wrap}><h1 style={S.h1}>{t("pp_not_found", "en")}</h1>
      <p style={S.muted}>{t("pp_expired", "en")}</p></main>;
  }
  const { company, inputs, quote: q, accepted, sentAt, preparedBy = null, options = [], bom = [], signedName = null, signedAt = null,
    roofAreaM2 = null, roofOrientation = null, roofPlanes = null } = data;
  // The client reads this in the installer's language, not always English.
  const lang = normLang(company.lang);
  const signedDate = signedAt
    ? fmtDate(signedAt, { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  // ?print=1 → the branded PDF document (same layout as the demo's printProposal),
  // not the mobile proposal. AutoPrint fires the save-as-PDF dialog.
  if (printMode) {
    // No QR code here. Around 80% of clients open the proposal on a phone, and
    // a QR asks them to scan a screen with the device already holding it — the
    // link is simply a tap away. It only ever made sense on a printed copy,
    // which is the rarer case, so it was cost with no payoff on the common one.
    return (
      <main lang={lang} style={{ background: "#fff", minHeight: "100vh" }}>
        <PrintSheet company={company} inputs={inputs} quote={q} lang={lang} sentAt={sentAt} preparedBy={preparedBy} bom={bom}
          roofAreaM2={roofAreaM2} roofOrientation={roofOrientation} roofPlanes={roofPlanes} />
        {/* The PDF route drives printing through CDP and passes auto=0:
            window.print() inside headless Chromium blocks rather than returns. */}
        {searchParams?.auto !== "0" && <AutoPrint />}
      </main>
    );
  }
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-IE";
  const fmt = (n) => "€" + Math.round(n).toLocaleString(loc);
  const yrs = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : n.toFixed(1);
  const mSave = q.year1 / 12, net = mSave - (inputs.loan || 0);

  // Same derivation PrintSheet.jsx uses, so the mobile view gets the real
  // monthly-production and cashflow charts too — this page had zero data
  // visualization before, numbers-in-cards only, while the PDF had three
  // real charts. PVGIS's own monthly shape for this roof when it was looked
  // up; the engine's seasonal curve is the honest fallback otherwise.
  const shape = Array.isArray(inputs.monthlyYieldShape) && inputs.monthlyYieldShape.length === 12
    ? inputs.monthlyYieldShape : SOLAR_SEASON;
  const shapeSum = shape.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const prodMonthly = shape.map((f) => (q.prod0 * (Number(f) || 0)) / shapeSum);
  const consEff = Math.max(0, Number(effectiveConsumption(inputs)) || 0);
  const consMonthly = (inputs.useMonthly && Array.isArray(inputs.consMonthly) && inputs.consMonthly.length === 12)
    ? inputs.consMonthly.map((v) => Number(v) || 0)
    : new Array(12).fill(consEff / 12);

  // Absent on any proposal frozen before this feature existed — old snapshots'
  // engine object simply doesn't have these keys, so the toggle only shows up
  // once both are real numbers rather than silently assuming a rate.
  const financeRate = Number(q.assumptions?.financeRatePct);
  const financeTerm = Number(q.assumptions?.financeTermYears);
  const hasFinance = financeRate >= 0 && financeTerm > 0;
  const monthlyPayment = hasFinance ? amortizedMonthlyPayment(q.cost, financeRate, financeTerm) : 0;
  const placeholderTitle = !inputs.title || /^\s*new quote\s*$/i.test(inputs.title);
  const headline = placeholderTitle ? t("pdf_auto_title", lang, { kw: Number(inputs.kw).toFixed(1) }) : inputs.title;
  // Same real, verified-only lookup PrintSheet.jsx uses — a custom/hand-typed
  // BOM line that matches no real catalog SKU gets no warranty cell, never a
  // guess (see lib/supplierCatalog.js's findWarrantyInfo).
  const bomLines = bom.filter((l) => (Number(l.qty) || 0) > 0);
  const bomWarranty = bomLines.map((l) => findWarrantyInfo(l.brand, l.model));
  const anyBomWarranty = bomWarranty.some(Boolean);
  const installWarrantyYears = Number(company.installWarrantyYears) || 0;

  return (
    <main style={S.wrap} lang={lang}>
      {/* Masthead — the same device as the PDF's: a kicker line, a bold
          display headline, a rule underneath. The phone link and the PDF are
          the same document; they should read as the same document. */}
      <div style={S.kicker}>
        {company.shortName || company.name} · {t("pp_tag", lang)} · {fmtDate(new Date(), loc)}
      </div>
      <h1 style={S.h1}>{headline}</h1>
      <p style={{ ...S.muted, margin: "0 0 20px" }}>{inputs.address} · {t("pp_prepared", lang)} {inputs.client || t("pp_you", lang)}</p>

      {/* Hero: the opening statement, not just another card in the stack. */}
      <section style={S.hero}>
        <div style={S.kpis}>
          <div><b style={S.big}>{inputs.kw.toFixed(1)} kW</b><span style={S.kpiLbl}>
            {t("pp_solar", lang)}{inputs.batt ? t("pp_plus_batt", lang) : ""}</span></div>
          {hasFinance ? (
            <FinanceToggle cash={fmt(q.cost)} monthly={`${fmt(monthlyPayment)}${t("pp_mo", lang)}`} lang={lang} />
          ) : (
            <div><b style={S.big}>{fmt(q.cost)}</b><span style={S.kpiLbl}>{t("pp_total_inv", lang)}</span></div>
          )}
          <div><b style={S.big}>{Math.round(q.prod0).toLocaleString(loc)} kWh</b><span style={S.kpiLbl}>{t("pp_prod_year", lang)}</span></div>
        </div>
      </section>

      {options.length > 0 && (
        <section style={{ margin: "22px 0" }}>
          <SecHead>{t("pp_compare_h", lang)}</SecHead>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: 12 }}>
            <div style={{ ...S.optCard, borderColor: "#1E6B4E" }}>
              <div style={{ ...S.optBadge, background: "#E4EFE9", color: "#1E6B4E" }}>{t("pp_recommended", lang)}</div>
              <div style={S.optSys}>{inputs.kw.toFixed(1)} kW{inputs.batt ? t("pp_plus_batt", lang) : ""}</div>
              <div style={S.optPay}>{yrs(q.bands.expc.payback)} <small style={S.muted}>{t("pp_years", lang)}</small></div>
              <div style={S.kpiLbl}>{fmt(q.cost)} · {fmt(q.year1 / 12)}{t("pp_mo", lang)}</div>
            </div>
            {options.map((o, i) => (
              <div key={i} style={S.optCard}>
                <div style={S.optBadge}>{o.label || `${t("pp_option", lang)} ${i + 2}`}</div>
                <div style={S.optSys}>{o.kw.toFixed(1)} kW{o.battKwh > 0 ? t("pp_plus_batt", lang) : ""}</div>
                <div style={S.optPay}>{yrs(o.payback)} <small style={S.muted}>{t("pp_years", lang)}</small></div>
                <div style={S.kpiLbl}>{fmt(o.cost)} · {fmt(o.year1 / 12)}{t("pp_mo", lang)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1 — what they're actually buying, ahead of the money: a serious
          buyer compares equipment first (same reasoning as PrintSheet.jsx's
          own section 1). A bill-of-materials line is {kind, brand, model,
          spec, qty} — bomLineText/kindLabel read those real fields, not a
          `.label` no BOM line has ever carried. */}
      {bom.length > 0 && (
        <section style={{ margin: "22px 0" }}>
          <SecHead n={1}>{t("pdf_glance_h", lang)}</SecHead>
          <table style={S.atbl}><tbody>
            {bomLines.map((l, i) => {
              const w = bomWarranty[i];
              return (
                <tr key={i}>
                  <td style={{ ...S.atK, color: "#142A21", fontWeight: 600 }}>
                    {w?.productUrl ? (
                      <a href={w.productUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", textDecorationColor: "#D9D5C6" }}>
                        {bomLineText(l)}
                      </a>
                    ) : bomLineText(l)}
                    <span style={{ display: "block", color: "#66756C", fontWeight: 400, fontSize: 11.5 }}>
                      {kindLabel(l.kind, lang)}
                      {anyBomWarranty && w ? ` · ${t("pdf_warranty_v", lang, { n: w.warrantyYears })}` : ""}
                    </span>
                  </td>
                  <td style={{ ...S.atV, textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>× {Number(l.qty)}</td>
                </tr>
              );
            })}
          </tbody></table>
          {installWarrantyYears > 0 && (
            <p style={{ fontSize: 12, color: "#66756C", marginTop: 10 }}>
              {t("pdf_warranty_install_h", lang)}: <b style={{ color: "#142A21" }}>{t("pdf_warranty_install_v", lang, { n: installWarrantyYears, co: company.name || "" })}</b>
            </p>
          )}
        </section>
      )}

      {/* 2 — the energy itself. */}
      <section style={{ margin: "22px 0" }}>
        <SecHead n={bom.length > 0 ? 2 : 1}>{t("pdf_energy_h", lang)}</SecHead>
        <div style={S.chart}><MonthlySVG prod={prodMonthly} cons={consMonthly} lang={lang} loc={loc} /></div>
      </section>

      {/* 3 — the money, as one continuous argument: scenarios, the year-by-year
          chart, then the live self-audit right where a skeptical reader wants
          it — immediately after being told the numbers, not several screens
          later — then what it costs monthly. Same shape as PrintSheet.jsx's
          own money section. */}
      <section style={{ margin: "22px 0" }}>
        <SecHead n={bom.length > 0 ? 3 : 2}>{t("pdf_money_h", lang, { n: q.horizon })}</SecHead>
        <div style={S.bands}>
          {[["pp_pess", q.bands.pess, "#C4543B"],
            ["pp_expc", q.bands.expc, "#E89B2D"],
            ["pp_opti", q.bands.opti, "#1E6B4E"]].map(([key, b, c]) => (
            <div key={key} style={{ ...S.band, borderLeft: `4px solid ${c}` }}>
              <div style={{ ...S.bandTag, color: c }}>{t(key, lang)}</div>
              <div style={S.bandYrs}>{yrs(b.payback)} <small style={S.muted}>{t("pp_years", lang)}</small></div>
              <div style={S.kpiLbl}>{t("pp_roi", lang, { n: q.horizon, v: b.roi == null ? "∞" : Math.round(b.roi) })}</div>
            </div>
          ))}
        </div>
        <div style={{ ...S.chart, marginTop: 14 }}>
          <CashflowSVG bands={q.bands} cost={q.cost} horizon={q.horizon} lang={lang} money={fmt} />
        </div>
        <details style={{ marginTop: 14 }}>
          <summary style={S.link}>{t("pp_assump", lang)}</summary>
          {/* readable, not a JSON dump — a homeowner must be able to check these */}
          <table style={S.atbl}><tbody>
            <tr><td style={S.atK}>{t("pa_yield", lang)}</td>
              <td style={S.atV}>{Math.round(q.yieldPerKwp || q.assumptions.baseYield)} kWh/kWp·yr</td></tr>
            <tr><td style={S.atK}>{t("pa_cost", lang)}</td>
              <td style={S.atV}>€{q.assumptions.costPerKw}/kW + €{q.assumptions.batteryCost} {t("pa_battery", lang)}</td></tr>
            <tr><td style={S.atK}>{t("pa_opex", lang)}</td>
              <td style={S.atV}>{t("pa_opex_v", lang, { n: q.assumptions.opexPct })}</td></tr>
            <tr><td style={S.atK}>{t("pa_horizon", lang)}</td>
              <td style={S.atV}>{t("pa_horizon_v", lang, { n: q.horizon })}</td></tr>
            <tr><td style={{ ...S.atK, paddingTop: 12, fontWeight: 700 }} colSpan={2}>{t("pa_bands", lang)}</td></tr>
            <tr><td style={S.atK}>{t("pa_yieldrange", lang)}</td>
              <td style={S.atV}>{Math.round((q.assumptions.bands.pess.ym - 1) * 100)}% / 0% / +{Math.round((q.assumptions.bands.opti.ym - 1) * 100)}%</td></tr>
            <tr><td style={S.atK}>{t("pa_degr", lang)}</td>
              <td style={S.atV}>{t("pa_triple_yr", lang, { p: q.assumptions.bands.pess.degr, e: q.assumptions.bands.expc.degr, o: q.assumptions.bands.opti.degr })}</td></tr>
            <tr><td style={S.atK}>{t("pa_infl", lang)}</td>
              <td style={S.atV}>{t("pa_triple_yr", lang, { p: q.assumptions.bands.pess.infl, e: q.assumptions.bands.expc.infl, o: q.assumptions.bands.opti.infl })}</td></tr>
          </tbody></table>
        </details>

        <div style={{ marginTop: 18 }}><ClientAudit inputs={inputs} assumptions={q.assumptions} lang={lang} /></div>

        <div style={{ ...S.fin, marginTop: 18 }}>
          <div style={S.finBox}><div style={S.kpiLbl}>{t("pp_loan", lang)}</div>
            <b style={S.big}>{fmt(inputs.loan || 0)}{t("pp_mo", lang)}</b></div>
          <div style={S.finBox}><div style={S.kpiLbl}>{t("pp_est_save", lang)}</div>
            <b style={S.big}>{fmt(mSave)}{t("pp_mo", lang)}</b></div>
        </div>
        <div style={{ ...S.verdict, ...(net >= 0 ? S.good : S.bad) }}>
          {net >= 0 ? t("pp_good", lang, { v: fmt(net) }) : t("pp_bad", lang)}
        </div>
      </section>

      {/* Next step — the entire point of the LIVE proposal versus the static
          PDF is that the client can act on it right here. This used to be the
          last thing on the page, styled exactly like every reference card
          above it; it's the one section that should look like the point of
          the whole document, not an afterthought below the fine print. */}
      <section style={S.cta}>
        <SecHead n={bom.length > 0 ? 4 : 3}>{t("pdf_next_h", lang)}</SecHead>
        {preparedBy?.name && (
          <div style={S.ctaContact}>
            <span style={{ color: "#66756C", fontSize: 13 }}>{t("pp_prepared_by", lang)}</span>{" "}
            <b style={{ color: "#142A21" }}>{preparedBy.name}</b>
            {preparedBy.phone ? <> · <a href={`tel:${preparedBy.phone}`} style={{ color: "#1E6B4E", fontWeight: 600, textDecoration: "none" }}>{preparedBy.phone}</a></> : null}
          </div>
        )}
        <Tracker code={params.code} accepted={accepted} lang={lang} signedName={signedName} signedDate={signedDate} />
      </section>

      {/* Grounded in THIS proposal's real, frozen numbers via a Make.com
          scenario the installer configures (docs/MAKE_AUTOMATIONS.md) — see
          QaWidget.jsx's own comment for why its output is never rendered as
          HTML. Live-view only, never on the printed/emailed PDF. */}
      <QaWidget code={params.code} lang={lang} preparedBy={preparedBy} />

      {/* Growth loop: every free-plan proposal a homeowner opens carries a
          tasteful VoltMira credit. Pro/Team white-labels it away. */}
      {company.plan === "free" ? (
        <a href="https://voltmira.com" target="_blank" rel="noopener noreferrer"
          style={{ display: "block", textAlign: "center", marginTop: 26, textDecoration: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#142A21", fontFamily: "Inter, system-ui, sans-serif" }}>
            <span style={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, borderRadius: 6, background: "#142A21", color: "#E89B2D", fontSize: 13 }}><svg width="13" height="13" viewBox="0 0 34 34"><path d="M8 25 L14 12" stroke="#C4543B" stroke-width="3" stroke-linecap="round"/><path d="M14.5 25 L20.5 9" stroke="#E89B2D" stroke-width="3" stroke-linecap="round"/><path d="M21 25 L27 6.5" stroke="#3FAE6A" stroke-width="3" stroke-linecap="round"/></svg></span>
            {t("powered_by", lang)}
          </div>
          <div style={{ ...S.muted, fontSize: 12, marginTop: 3 }}>{t("powered_by_sub", lang)}</div>
        </a>
      ) : null /* Pro/Team: white-label, no VoltMira footer */}

      {/* This page tracks real opens/time-viewed on a real homeowner (see
          Privacy Policy's "Proposal analytics") — that disclosure has to stay
          reachable even when Pro/Team hides the branding above; transparency
          isn't a white-label option. Deliberately NOT hidden by company.plan. */}
      <p className="no-print" style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#8FA398" }}>
        <a href="https://voltmira.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
          {t("prop_privacy_link", lang)}
        </a>
      </p>
      {/* print stylesheet: clean paper output for save-as-PDF.
          No raw ">" in the CSS text below (was `details>*{...}`, now a
          descendant selector instead of a child selector) — <style> is a
          raw-text HTML element, so the browser never decodes the "&gt;"
          React's server-side escaping produces for a literal ">" in text
          content, while the client re-render sees the real ">" it just
          wrote — a real, reproducible hydration mismatch on every load of
          this page, not a cosmetic one: it forced the whole <main> to
          client-render, discarding the server-rendered content. */}
      <style>{`@media print{
        body{background:#fff!important}
        main{background:#fff!important;max-width:100%!important;padding:0!important}
        details{display:block} details *{display:block}
        button{display:none!important}
        .no-print{display:none!important}
        section{break-inside:avoid;border-color:#ddd!important;box-shadow:none!important}
      }`}</style>
    </main>
  );
}

// Inter Tight for every headline number/title: the app already loads it (the
// display face on /login) but this page never used it, so it read at the
// same weight as its own body text everywhere — same fix as the PDF.
const DISPLAY = "'Inter Tight',Inter,system-ui,sans-serif";
const S = {
  wrap: { maxWidth: 780, margin: "0 auto", padding: "28px 18px 70px",
    fontFamily: "Inter, system-ui, sans-serif", color: "#142A21", background: "#F6F5F0", minHeight: "100vh" },
  // Masthead — mirrors PrintSheet.jsx's .p-co/h1 treatment, so the phone
  // link and the PDF read as one document instead of two unrelated designs.
  kicker: { fontSize: 11.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
    color: "#1E6B4E", marginBottom: 10 },
  brand: { fontWeight: 700, fontSize: 18, fontFamily: DISPLAY },
  tag: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em",
    background: "#E4EFE9", color: "#1E6B4E", padding: "4px 10px", borderRadius: 99 },
  h1: { fontSize: 30, fontFamily: DISPLAY, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px" },
  h2: { fontSize: 15, fontFamily: DISPLAY, fontWeight: 700, color: "#142A21", margin: 0 },
  muted: { color: "#66756C", fontSize: 13.5 },
  // Numbered spine (SecHead): a section is demarcated by its badge + title,
  // not by wrapping it in yet another identical white bordered box — the
  // "everything is a card" look is exactly what read as templated before.
  // Only specific elements below (the hero, the chart frame, scenario cards,
  // the equipment table) get their own visual containment.
  secHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingTop: 18, borderTop: "1px solid #E3E1D6" },
  secBadge: { flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 22, height: 22, borderRadius: "50%", background: "#1E6B4E", color: "#fff",
    fontFamily: DISPLAY, fontSize: 11.5, fontWeight: 700 },
  hero: { background: "#fff", border: "1px solid #E3E1D6", borderTop: "3px solid #1E6B4E", borderRadius: 14, padding: "20px 20px 18px",
    boxShadow: "0 1px 2px rgba(20,42,33,.04), 0 10px 24px -14px rgba(20,42,33,.16)" },
  chart: { border: "1px solid #E5E2D6", borderRadius: 10, background: "#FCFBF7", padding: "6px 4px 2px", overflow: "hidden" },
  kpis: { display: "flex", gap: 28, flexWrap: "wrap" },
  big: { display: "block", fontSize: 24, fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "-0.02em" },
  kpiLbl: { fontSize: 12, color: "#66756C" },
  bands: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 },
  band: { background: "#fff", border: "1px solid #E3E1D6", borderRadius: 10, padding: "14px 14px" },
  bandTag: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 },
  bandYrs: { fontSize: 24, fontFamily: DISPLAY, fontWeight: 800 },
  fin: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  finBox: { background: "#fff", border: "1px solid #E3E1D6", borderRadius: 10, padding: 16, textAlign: "center" },
  verdict: { textAlign: "center", fontWeight: 600, padding: "12px 14px", borderRadius: 10, fontSize: 15 },
  good: { background: "#E4EFE9", color: "#1E6B4E" },
  bad: { background: "#F7E6E1", color: "#C4543B" },
  link: { color: "#1E6B4E", cursor: "pointer", fontWeight: 600, fontSize: 13.5 },
  atbl: { width: "100%", marginTop: 10, borderCollapse: "collapse", fontSize: 13 },
  atK: { padding: "6px 10px 6px 0", color: "#66756C", verticalAlign: "top" },
  atV: { padding: "6px 0", color: "#142A21", fontWeight: 600 },
  optCard: { background: "#fff", border: "1.5px solid #E3E1D6", borderRadius: 12, padding: "13px 14px" },
  optBadge: { display: "inline-block", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em",
    background: "#EDEBE2", color: "#66756C", borderRadius: 99, padding: "3px 9px", marginBottom: 9 },
  optSys: { fontSize: 15, fontWeight: 700, fontFamily: DISPLAY, marginBottom: 2 },
  optPay: { fontSize: 21, fontFamily: DISPLAY, fontWeight: 800, lineHeight: 1.1 },
  // The one section meant to look like the point of the page: a tinted
  // panel (the same green tint used for "good" verdicts elsewhere), not
  // another plain white card competing for attention with the reference
  // material above it.
  cta: { background: "#EFF5F1", border: "1px solid #CBD8CF", borderRadius: 16, padding: "20px 20px 22px", margin: "26px 0 16px" },
  ctaContact: { fontSize: 13.5, textAlign: "center", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #D9E3DC" },
};
