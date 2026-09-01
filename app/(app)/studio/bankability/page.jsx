"use client";
// Preview 4 — P50 / P90 as a formal export.
// The same honesty-engine yield maths, re-packaged as an Energy Yield Assessment
// & bankability summary — the shape a bank or an EBRD-adjacent lender expects for
// a commercial deal. Exceedance table, uncertainty budget, 25-yr schedule, DSCR.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, makeT, PreviewHeader, MockNote, EUR, NUM, engineSettings,
  useStudioClient, ClientBar,
} from "../studio-kit.jsx";
import { simulate, SOLAR_SEASON } from "../_engine.js";

const TX = {
  title: { en: "P50 / P90 export", ro: "Export P50 / P90", ru: "Экспорт P50 / P90" },
  sub: {
    en: "An Energy Yield Assessment and bankability summary for this client's system — exceedance probabilities, an uncertainty budget, the 25-year schedule and a DSCR view, from the same engine.",
    ro: "O evaluare a producției energetice și un rezumat de bancabilitate pentru sistemul acestui client — probabilități de depășire, buget de incertitudine, graficul pe 25 de ani și o vedere DSCR.",
    ru: "Оценка выработки и сводка банкабельности для системы этого клиента — вероятности превышения, бюджет неопределённости, 25-летний график и DSCR.",
  },
  note: {
    en: "P50 is the engine's expected band. P-values apply a combined uncertainty (σ ≈ 7.1%) to a normal distribution — the same method a lender's technical adviser uses. Everything below is built from the client's system in the bar above.",
    ro: "P50 este banda „așteptat” a motorului. Valorile P aplică o incertitudine combinată (σ ≈ 7,1%) unei distribuții normale — metoda folosită de consultantul tehnic al unei bănci. Tot ce urmează se construiește din sistemul clientului din bara de sus.",
    ru: "P50 — «ожидаемый» диапазон движка. P-значения применяют суммарную неопределённость (σ ≈ 7,1%) к нормальному распределению. Всё ниже строится из системы клиента в панели выше.",
  },
  gearing: { en: "Debt gearing", ro: "Grad de îndatorare", ru: "Доля долга" },
  rate: { en: "Debt rate", ro: "Dobândă", ru: "Ставка" },
  tenor: { en: "Tenor", ro: "Scadență", ru: "Срок" },
  yrs: { en: "yrs", ro: "ani", ru: "лет" },
  pdf: { en: "Export PDF", ro: "Exportă PDF", ru: "Экспорт PDF" },
  csv: { en: "Export data (CSV)", ro: "Exportă datele (CSV)", ru: "Экспорт данных (CSV)" },
};

const YIELD_KWP = 1256;   // PVGIS-SARAH3 optimal-plane resource assumption

// Combined P50 uncertainty budget (independent, root-sum-square).
const UNC = [
  { k: "Long-term solar resource (GHI)", s: 3.5 },
  { k: "Interannual variability", s: 4.8 },
  { k: "Transposition & PV model", s: 2.6 },
  { k: "Soiling & snow losses", s: 1.8 },
  { k: "System availability (grid + inverter)", s: 1.5 },
  { k: "Shading & horizon", s: 1.4 },
  { k: "Year-1 degradation / LID", s: 1.0 },
];
const SIGMA = Math.sqrt(UNC.reduce((a, x) => a + x.s * x.s, 0));  // ≈ 7.1
const Z = { P50: 0, P75: 0.6745, P90: 1.2816, P95: 1.6449, P99: 2.3263 };
const PLEVELS = ["P50", "P75", "P90", "P95", "P99"];

// degradation factor for year n (LID year 1, then linear)
const degr = (n) => (n <= 1 ? 0.98 : 0.98 * Math.pow(1 - 0.0055, n - 1));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function csvDownload(name, rows) {
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  try {
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  } catch { /* preview-only, non-fatal */ }
}

