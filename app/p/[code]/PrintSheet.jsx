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
import { supportLine } from "./SupportOffer.jsx";
import { t } from "../../../lib/i18n.js";
import { isPlaceholderTitle } from "../../../lib/quoteTitle.js";
import { fmtDate } from "../../../lib/tz.js";
import { SOLAR_SEASON, FX, effectiveConsumption, amortizedMonthlyPayment } from "@voltmira/engine";
import { designCheck, designCheckRows } from "../../../lib/designCheck.js";
import { kindLabel, bomLineText, surplusRevenue } from "../../../lib/quoteAnalysis.js";
import { findWarrantyInfo } from "../../../lib/supplierCatalog.js";
import { termsFor, warrantyRows, inverterFacts, paymentStages, productOf } from "../../../lib/offerTerms.js";
import { pt } from "../../../lib/payText.js";
import { backupHours } from "../../../lib/batteryBackup.js";
import { compassLabel } from "../../../lib/roofLayout.js";
import { CashflowSVG, MonthlySVG, CHART } from "./charts.jsx";
import { ppt, yearsN, kwhUnit, kwUnit } from "./text.js";
import { Moon, Scale, Snowflake, ThermometerSun, TriangleAlert } from "lucide-react";
import UaSection from "./UaSection.jsx";
import RoofSatellite from "../../../components/RoofSatellite.jsx";
import RoofPhotoPlan from "../../../components/RoofPhotoPlan.jsx";
import RoofSides from "./RoofSides.jsx";

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
  .p-title{margin:12px 0 10px}
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
  .print-sheet section{margin-top:13px}
  .print-sheet h2{display:flex;align-items:center;gap:9px;font-family:${D};font-weight:700;font-size:15px;
    margin:0 0 8px;color:#142A21;break-after:avoid;page-break-after:avoid}
  .p-n{flex:none;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#1E6B4E;
    color:#fff;font-family:${D};font-size:10.5px;font-weight:700}
  .p-lead{margin:0 0 7px;font-size:12px;color:#3B5046;max-width:92ch}
  .p-note{margin:6px 0 0;font-size:11px;color:#66756C;line-height:1.45}
  /* the equipment's photo and figure */
  .p-gl{display:flex;align-items:center;gap:8px}
  .p-gimg{width:26px;height:26px;object-fit:contain;border-radius:6px;background:#F4F3EE;flex:none}
  .p-gl small{display:block;font-size:9.5px;color:#66756C;margin-top:1px}
  /* warranties and scope */
  .p-war{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:9px}
  .p-war th{text-align:left;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#66756C;border-bottom:1.5px solid #E3E1D6;padding:4px 6px}
  .p-war td{padding:5px 6px;border-bottom:1px solid #EEECE4;color:#142A21;vertical-align:top}
  .p-war td.k{font-weight:600;white-space:nowrap}
  .p-war td.by{color:#66756C}
  .p-scope{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
  .p-scope > div{border:1px solid #E3E1D6;border-radius:10px;padding:8px 11px}
  .p-scope > div.out{background:#FBFAF6}
  .p-scope h3{margin:0 0 4px;font-size:11px;font-weight:700;color:#1E6B4E}
  .p-scope .out h3{color:#A8432A}
  .p-scope ul{margin:0;padding-left:15px;font-size:10.5px;color:#3B5046;line-height:1.45}
  /* payment and acceptance */
  .p-stages{list-style:none;margin:0 0 9px;padding:0;display:flex;gap:8px}
  .p-stages li{flex:1;border:1px solid #E3E1D6;border-radius:10px;padding:7px 10px;display:flex;flex-direction:column;gap:1px}
  .p-stages b{font-family:${D};font-size:16px;font-weight:800;color:#1E6B4E}
  .p-stages span{font-size:10.5px;color:#3B5046}
  .p-stages em{font-style:normal;font-size:10.5px;font-weight:600;color:#142A21}
  .p-accept p{margin:0 0 4px;font-size:11px;color:#3B5046;overflow-wrap:anywhere}
  .p-acc-or{color:#66756C !important}
  .p-sign{display:grid;grid-template-columns:1.4fr .8fr 1.4fr;gap:14px;margin-top:20px}
  .p-sign div{font-size:9.5px;color:#66756C}
  .p-sign span{display:block;border-bottom:1px solid #142A21;height:22px;margin-bottom:3px}
  /* the year's energy in four figures */
  .p-etiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}
  .p-etiles > div{border:1px solid #E3E1D6;border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:1px}
  .p-etiles b{font-family:${D};font-size:15px;font-weight:800;color:#142A21;font-variant-numeric:tabular-nums;white-space:nowrap}
  .p-etiles span{font-size:10.5px;color:#3B5046}
  .p-etiles em{font-style:normal;font-size:9.5px;color:#8A948E}
  .p-etiles .t-prod b{color:#1E6B4E}

  /* what you are buying */
  .p-buy{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}
  .p-buy.has-roof{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)}
  /* a photo or the view from above sits beside the equipment, not under it: full width it took half of page 1 and
     pushed the energy chart onto a page of its own */
  .p-buy.has-pic{grid-template-columns:minmax(0,1.55fr) minmax(0,1fr)}
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
  .p-foot{margin:5px 0 0;font-size:9px;color:#8A948E;line-height:1.4}
  /* the assumptions, the signature line and the footer stay together: a footer alone on a last page reads as an error */
  .p-end{break-inside:avoid;page-break-inside:avoid}

  /* pagination: the sections follow one another (a forced page before the money left page 2 with only the
     monthly chart when the roof photo filled page 1); a unit is never split across two pages */
  .p-money{break-inside:avoid;page-break-inside:avoid}
  .p-offer,.p-scen,.p-chart,.p-duo,.p-fit,.p-steps,.p-cta,.p-gear-t,.p-backup,.p-annex,.p-ua,.p-etiles,.p-energy,.p-war,.p-scope,.p-pay{break-inside:avoid;page-break-inside:avoid}
  .p-terms > h2{break-after:avoid;page-break-after:avoid}
  @page{ size:A4; margin:14mm; }
  @media print{
    .print-sheet{width:auto;padding:0;margin:0}
    /* each page exactly one A4 (269 mm inside the margins), its sections spread over it */
    .p-page{min-height:268mm;display:flex;flex-direction:column;justify-content:space-between;break-after:page;page-break-after:always}
    .p-page.p-last{break-after:auto;page-break-after:auto}
    .p-page > section:first-child{margin-top:0}
  }
  /* the year table */
  .p-yt{width:100%;border-collapse:collapse;font-size:11px;font-variant-numeric:tabular-nums}
  .p-yt th{text-align:right;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#66756C;border-bottom:1.5px solid #E3E1D6;padding:4px 8px}
  .p-yt th:first-child,.p-yt td:first-child{text-align:left}
  .p-yt td{text-align:right;padding:4px 8px;border-bottom:1px solid #EEECE4;color:#142A21}
  .p-yt tr.pos td:last-child b{color:#1E6B4E}
  .p-yt td:last-child b{color:#A8432A}
  .p-years{break-inside:avoid;page-break-inside:avoid}
  @media screen{ .p-money{margin-top:28px;padding-top:18px;border-top:1px dashed #E3E1D6} }
  /* opened on a phone (the PDF renders as print, so this never reaches the paper): a side margin,
     the four offer figures two by two, and the side-by-side blocks stacked */
  @media screen and (max-width:560px){
    .print-sheet{padding:20px 16px}
    .p-offer{grid-template-columns:1fr 1fr}
    .p-offer > div:nth-child(3){border-left:0}
    .p-offer > div:nth-child(n+3){border-top:1px solid #E3E1D6}
    .p-scen,.p-buy.has-roof,.p-buy.has-pic,.p-duo,.p-fit,.p-assump{grid-template-columns:minmax(0,1fr)}
    .p-steps,.p-etiles{grid-template-columns:repeat(2,minmax(0,1fr))}
    .p-scope,.p-sign{grid-template-columns:minmax(0,1fr)}
    .p-stages{flex-direction:column}
  }
`;

export default function PrintSheet({ company, inputs, quote: q, lang, sentAt = null, preparedBy = null, bom = [], roofAreaM2 = null, roofOrientation = null, roofPlanes = null, roofSat = null, roofSite = null, roofPhoto = null, roofPhotoPlace = null, roofSides = null, roofStatus = null, acceptUrl = "", fx = null, support = null, tariff = null, signed = null, legal = null, paySchedule = null, terms = null, photos = {}, expired = false }) {
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-IE";
  // Minus ahead of the currency symbol: "€-31" reads as a broken string.
  // Lei for a Moldovan installer at the rate frozen with the proposal, with
  // the minus ahead of the symbol (lib/money.js); decimals with a comma.
  const fmt = moneyFormatter({ currency: company.currency, lang, fx });
  const nf = numFor(lang);
  const yrsF = (n) => n === null ? `${Number(q.horizon) || 25}+` : n === 0 ? t("pp_immediate", lang) : nf(n, 1);
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
  // the consumption the offer was computed on (the monthly profile when used), as the live page does
  const consY = Math.max(0, Number(effectiveConsumption(inputs)) || 0);
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
  // the maker's photo and the figure that matters of each quoted product, when the catalog knows it exactly
  const lineInfo = lines.map((l) => {
    const p = productOf(l);
    if (!p) return {};
    const spec = l.kind === "panel" && p.eff ? ppt("g_eff", lang, { e: nf(p.eff, 1) })
      : l.kind === "inverter" ? [p.type === "hybrid" ? ppt("g_hybrid", lang) : p.type === "string" ? ppt("g_string", lang) : "", p.phases === 3 ? ppt("g_ph3", lang) : p.phases === 1 ? ppt("g_ph1", lang) : ""].filter(Boolean).join(", ")
      : "";
    // only a photo the server could fetch (lib/photoInline.js): a maker's site that refused printed a broken image
    return { photo: photos?.[p.photoUrl] || null, spec };
  });
  const inv = inverterFacts(lines);
  const wRows = warrantyRows(lines, { installYears: Number(company?.installWarrantyYears) || 0, company: company?.name || "", lang });
  const scope = termsFor(terms, lang);
  const stages = paymentStages(paySchedule);
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
  const surplus = isMD ? surplusRevenue(q.prod0, q.self, Number(fx?.MDL) || FX.MDL, tariff?.exportMdlPerKwh) : null;
  const weightedMdl = isMD ? surplus.effectiveMdlPerKwh : 0;

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
  const kwh = (v) => `${Math.round(v).toLocaleString(loc)} ${kwhUnit(lang)}`;
  // the years the table shows: what the system makes (it ages), what it saves that year, the money position
  const degrPct = Number(E.bands?.expc?.degr ?? 0.5);
  const yearRows = [1, 2, 3, 5, 10, 15, 20, 25].filter((y) => y <= hz && rowsE.length >= y).map((y) => ({
    y, kwh: q.prod0 * Math.pow(1 - degrPct / 100, y - 1),
    save: rowsE[y - 1] - (y > 1 ? rowsE[y - 2] : -q.cost), pos: rowsE[y - 1],
  }));

  // Valid for the company's validity window from when the quote was sent,
  // in the app's timezone.
  const validityDays = E.quoteValidityDays || 30;
  const validBase = sentAt ? new Date(sentAt).getTime() : Date.now();
  const validUntil = fmtDate(new Date(validBase + validityDays * 864e5), loc);
  // the date the offer was issued (when its link was made), not the day the PDF is printed: an old offer printed
  // today read "25.10.2026, valid until 16.08.2026"
  const issuedOn = fmtDate(new Date(validBase), loc);
  // The default title ("New quote", or its translation) is not a title: describe the system instead of printing it.
  const placeholderTitle = isPlaceholderTitle(inputs.title);
  const headline = placeholderTitle ? t("pdf_auto_title", lang, { kw: nf(inputs.kw, 1) }) : inputs.title;
  const mktLine = t("market_" + (inputs.market || "RO").toLowerCase(), lang);
  const who = [inputs.client ? tr("pdf2_for", { c: inputs.client }) : "", inputs.address || ""].filter(Boolean).join(", ");
  const hasLogo = company.logoUrl && /^(https?:\/\/|data:image\/)/i.test(company.logoUrl);

  let n = 0;
  const num = () => ++n;

  return (
    <div className="print-sheet">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* page 1: the offer, what is bought, the energy */}
      <div className="p-page">

      <header className="p-mast">
        <div className="p-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hasLogo && <img src={company.logoUrl} alt="" />}
          <span className="p-brand-n">{company.name}</span>
        </div>
        <div className="p-meta">
          <b>{tr("pdf_title")}</b>
          <span>{signed?.name ? tr("pdf2_signed_on", { d: signed.date || "" })
            : `${tr("pdf2_issued", { d: issuedOn })}, ${expired ? tr("pdf2_expired", { d: validUntil }) : tr("pdf2_valid_l", { d: validUntil })}`}</span>
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
          {/* one monthly figure in the whole offer: the installer's when typed, else the example with its terms */}
          {loan > 0 ? <em>{tr("pdf2_k_monthly3", { v: fmt(loan) })}</em>
            : hasFinance && monthlyPayment > 0 && <em>{tr("pdf2_k_monthly2", { v: fmt(monthlyPayment), n: financeTerm, r: nf(financeRate, 1) })}</em>}
        </div>
        <div>
          <span>{tr("pdf2_k_save")}</span>
          <b>{tr("pdf2_per_year", { v: fmt(q.year1) })}</b>
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
        <div className={"p-buy" + (hasRoof && !roofPhoto && !roofSat ? " has-roof" : roofPhoto || roofSat || roofSite ? " has-pic" : "")}>
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
                  <td className="g">
                    <span className="p-gl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {lineInfo[i].photo && <img className="p-gimg" src={lineInfo[i].photo} alt="" />}
                      <span>
                        {w?.productUrl ? <a href={w.productUrl} target="_blank" rel="noopener noreferrer">{bomLineText(l, lang)}</a> : bomLineText(l, lang)}
                        {lineInfo[i].spec && <small>{lineInfo[i].spec}</small>}
                      </span>
                    </span>
                  </td>
                  {anyWarranty && <td className="w">{w ? tr("pdf_warranty_v", { n: w.warrantyYears }) : ""}</td>}
                  <td className="q">× {Number(l.qty)}</td>
                </tr>
              );
            }) : (
              <>
                <tr><td className="k">{tr("pdf_panels")}</td><td className="g">{tr("pdf_panels_v", { n: panels })}</td>{anyWarranty && <td />}<td className="q" /></tr>
                <tr><td className="k">{tr("pdf_inverter")}</td><td className="g">~{nf(inputs.kw, 1)} {kwUnit(lang)}</td>{anyWarranty && <td />}<td className="q" /></tr>
                {inputs.batt && <tr><td className="k">{tr("pdf_batt_row")}</td><td className="g">{battKwh ? `${battKwh} ${kwhUnit(lang)}` : tr("pdf_included")}</td>{anyWarranty && <td />}<td className="q" /></tr>}
              </>
            )}
          </tbody></table>
          {/* the real roof from above when the offer carries its position;
              offers sent before that keep the plain drawing */}
          {roofPhoto && roofPhotoPlace && roofSat ? (
            <div className="p-roof">
              <RoofPhotoPlan photo={roofPhoto} place={roofPhotoPlace} roof={roofSat} />
              <small>{tr("pdf_roof_photo_plan_note", { n: roofSat.quoted || roofSat.planes.reduce((s, pl) => s + pl.panels.length, 0) })}</small>
            </div>
          ) : roofPhoto ? (
            <div className="p-roof">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={roofPhoto} alt="" style={{ display: "block", width: "100%", maxWidth: 680, borderRadius: 10 }} />
              <small>{tr("pdf_roof_photo_note")}</small>
            </div>
          ) : roofSat ? (
            <div className="p-roof">
              <RoofSatellite roof={roofSat} />
              <small>{tr("pdf_roof_sat_note", { n: roofSat.quoted || roofSat.planes.reduce((s, pl) => s + pl.panels.length, 0) })}</small>
            </div>
          ) : hasRoof ? (
            <div className="p-roof">
              <RoofSnapshotSVG planes={roofPlanes} />
              <small>{tr("pdf_roof_snap_note", { n: roofPlanes.reduce((s, pl) => s + pl.panels.length, 0) })}</small>
            </div>
          ) : roofSite ? (
            <div className="p-roof">
              <RoofSatellite roof={{ planes: [], center: roofSite, tileZoom: roofSite.tileZoom }} />
              <small>{tr(roofSite.approx ? "pdf_roof_area_note" : "pdf_roof_site_note")}</small>
            </div>
          ) : null}
        </div>
        <div className="p-chips">
          <span className="p-chip">{tr(roofAreaM2 ? "pdf_roof_real" : "pdf_roof")}: <b>~{roofArea} m²</b></span>
          <span className="p-chip">{tr("pdf_orient")}: <b>{orientText}</b></span>
        </div>
        {inv && (inv.hybrid != null || inv.app || lines.length) && (
          <p className="p-note">
            {battKwh === 0 && inv.hybrid === true ? ppt("g_batt_later", lang) + " " : battKwh === 0 && inv.hybrid === false ? ppt("g_batt_no", lang) + " " : ""}
            {inv.app ? ppt("g_app", lang, { a: inv.app }) : ppt("g_app_any", lang)}
          </p>
        )}
        <RoofSides sides={roofSides} status={roofStatus} lang={lang} company={company.shortName || company.name || ""} nf={nf}
          day={roofStatus?.at ? fmtDate(new Date(roofStatus.at + "T12:00:00Z"), loc) : null} />
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

      <section className="p-energy">
        <h2><span className="p-n">{num()}</span>{ppt("energy_h", lang)}</h2>
        <MonthlySVG prod={prodMonthly} cons={consMonthly} lang={lang} loc={loc} compact axisUnit={kwhUnit(lang)} />
        {/* the year in four figures: what it makes, where it goes, what is still bought */}
        <div className="p-etiles">
          <div className="t-prod">
            <b>{kwh(q.prod0)}</b><span>{ppt("e_prod", lang)}</span>
            <em>{ppt("e_s_prod", lang, { v: kwh(Math.max(...prodMonthly)) })}</em>
          </div>
          {consEff > 0 && (
            <div>
              <b>{kwh(selfKwh)}</b><span>{ppt("e_t_home", lang)}</span>
              <em>{ppt("e_s_share", lang, { p: selfPct })}</em>
            </div>
          )}
          <div>
            <b>{kwh(Math.max(0, q.prod0 - selfKwh))}</b><span>{ppt("e_t_out", lang)}</span>
            <em>{surplus && surplus.totalKwh > 0 ? ppt("e_s_paid", lang, { v: fmt(surplus.eur) }) : ppt("e_s_share", lang, { p: 100 - selfPct })}</em>
          </div>
          {consEff > 0 && (
            <div>
              <b>{kwh(Math.max(0, consEff - fromSolar))}</b><span>{ppt("e_t_in", lang)}</span>
              <em>{ppt("e_s_cons", lang, { p: 100 - coverPct })}</em>
            </div>
          )}
        </div>
      </section>

      </div>

      {/* page 2: the money, year by year, and the design checks */}
      <div className="p-page">
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
        <CashflowSVG bands={bands} cost={q.cost} horizon={hz} lang={lang} money={fmt}
          tickFmt={(v) => nf(Math.round(fmt.toLocal(v) / 1000) * 1000, 0)} axisUnit={fmt.local ? fmt.unit : "€"} />
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
            v: fmt.local ? fmt(surplus.eur) : `${Math.round(surplus.mdl).toLocaleString(loc)} ${lang === "ru" || lang === "uk" ? "лей" : "lei"} (${fmt(surplus.eur)})`,
          })}</p>
        )}
      </section>

      {/* year by year in the expected scenario: what it produces, what it saves that year, and where the money stands */}
      {!(support?.results?.length > 0) && (
        <section className="p-years">
          <h2><span className="p-n">{num()}</span>{ppt("yr_h", lang)}</h2>
          <table className="p-yt"><tbody>
            <tr><th>{ppt("yr_year", lang)}</th><th>{ppt("yr_prod", lang)}</th><th>{ppt("yr_save", lang)}</th><th>{ppt("yr_pos", lang)}</th></tr>
            {yearRows.map((r) => (
              <tr key={r.y} className={r.pos >= 0 ? "pos" : ""}>
                <td>{r.y}</td><td>{kwh(r.kwh)}</td><td>{fmt(r.save)}</td><td><b>{fmt(r.pos)}</b></td>
              </tr>
            ))}
          </tbody></table>
          <p className="p-note">{ppt("yr_note", lang, { i: nf(inflPct, 1), d: nf(degrPct, 1) })}</p>
        </section>
      )}

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

      {/* the support programmes frozen with the offer, as on the live page (SupportOffer.jsx) */}
      {support?.results?.length > 0 && (() => {
        const L = moneyFormatter({ currency: "MDL", lang, fx: { MDL: 1 } });
        const line = supportLine(support, lang, { costMdl: q.cost * (Number(fx?.MDL) || 0) });
        return (
          <section>
            <h2><span className="p-n">{num()}</span>{ppt("sup_h", lang)}</h2>
            <p className="p-lead">{ppt("sup_sub", lang, { d: fmtDate(`${support.asOf}T12:00:00Z`, loc, { day: "numeric", month: "long", year: "numeric" }) })}</p>
            <ul className="p-sup">
              {support.results.map((r) => (
                <li key={r.code}>
                  <b>{r.name?.[lang] || r.name?.en}</b>
                  {": "}{ppt(r.status === "eligible" ? "sup_eligible" : "sup_conditional", lang)}
                  {r.estimateMinor > 0 ? `, ${ppt(r.kind === "guarantee" ? "sup_guarantee" : r.upTo || r.status !== "eligible" ? "sup_up_to" : "sup_about", lang, { x: L(r.estimateMinor / 100) })}` : ""}
                  {r.fromPct != null ? `, ${ppt("sup_duty", lang, { a: r.fromPct, b: r.toPct })}` : ""}
                </li>
              ))}
            </ul>
            {line && <p className="p-lead"><b>{line.head}</b>{line.net ? `. ${line.net}` : ""}</p>}
          </section>
        );
      })()}

      </div>

      {/* page 3: the warranties and the scope, the next steps, payment and acceptance, the assumptions */}
      <div className="p-page p-last">
      {/* the warranties of what is quoted (verified in the catalog) and the installer's scope (Settings) */}
      <section className="p-terms">
        <h2><span className="p-n">{num()}</span>{ppt("war_h", lang)}</h2>
        {wRows.length > 0 ? (
          <table className="p-war"><tbody>
            <tr><th>{ppt("war_what", lang)}</th><th>{ppt("war_len", lang)}</th><th>{ppt("war_by", lang)}</th></tr>
            {wRows.map(([what, len, by], i) => <tr key={i}><td className="k">{what}</td><td>{len}</td><td className="by">{by}</td></tr>)}
          </tbody></table>
        ) : <p className="p-lead">{ppt("war_none", lang)}</p>}
        <div className="p-scope">
          <div><h3>{ppt("inc_h", lang)}</h3><ul>{scope.include.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          <div className="out"><h3>{ppt("exc_h", lang)}</h3><ul>{scope.exclude.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
      </section>

      <section>
        <h2><span className="p-n">{num()}</span>{tr("pdf_next_h")}</h2>
        <ol className="p-steps">
          <li>{ppt("step1", lang)}</li>
          <li>{ppt("step2", lang)}</li>
          <li>{ppt("step3", lang)}</li>
          <li>{ppt("step4", lang)}</li>
        </ol>
        {fit.length === 0 && <p className="p-eco">{co2(tr("pdf2_eco", { kg: Math.round(co2Year).toLocaleString(loc), t: trees }))}</p>}
      </section>

      {/* how it is paid (the job's stages, Phase 4) and where the client accepts it */}
      <section className="p-pay">
        <h2><span className="p-n">{num()}</span>{ppt("pay_h", lang)}</h2>
        <p className="p-lead">{ppt("pay_lead", lang)}</p>
        <ol className="p-stages">
          {stages.map((s) => (
            <li key={s.trigger}><b>{s.pct}%</b><span>{pt("tr_" + s.trigger, lang)}</span><em>{fmt((q.cost * s.pct) / 100)}</em></li>
          ))}
        </ol>
        {signed?.name ? (
          <p className="p-lead"><b>{ppt("sig_print", lang, { name: signed.name, date: signed.date || "", level: ppt(signed.level === "qualified" ? (signed.simulated ? "lvl_simulated" : "lvl_qualified") : "lvl_simple", lang) })}</b></p>
        ) : (
          <div className="p-accept">
            {acceptUrl && <p>{ppt("acc_online", lang, { u: acceptUrl })}</p>}
            <p className="p-acc-or">{ppt("acc_paper", lang)}</p>
            <div className="p-sign">
              <div><span />{ppt("acc_client", lang)}</div>
              <div><span />{ppt("acc_date", lang)}</div>
              <div><span />{ppt("acc_for", lang, { c: legal?.name || company.name })}</div>
            </div>
          </div>
        )}
      </section>

      <div className="p-end">
      <div className="p-annex">
        <div className="p-annex-h">{tr("pdf_assump_h")}: <span>{tr("pdf2_assump_s")}</span></div>
        <dl className="p-assump">
          <div><dt>{tr("as_yield_exp")}</dt><dd>{tr("as_yield_v", { n: Math.round(q.yieldPerKwp || E.baseYield) })}</dd></div>
          <div><dt>{tr("as_export_scheme")}</dt><dd>{mktLine}</dd></div>
          <div><dt>{tr("as_selfcons")}</dt><dd>{selfPct}%{inputs.batt ? " " + tr("as_with_batt") : ""}</dd></div>
          <div><dt>{tr("as_cost_basis")}</dt><dd>{fmt(E.costPerKw)}/kW{E.batteryCost ? ` + ${fmt(E.batteryCost)}` : ""}</dd></div>
          <div><dt>{tr("pdf_horizon")}</dt><dd>{tr("as_horizon_v", { n: hz })}</dd></div>
          <div><dt>{co2(tr("pdf_co2_factor"))}</dt><dd>{mkt.co2} kg/kWh</dd></div>
          <div><dt>{ppt("as_price_now", lang)}</dt><dd>{fmt.perKwh(priceY)}</dd></div>
          <div><dt>{ppt("as_infl", lang)}</dt><dd>{ppt("as_infl_v", lang, { n: nf(inflPct, 1) })}</dd></div>
          <div><dt>{ppt("as_degr", lang)}</dt><dd>{ppt("as_degr_v", lang, { n: nf(Number(E.bands?.expc?.degr ?? 0.5), 1) })}</dd></div>
          {hasFinance && loan === 0 && <div><dt>{ppt("as_loan", lang)}</dt><dd>{ppt("as_loan_v", lang, { n: financeTerm, r: nf(financeRate, 1) })}</dd></div>}
          {inputs.tariffMode === "differentiated" && (
            <div><dt>{tr("as_md_tariff")}</dt><dd>{tr("as_md_tariff_v", { d: E.mdDayRateMdl, n: E.mdNightRateMdl })}</dd></div>
          )}
        </dl>
      </div>


      {/* one line: who prepared it, and the company's note */}
      <p className="p-foot">
        {preparedBy?.name ? `${tr("pp_prepared_by")} ${preparedBy.name}${preparedBy.phone ? ", " + preparedBy.phone : ""}. ` : ""}
        {legal?.name && legal?.idno ? <>{ppt("legal_line", lang, { name: legal.name, idno: legal.idno, addr: legal.address || "" })}{legal.iban ? `, IBAN ${legal.iban}` : ""}. </> : null}
        {company.name}, {tr("pdf_foot")}, voltmira.com
      </p>
      </div>
      </div>
    </div>
  );
}
