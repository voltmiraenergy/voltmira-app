"use client";
// Preview 4 — P50 / P90 as a formal export.
// The same honesty-engine yield maths, re-packaged as an Energy Yield Assessment
// & bankability summary — the shape a bank or an EBRD-adjacent lender expects for
// a commercial deal. Exceedance table, uncertainty budget, 25-yr schedule, DSCR.
//
// The document body has its own language toggle (EN default, for the lender's
// technical adviser; RO so a Romanian installer can present the same report). The
// surrounding chrome follows the app language like every other surface.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, makeT, PreviewHeader, MockNote, EUR, NUM, engineSettings, downloadStudioDoc,
  useStudioClient, ClientBar, systemFor, DocReveal,
} from "../studio-kit.jsx";
import { simulate, SOLAR_SEASON, effectiveYield, FX } from "../_engine.js";
import {
  weightedExportPriceMdl, weightedExportPriceEur, annualAverages, BUYBACK_SOURCE,
} from "../../../../lib/prosumerPrice.js";

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
  docLangLabel: { en: "Document language", ro: "Limba documentului", ru: "Язык документа" },
  gearing: { en: "Debt gearing", ro: "Grad de îndatorare", ru: "Доля долга" },
  rate: { en: "Debt rate", ro: "Dobândă", ru: "Ставка" },
  tenor: { en: "Tenor", ro: "Scadență", ru: "Срок" },
  yrs: { en: "yrs", ro: "ani", ru: "лет" },
  disc: { en: "Discount rate", ro: "Rată de actualizare", ru: "Ставка дисконт." },
  pdf: { en: "Export PDF", ro: "Exportă PDF", ru: "Экспорт PDF" },
  csv: { en: "Export data (CSV)", ro: "Exportă datele (CSV)", ru: "Экспорт данных (CSV)" },
  m_payback: { en: "Payback (P50)", ro: "Recuperare (P50)", ru: "Окупаемость (P50)" },
  m_dscr: { en: "Min. DSCR (P90)", ro: "DSCR minim (P90)", ru: "Мин. DSCR (P90)" },
  m_npv: { en: "NPV", ro: "VAN", ru: "NPV" },
  m_irr: { en: "IRR", ro: "RIR", ru: "IRR" },
  m_years: { en: "yrs", ro: "ani", ru: "лет" },
};

