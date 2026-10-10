// app/p/[code]/PrintSheet.jsx — the proposal PDF the client keeps.
//
// Two A4 pages, built to be read by the homeowner rather than filed:
//   page 1  the offer in four numbers, what they are buying (the real parts,
//           warranties, the roof as drawn, backup hours), and the energy;
//   page 2  the money (three honest scenarios, the cash position, monthly
//           money, the cost of doing nothing), the design checks in plain
//           words, the next steps with the link to accept online, and the
//           assumptions in small print.
// It used to run to four pages with an engineer's annex (MPPT matrix, wiring
// diagram, datasheet tables, a monthly buy-back chart). Those numbers still
// drive what is printed here and still show in full to the installer in the
// editor; the client gets what each one means.
// Rendered instead of the mobile proposal when ?print=1.
import { moneyFormatter, numFor } from "../../../lib/money.js";
import { t } from "../../../lib/i18n.js";
import { fmtDate } from "../../../lib/tz.js";
import { SOLAR_SEASON, FX, effectiveConsumption, amortizedMonthlyPayment } from "@voltmira/engine";
import { designCheck, designCheckRows } from "../../../lib/designCheck.js";
import { kindLabel, bomLineText, surplusRevenue } from "../../../lib/quoteAnalysis.js";
import { findWarrantyInfo } from "../../../lib/supplierCatalog.js";
import { backupHours } from "../../../lib/batteryBackup.js";
import { compassLabel } from "../../../lib/roofLayout.js";
import { weightedExportPriceMdl } from "../../../lib/prosumerPrice.js";
import { CashflowSVG, MonthlySVG, CHART } from "./charts.jsx";
import { ppt, yearsN } from "./text.js";
import { Moon, Scale, Snowflake, ThermometerSun, TriangleAlert } from "lucide-react";
import UaSection from "./UaSection.jsx";

// Per-market export data (same table as the demo's MARKETS).
const MKT = {
  RO: { feed: 0.036, co2: 0.30 },
  MD: { feed: 0.02, co2: 0.40 },
  // Ukraine: the 2023 average factor for households (final consumers, 2nd
  // voltage class), 0.332 t CO2/MWh, Green Transition Office / DiXi Group,
  // "GHG Emission Factors for Electricity Generation and Consumption in Ukraine" (2024).
  UA: { feed: 0.1203, co2: 0.33 },
  DE: { feed: 0.08, co2: 0.35 },
};

// A literal ₂ sits outside every Inter subset and fell back to another font
// mid-word; the ordinary "2" is in Inter, so subscript it with markup.
function co2(text) {
  const i = (text || "").indexOf("CO2");
  if (i < 0) return text;
  return <>{text.slice(0, i)}CO<sub>2</sub>{text.slice(i + 3)}</>;
}

// A top-down snapshot of the roof Site Designer actually drew: each plane's
// real outline, the real fitted panel rectangles and any obstacles skipped.
// `planes[].outline/obstacles/panels` arrive projected to local meters
// (createProposal, at send time), so this only scales and flips an axis.
// Exported: the live page (page.jsx) shows the same drawing.
export function RoofSnapshotSVG({ planes }) {
  const W = 680, PAD = 18;
  const allPts = [];
  planes.forEach((pl) => {
    pl.outline.forEach((p) => allPts.push(p));
    (pl.obstacles || []).forEach((o) => o.forEach((p) => allPts.push(p)));
  });
  if (allPts.length === 0) return null;
  const xs = allPts.map((p) => p[0]), ys = allPts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
  const scale = (W - PAD * 2) / spanX;
  const H = spanY * scale + PAD * 2;
  // World meters (y north-positive) to SVG pixels (y down).
  const toSvg = ([x, y]) => [PAD + (x - minX) * scale, PAD + (maxY - y) * scale];
  const pts = (ring) => ring.map((p) => toSvg(p).join(",")).join(" ");
  const sharedObstacles = planes[0]?.obstacles || [];
  return (
    <svg className="p-roof-svg" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      {planes.map((pl, i) => (
        <g key={i}>
          <polygon points={pts(pl.outline)} fill="#FCFBF7" stroke="#8A8574" strokeWidth="1.5" />
          {pl.panels.map((ring, j) => (
            <polygon key={j} points={pts(ring)} fill="#1E6B4E" fillOpacity="0.6" stroke="#0F4E38" strokeWidth="0.5" />
          ))}
        </g>
      ))}
      {sharedObstacles.map((ring, j) => (
        <polygon key={j} points={pts(ring)} fill="#C4543B" fillOpacity="0.3" stroke="#C4543B" strokeWidth="1" strokeDasharray="2.5 2" />
      ))}
    </svg>
  );
}

