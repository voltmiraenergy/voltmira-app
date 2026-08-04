// app/p/[code]/PrintSheet.jsx — the branded proposal PDF, ported 1:1 from the
// demo's printProposal(): company line, headline KPIs (incl. highlighted
// lifetime savings), scenario table with key inputs, cumulative cash-flow
// chart, environmental impact, system-at-a-glance, monthly money + verdict,
// full assumptions, next steps + validity, footer. Rendered instead of the
// mobile proposal when ?print=1; AutoPrint fires the save-as-PDF dialog.
import { t } from "../../../lib/i18n.js";

// Per-market export data (same table as the demo's MARKETS).
const MKT = {
  RO: { feed: 0.036, co2: 0.30 },
  MD: { feed: 0.02, co2: 0.40 },
  DE: { feed: 0.08, co2: 0.35 },
};

function CashflowSVG({ bands, cost, horizon, lang }) {
  const W = 720, H = 185, PADX = 12, PADT = 10, PADB = 22;
  const rowsP = bands.pess.rows || [], rowsE = bands.expc.rows || [], rowsO = bands.opti.rows || [];
  const all = [...rowsP, ...rowsE, ...rowsO, -cost, 0];
  const mn = Math.min(...all), mx = Math.max(...all), sp = (mx - mn) || 1;
  const X = (i) => PADX + (i / Math.max(1, horizon - 1)) * (W - 2 * PADX);
  const Y = (v) => PADT + (1 - (v - mn) / sp) * (H - PADT - PADB);
  const ln = (r) => r.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const zero = Y(0), be = bands.expc.payback;
  const bx = be && be > 0 ? X(be - 1) : null;
  return (
    <svg className="p-chart" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      <line x1={PADX} y1={zero} x2={W - PADX} y2={zero} stroke="#B9B5A6" strokeWidth="1" strokeDasharray="3 4" />
      <path d={ln(rowsP)} fill="none" stroke="#C4543B" strokeWidth="1.4" strokeDasharray="4 3" opacity=".5" />
      <path d={ln(rowsO)} fill="none" stroke="#1E6B4E" strokeWidth="1.4" strokeDasharray="4 3" opacity=".5" />
      <path d={ln(rowsE)} fill="none" stroke="#1E6B4E" strokeWidth="2.4" />
      {bx !== null && <>
        <line x1={bx} y1={PADT} x2={bx} y2={H - PADB} stroke="#E89B2D" strokeWidth="1.4" strokeDasharray="3 3" />
        <circle cx={bx} cy={zero} r="3.4" fill="#E89B2D" />
        <text x={bx} y={H - 6} fontSize="9" fill="#C97F14" textAnchor="middle">{t("pdf_breakeven", lang)}</text>
      </>}
      <text x={PADX} y={H - 6} fontSize="9" fill="#999">{t("pdf_year1", lang)}</text>
      <text x={W - PADX} y={H - 6} fontSize="9" fill="#999" textAnchor="end">{t("pdf_yearN", lang, { n: horizon })}</text>
    </svg>
  );
}

const CSS = `
  body{background:#fff!important}
  .print-sheet{max-width:820px;margin:0 auto;background:#fff;color:#111;
    font-family:Inter,system-ui,sans-serif;font-size:13.5px;padding:38px 46px;line-height:1.5}
  .print-sheet h1,.print-sheet h2{font-family:'Inter',system-ui,sans-serif}
  .print-sheet .p-co{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#1E6B4E;font-weight:700;margin-bottom:10px}
  .print-sheet h1{font-size:27px;margin:0 0 4px;letter-spacing:-.02em}
  .print-sheet .p-sub{color:#555;font-size:13px;margin-bottom:26px}
  .print-sheet .p-kpis{display:flex;gap:34px;margin-bottom:26px;flex-wrap:wrap}
  .print-sheet .p-kpis b{display:block;font-size:22px;font-family:'Inter',system-ui,sans-serif}
  .print-sheet .p-kpis span{font-size:11px;color:#666}
  .print-sheet .p-kpis .hl{color:#C97F14}
  .print-sheet h2{font-size:15px;margin:22px 0 10px;color:#1E6B4E}
  .print-sheet table{width:100%;border-collapse:collapse;font-size:12.5px}
  .print-sheet th{text-align:left;padding:7px 9px;background:#F0EEE6;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .print-sheet td{padding:7px 9px;border-bottom:1px solid #E5E2D6}
  .print-sheet .p-verdict{margin-top:18px;padding:13px;background:#E4EFE9;color:#1E6B4E;font-weight:600;border-radius:8px;font-size:14px}
  .print-sheet .p-foot{margin-top:30px;font-size:10.5px;color:#888;border-top:1px solid #ddd;padding-top:12px}
  .print-sheet section{page-break-inside:avoid;margin:0}
  .print-sheet .p-chart{width:100%;height:auto;display:block;margin:4px 0 6px;border:1px solid #E5E2D6;border-radius:8px;background:#FCFBF7}
  .print-sheet .p-legend{display:flex;flex-wrap:wrap;gap:16px;font-size:10px;color:#666;margin-bottom:4px}
  .print-sheet .p-legend i{display:inline-block;width:15px;height:0;border-top:2px solid #1E6B4E;margin-right:5px;vertical-align:middle}
  .print-sheet .p-note{font-size:11.5px;color:#555;line-height:1.5;margin:2px 0 0}
  .print-sheet .p-eco{display:flex;gap:30px;margin:6px 0 2px;flex-wrap:wrap}
  .print-sheet .p-eco b{display:block;font-size:19px;font-family:'Inter',system-ui,sans-serif;color:#1E6B4E}
  .print-sheet .p-eco span{font-size:10.5px;color:#666}
  .print-sheet .p-steps{margin:4px 0 0;padding-left:18px;font-size:12.5px;color:#333}
  .print-sheet .p-steps li{margin-bottom:5px}
  .print-sheet .p-valid{margin-top:10px;font-size:11.5px;color:#666}
  @media print{ .print-sheet{padding:0} }
`;