// Internal rate of return by bisection on the P50 cashflow series (cf[0] = −capex).
function irrOf(cf) {
  const npvAt = (r) => cf.reduce((s, c, n) => s + c / Math.pow(1 + r, n), 0);
  let lo = -0.9, hi = 1.5, fLo = npvAt(lo);
  if (fLo * npvAt(hi) > 0) return null;          // no sign change in range
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2, fMid = npvAt(mid);
    if (Math.abs(fMid) < 1e-4) return mid;
    if (fLo * fMid < 0) hi = mid; else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

// Combined P50 uncertainty budget (independent, root-sum-square).
const UNC = [
  { k: "Long-term solar resource (GHI)", ro: "Resursă solară pe termen lung (GHI)", s: 3.5 },
  { k: "Interannual variability", ro: "Variabilitate interanuală", s: 4.8 },
  { k: "Transposition & PV model", ro: "Transpoziție & model PV", s: 2.6 },
  { k: "Soiling & snow losses", ro: "Pierderi prin murdărire & zăpadă", s: 1.8 },
  { k: "System availability (grid + inverter)", ro: "Disponibilitatea sistemului (rețea + invertor)", s: 1.5 },
  { k: "Shading & horizon", ro: "Umbrire & orizont", s: 1.4 },
  { k: "Year-1 degradation / LID", ro: "Degradare an 1 / LID", s: 1.0 },
];
const SIGMA = Math.sqrt(UNC.reduce((a, x) => a + x.s * x.s, 0));  // ≈ 7.1
const Z = { P50: 0, P75: 0.6745, P90: 1.2816, P95: 1.6449, P99: 2.3263 };
const PLEVELS = ["P50", "P75", "P90", "P95", "P99"];

// degradation factor for year n (LID year 1, then linear)
// Degradation factor for year n: 2% LID in year 1, then `rate`/yr linear.
const degrAt = (n, rate) => (n <= 1 ? 0.98 : 0.98 * Math.pow(1 - rate, n - 1));
const DEGR_BASE = 0.0055;
const degr = (n) => degrAt(n, DEGR_BASE);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_RO = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];

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
  const [disc, setDisc] = useState(6);   // real discount rate for NPV / IRR / LCOE
  // Document language follows the workspace by default (so a Romanian workspace
  // doesn't get an English document beside Romanian chrome); switch to EN on
  // demand for a lender / technical-adviser audience. EN/RO only.
  const [docLang, setDocLang] = useState(lang === "en" ? "en" : "ro");
  useEffect(() => { setDocLang(lang === "en" ? "en" : "ro"); }, [lang]);
  const d = (en, ro) => (docLang === "ro" ? ro : en);

  // A bank reads this doc next to the offer, so both have to price exported kWh
  // the same way: Moldova's surplus is bought back at the operator's published
  // monthly price, weighted by the months the system actually exports in.
  const buyback = useMemo(() => ({
    weightedMdl: weightedExportPriceMdl(SOLAR_SEASON),
    weightedEur: weightedExportPriceEur(SOLAR_SEASON, FX.MDL),
    years: annualAverages(),
  }), []);

  const project = useMemo(() => ({
    name: client.name, ref: client.ref || "VM-BNK-2026",
    market: client.market, kw: +client.kw || 0, price: +client.price || 0.15,
    cons: +client.cons || 0, batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0,
    afmSubsidy: false, yieldOverride: effectiveYield(client),
    ...(client.market === "MD" ? { feedOverride: buyback.weightedEur } : {}),
  }), [client, buyback.weightedEur]);
  const schemeLabel = project.market === "MD"
    ? d("Moldova · net billing", "Moldova · facturare netă")
    : d("Romania · net metering 1:1", "România · contorizare netă 1:1");

  // Chemistry-aware storage life: LiFePO₄ at a solar duty-cycle (~330 full
  // cycles/yr) comfortably clears 25 years; a shorter-lived chemistry (NMC)
  // needs a pack replacement in the cashflow, not a promise nobody checks.
  const battInfo = useMemo(() => {
    if (!(+client.batteryKwh > 0)) return null;
    const battery = systemFor(client).battery;
    const CYCLES_PER_YEAR = 330;
    const lifeYears = battery.cycles / CYCLES_PER_YEAR;
    const replaceYear = battery.chemClass !== "LFP" && lifeYears < 25 ? Math.min(24, Math.max(1, Math.round(lifeYears))) : null;
    const units = Math.max(1, Math.ceil((+client.batteryKwh || 0) / battery.kwh));
    return { battery, lifeYears, replaceYear, replaceCostEur: replaceYear ? units * battery.price : 0 };
  }, [client]);

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
      const battReplace = battInfo?.replaceYear === n ? battInfo.replaceCostEur : 0;
      const p50Net = netY1 * g * escal - battReplace;
      const p90Net = p90NetY1 * g * escal - battReplace;
      const ds = n <= tenor ? annuity : 0;
      if (n <= tenor) {
        dscrMinP50 = Math.min(dscrMinP50, p50Net / annuity);
        dscrMinP90 = Math.min(dscrMinP90, p90Net / annuity);
      }
      sched.push({
        n, degrPct: (1 - degr(n)) * 100,
        p50MWh: p50Annual * degr(n) / 1000,
        p90MWh: p50Annual * p90ratio * degr(n) / 1000,
        p50Net, p90Net, ds, battReplace,
      });
    }

    // Discounted investment metrics on the P50 case. NPV and IRR run on the net
    // cashflow (energy value less O&M) against CAPEX; LCOE divides discounted
    // lifetime cost (CAPEX + escalating O&M) by discounted lifetime energy.
    const dr = disc / 100;
    const opexRate = (Number(E.opexPct) || 0.5) / 100;
    const cfP50 = [-capex];
    let npv = -capex, pvEnergy = 0, pvCost = capex;
    for (const s of sched) {
      const dn = Math.pow(1 + dr, s.n);
      npv += s.p50Net / dn;
      cfP50.push(s.p50Net);
      pvEnergy += (s.p50MWh * 1000) / dn;
      pvCost += (capex * opexRate * Math.pow(1 + infl, s.n - 1)) / dn;
    }
    const irr = irrOf(cfP50);
    const lcoe = pvEnergy > 0 ? pvCost / pvEnergy : null;

    // Sensitivity (tornado): swing one NPV driver low/high, hold the rest at
    // base. NPV from first principles so the base call reproduces `npv` exactly.
    const npvOf = (net, cx, drv, iflv, degRate) => {
      const g1 = degrAt(1, degRate);
      let v = -cx;
      for (let n = 1; n <= 25; n++) {
        const g = degrAt(n, degRate) / g1;
        v += (net * g * Math.pow(1 + iflv, n - 1)) / Math.pow(1 + drv, n);
      }
      return v;
    };
    // Re-simulate only for the drivers that change the yearly net (yield, price);
    // CAPEX/discount/degradation/inflation are analytic on the same net.
    const netAt = (yMul, pMul) => simulate(
      { ...project, yieldOverride: project.yieldOverride * yMul, price: project.price * pMul }, E, "expc"
    ).year1;
    const opexBase = capex * opexRate;
    const raw = [
      { key: "yield", a: npvOf(netAt(0.90, 1), capex, dr, infl, DEGR_BASE), b: npvOf(netAt(1.10, 1), capex, dr, infl, DEGR_BASE) },
      { key: "price", a: npvOf(netAt(1, 0.80), capex, dr, infl, DEGR_BASE), b: npvOf(netAt(1, 1.20), capex, dr, infl, DEGR_BASE) },
      { key: "capex", a: npvOf(netY1 + opexBase * (1 - 1.15), capex * 1.15, dr, infl, DEGR_BASE), b: npvOf(netY1 + opexBase * (1 - 0.85), capex * 0.85, dr, infl, DEGR_BASE) },
      { key: "disc", a: npvOf(netY1, capex, (disc + 3) / 100, infl, DEGR_BASE), b: npvOf(netY1, capex, Math.max(0, disc - 3) / 100, infl, DEGR_BASE) },
      { key: "degr", a: npvOf(netY1, capex, dr, infl, 0.0085), b: npvOf(netY1, capex, dr, infl, 0.0025) },
      { key: "infl", a: npvOf(netY1, capex, dr, Math.max(0, infl - 0.02), DEGR_BASE), b: npvOf(netY1, capex, dr, infl + 0.02, DEGR_BASE) },
    ];
    const tornado = raw
      .map((r) => ({ key: r.key, lo: Math.min(r.a, r.b), hi: Math.max(r.a, r.b), span: Math.abs(r.a - r.b) }))
      .sort((x, y) => y.span - x.span);

    return {
      capex, debt, annuity, byLevel, cv, p50Annual,
      paybackP50: p50sim.payback, paybackP90: p90sim.payback,
      netY1, p90NetY1, sched, dscrMinP50, dscrMinP90,
      dscrY1P50: netY1 / annuity, dscrY1P90: p90NetY1 / annuity,
      npv, irr, lcoe, tornado,
    };
  }, [gearing, rate, tenor, disc, project, battInfo]);

  const loc = docLang === "ro" ? "ro-RO" : "en-IE";
  const showYears = [1, 2, 3, 5, 10, 15, 20, 25, ...(battInfo?.replaceYear ? [battInfo.replaceYear] : [])]
    .filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);

  function exportCsv() {
    const rows = [
      ["VoltMira — Energy Yield Assessment", project.name, project.ref],
      [],
      ["Exceedance", "Annual MWh", "Specific yield kWh/kWp", "Capacity factor %"],
      ...PLEVELS.map((L) => [L, (model.byLevel[L].annual / 1000).toFixed(1), model.byLevel[L].spec.toFixed(0), (model.byLevel[L].cf * 100).toFixed(1)]),
      [],
      ["Investment metrics (P50, discounted)"],
      ["Discount rate %", disc.toFixed(1)],
      ["NPV EUR", Math.round(model.npv)],
      ["IRR %", model.irr == null ? "n/a" : (model.irr * 100).toFixed(1)],
      ["LCOE EUR/kWh", model.lcoe == null ? "n/a" : model.lcoe.toFixed(3)],
      [],
      ["Year", "Degradation %", "P50 MWh", "P90 MWh", "P50 net cash EUR", "P90 net cash EUR", "Debt service EUR"],
      ...model.sched.map((s) => [s.n, s.degrPct.toFixed(2), s.p50MWh.toFixed(1), s.p90MWh.toFixed(1), Math.round(s.p50Net), Math.round(s.p90Net), Math.round(s.ds)]),
    ];
    csvDownload(`voltmira-eya-${project.ref}.csv`, rows);
  }

  const months = docLang === "ro" ? MONTHS_RO : MONTHS;

  return (
    <>
      <PreviewHeader slug="bankability" lang={lang} title={t("title")} sub={t("sub")}
        right={<>
          <button className="btn ghost sm" onClick={exportCsv}>{t("csv")}</button>
          <button className="btn ghost sm" onClick={() => downloadStudioDoc("bankability-P50-P90")}>{t("pdf")}</button>
        </>} />
      <MockNote>{t("note")}</MockNote>

      <ClientBar lang={lang} />

      {/* lender assumptions */}
      <div className="pv-panel pv-noprint" style={{ marginBottom: 16 }}>
        <div className="bk-doclang">
          <span>{t("docLangLabel")}</span>
          <div className="pv-seg">
            <button className={docLang === "en" ? "on" : ""} onClick={() => setDocLang("en")}>EN</button>
            <button className={docLang === "ro" ? "on" : ""} onClick={() => setDocLang("ro")}>RO</button>
          </div>
        </div>
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
          <label><span>{t("disc")} <output>{disc.toFixed(1)}%</output></span>
            <input type="range" min="3" max="12" step="0.5" value={disc} style={{ "--fill": ((disc - 3) / 9) * 100 + "%" }}
              onChange={(e) => setDisc(+e.target.value)} /></label>
        </div>
      </div>

      <div className="pv-metrics" style={{ marginBottom: 16 }}>
        <div className="pv-metric"><b>{model.paybackP50 == null ? "—" : `${model.paybackP50.toFixed(1)} ${t("m_years")}`}</b><span>{t("m_payback")}</span></div>
        <div className={"pv-metric" + (model.dscrMinP90 < 1.2 ? " warn" : " good")}><b>{model.dscrMinP90.toFixed(2)}×</b><span>{t("m_dscr")}</span></div>
        <div className={"pv-metric" + (model.npv >= 0 ? " good" : " warn")}><b>{EUR(model.npv)}</b><span>{t("m_npv")}</span></div>
        <div className="pv-metric"><b>{model.irr == null ? "n/a" : `${(model.irr * 100).toFixed(1)}%`}</b><span>{t("m_irr")}</span></div>
      </div>

      {/* the document */}
      <DocReveal lang={lang}>
      <div className="pv-doc">
        <div className="doc-co">VoltMira · {d("Energy Yield Assessment & Bankability Summary", "Evaluarea producției de energie & rezumat de bancabilitate")} · {new Date().toLocaleDateString(loc)}</div>
        <h1>{project.name}</h1>
        <p className="doc-sub">Ref. {project.ref} · {d("prepared for the lender's technical adviser", "pregătit pentru consultantul tehnic al finanțatorului")} · {d("methodology", "metodologie")}: PVGIS-SARAH3 {d("resource", "resursă")} + VoltMira {d("honesty engine", "motor de onestitate")} (P50 = {d("expected band", "banda așteptată")})</p>

        <h2>{d("Project summary", "Rezumatul proiectului")}</h2>
        <div className="doc-grid">
          <div className="doc-kv"><span>{d("Installed DC capacity", "Putere DC instalată")}</span><b>{project.kw.toFixed(1)} kWp</b></div>
          <div className="doc-kv"><span>{d("Market / scheme", "Piață / schemă")}</span><b>{schemeLabel}</b></div>
          <div className="doc-kv"><span>{d("Specific yield (site, P50)", "Producție specifică (sit, P50)")}</span><b>{project.yieldOverride} kWh/kWp/{d("yr", "an")}</b></div>
          <div className="doc-kv"><span>{d("Assessment horizon", "Orizont de evaluare")}</span><b>{d("25 years", "25 de ani")}</b></div>
          <div className="doc-kv"><span>{d("CAPEX (turnkey)", "CAPEX (la cheie)")}</span><b>{EUR(model.capex)}</b></div>
          <div className="doc-kv"><span>{d("Combined P50 uncertainty (σ)", "Incertitudine P50 combinată (σ)")}</span><b>{SIGMA.toFixed(1)}%</b></div>
        </div>

        <h2>{d("Energy yield — exceedance probabilities (year 1)", "Producția de energie — probabilități de depășire (anul 1)")}</h2>
        <table>
          <thead><tr><th>{d("Exceedance", "Depășire")}</th><th>{d("Annual energy", "Energie anuală")}</th><th>{d("Specific yield", "Producție specifică")}</th><th>{d("Capacity factor", "Factor de capacitate")}</th><th>{d("vs P50", "față de P50")}</th></tr></thead>
          <tbody>
            {PLEVELS.map((L) => {
              const v = model.byLevel[L];
              return (
                <tr key={L} style={L === "P90" ? { background: "#F0EEE6" } : undefined}>
                  <td><b>{L}</b>{L === "P50" ? d(" (expected)", " (așteptat)") : L === "P90" ? d(" (bank case)", " (caz bancar)") : ""}</td>
                  <td>{NUM(v.annual / 1000, 1)} MWh</td>
                  <td>{v.spec.toFixed(0)} kWh/kWp</td>
                  <td>{(v.cf * 100).toFixed(1)}%</td>
                  <td>{L === "P50" ? "—" : "−" + (Z[L] * model.cv * 100).toFixed(1) + "%"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ExceedanceCurve model={model} docLang={docLang} />

        <h2>{d("Uncertainty budget", "Buget de incertitudine")}</h2>
        <table>
          <thead><tr><th>{d("Source", "Sursă")}</th><th>σ (%)</th></tr></thead>
          <tbody>
            {UNC.map((u) => <tr key={u.k}><td>{d(u.k, u.ro)}</td><td>{u.s.toFixed(1)}</td></tr>)}
            <tr style={{ background: "#F0EEE6" }}><td><b>{d("Combined (RSS)", "Combinat (RSS)")}</b></td><td><b>{SIGMA.toFixed(1)}</b></td></tr>
          </tbody>
        </table>

        <h2>{d("Monthly P50 production (year 1)", "Producție lunară P50 (anul 1)")}</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>{d("Month", "Luna")}</th>{months.map((m) => <th key={m} style={{ textAlign: "right" }}>{m}</th>)}<th style={{ textAlign: "right" }}>{d("Year", "An")}</th></tr></thead>
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

        <h2>{d("25-year performance schedule", "Grafic de performanță pe 25 de ani")}</h2>
        <table>
          <thead><tr><th>{d("Year", "An")}</th><th>{d("Degradation", "Degradare")}</th><th>{d("P50 energy", "Energie P50")}</th><th>{d("P90 energy", "Energie P90")}</th><th>{d("P50 net cash", "Flux net P50")}</th><th>{d("P90 net cash", "Flux net P90")}</th></tr></thead>
          <tbody>
            {model.sched.filter((s) => showYears.includes(s.n)).map((s) => (
              <tr key={s.n} style={s.battReplace > 0 ? { background: "#F7E6E1" } : undefined}>
                <td>{s.n}{s.battReplace > 0 ? " *" : ""}</td><td>−{s.degrPct.toFixed(1)}%</td>
                <td>{s.p50MWh.toFixed(1)} MWh</td><td>{s.p90MWh.toFixed(1)} MWh</td>
                <td>{EUR(s.p50Net)}</td><td>{EUR(s.p90Net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="doc-note">{d("Full year-by-year table in the CSV export. Net cash = energy value less O&M, escalated at the expected-band inflation assumption.", "Tabelul complet, an cu an, în exportul CSV. Flux net = valoarea energiei minus O&M, indexat cu ipoteza de inflație a benzii așteptate.")}</p>

        <h2>{d("Storage life & chemistry", "Durata de viață a stocării & chimia")}</h2>
        {battInfo ? (
          <p style={{ fontSize: "11.5px" }}>
            {battInfo.replaceYear
              ? d(
                  `The selected battery (${battInfo.battery.brand} ${battInfo.battery.model}, ${battInfo.battery.chem}, rated ${NUM(battInfo.battery.cycles)} cycles) is projected to reach end-of-life at a solar duty cycle of ~330 full cycles/yr around year ${battInfo.replaceYear} (marked * above) — a full-pack replacement (≈ ${EUR(battInfo.replaceCostEur)}) is included in that year's net cashflow, not left off the page.`,
                  `Bateria aleasă (${battInfo.battery.brand} ${battInfo.battery.model}, ${battInfo.battery.chem}, ${NUM(battInfo.battery.cycles)} cicluri) atinge sfârșitul de viață, la un regim solar de ~330 cicluri complete/an, în jurul anului ${battInfo.replaceYear} (marcat * mai sus) — o înlocuire completă (≈ ${EUR(battInfo.replaceCostEur)}) e inclusă în fluxul net al acelui an, nu ascunsă.`
                )
              : d(
                  `The selected battery (${battInfo.battery.brand} ${battInfo.battery.model}, ${battInfo.battery.chem}, rated ${NUM(battInfo.battery.cycles)} cycles) comfortably clears 25 years at a solar duty cycle of ~330 full cycles/yr (≈ ${Math.round(battInfo.lifeYears)} years of headroom) — no replacement is scheduled in the cashflow.`,
                  `Bateria aleasă (${battInfo.battery.brand} ${battInfo.battery.model}, ${battInfo.battery.chem}, ${NUM(battInfo.battery.cycles)} cicluri) depășește confortabil 25 de ani la un regim solar de ~330 cicluri complete/an (≈ ${Math.round(battInfo.lifeYears)} ani rezervă) — nicio înlocuire nu e programată în flux.`
                )}
          </p>
        ) : (
          <p style={{ fontSize: "11.5px" }}>{d("No battery in this system — nothing to schedule.", "Fără baterie în acest sistem — nimic de programat.")}</p>
        )}

        <h2>{d("Lender view — debt service coverage", "Perspectiva finanțatorului — acoperirea serviciului datoriei")}</h2>
        <div className="doc-grid">
          <div className="doc-kv"><span>{d("Gearing / debt amount", "Grad de îndatorare / sumă credit")}</span><b>{gearing}% · {EUR(model.debt)}</b></div>
          <div className="doc-kv"><span>{d("Rate / tenor", "Dobândă / scadență")}</span><b>{rate.toFixed(2)}% · {tenor} {d("yrs", "ani")}</b></div>
          <div className="doc-kv"><span>{d("Annual debt service", "Serviciul anual al datoriei")}</span><b>{EUR(model.annuity)}</b></div>
          <div className="doc-kv"><span>{d("Payback — P50 / P90", "Amortizare — P50 / P90")}</span><b>{model.paybackP50 == null ? "25+" : model.paybackP50.toFixed(1)} / {model.paybackP90 == null ? "25+" : model.paybackP90.toFixed(1)} {d("yrs", "ani")}</b></div>
          <div className="doc-kv"><span>{d("DSCR year 1 — P50 / P90", "DSCR anul 1 — P50 / P90")}</span><b>{model.dscrY1P50.toFixed(2)}x / {model.dscrY1P90.toFixed(2)}x</b></div>
          <div className="doc-kv"><span>{d("Min DSCR over tenor — P50 / P90", "DSCR minim pe durată — P50 / P90")}</span><b>{model.dscrMinP50.toFixed(2)}x / {model.dscrMinP90.toFixed(2)}x</b></div>
        </div>
        <p className="doc-note" style={{ marginTop: 8 }}>
          {model.dscrMinP90 >= 1.2
            ? d("P90 minimum DSCR clears a conventional 1.20x covenant across the tenor.", "DSCR-ul minim P90 depășește un covenant convențional de 1,20x pe toată durata.")
            : d("P90 minimum DSCR is below a 1.20x covenant — reduce gearing or extend tenor to reach bankability.", "DSCR-ul minim P90 este sub covenantul de 1,20x — reduceți gradul de îndatorare sau prelungiți scadența pentru a atinge bancabilitatea.")}
        </p>

        <h2>{d("Investment metrics (P50, discounted)", "Indicatori de investiție (P50, actualizați)")}</h2>
        <div className="doc-grid">
          <div className="doc-kv"><span>{d("Discount rate (real)", "Rată de actualizare (reală)")}</span><b>{disc.toFixed(1)}%</b></div>
          <div className="doc-kv"><span>{d("Net present value (NPV)", "Valoare actualizată netă (VAN)")}</span><b>{EUR(model.npv)}</b></div>
          <div className="doc-kv"><span>{d("Internal rate of return (IRR)", "Rata internă de rentabilitate (RIR)")}</span><b>{model.irr == null ? "—" : (model.irr * 100).toFixed(1) + "%"}</b></div>
          <div className="doc-kv"><span>{d("LCOE — levelised cost of energy", "LCOE — cost nivelat al energiei")}</span><b>{model.lcoe == null ? "—" : "€" + model.lcoe.toFixed(3) + "/kWh"}</b></div>
        </div>
        <p className="doc-note" style={{ marginTop: 8 }}>
          {d(
            "NPV and IRR are computed on the P50 net cashflow (energy value less O&M) over 25 years against CAPEX, at the discount rate above. LCOE = discounted lifetime cost (CAPEX + O&M) per discounted kWh produced — compare it to the retail tariff to see the margin.",
            "VAN și RIR sunt calculate pe fluxul net P50 (valoarea energiei minus O&M) pe 25 de ani față de CAPEX, la rata de actualizare de mai sus. LCOE = costul actualizat pe durata de viață (CAPEX + O&M) pe kWh actualizat produs — comparați-l cu tariful de la rețea pentru a vedea marja."
          )}
        </p>

        <h2>{d("Sensitivity — NPV drivers (P50)", "Sensibilitate — factori VAN (P50)")}</h2>
        <TornadoSVG
          rows={model.tornado} base={model.npv}
          label={(k) => ({
            yield: d("Specific yield ±10%", "Producție specifică ±10%"),
            price: d("Electricity price ±20%", "Preț energie ±20%"),
            capex: d("CAPEX ±15%", "CAPEX ±15%"),
            disc: d("Discount rate ±3pp", "Rată de actualizare ±3pp"),
            degr: d("Degradation 0.25–0.85%/yr", "Degradare 0,25–0,85%/an"),
            infl: d("Energy inflation ±2pp", "Inflație energetică ±2pp"),
          }[k] || k)}
          baseLabel={d("base", "bază")}
        />
        <p className="doc-note">
          {d(
            "Each bar swings one driver to its low and high while the rest stay at base, ordered by impact on NPV. The dashed line is the base-case NPV; a bar reaching left of it is where that driver alone turns the project NPV-negative.",
            "Fiecare bară variază un factor la valorile mică și mare, restul rămânând la bază, ordonate după impactul asupra VAN. Linia punctată e VAN-ul de bază; o bară care trece la stânga ei arată unde acel factor singur face proiectul VAN-negativ."
          )}
        </p>

        <h2>{d("Methodology & limitations", "Metodologie și limitări")}</h2>
        <p style={{ fontSize: "11px" }}>
          {d(
            "Resource from PVGIS-SARAH3 (2005–2023) for the site coordinates. Energy model and losses per the VoltMira engine (SR EN 50549-1 export scheme, per-market tariff rules). P-values assume a normal distribution of annual energy about P50 with the combined σ above. This is a screening assessment for financing discussions — not a substitute for an independent engineer's report where required by the facility.",
            "Resursă din PVGIS-SARAH3 (2005–2023) pentru coordonatele sitului. Model energetic și pierderi conform motorului VoltMira (schemă de export SR EN 50549-1, reguli tarifare per piață). Valorile P presupun o distribuție normală a energiei anuale în jurul P50, cu σ combinat de mai sus. Este o evaluare de screening pentru discuții de finanțare — nu înlocuiește raportul unui inginer independent, acolo unde este cerut de facilitate."
          )}
        </p>
        <p style={{ fontSize: "11px" }}>
          {d(
            "The energy-price escalation in the expected band is calibrated against published ANRE household tariff orders (Premier Energy / RED Nord, 2021–2026), not an arbitrary constant — replace with the facility's own regulatory forecast where one exists.",
            "Creșterea de preț la energie din banda așteptată e calibrată pe ordinele ANRE publicate pentru tariful populației (Premier Energy / RED Nord, 2021–2026), nu pe o constantă arbitrară — înlocuiți-o cu prognoza reglementată a finanțatorului acolo unde există una."
          )}
        </p>
        {project.market === "MD" && (
          <p style={{ fontSize: "11px" }}>
            {d(
              `Exported energy is valued at ${BUYBACK_SOURCE.operator}'s published monthly purchase price for prosumer-delivered energy, weighted by the months this system actually exports in: ${buyback.weightedMdl.toFixed(2)} lei/kWh (€${buyback.weightedEur.toFixed(3)}). A flat calendar average would overstate it, because the price is lowest in the spring and summer months that carry most of the export. The published series itself has moved: ${buyback.years.map((r) => `${r.year} ${r.avg.toFixed(2)} lei${r.yoyPct != null ? ` (${r.yoyPct > 0 ? "+" : ""}${r.yoyPct.toFixed(0)}% like-for-like on ${r.yoyMonths} common months)` : ""}`).join("; ")}. That history is shown for reference only — the escalation applied to the cashflow is the band setting above, not an extrapolation of these figures.`,
              `Energia exportată e evaluată la prețul mediu lunar publicat de ${BUYBACK_SOURCE.operator} pentru energia livrată de prosumatori, ponderat cu lunile în care acest sistem chiar exportă: ${buyback.weightedMdl.toFixed(2)} lei/kWh (€${buyback.weightedEur.toFixed(3)}). O medie calendaristică simplă ar supraevalua cifra, pentru că prețul e cel mai mic exact în lunile de primăvară-vară care duc cea mai mare parte a exportului. Seria publicată s-a mișcat astfel: ${buyback.years.map((r) => `${r.year} ${r.avg.toFixed(2)} lei${r.yoyPct != null ? ` (${r.yoyPct > 0 ? "+" : ""}${r.yoyPct.toFixed(0)}% comparabil, pe ${r.yoyMonths} luni comune)` : ""}`).join("; ")}. Istoricul e dat doar ca referință — creșterea aplicată fluxului de numerar e setarea de bandă de mai sus, nu o extrapolare a acestor cifre.`
            )}
          </p>
        )}
        <div className="doc-sign">
          <div>{d("Prepared by — VoltMira (automated)", "Întocmit de — VoltMira (automat)")} · {new Date().toLocaleDateString(loc)}</div>
          <div>{d("Reviewed by — [independent engineer]", "Verificat de — [inginer independent]")}</div>
        </div>
      </div>
      </DocReveal>

      <style dangerouslySetInnerHTML={{ __html: `
        .bk-doclang{display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:12px;font-weight:600;color:var(--muted)}
        .bk-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px 20px}
        .bk-controls label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--muted)}
        .bk-controls output{color:var(--green);font-family:var(--font-d);font-weight:700}
      ` }} />
    </>
  );
}

// Tornado chart: horizontal bars, one per NPV driver, centred on the base-case
// NPV. Downside (below base) in terracotta, upside (above base) in green.
function TornadoSVG({ rows, base, label, baseLabel }) {
  const fmt = (v) => (v < 0 ? "−" : "") + "€" + Math.abs(Math.round(v / 1000)) + "k";
  // GUT is the gutter the value labels are drawn into: the leftmost bar starts
  // one gutter right of the row labels and the rightmost ends one gutter short
  // of the edge, so neither end label can land on a row label or run off-frame.
  const W = 560, rowH = 30, PADT = 10, PADB = 30, LBL = 168, GUT = 32;
  const xL = LBL + GUT, xR = W - 10 - GUT;
  const H = PADT + rows.length * rowH + PADB;
  const lo = Math.min(base, ...rows.map((r) => r.lo));
  const hi = Math.max(base, ...rows.map((r) => r.hi));
  const span = (hi - lo) || 1;
  const X = (v) => xL + ((v - lo) / span) * (xR - xL);
  const bx = X(base);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 560, margin: "4px 0 2px" }} xmlns="http://www.w3.org/2000/svg">
      <line x1={bx} y1={PADT} x2={bx} y2={H - PADB} stroke="#14211b" strokeWidth="1" strokeDasharray="3 3" />
      {rows.map((r, i) => {
        const y = PADT + i * rowH + 5, bh = 17;
        return (
          <g key={r.key}>
            <text x={LBL - 4} y={y + bh / 2 + 3} textAnchor="end" fontSize="9" fill="#333">{label(r.key)}</text>
            <rect x={X(r.lo)} y={y} width={Math.max(0, bx - X(r.lo))} height={bh} fill="#E3C0B3" />
            <rect x={bx} y={y} width={Math.max(0, X(r.hi) - bx)} height={bh} fill="#B4D3C2" />
            <text x={X(r.lo) - 4} y={y + bh / 2 + 3} textAnchor="end" fontSize="7.5" fill="#9A5A46">{fmt(r.lo)}</text>
            <text x={X(r.hi) + 4} y={y + bh / 2 + 3} textAnchor="start" fontSize="7.5" fill="#2F6A49">{fmt(r.hi)}</text>
          </g>
        );
      })}
      <text x={bx} y={H - 10} textAnchor="middle" fontSize="8" fill="#14211b">{baseLabel} {fmt(base)}</text>
    </svg>
  );
}

function ExceedanceCurve({ model, docLang }) {
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
  const axisLabel = docLang === "ro"
    ? "energie anuală (MWh) — probabilitate de depășire"
    : "annual energy (MWh) — probability of exceedance";
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
      <text x={(W) / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="#888">{axisLabel}</text>
    </svg>
  );
}