const D = "'Inter Tight','Inter',system-ui,sans-serif";
const CSS = `
  /* One white A4 surface on screen and on paper: a tinted desk behind the
     sheet would be painted into the PDF as a grey band. 182mm is the content
     column inside the 14mm @page margins. */
  html,body{background:#fff!important;margin:0}
  .print-sheet{width:182mm;max-width:100%;box-sizing:border-box;padding:14mm 0;margin:0 auto;background:#fff;
    color:#142A21;font-family:Inter,system-ui,sans-serif;font-size:12.5px;line-height:1.45}
  .print-sheet *{box-sizing:border-box}
  .print-sheet sub{font-size:.72em;line-height:0;vertical-align:-.22em}

  /* masthead */
  .p-mast{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:2px solid #142A21}
  .p-brand{display:flex;align-items:center;gap:10px;min-width:0}
  .p-brand img{height:30px;max-width:150px;object-fit:contain}
  .p-brand-n{font-family:${D};font-weight:800;font-size:17px;letter-spacing:-.01em}
  .p-meta{text-align:right;font-size:10.5px;color:#66756C;line-height:1.5}
  .p-meta b{display:block;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#1E6B4E}
  .p-title{margin:16px 0 14px}
  .p-title h1{font-family:${D};font-weight:800;font-size:26px;letter-spacing:-.02em;line-height:1.1;margin:0 0 4px}
  .p-title p{margin:0;font-size:12px;color:#66756C}

  /* the offer in four numbers */
  .p-offer{display:grid;grid-template-columns:1.25fr 1fr 1fr 1.1fr;border:1px solid #E3E1D6;border-radius:12px;overflow:hidden}
  .p-offer > div{padding:12px 14px;border-left:1px solid #E3E1D6}
  .p-offer > div:first-child{border-left:0;background:#142A21;color:#fff}
  .p-offer span{display:block;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#66756C}
  .p-offer > div:first-child span{color:rgba(255,255,255,.7)}
  .p-offer b{display:block;font-family:${D};font-weight:800;font-size:22px;letter-spacing:-.02em;line-height:1.15;margin-top:3px;white-space:nowrap}
  .p-offer em{display:block;font-style:normal;font-size:10px;color:#66756C;margin-top:2px;line-height:1.35}
  .p-offer > div:first-child em{color:rgba(255,255,255,.72)}
  .p-offer .p-o-net b{color:#1E6B4E}

  /* sections */
  .print-sheet section{margin-top:15px}
  .print-sheet h2{display:flex;align-items:center;gap:9px;font-family:${D};font-weight:700;font-size:15px;
    margin:0 0 8px;color:#142A21;break-after:avoid;page-break-after:avoid}
  .p-n{flex:none;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#1E6B4E;
    color:#fff;font-family:${D};font-size:10.5px;font-weight:700}
  .p-lead{margin:0 0 7px;font-size:12px;color:#3B5046;max-width:92ch}
  .p-note{margin:6px 0 0;font-size:11px;color:#66756C;line-height:1.45}

  /* what you are buying */
  .p-buy{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}
  .p-buy.has-roof{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)}
  .p-gear-t{width:100%;border-collapse:collapse;font-size:11.5px}
  .p-gear-t th{text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#66756C;
    padding:0 8px 6px 0;border-bottom:1.5px solid #142A21}
  .p-gear-t td{padding:7px 8px 7px 0;border-bottom:1px solid #EDEAE0;vertical-align:top}
  .p-gear-t td.k{color:#66756C;font-size:10px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;width:1%}
  .p-gear-t td.g{font-weight:600;color:#142A21}
  .p-gear-t td.g a{color:inherit;text-decoration:underline;text-decoration-color:#C9C4B2;text-underline-offset:2px}
  .p-gear-t td.w{white-space:nowrap;color:#3B5046;width:1%}
  .p-gear-t td.q{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;width:1%}
  .p-roof{border:1px solid #E3E1D6;border-radius:10px;padding:6px;background:#FCFBF7}
  .p-roof-svg{display:block;width:100%;height:auto;max-height:150px}
  .p-roof small{display:block;font-size:9.5px;color:#66756C;margin:4px 2px 0}
  .p-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
  .p-chip{font-size:10.5px;color:#3B5046;background:#F4F3EE;border-radius:99px;padding:3px 10px}
  .p-chip b{color:#142A21}
  .p-backup{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin-top:9px;padding:9px 12px;border-radius:9px;
    background:#EFF4EE;border:1px solid #D5E2D6}
  .p-backup b{font-family:${D};font-size:14.5px;font-weight:700;color:#1E6B4E}
  .p-backup span{font-size:11px;color:#3B5046}

  /* charts */
  .p-chart{width:100%;height:auto;display:block;border:1px solid #EDEAE0;border-radius:9px;background:#FCFBF7}
  .p-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:9.5px;color:#66756C;margin:5px 0 0}
  .p-legend i{display:inline-block;width:14px;height:0;border-top:2px solid ${CHART.expc};margin-right:5px;vertical-align:middle}
  .p-legend i.dot{width:7px;height:7px;border:0;border-radius:50%;background:${CHART.ink}}

  /* money */
  .p-scen{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}
  .p-scen > div{border:1px solid #E3E1D6;border-radius:9px;padding:8px 11px;display:flex;align-items:baseline;justify-content:space-between;gap:8px}
  .p-scen > div.on{background:#F1F6F2;border-color:#C9D9CD}
  .p-scen .s-t{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#142A21}
  .p-scen .s-t i{display:inline-block;width:12px;height:0;border-top:2px solid;margin-right:5px;vertical-align:middle}
  .p-scen .s-t i.d{border-top-style:dashed}
  .p-scen .s-t small{display:block;font-size:9.5px;font-weight:500;color:#66756C;letter-spacing:0;text-transform:none;margin-top:1px}
  .p-scen .s-y{font-family:${D};font-size:19px;font-weight:800;letter-spacing:-.02em;white-space:nowrap}
  .p-scen .s-y small{font-size:10px;font-weight:500;color:#66756C;letter-spacing:0;margin-left:2px}
  .p-duo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:12px;margin-top:10px;align-items:stretch}
  .p-duo.one{grid-template-columns:minmax(0,1fr)}
  .p-box{border:1px solid #E3E1D6;border-radius:9px;padding:9px 12px}
  .p-box h3{margin:0 0 6px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#66756C}
  .p-mo{display:grid;grid-template-columns:repeat(3,auto);justify-content:space-between;gap:10px}
  .p-mo b{display:block;font-family:${D};font-size:15px;font-weight:700}
  .p-mo span{font-size:9.5px;color:#66756C}
  .p-mo .pos b{color:#1E6B4E}
  .p-vs{display:grid;gap:5px}
  .p-vs-r{display:grid;grid-template-columns:86px 1fr auto;gap:8px;align-items:center;font-size:10.5px}
  .p-vs-t{height:12px}
  .p-vs-t i{display:block;height:100%;min-width:3px;border-radius:0 4px 4px 0}
  .p-vs-r b{font-family:${D};font-weight:700;font-size:12px;white-space:nowrap}
  .p-vs .bad i{background:${CHART.cons}}
  .p-vs .good i{background:${CHART.prod}}

  /* designed for your home */
  .p-fit{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
  .p-fit-i{position:relative;border:1px solid #E3E1D6;border-radius:9px;padding:8px 11px 8px 30px}
  .p-fit-ic{position:absolute;left:9px;top:9px;width:14px;height:14px;color:#1E6B4E;stroke-width:2}
  .p-fit-i.warn{border-color:#E8B4A6;background:#FDF5F2}
  .p-fit-i.warn .p-fit-ic{color:#C4543B}
  .p-fit-i b{display:block;font-size:11.5px}
  .p-fit-i span{display:block;font-size:10.5px;color:#66756C;margin-top:1px}
  .p-fit-i em{display:block;font-style:normal;font-size:10px;color:#A8432E;margin-top:3px}
  .p-eco{margin:9px 0 0;font-size:11px;color:#3B5046}
  .p-eco b{color:#1E6B4E}

  /* next steps */
  .p-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;counter-reset:s}
  .p-steps li{counter-increment:s;border-top:2px solid #1E6B4E;padding-top:5px;font-size:10.5px;color:#3B5046;line-height:1.4}
  .p-steps li::before{content:counter(s);display:block;font-family:${D};font-weight:800;font-size:15px;color:#1E6B4E;margin-bottom:2px}
  .p-cta{margin-top:10px;padding:10px 14px;border-radius:10px;background:#142A21;color:#fff;font-size:12px;line-height:1.5}
  .p-cta b{color:#F2B85F;font-weight:700}
  .p-proof{display:inline-block;margin-top:8px;font-size:10.5px;font-weight:600;color:#1E6B4E;background:#E4EFE9;border-radius:99px;padding:3px 10px}

  /* assumptions, in small print */
  .p-annex{margin-top:10px;padding-top:7px;border-top:1px solid #E3E1D6}
  .p-annex-h{font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#66756C;margin-bottom:5px}
  .p-annex-h span{font-weight:500;letter-spacing:0;text-transform:none}
  .p-assump{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px 14px;margin:0;font-size:9.5px;color:#66756C}
  .p-assump div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #E3E1D6;padding:2px 0}
  .p-assump dt{margin:0}.p-assump dd{margin:0;color:#3B5046;text-align:right}
  .p-foot{margin-top:6px;font-size:9.5px;color:#8A948E;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}

  /* pagination: page 2 starts at the money; keep units whole */
  .p-money{break-before:page;page-break-before:always}
  .p-offer,.p-scen,.p-chart,.p-duo,.p-fit,.p-steps,.p-cta,.p-gear-t,.p-backup,.p-annex,.p-ua{break-inside:avoid;page-break-inside:avoid}
  @page{ size:A4; margin:14mm; }
  @media print{ .print-sheet{width:auto;padding:0;margin:0} }
  @media screen{ .p-money{margin-top:28px;padding-top:18px;border-top:1px dashed #E3E1D6} }
  /* opened on a phone (the PDF renders as print, so this never reaches the paper): a side margin,
     the four offer figures two by two, and the side-by-side blocks stacked */
  @media screen and (max-width:560px){
    .print-sheet{padding:20px 16px}
    .p-offer{grid-template-columns:1fr 1fr}
    .p-offer > div:nth-child(3){border-left:0}
    .p-offer > div:nth-child(n+3){border-top:1px solid #E3E1D6}
    .p-scen,.p-buy.has-roof,.p-duo,.p-fit,.p-assump{grid-template-columns:minmax(0,1fr)}
    .p-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
`;