export default function BankabilityPreview() {
  const lang = useLang();
  const t = makeT(TX, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "P50 / P90 export — VoltMira Studio"; }, []);

  const [gearing, setGearing] = useState(70);
  const [rate, setRate] = useState(6.5);
  const [tenor, setTenor] = useState(8);

  const project = useMemo(() => ({
    name: client.name, ref: client.ref || "VM-BNK-2026",
    market: client.market, kw: +client.kw || 0, price: +client.price || 0.15,
    cons: +client.cons || 0, batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0,
    afmSubsidy: false, yieldOverride: YIELD_KWP,
  }), [client]);
  const schemeLabel = project.market === "MD" ? "Moldova · net billing" : "Romania · net metering 1:1";

  const model = useMemo(() => {
    const E = engineSettings();
    const p50sim = simulate(project, E, "expc");
    const cv = SIGMA / 100;
    const p50Annual = p50sim.prod0;                       // kWh/yr, year 1 (pre-degradation base)
    const byLevel = {};
    for (const L of PLEVELS) {
      const yr = p50Annual * (1 - Z[L] * cv);
      byLevel[L] = { annual: yr, spec: yr / project.kw, cf: yr / (project.kw * 8760) };
    }
    // P90 payback via a yield-scaled re-simulation (real engine, not a fudge).
    const p90ratio = 1 - Z.P90 * cv;
    const p90sim = simulate({ ...project, yieldOverride: project.yieldOverride * p90ratio }, E, "expc");

    const capex = p50sim.grossCost;
    const debt = capex * (gearing / 100);
    const r = rate / 100;
    const annuity = debt * r / (1 - Math.pow(1 + r, -tenor));

    // 25-year net cashflow (engine gives us year-1 net; grow with expc inflation,
    // shrink with degradation). rows[] is cumulative so diff gives yearly net.
    const infl = E.bands.expc.infl / 100;
    const netY1 = p50sim.year1;
    const p90NetY1 = p90sim.year1;
    const sched = [];
    let dscrMinP50 = Infinity, dscrMinP90 = Infinity;
    for (let n = 1; n <= 25; n++) {
      const g = degr(n) / degr(1);
      const escal = Math.pow(1 + infl, n - 1);
      const p50Net = netY1 * g * escal;
      const p90Net = p90NetY1 * g * escal;
      const ds = n <= tenor ? annuity : 0;
      if (n <= tenor) {
        dscrMinP50 = Math.min(dscrMinP50, p50Net / annuity);
        dscrMinP90 = Math.min(dscrMinP90, p90Net / annuity);
      }
      sched.push({
        n, degrPct: (1 - degr(n)) * 100,
        p50MWh: p50Annual * degr(n) / 1000,
        p90MWh: p50Annual * p90ratio * degr(n) / 1000,
        p50Net, p90Net, ds,
      });
    }
    return {
      capex, debt, annuity, byLevel, cv, p50Annual,
      paybackP50: p50sim.payback, paybackP90: p90sim.payback,
      netY1, p90NetY1, sched, dscrMinP50, dscrMinP90,
      dscrY1P50: netY1 / annuity, dscrY1P90: p90NetY1 / annuity,
    };
  }, [gearing, rate, tenor, project]);

  const loc = "en-IE";
  const showYears = [1, 2, 3, 5, 10, 15, 20, 25];

  function exportCsv() {
    const rows = [
      ["VoltMira — Energy Yield Assessment", project.name, project.ref],
      [],
      ["Exceedance", "Annual MWh", "Specific yield kWh/kWp", "Capacity factor %"],
      ...PLEVELS.map((L) => [L, (model.byLevel[L].annual / 1000).toFixed(1), model.byLevel[L].spec.toFixed(0), (model.byLevel[L].cf * 100).toFixed(1)]),
      [],
      ["Year", "Degradation %", "P50 MWh", "P90 MWh", "P50 net cash EUR", "P90 net cash EUR", "Debt service EUR"],
      ...model.sched.map((s) => [s.n, s.degrPct.toFixed(2), s.p50MWh.toFixed(1), s.p90MWh.toFixed(1), Math.round(s.p50Net), Math.round(s.p90Net), Math.round(s.ds)]),
    ];
    csvDownload(`voltmira-eya-${project.ref}.csv`, rows);
  }

  return (
    <>
      <PreviewHeader slug="bankability" lang={lang} title={t("title")} sub={t("sub")}
        right={<>
          <button className="btn ghost sm" onClick={exportCsv}>{t("csv")}</button>
          <button className="btn ghost sm" onClick={() => window.print()}>{t("pdf")}</button>
        </>} />
      <MockNote>{t("note")}</MockNote>

      <ClientBar lang={lang} />

      {/* lender assumptions */}
      <div className="pv-panel pv-noprint" style={{ marginBottom: 16 }}>
        <div className="bk-controls">
          <label><span>{t("gearing")} <output>{gearing}%</output></span>
            <input type="range" min="40" max="85" step="5" value={gearing} style={{ "--fill": ((gearing - 40) / 45) * 100 + "%" }}
              onChange={(e) => setGearing(+e.target.value)} /></label>
          <label><span>{t("rate")} <output>{rate.toFixed(1)}%</output></span>
            <input type="range" min="4" max="10" step="0.25" value={rate} style={{ "--fill": ((rate - 4) / 6) * 100 + "%" }}
              onChange={(e) => setRate(+e.target.value)} /></label>
          <label><span>{t("tenor")} <output>{tenor} {t("yrs")}</output></span>
            <input type="range" min="5" max="15" step="1" value={tenor} style={{ "--fill": ((tenor - 5) / 10) * 100 + "%" }}
              onChange={(e) => setTenor(+e.target.value)} /></label>
        </div>
      </div>

      {/* the document */}
      <div className="pv-doc-scroll">
      <div className="pv-doc">
        <div className="doc-co">VoltMira · Energy Yield Assessment & Bankability Summary · {new Date().toLocaleDateString(loc)}</div>
        <h1>{project.name}</h1>
        <p className="doc-sub">Ref. {project.ref} · prepared for the lender's technical adviser · methodology: PVGIS-SARAH3 resource + VoltMira honesty engine (P50 = expected band)</p>

        <h2>Project summary</h2>
        <div className="doc-grid">
          <div className="doc-kv"><span>Installed DC capacity</span><b>{project.kw.toFixed(1)} kWp</b></div>
          <div className="doc-kv"><span>Market / scheme</span><b>{schemeLabel}</b></div>
          <div className="doc-kv"><span>Optimal-plane resource</span><b>{project.yieldOverride} kWh/kWp/yr</b></div>
          <div className="doc-kv"><span>Assessment horizon</span><b>25 years</b></div>
          <div className="doc-kv"><span>CAPEX (turnkey)</span><b>{EUR(model.capex)}</b></div>
          <div className="doc-kv"><span>Combined P50 uncertainty (σ)</span><b>{SIGMA.toFixed(1)}%</b></div>
        </div>

        <h2>Energy yield — exceedance probabilities (year 1)</h2>
        <table>
          <thead><tr><th>Exceedance</th><th>Annual energy</th><th>Specific yield</th><th>Capacity factor</th><th>vs P50</th></tr></thead>
          <tbody>
            {PLEVELS.map((L) => {
              const v = model.byLevel[L];
              return (
                <tr key={L} style={L === "P90" ? { background: "#F0EEE6" } : undefined}>
                  <td><b>{L}</b>{L === "P50" ? " (expected)" : L === "P90" ? " (bank case)" : ""}</td>
                  <td>{NUM(v.annual / 1000, 1)} MWh</td>
                  <td>{v.spec.toFixed(0)} kWh/kWp</td>
                  <td>{(v.cf * 100).toFixed(1)}%</td>
                  <td>{L === "P50" ? "—" : "−" + (Z[L] * model.cv * 100).toFixed(1) + "%"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ExceedanceCurve model={model} />

        <h2>Uncertainty budget</h2>
        <table>
          <thead><tr><th>Source</th><th>σ (%)</th></tr></thead>
          <tbody>
            {UNC.map((u) => <tr key={u.k}><td>{u.k}</td><td>{u.s.toFixed(1)}</td></tr>)}
            <tr style={{ background: "#F0EEE6" }}><td><b>Combined (RSS)</b></td><td><b>{SIGMA.toFixed(1)}</b></td></tr>
          </tbody>
        </table>

        <h2>Monthly P50 production (year 1)</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Month</th>{MONTHS.map((m) => <th key={m} style={{ textAlign: "right" }}>{m}</th>)}<th style={{ textAlign: "right" }}>Year</th></tr></thead>
            <tbody>
              <tr><td>MWh</td>
                {SOLAR_SEASON.map((f, i) => {
                  const sum = SOLAR_SEASON.reduce((a, b) => a + b, 0);
                  return <td key={i} style={{ textAlign: "right" }}>{(model.p50Annual * f / sum / 1000).toFixed(1)}</td>;
                })}
                <td style={{ textAlign: "right" }}><b>{(model.p50Annual / 1000).toFixed(1)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>25-year performance schedule</h2>
        <table>
          <thead><tr><th>Year</th><th>Degradation</th><th>P50 energy</th><th>P90 energy</th><th>P50 net cash</th><th>P90 net cash</th></tr></thead>
          <tbody>
            {model.sched.filter((s) => showYears.includes(s.n)).map((s) => (
              <tr key={s.n}>
                <td>{s.n}</td><td>−{s.degrPct.toFixed(1)}%</td>
                <td>{s.p50MWh.toFixed(1)} MWh</td><td>{s.p90MWh.toFixed(1)} MWh</td>
                <td>{EUR(s.p50Net)}</td><td>{EUR(s.p90Net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="doc-note">Full year-by-year table in the CSV export. Net cash = energy value less O&amp;M, escalated at the expected-band inflation assumption.</p>

        <h2>Lender view — debt service coverage</h2>
        <div className="doc-grid">
          <div className="doc-kv"><span>Gearing / debt amount</span><b>{gearing}% · {EUR(model.debt)}</b></div>
          <div className="doc-kv"><span>Rate / tenor</span><b>{rate.toFixed(2)}% · {tenor} yrs</b></div>
          <div className="doc-kv"><span>Annual debt service</span><b>{EUR(model.annuity)}</b></div>
          <div className="doc-kv"><span>Payback — P50 / P90</span><b>{model.paybackP50 == null ? "25+" : model.paybackP50.toFixed(1)} / {model.paybackP90 == null ? "25+" : model.paybackP90.toFixed(1)} yrs</b></div>
          <div className="doc-kv"><span>DSCR year 1 — P50 / P90</span><b>{model.dscrY1P50.toFixed(2)}x / {model.dscrY1P90.toFixed(2)}x</b></div>
          <div className="doc-kv"><span>Min DSCR over tenor — P50 / P90</span><b>{model.dscrMinP50.toFixed(2)}x / {model.dscrMinP90.toFixed(2)}x</b></div>
        </div>
        <p className="doc-note" style={{ marginTop: 8 }}>
          {model.dscrMinP90 >= 1.2
            ? "P90 minimum DSCR clears a conventional 1.20x covenant across the tenor."
            : "P90 minimum DSCR is below a 1.20x covenant — reduce gearing or extend tenor to reach bankability."}
        </p>

        <h2>Methodology & limitations</h2>
        <p style={{ fontSize: "11px" }}>
          Resource from PVGIS-SARAH3 (2005–2023) for the site coordinates. Energy model and losses per the VoltMira engine
          (SR EN 50549-1 export scheme, per-market tariff rules). P-values assume a normal distribution of annual energy
          about P50 with the combined σ above. This is a screening assessment for financing discussions — not a substitute
          for an independent engineer's report where required by the facility.
        </p>
        <div className="doc-sign">
          <div>Prepared by — VoltMira (automated) · {new Date().toLocaleDateString(loc)}</div>
          <div>Reviewed by — [independent engineer]</div>
        </div>
      </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .bk-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px 20px}
        .bk-controls label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--muted)}
        .bk-controls output{color:var(--green);font-family:var(--font-d);font-weight:700}
      ` }} />
    </>
  );
}

function ExceedanceCurve({ model }) {
  const W = 520, H = 150, PADL = 40, PADB = 24, PADT = 8, PADR = 10;
  // x = annual MWh across P99..P50 range, y = probability of exceedance
  const lo = model.byLevel.P99.annual / 1000, hi = model.byLevel.P50.annual / 1000;
  const span = (hi - lo) || 1;
  const X = (mwh) => PADL + ((mwh - lo) / span) * (W - PADL - PADR);
  const Y = (p) => PADT + (1 - p / 100) * (H - PADT - PADB);
  // smooth-ish curve through the five points, plotted as exceedance %.
  const pts = [["P50", 50], ["P75", 25], ["P90", 10], ["P95", 5], ["P99", 1]]
    .map(([L, ex]) => [X(model.byLevel[L].annual / 1000), Y(ex)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 520, margin: "4px 0 2px" }}>
      <line x1={PADL} y1={Y(0)} x2={W - PADR} y2={Y(0)} stroke="#ccc" strokeWidth="1" />
      <line x1={PADL} y1={PADT} x2={PADL} y2={Y(0)} stroke="#ccc" strokeWidth="1" />
      {[10, 50, 90].map((p) => (
        <g key={p}>
          <line x1={PADL} y1={Y(p)} x2={W - PADR} y2={Y(p)} stroke="#eee" strokeWidth="1" />
          <text x={PADL - 6} y={Y(p) + 3} textAnchor="end" fontSize="8" fill="#888">{p}%</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="#1E6B4E" strokeWidth="2" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={i === 2 ? "#E89B2D" : "#1E6B4E"} />)}
      <text x={pts[0][0]} y={pts[0][1] - 7} fontSize="8" fill="#1E6B4E" textAnchor="middle">P50</text>
      <text x={pts[2][0]} y={pts[2][1] - 7} fontSize="8" fill="#C97F14" textAnchor="middle">P90</text>
      <text x={(W) / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="#888">annual energy (MWh) — probability of exceedance</text>
    </svg>
  );
}