export default function PrintSheet({ company, inputs, quote: q, lang, sentAt = null, preparedBy = null }) {
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-IE";
  const fmt = (n) => "€" + Math.round(n).toLocaleString(loc);
  const yrsF = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : n.toFixed(1);
  const pct = (n) => Math.round(n) + "%";
  const E = q.assumptions;
  const hz = q.horizon;
  const bands = q.bands;
  const mkt = MKT[inputs.market] || MKT.RO;

  const rowsE = bands.expc.rows || [];
  const lifeNet = rowsE.length ? rowsE[rowsE.length - 1] : 0;
  const lifeGross = lifeNet + q.cost;
  const net = q.year1 / 12 - (inputs.loan || 0);
  const co2Year = q.prod0 * mkt.co2;
  const co2Life = co2Year * hz / 1000;
  const trees = Math.max(1, Math.round(co2Year / 21));
  const carKm = Math.round(co2Year / 0.17);
  const panels = Math.max(1, Math.round(inputs.kw / 0.44));
  const roofArea = Math.round(inputs.kw * 5.5);
  // Valid for the company's validity window from when the quote was sent
  // (frozen in the snapshot engine); falls back to today + 30 for old proposals.
  const validityDays = E.quoteValidityDays || 30;
  const validBase = sentAt ? new Date(sentAt).getTime() : Date.now();
  const validUntil = new Date(validBase + validityDays * 864e5).toLocaleDateString(loc);
  const battSuffix = inputs.batt ? t("pp_plus_batt", lang) : "";
  const mktLine = t("market_" + (inputs.market || "RO").toLowerCase(), lang);
  const tr = (k, v) => t(k, lang, v);

  return (
    <div className="print-sheet">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {company.logoUrl && /^(https?:\/\/|data:image\/)/i.test(company.logoUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logoUrl} alt="" style={{ height: 26, marginBottom: 10 }} />
      )}
      <div className="p-co">{company.name} · {tr("pdf_title")} · {new Date().toLocaleDateString(loc)}</div>
      <h1>{inputs.title || tr("untitled")}</h1>
      <div className="p-sub">{inputs.address || ""} — {tr("pdf_prepared")} {inputs.client || tr("pdf_the_client")}</div>

      <div className="p-kpis">
        <div><b>{Number(inputs.kw).toFixed(1)} kW{battSuffix}</b><span>{tr("pdf_system")}</span></div>
        <div><b>{fmt(q.cost)}</b><span>{tr("total_inv")}</span></div>
        <div><b>{Math.round(q.prod0).toLocaleString(loc)} kWh</b><span>{tr("prod_year")}</span></div>
        <div><b>{fmt(q.year1)}</b><span>{tr("save_y1")}</span></div>
        <div><b className="hl">{fmt(lifeGross)}</b><span>{tr("pdf_save_over", { n: hz })}</span></div>
      </div>

      <section>
        <h2>{tr("payback_title")}</h2>
        <table><tbody>
          <tr><th>{tr("pdf_scenario")}</th><th>{tr("pdf_payback")}</th><th>{hz}{tr("yr_roi")}</th><th>{tr("pdf_key_inputs")}</th></tr>
          <tr><td>{tr("pessimistic")}</td><td>{yrsF(bands.pess.payback)} {tr("years_w")}</td><td>{pct(bands.pess.roi)}</td>
            <td>{tr("pdf_inputs_v", { y: Math.round((E.bands.pess.ym - 1) * 100) + "%", d: E.bands.pess.degr, i: E.bands.pess.infl })}</td></tr>
          <tr><td><b>{tr("expected")}</b></td><td><b>{yrsF(bands.expc.payback)} {tr("years_w")}</b></td><td><b>{pct(bands.expc.roi)}</b></td>
            <td>{tr("pdf_inputs_v", { y: tr("pdf_base_yield"), d: E.bands.expc.degr, i: E.bands.expc.infl })}</td></tr>
          <tr><td>{tr("optimistic")}</td><td>{yrsF(bands.opti.payback)} {tr("years_w")}</td><td>{pct(bands.opti.roi)}</td>
            <td>{tr("pdf_inputs_v", { y: "+" + Math.round((E.bands.opti.ym - 1) * 100) + "%", d: E.bands.opti.degr, i: E.bands.opti.infl })}</td></tr>
        </tbody></table>
      </section>

      <section>
        <h2>{tr("pdf_money_h", { n: hz })}</h2>
        <CashflowSVG bands={bands} cost={q.cost} horizon={hz} lang={lang} />
        <div className="p-legend">
          <span><i />{tr("expected")}</span>
          <span><i style={{ borderColor: "#C4543B", borderTopStyle: "dashed" }} />{tr("pessimistic")}</span>
          <span><i style={{ borderColor: "#1E6B4E", borderTopStyle: "dashed", opacity: .6 }} />{tr("optimistic")}</span>
          <span><i style={{ borderColor: "#E89B2D", borderTopStyle: "dashed" }} />{tr("lg_break")}</span>
        </div>
        <p className="p-note" dangerouslySetInnerHTML={{
          __html: tr("pdf_cash_note", { n: hz, v: fmt(lifeNet) }) }} />
      </section>

      <section>
        <h2>{tr("pdf_eco_h")}</h2>
        <div className="p-eco">
          <div><b>{Math.round(co2Year).toLocaleString(loc)} kg</b><span>{tr("pdf_co2_year")}</span></div>
          <div><b>{co2Life.toFixed(1)} t</b><span>{tr("pdf_co2_life", { n: hz })}</span></div>
          <div><b>{trees}</b><span>{tr("pdf_trees")}</span></div>
          <div><b>{carKm.toLocaleString(loc)} km</b><span>{tr("pdf_car")}</span></div>
        </div>
      </section>

      <section>
        <h2>{tr("pdf_glance_h")}</h2>
        <table><tbody>
          <tr><td>{tr("pdf_panels")}</td><td>{tr("pdf_panels_v", { n: panels })}</td></tr>
          <tr><td>{tr("pdf_inverter")}</td><td>~{Number(inputs.kw).toFixed(1)} kW</td></tr>
          {inputs.batt && <tr><td>{tr("pdf_batt_row")}</td><td>{tr("pdf_included")}</td></tr>}
          <tr><td>{tr("pdf_roof")}</td><td>~{roofArea} m²</td></tr>
          <tr><td>{tr("pdf_orient")}</td><td>{tr("pdf_orient_v")}</td></tr>
        </tbody></table>
      </section>

      <section>
        <h2>{tr("pdf_monthly_h")}</h2>
        <table><tbody>
          <tr><th>{tr("pdf_loan_h")}</th><th>{tr("pdf_save_h")}</th><th>{tr("pdf_net_h")}</th></tr>
          <tr><td>{fmt(inputs.loan || 0)}</td><td>{fmt(q.year1 / 12)}</td>
            <td>{(net >= 0 ? "+" : "") + fmt(net)}{tr("pp_mo")}</td></tr>
        </tbody></table>
        {net >= 0 && <div className="p-verdict">{tr("pdf_cf_ok")}</div>}
      </section>

      <section>
        <h2>{tr("pdf_assump_h")}</h2>
        <table><tbody>
          <tr><td>{tr("as_yield_exp")}</td><td>{tr("as_yield_v", { n: Math.round(q.yieldPerKwp || E.baseYield) })}</td></tr>
          {q.afmSubsidy && <tr><td>{tr("pa_subsidy")}</td><td>{tr("pa_yes")} — {(E.subsidyAmountRon || 20000).toLocaleString(loc)} RON</td></tr>}
          <tr><td>{tr("as_export_scheme")}</td><td>{tr("pdf_scheme_v", { s: mktLine, f: mkt.feed })}</td></tr>
          <tr><td>{tr("as_selfcons")}</td><td>{Math.round((q.self || 0) * 100)}%{inputs.batt ? " " + tr("as_with_batt") : ""}</td></tr>
          <tr><td>{tr("as_cost_basis")}</td><td>{tr("pdf_cost_v", { c: E.costPerKw, b: E.batteryCost, o: E.opexPct })}</td></tr>
          <tr><td>{tr("pdf_horizon")}</td><td>{tr("as_horizon_v", { n: hz })}</td></tr>
          <tr><td>{tr("pdf_co2_factor")}</td><td>{mkt.co2} kg/kWh</td></tr>
        </tbody></table>
      </section>

      <section>
        <h2>{tr("pdf_next_h")}</h2>
        <ol className="p-steps">
          <li>{tr("pdf_step1")}</li>
          <li>{tr("pdf_step2")}</li>
          <li>{tr("pdf_step3")}</li>
          <li>{tr("pdf_step4")}</li>
        </ol>
        <div className="p-valid">{tr("pdf_valid", { d: validUntil })}</div>
      </section>

      {preparedBy?.name && (
        <div className="p-foot" style={{ borderTop: "none", marginTop: 18, paddingTop: 0 }}>
          {tr("pp_prepared_by")} {preparedBy.name}{preparedBy.phone ? " · " + preparedBy.phone : ""} · {company.name}
        </div>
      )}
      <div className="p-foot">{company.name}{company.plan === "free" ? <> · {tr("pdf_foot")} · voltmira.com</> : null}</div>
    </div>
  );
}