export default function PrintSheet({ company, inputs, quote: q, lang, sentAt = null, preparedBy = null, bom = [], roofAreaM2 = null, roofOrientation = null, roofPlanes = null, acceptUrl = "", fx = null }) {
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-IE";
  // Minus ahead of the currency symbol: "€-31" reads as a broken string.
  // Lei for a Moldovan installer at the rate frozen with the proposal, with
  // the minus ahead of the symbol (lib/money.js); decimals with a comma.
  const fmt = moneyFormatter({ currency: company.currency, lang, fx });
  const nf = numFor(lang);
  const yrsF = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : nf(n, 1);
  const pct = (n) => (n == null ? "∞" : Math.round(n) + "%");
  const tr = (k, v) => t(k, lang, v);
  const E = q.assumptions;
  const hz = q.horizon;
  const bands = q.bands;
  const mkt = MKT[inputs.market] || MKT.RO;

  const rowsE = bands.expc.rows || [];
  const lifeNet = rowsE.length ? rowsE[rowsE.length - 1] : 0;
  const lifeGross = lifeNet + q.cost;
  const loan = Number(inputs.loan) || 0;
  const net = q.year1 / 12 - loan;
  const financeRate = Number(E.financeRatePct);
  const financeTerm = Number(E.financeTermYears);
  const hasFinance = financeRate >= 0 && financeTerm > 0;
  const monthlyPayment = hasFinance ? amortizedMonthlyPayment(q.cost, financeRate, financeTerm) : 0;
  // Cost of doing nothing: the client's own consumption bought from the grid
  // for the whole horizon, inflating at the expected band's rate.
  const inflPct = Number(E.bands?.expc?.infl ?? 0);
  const consY = Number(inputs.cons) || 0;
  const priceY = Number(inputs.price) || 0;
  const infl = inflPct / 100;
  const doNothing = consY > 0 && priceY > 0 ? consY * priceY * (infl === 0 ? hz : ((Math.pow(1 + infl, hz) - 1) / infl)) : 0;
  const gridAfter = Math.max(0, doNothing - lifeGross);
  const withSolar = gridAfter + q.cost;
  const vsMax = Math.max(doNothing, withSolar, 1);
  const co2Year = q.prod0 * mkt.co2;
  const trees = Math.max(1, Math.round(co2Year / 21));
  const panels = Math.max(1, Math.round(inputs.kw / 0.44));
  const roofArea = roofAreaM2 ? Math.round(roofAreaM2) : Math.round(inputs.kw * 5.5);
  const orientText = roofOrientation
    ? `${Math.round(roofOrientation.tiltDeg)}°, ${compassLabel(roofOrientation.azimuthDeg, lang)}`
    : roofAreaM2 ? t("pdf_orient_varies", lang) : t("pdf_orient_v", lang);

  // ---- what the client is buying: the real parts when a bill of materials
  // exists, the size-derived estimate otherwise. Never the unit cost: the BOM
  // carries the installer's purchase price and margin.
  const lines = (Array.isArray(bom) ? bom : []).filter((l) => (Number(l.qty) || 0) > 0);
  // Manufacturer warranties only where brand+model match the supplier catalog.
  const lineWarranty = lines.map((l) => findWarrantyInfo(l.brand, l.model));
  const anyWarranty = lineWarranty.some(Boolean);
  const installWarrantyYears = Number(company?.installWarrantyYears) || 0;
  const battKwh = inputs.batt ? (Number(inputs.battKwh) || 0) : 0;
  const consEff = Math.max(0, Number(effectiveConsumption(inputs)) || 0);
  const backupHrs = battKwh > 0 ? backupHours(battKwh, consEff) : null;
  const hasRoof = Array.isArray(roofPlanes) && roofPlanes.length > 0;

  // ---- designed for your home: the engineering checks, said plainly. Only
  // when real equipment is chosen: checks against a stand-in panel and
  // inverter would tell the client nothing about their own system.
  const dc = designCheck({ bom: lines, kw: Number(inputs.kw) || 0, battKwh, consKwh: consEff, market: inputs.market });
  const rows = designCheckRows(dc, { lang, battKwh });
  const realGear = Boolean(dc.fromBom?.panel && dc.fromBom?.inverter);
  // designCheckRows order: DC/AC, cold voltage, [string length], [battery], [medium voltage].
  const battIdx = 2 + (dc.stringRangeInfo ? 1 : 0);
  const fit = realGear ? [
    { icon: Scale, ok: rows[0].ok, warn: rows[0].warn, title: tr("pdf2_fit_match"), line: tr("pdf2_fit_match_l", { dc: nf(dc.dcKw, 1), ac: nf(dc.acKw, 1) }) },
    { icon: Snowflake, ok: rows[1].ok, warn: rows[1].warn, title: tr("pdf2_fit_cold"), line: tr("pdf2_fit_cold_l", { v: Math.round(dc.vString), t: dc.coldT, max: dc.maxDcV }) },
    ...(dc.stringRangeInfo ? [{ icon: ThermometerSun, ok: rows[2].ok, warn: rows[2].warn, title: tr("pdf2_fit_hot"), line: tr("pdf2_fit_hot_l", { n: dc.perString, t: dc.hotT }) }] : []),
    ...(battKwh > 0 ? [{ icon: Moon, ok: rows[battIdx].ok, warn: rows[battIdx].warn, title: tr("pdf2_fit_batt"), line: tr("pdf2_fit_batt_l", { b: nf(battKwh, 1), e: nf(dc.eveningKwh, 1) }) }] : []),
  ] : [];

  // ---- what the exported surplus earns (Moldova's net billing only; Romania
  // credits exports 1:1 at the retail price).
  const isMD = inputs.market === "MD";
  const surplus = isMD ? surplusRevenue(q.prod0, q.self, FX.MDL) : null;
  const weightedMdl = isMD ? weightedExportPriceMdl(SOLAR_SEASON) : 0;

  // ---- energy, month by month (PVGIS's own monthly shape when looked up).
  const shape = Array.isArray(inputs.monthlyYieldShape) && inputs.monthlyYieldShape.length === 12 ? inputs.monthlyYieldShape : SOLAR_SEASON;
  const shapeSum = shape.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const prodMonthly = shape.map((f) => (q.prod0 * (Number(f) || 0)) / shapeSum);
  const consMonthly = (inputs.useMonthly && Array.isArray(inputs.consMonthly) && inputs.consMonthly.length === 12)
    ? inputs.consMonthly.map((v) => Number(v) || 0)
    : new Array(12).fill(consEff / 12);
  const selfPct = Math.round((q.self || 0) * 100);
  const selfKwh = (q.self || 0) * q.prod0;
  const fromSolar = Math.min(selfKwh, consEff);
  const coverPct = consEff > 0 ? Math.round((fromSolar / consEff) * 100) : 0;

  // Valid for the company's validity window from when the quote was sent,
  // in the app's timezone.
  const validityDays = E.quoteValidityDays || 30;
  const validBase = sentAt ? new Date(sentAt).getTime() : Date.now();
  const validUntil = fmtDate(new Date(validBase + validityDays * 864e5), loc);
  // "New quote" is the table default: describe the system instead of printing it.
  const placeholderTitle = !inputs.title || /^\s*new quote\s*$/i.test(inputs.title);
  const headline = placeholderTitle ? t("pdf_auto_title", lang, { kw: nf(inputs.kw, 1) }) : inputs.title;
  const mktLine = t("market_" + (inputs.market || "RO").toLowerCase(), lang);
  const who = [inputs.client ? tr("pdf2_for", { c: inputs.client }) : "", inputs.address || ""].filter(Boolean).join(", ");
  const hasLogo = company.logoUrl && /^(https?:\/\/|data:image\/)/i.test(company.logoUrl);
  const acceptShort = acceptUrl.replace(/^https?:\/\//, "");

  let n = 0;
  const num = () => ++n;

  return (
    <div className="print-sheet">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="p-mast">
        <div className="p-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hasLogo && <img src={company.logoUrl} alt="" />}
          <span className="p-brand-n">{company.name}</span>
        </div>
        <div className="p-meta">
          <b>{tr("pdf_title")}</b>
          <span>{fmtDate(new Date(), loc)}, {tr("pdf2_valid", { d: validUntil })}</span>
        </div>
      </header>

      <div className="p-title">
        <h1>{headline}</h1>
        {who && <p>{who}</p>}
      </div>

      {/* The offer in four numbers: what it costs, what it saves, when it has
          paid for itself, and what it is worth over its life. */}
      <div className="p-offer">
        <div>
          <span>{tr("pdf2_k_price")}</span>
          <b>{fmt(q.cost)}</b>
          {hasFinance && monthlyPayment > 0 && <em>{tr("pdf2_k_monthly", { v: fmt(monthlyPayment) })}</em>}
        </div>
        <div>
          <span>{tr("pdf2_k_save")}</span>
          <b>{fmt(q.year1)}</b>
          <em>{tr("pdf2_k_save_s", { v: fmt(q.year1 / 12) })}</em>
        </div>
        <div>
          <span>{tr("pdf2_k_payback")}</span>
          <b>{yrsF(bands.expc.payback)} {tr("years_w")}</b>
          <em>{tr("pdf2_k_range", { a: yrsF(bands.opti.payback), b: yrsF(bands.pess.payback) })}</em>
        </div>
        <div className="p-o-net">
          <span>{tr("pdf2_k_net", { n: hz })}</span>
          <b>{fmt(lifeNet)}</b>
          <em>{tr("pdf2_k_net_s")}</em>
        </div>
      </div>

      {/* Ukraine: outages first, the way a Ukrainian household decides. */}
      {inputs.market === "UA" && (
        <div className="p-ua"><UaSection inputs={inputs} quote={q} assumptions={q.assumptions} fx={fx} money={fmt} lang={lang} /></div>
      )}

      {/* What they are buying: a serious buyer compares equipment first. */}
      <section>
        <h2><span className="p-n">{num()}</span>{ppt("buy_h", lang)}</h2>
        <p className="p-lead">{ppt("buy_lead", lang, {
          kw: nf(inputs.kw, 1),
          b: battKwh > 0 ? ppt("with_batt", lang, { b: battKwh }) : "",
          p: Math.round(q.prod0).toLocaleString(loc),
        })}</p>
        <div className={"p-buy" + (hasRoof ? " has-roof" : "")}>
          <table className="p-gear-t"><tbody>
            <tr>
              <th>{tr("pdf_component")}</th><th>{tr("pdf_gear")}</th>
              {anyWarranty && <th>{tr("pdf_warranty")}</th>}
              <th style={{ textAlign: "right" }}>{tr("pdf_qty")}</th>
            </tr>
            {lines.length > 0 ? lines.map((l, i) => {
              const w = lineWarranty[i];
              return (
                <tr key={i}>
                  <td className="k">{kindLabel(l.kind, lang)}</td>
                  <td className="g">{w?.productUrl ? <a href={w.productUrl} target="_blank" rel="noopener noreferrer">{bomLineText(l, lang)}</a> : bomLineText(l, lang)}</td>
                  {anyWarranty && <td className="w">{w ? tr("pdf_warranty_v", { n: w.warrantyYears }) : ""}</td>}
                  <td className="q">× {Number(l.qty)}</td>
                </tr>
              );
            }) : (
              <>
                <tr><td className="k">{tr("pdf_panels")}</td><td className="g">{tr("pdf_panels_v", { n: panels })}</td>{anyWarranty && <td />}<td className="q" /></tr>
                <tr><td className="k">{tr("pdf_inverter")}</td><td className="g">~{nf(inputs.kw, 1)} kW</td>{anyWarranty && <td />}<td className="q" /></tr>
                {inputs.batt && <tr><td className="k">{tr("pdf_batt_row")}</td><td className="g">{battKwh ? `${battKwh} kWh` : tr("pdf_included")}</td>{anyWarranty && <td />}<td className="q" /></tr>}
              </>
            )}
          </tbody></table>
          {hasRoof && (
            <div className="p-roof">
              <RoofSnapshotSVG planes={roofPlanes} />
              <small>{tr("pdf_roof_snap_note", { n: roofPlanes.reduce((s, pl) => s + pl.panels.length, 0) })}</small>
            </div>
          )}
        </div>
        <div className="p-chips">
          <span className="p-chip">{tr(roofAreaM2 ? "pdf_roof_real" : "pdf_roof")}: <b>~{roofArea} m²</b></span>
          <span className="p-chip">{tr("pdf_orient")}: <b>{orientText}</b></span>
          {installWarrantyYears > 0 && <span className="p-chip"><b>{tr("pdf_warranty_install_v", { n: installWarrantyYears, co: company?.name || "" })}</b></span>}
        </div>
        {/* A battery is its own product (keeping the lights on), not just a
            savings add-on: the honest, computable claim is hours of backup at
            this household's own average draw. */}
        {backupHrs != null && (
          <div className="p-backup">
            <b>~{Math.round(backupHrs)} {tr("pdf_backup_hunit")}</b>
            <span>{ppt("backup_p", lang, { b: battKwh })}</span>
          </div>
        )}
      </section>

      <section>
        <h2><span className="p-n">{num()}</span>{ppt("energy_h", lang)}</h2>
        <MonthlySVG prod={prodMonthly} cons={consMonthly} lang={lang} loc={loc} compact />
        {consEff > 0 && <p className="p-note">{ppt("e_line", lang, { s: selfPct, c: coverPct })}</p>}
      </section>

      {/* Page 2: the money, as one argument. */}
      <section className="p-money">
        <h2><span className="p-n">{num()}</span>{ppt("money_h", lang, { y: yearsN(hz, lang) })}</h2>
        <div className="p-scen">
          {[["pess", tr("pessimistic"), bands.pess, CHART.pess],
            ["expc", tr("expected"), bands.expc, CHART.expc],
            ["opti", tr("optimistic"), bands.opti, CHART.opti]].map(([k, label, b, c]) => (
            <div key={k} className={k === "expc" ? "on" : ""}>
              <span className="s-t"><i className={k === "expc" ? "" : "d"} style={{ color: c }} />{label}<small>{hz}{tr("yr_roi")}, {pct(b.roi)}</small></span>
              <span className="s-y">{yrsF(b.payback)}<small>{tr("years_w")}</small></span>
            </div>
          ))}
        </div>
        <CashflowSVG bands={bands} cost={q.cost} horizon={hz} lang={lang} money={fmt} compact />
        <div className="p-legend">
          <span><i />{tr("expected")}</span>
          <span><i style={{ borderColor: CHART.pess, borderTopStyle: "dashed" }} />{tr("pessimistic")}</span>
          <span><i style={{ borderColor: CHART.opti, borderTopStyle: "dashed" }} />{tr("optimistic")}</span>
          <span><i className="dot" />{tr("lg_break")}</span>
        </div>
        {(loan > 0 || doNothing > 0) && (
          <div className={"p-duo" + (loan > 0 && doNothing > 0 ? "" : " one")}>
            {loan > 0 && (
              <div className="p-box">
                <h3>{tr("pdf_monthly_h")}</h3>
                <div className="p-mo">
                  <div><b>{fmt(loan)}</b><span>{tr("pdf_loan_h")}</span></div>
                  <div><b>{fmt(q.year1 / 12)}</b><span>{tr("pdf_save_h")}</span></div>
                  <div className={net >= 0 ? "pos" : ""}><b>{(net >= 0 ? "+" : "") + fmt(net)}</b><span>{tr("pdf_net_h")}</span></div>
                </div>
              </div>
            )}
            {doNothing > 0 && (
              <div className="p-box">
                <h3>{ppt("vs_h", lang, { y: yearsN(hz, lang) })}</h3>
                <div className="p-vs">
                  <div className="p-vs-r bad"><span>{tr("pdf_vs_without")}</span><span className="p-vs-t"><i style={{ width: `${(doNothing / vsMax) * 100}%` }} /></span><b>{fmt(doNothing)}</b></div>
                  <div className="p-vs-r good"><span>{tr("pdf_vs_with")}</span><span className="p-vs-t"><i style={{ width: `${(withSolar / vsMax) * 100}%` }} /></span><b>{fmt(withSolar)}</b></div>
                </div>
              </div>
            )}
          </div>
        )}
        {surplus && surplus.totalKwh > 0 && (
          <p className="p-note">{tr("pdf2_surplus", {
            k: Math.round(surplus.totalKwh).toLocaleString(loc),
            p: nf(weightedMdl, 2),
            // already in lei when the workspace is: say it once
            v: fmt.local ? fmt(surplus.eur) : `${Math.round(surplus.mdl).toLocaleString(loc)} lei (${fmt(surplus.eur)})`,
          })}</p>
        )}
      </section>

      {fit.length > 0 && (
        <section>
          <h2><span className="p-n">{num()}</span>{ppt("fit_h", lang)}</h2>
          <p className="p-lead">{tr("pdf2_fit_p")}</p>
          <div className="p-fit">
            {fit.map((f, i) => {
              const Icon = f.ok ? f.icon : TriangleAlert;
              return (
              <div key={i} className={"p-fit-i" + (f.ok ? "" : " warn")}>
                <Icon className="p-fit-ic" aria-hidden="true" />
                <b>{f.title}</b>
                <span>{f.line}</span>
                {!f.ok && f.warn ? <em>{f.warn}</em> : null}
              </div>
              );
            })}
          </div>
          <p className="p-eco">{co2(tr("pdf2_eco", { kg: Math.round(co2Year).toLocaleString(loc), t: trees }))}</p>
        </section>
      )}

      <section>
        <h2><span className="p-n">{num()}</span>{tr("pdf_next_h")}</h2>
        <ol className="p-steps">
          <li>{ppt("step1", lang)}</li>
          <li>{ppt("step2", lang)}</li>
          <li>{ppt("step3", lang)}</li>
          <li>{ppt("step4", lang)}</li>
        </ol>
        {acceptShort && (
          <div className="p-cta">
            {ppt("pdf_go", lang, { url: "" })}<b>{acceptShort}</b>
            {preparedBy?.name && preparedBy?.phone ? <> {ppt("pdf_call", lang, { who: preparedBy.name, phone: preparedBy.phone })}</> : "."}
          </div>
        )}
        {/* From 3 up: "1 system installed" undersells a new installer. */}
        {company.wonCount >= 3 && <div className="p-proof">{tr("pdf_installed", { n: company.wonCount, co: company.name })}</div>}
        {fit.length === 0 && <p className="p-eco">{co2(tr("pdf2_eco", { kg: Math.round(co2Year).toLocaleString(loc), t: trees }))}</p>}
      </section>

      <div className="p-annex">
        <div className="p-annex-h">{tr("pdf_assump_h")}: <span>{tr("pdf2_assump_s")}</span></div>
        <dl className="p-assump">
          <div><dt>{tr("as_yield_exp")}</dt><dd>{tr("as_yield_v", { n: Math.round(q.yieldPerKwp || E.baseYield) })}</dd></div>
          <div><dt>{tr("as_export_scheme")}</dt><dd>{mktLine}</dd></div>
          <div><dt>{tr("as_selfcons")}</dt><dd>{selfPct}%{inputs.batt ? " " + tr("as_with_batt") : ""}</dd></div>
          <div><dt>{tr("as_cost_basis")}</dt><dd>{fmt(E.costPerKw)}/kW{E.batteryCost ? ` + ${fmt(E.batteryCost)}` : ""}</dd></div>
          <div><dt>{tr("pdf_horizon")}</dt><dd>{tr("as_horizon_v", { n: hz })}</dd></div>
          <div><dt>{co2(tr("pdf_co2_factor"))}</dt><dd>{mkt.co2} kg/kWh</dd></div>
          {inputs.tariffMode === "differentiated" && (
            <div><dt>{tr("as_md_tariff")}</dt><dd>{tr("as_md_tariff_v", { d: E.mdDayRateMdl, n: E.mdNightRateMdl })}</dd></div>
          )}
        </dl>
      </div>

      <div className="p-foot">
        <span>{preparedBy?.name ? `${tr("pp_prepared_by")} ${preparedBy.name}${preparedBy.phone ? ", " + preparedBy.phone : ""}` : company.name}</span>
        <span>{company.name}{company.plan === "free" ? `, ${tr("pdf_foot")}, voltmira.com` : ""}</span>
      </div>
    </div>
  );
}
