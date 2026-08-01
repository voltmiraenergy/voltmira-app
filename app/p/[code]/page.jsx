// app/p/[code]/page.jsx — the page your installer's CLIENT opens on their phone.
// Server-renders the proposal from the API, then a small client component
// sends real tracking events (open, heartbeat every 15s, battery toggle, accept).
import Tracker from "./tracker.jsx";
import AutoPrint from "./AutoPrint.jsx";
import PrintSheet from "./PrintSheet.jsx";
import ClientAudit from "./ClientAudit.jsx";
import { t, normLang } from "../../../lib/i18n.js";

async function getProposal(code) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/proposal/${code}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params, searchParams }) {
  // ?print=1 = the INSTALLER exporting a PDF: no tracking (would inflate their
  // own open counts), no accept/request buttons, auto print dialog.
  const printMode = searchParams?.print === "1";
  const data = await getProposal(params.code);
  if (!data) {
    return <main style={S.wrap}><h1 style={S.h1}>{t("pp_not_found", "en")}</h1>
      <p style={S.muted}>{t("pp_expired", "en")}</p></main>;
  }
  const { company, inputs, quote: q, accepted, sentAt, options = [] } = data;
  // The client reads this in the installer's language, not always English.
  const lang = normLang(company.lang);

  // ?print=1 → the branded PDF document (same layout as the demo's printProposal),
  // not the mobile proposal. AutoPrint fires the save-as-PDF dialog.
  if (printMode) {
    return (
      <main lang={lang} style={{ background: "#fff", minHeight: "100vh" }}>
        <PrintSheet company={company} inputs={inputs} quote={q} lang={lang} sentAt={sentAt} />
        <AutoPrint />
      </main>
    );
  }
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-IE";
  const fmt = (n) => "\u20AC" + Math.round(n).toLocaleString(loc);
  const yrs = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : n.toFixed(1);
  const mSave = q.year1 / 12, net = mSave - (inputs.loan || 0);

  return (
    <main style={S.wrap} lang={lang}>
      <header style={S.head}>
        {company.logoUrl
          ? <img src={company.logoUrl} alt="" style={{ height: 28 }} />
          : <span style={S.brand}>{company.shortName || company.name}</span>}
        <span style={S.tag}>{t("pp_tag", lang)}</span>
      </header>

      <h1 style={S.h1}>{inputs.title}</h1>
      <p style={S.muted}>{inputs.address} · {t("pp_prepared", lang)} {inputs.client || t("pp_you", lang)}</p>

      <section style={S.card}>
        <div style={S.kpis}>
          <div><b style={S.big}>{inputs.kw.toFixed(1)} kW</b><span style={S.kpiLbl}>
            {t("pp_solar", lang)}{inputs.batt ? t("pp_plus_batt", lang) : ""}</span></div>
          <div><b style={S.big}>{fmt(q.cost)}</b><span style={S.kpiLbl}>{t("pp_total_inv", lang)}</span></div>
          <div><b style={S.big}>{Math.round(q.prod0).toLocaleString(loc)} kWh</b><span style={S.kpiLbl}>{t("pp_prod_year", lang)}</span></div>
        </div>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>{t("pp_payback_h", lang)}</h2>
        <div style={S.bands}>
          {[["pp_pess", q.bands.pess, "#C4543B"],
            ["pp_expc", q.bands.expc, "#E89B2D"],
            ["pp_opti", q.bands.opti, "#1E6B4E"]].map(([key, b, c]) => (
            <div key={key} style={{ ...S.band, borderLeft: `4px solid ${c}` }}>
              <div style={{ ...S.bandTag, color: c }}>{t(key, lang)}</div>
              <div style={S.bandYrs}>{yrs(b.payback)} <small style={S.muted}>{t("pp_years", lang)}</small></div>
              <div style={S.kpiLbl}>{t("pp_roi", lang, { n: q.horizon, v: Math.round(b.roi) })}</div>
            </div>
          ))}
        </div>
        <details style={{ marginTop: 14 }}>
          <summary style={S.link}>{t("pp_assump", lang)}</summary>
          {/* readable, not a JSON dump — a homeowner must be able to check these */}
          <table style={S.atbl}><tbody>
            <tr><td style={S.atK}>{t("pa_yield", lang)}</td>
              <td style={S.atV}>{Math.round(q.yieldPerKwp || q.assumptions.baseYield)} kWh/kWp·yr</td></tr>
            <tr><td style={S.atK}>{t("pa_cost", lang)}</td>
              <td style={S.atV}>€{q.assumptions.costPerKw}/kW + €{q.assumptions.batteryCost} {t("pa_battery", lang)}</td></tr>
            {q.afmSubsidy && (
              <tr><td style={S.atK}>{t("pa_subsidy", lang)}</td>
                <td style={S.atV}>{t("pa_yes", lang)} — {(q.assumptions.subsidyAmountRon || 20000).toLocaleString()} RON</td></tr>
            )}
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
      </section>

      {options.length > 0 && (
        <section style={S.card}>
          <h2 style={S.h2}>{t("pp_compare_h", lang)}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: 12 }}>
            <div style={{ ...S.optCard, borderColor: "#1E6B4E" }}>
              <div style={{ ...S.optBadge, background: "#E4EFE9", color: "#1E6B4E" }}>{t("pp_recommended", lang)}</div>
              <div style={S.optSys}>{inputs.kw.toFixed(1)} kW{inputs.batt ? " + 🔋" : ""}</div>
              <div style={S.optPay}>{yrs(q.bands.expc.payback)} <small style={S.muted}>{t("pp_years", lang)}</small></div>
              <div style={S.kpiLbl}>{fmt(q.cost)} · {fmt(q.year1 / 12)}{t("pp_mo", lang)}</div>
            </div>
            {options.map((o, i) => (
              <div key={i} style={S.optCard}>
                <div style={S.optBadge}>{o.label || `${t("pp_option", lang)} ${i + 2}`}</div>
                <div style={S.optSys}>{o.kw.toFixed(1)} kW{o.battKwh > 0 ? " + 🔋" : ""}</div>
                <div style={S.optPay}>{yrs(o.payback)} <small style={S.muted}>{t("pp_years", lang)}</small></div>
                <div style={S.kpiLbl}>{fmt(o.cost)} · {fmt(o.year1 / 12)}{t("pp_mo", lang)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ClientAudit inputs={inputs} assumptions={q.assumptions} lang={lang} />

      <section style={S.card}>
        <h2 style={S.h2}>{t("pp_monthly_h", lang)}</h2>
        <div style={S.fin}>
          <div style={S.finBox}><div style={S.kpiLbl}>{t("pp_loan", lang)}</div>
            <b style={S.big}>{fmt(inputs.loan || 0)}{t("pp_mo", lang)}</b></div>
          <div style={S.finBox}><div style={S.kpiLbl}>{t("pp_est_save", lang)}</div>
            <b style={S.big}>{fmt(mSave)}{t("pp_mo", lang)}</b></div>
        </div>
        <div style={{ ...S.verdict, ...(net >= 0 ? S.good : S.bad) }}>
          {net >= 0 ? t("pp_good", lang, { v: fmt(net) }) : t("pp_bad", lang)}
        </div>
      </section>

      <Tracker code={params.code} accepted={accepted} lang={lang} />

      {/* Growth loop: every free-plan proposal a homeowner opens carries a
          tasteful VoltMira credit. Pro/Team white-labels it away. */}
      {company.plan === "free" ? (
        <a href="https://voltmira.com" target="_blank" rel="noopener noreferrer"
          style={{ display: "block", textAlign: "center", marginTop: 22, textDecoration: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#142A21", fontFamily: "Inter, system-ui, sans-serif" }}>
            <span style={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, borderRadius: 6, background: "#142A21", color: "#E89B2D", fontSize: 13 }}>⚡</span>
            {t("powered_by", lang)}
          </div>
          <div style={{ ...S.muted, fontSize: 12, marginTop: 3 }}>{t("powered_by_sub", lang)}</div>
        </a>
      ) : null /* Pro/Team: white-label — no VoltMira footer */}
      {/* print stylesheet: clean paper output for save-as-PDF */}
      <style>{`@media print{
        body{background:#fff!important}
        main{background:#fff!important;max-width:100%!important;padding:0!important}
        details{display:block} details>*{display:block}
        button{display:none!important}
        section{break-inside:avoid;border-color:#ddd!important}
      }`}</style>
    </main>
  );
}

const S = {
  wrap: { maxWidth: 780, margin: "0 auto", padding: "28px 18px 70px",
    fontFamily: "Inter, system-ui, sans-serif", color: "#142A21", background: "#F6F5F0", minHeight: "100vh" },
  head: { display: "flex", alignItems: "center", gap: 12, marginBottom: 22 },
  brand: { fontWeight: 700, fontSize: 18, fontFamily: "Inter, system-ui, sans-serif" },
  tag: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em",
    background: "#E4EFE9", color: "#1E6B4E", padding: "4px 10px", borderRadius: 99 },
  h1: { fontSize: 28, fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.02em", margin: "0 0 4px" },
  h2: { fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em", color: "#66756C", margin: "0 0 14px" },
  muted: { color: "#66756C", fontSize: 13.5 },
  card: { background: "#fff", border: "1px solid #E3E1D6", borderRadius: 14, padding: 20, margin: "16px 0" },
  kpis: { display: "flex", gap: 28, flexWrap: "wrap" },
  big: { display: "block", fontSize: 24, fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.02em" },
  kpiLbl: { fontSize: 12, color: "#66756C" },
  bands: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 },
  band: { background: "#F6F5F0", borderRadius: 10, padding: "14px 14px" },
  bandTag: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 },
  bandYrs: { fontSize: 24, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700 },
  fin: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  finBox: { background: "#F6F5F0", borderRadius: 10, padding: 16, textAlign: "center" },
  verdict: { textAlign: "center", fontWeight: 600, padding: "12px 14px", borderRadius: 10, fontSize: 15 },
  good: { background: "#E4EFE9", color: "#1E6B4E" },
  bad: { background: "#F7E6E1", color: "#C4543B" },
  link: { color: "#1E6B4E", cursor: "pointer", fontWeight: 600, fontSize: 13.5 },
  pre: { fontSize: 11.5, background: "#F6F5F0", padding: 12, borderRadius: 8, overflow: "auto" },
  atbl: { width: "100%", marginTop: 10, borderCollapse: "collapse", fontSize: 13 },
  atK: { padding: "6px 10px 6px 0", color: "#66756C", verticalAlign: "top" },
  atV: { padding: "6px 0", color: "#142A21", fontWeight: 600 },
  optCard: { background: "#F6F5F0", border: "1.5px solid #E3E1D6", borderRadius: 12, padding: "13px 14px" },
  optBadge: { display: "inline-block", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em",
    background: "#EDEBE2", color: "#66756C", borderRadius: 99, padding: "3px 9px", marginBottom: 9 },
  optSys: { fontSize: 15, fontWeight: 700, fontFamily: "Inter, system-ui, sans-serif", marginBottom: 2 },
  optPay: { fontSize: 21, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700, lineHeight: 1.1 },
};
