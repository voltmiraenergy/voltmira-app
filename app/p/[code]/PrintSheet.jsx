// app/p/[code]/PrintSheet.jsx — the branded proposal PDF, ported 1:1 from the
// demo's printProposal(): company line, headline KPIs (incl. highlighted
// lifetime savings), scenario table with key inputs, cumulative cash-flow
// chart, environmental impact, system-at-a-glance, monthly money + verdict,
// full assumptions, next steps + validity, footer. Rendered instead of the
// mobile proposal when ?print=1; AutoPrint fires the save-as-PDF dialog.
import { t } from "../../../lib/i18n.js";
import { fmtDate } from "../../../lib/tz.js";
import { SOLAR_SEASON, FX, effectiveConsumption } from "@voltmira/engine";
import { designCheck, designCheckRows, designCheckLead, stringInputs } from "../../../lib/designCheck.js";
import { kindLabel, bomLineText, surplusRevenue } from "../../../lib/quoteAnalysis.js";
import { backupHours } from "../../../lib/batteryBackup.js";
import { compassLabel } from "../../../lib/roofLayout.js";
import {
  latestSeasonalMdl, weightedExportPriceMdl, weightedExportPriceEur,
  flatAverageMdl, storageSpreadMdl, MONTHS_RO, BUYBACK_SOURCE,
} from "../../../lib/prosumerPrice.js";

// Per-market export data (same table as the demo's MARKETS).
const MKT = {
  RO: { feed: 0.036, co2: 0.30 },
  MD: { feed: 0.02, co2: 0.40 },
  DE: { feed: 0.08, co2: 0.35 },
};

// A literal ₂ (U+2082) sits outside every Inter subset, so it fell back to
// Arial mid-word in a real browser — visible as the odd spacing in "CO ₂" — and
// would be a tofu box on a container with no system fonts. The ordinary "2" IS
// in Inter, so subscript it with markup instead of relying on a glyph we don't
// ship.
// "1 fază" vs "3 faze" — the catalog only ever ships 1-phase or 3-phase gear,
// so this doesn't need the full Slavic plural-form ladder, just singular vs.
// the one plural each language actually uses here.
function t3phase(n, lang) {
  if (lang === "en") return n === 1 ? "phase" : "phases";
  if (lang === "ru") return n === 1 ? "фаза" : "фазы";
  return n === 1 ? "fază" : "faze";
}

function co2(text) {
  const i = (text || "").indexOf("CO2");
  if (i < 0) return text;
  return <>{text.slice(0, i)}CO<sub>2</sub>{text.slice(i + 3)}</>;
}

/** A 1 / 2 / 5 × 10ⁿ step, so the money axis lands on figures people read. */
function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

// Cumulative cash position across the horizon. The old version drew three thin
// lines in an empty box with no money axis at all — the client could see a line
// going up and nothing else. This one labels the axis in their own currency,
// fills the gap between where they stand and break-even, and marks the year the
// system has paid for itself.
function CashflowSVG({ bands, cost, horizon, lang, money }) {
  const W = 720, H = 250, PADL = 62, PADR = 18, PADT = 16, PADB = 34;
  const rowsP = bands.pess.rows || [], rowsE = bands.expc.rows || [], rowsO = bands.opti.rows || [];
  const all = [...rowsP, ...rowsE, ...rowsO, -cost, 0];
  const step = niceStep((Math.max(...all) - Math.min(...all)) / 4);
  const lo = Math.floor(Math.min(...all) / step) * step;
  const hi = Math.ceil(Math.max(...all) / step) * step;
  const X = (i) => PADL + (i / Math.max(1, horizon - 1)) * (W - PADL - PADR);
  const Y = (v) => PADT + (1 - (v - lo) / ((hi - lo) || 1)) * (H - PADT - PADB);
  const ln = (r) => r.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const zero = Y(0);
  const be = bands.expc.payback;
  const bx = be && be > 0 ? X(be - 1) : null;

  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const yearTicks = [1, 5, 10, 15, 20, 25].filter((y) => y <= horizon);

  // The band between the expected position and break-even: below the line the
  // system is still paying itself back, above it every euro is profit.
  const area = `${ln(rowsE)} L ${X(rowsE.length - 1).toFixed(1)} ${zero.toFixed(1)} L ${X(0).toFixed(1)} ${zero.toFixed(1)} Z`;

  return (
    <svg className="p-chart" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PADL} y1={Y(v)} x2={W - PADR} y2={Y(v)} stroke="#EDEAE0" strokeWidth="1" />
          <text x={PADL - 7} y={Y(v) + 3} textAnchor="end" fontSize="8.5" fill="#999">{money(v)}</text>
        </g>
      ))}
      <path d={area} fill="#1E6B4E" opacity=".10" />
      <line x1={PADL} y1={zero} x2={W - PADR} y2={zero} stroke="#B9B5A6" strokeWidth="1.2" strokeDasharray="3 4" />
      <path d={ln(rowsP)} fill="none" stroke="#C4543B" strokeWidth="1.3" strokeDasharray="4 3" opacity=".55" />
      <path d={ln(rowsO)} fill="none" stroke="#1E6B4E" strokeWidth="1.3" strokeDasharray="4 3" opacity=".55" />
      <path d={ln(rowsE)} fill="none" stroke="#1E6B4E" strokeWidth="2.6" strokeLinejoin="round" />
      {bx !== null && (
        <g>
          <line x1={bx} y1={PADT} x2={bx} y2={H - PADB} stroke="#E89B2D" strokeWidth="1.3" strokeDasharray="3 3" />
          <circle cx={bx} cy={zero} r="4" fill="#E89B2D" stroke="#fff" strokeWidth="1.4" />
          <text x={bx + (bx > W - 150 ? -7 : 7)} y={PADT + 10} fontSize="9.5" fontWeight="700" fill="#C97F14"
            textAnchor={bx > W - 150 ? "end" : "start"}>
            {t("pdf_breakeven", lang)} · {be.toFixed(1)} {t("years_w", lang)}
          </text>
        </g>
      )}
      <line x1={PADL} y1={H - PADB} x2={W - PADR} y2={H - PADB} stroke="#D8D4C6" strokeWidth="1" />
      {yearTicks.map((y) => (
        <text key={y} x={X(y - 1)} y={H - PADB + 14} textAnchor="middle" fontSize="8.5" fill="#999">
          {t("pdf_year_n", lang, { n: y })}
        </text>
      ))}
    </svg>
  );
}

// Month by month: what the roof makes against what the household uses. This is
// the chart every solar buyer expects and the document never had — it answers
// "will it cover my winter?" in one glance, which three paragraphs of prose
// about self-consumption ratios never did.
function MonthlySVG({ prod, cons, lang, loc }) {
  const W = 720, H = 210, PADL = 52, PADR = 14, PADT = 14, PADB = 34;
  const maxV = Math.max(...prod, ...cons, 1);
  const step = niceStep(maxV / 3);
  const hi = Math.ceil(maxV / step) * step;
  const bw = (W - PADL - PADR) / 12;
  const Y = (v) => PADT + (1 - v / hi) * (H - PADT - PADB);
  const base = Y(0);
  const ticks = [];
  for (let v = 0; v <= hi + 1e-9; v += step) ticks.push(v);
  return (
    <svg className="p-chart" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PADL} y1={Y(v)} x2={W - PADR} y2={Y(v)} stroke="#EDEAE0" strokeWidth="1" />
          <text x={PADL - 6} y={Y(v) + 3} textAnchor="end" fontSize="8" fill="#999">
            {Math.round(v).toLocaleString(loc)}</text>
        </g>
      ))}
      {prod.map((p, i) => {
        const x = PADL + bw * i;
        const c = cons[i] || 0;
        return (
          <g key={i}>
            <rect x={x + bw * 0.14} y={Y(p)} width={bw * 0.38} height={Math.max(1, base - Y(p))} rx="2" fill="#1E6B4E" opacity=".88" />
            <rect x={x + bw * 0.54} y={Y(c)} width={bw * 0.32} height={Math.max(1, base - Y(c))} rx="2" fill="#C9C4B4" />
          </g>
        );
      })}
      <line x1={PADL} y1={base} x2={W - PADR} y2={base} stroke="#D8D4C6" strokeWidth="1" />
      {MONTHS_RO.map((m, i) => (
        <text key={m} x={PADL + bw * (i + 0.5)} y={H - 20} textAnchor="middle" fontSize="8" fill="#999">{m}</text>
      ))}
      <rect x={PADL} y={H - 13} width="8" height="8" rx="2" fill="#1E6B4E" opacity=".88" />
      <text x={PADL + 12} y={H - 6} fontSize="8.5" fill="#777">{t("pdf_m_prod", lang)}</text>
      <rect x={PADL + 132} y={H - 13} width="8" height="8" rx="2" fill="#C9C4B4" />
      <text x={PADL + 144} y={H - 6} fontSize="8.5" fill="#777">{t("pdf_m_cons", lang)}</text>
    </svg>
  );
}

// The operator's published monthly buy-back price as bars, with the months the
// system actually exports drawn behind them. The two point opposite ways — the
// price bottoms out exactly when the surplus peaks — which is the whole reason
// the weighted average (dashed) is the figure quoted rather than the flat mean.
// Print palette: inline hex, not the app's CSS variables (this page renders
// outside AppTheme, and a print stylesheet must not depend on custom properties).
function BuybackSVG({ seasonal, weighted, lang }) {
  const W = 720, H = 176, PADL = 30, PADR = 84, PADT = 16, PADB = 34;
  const vals = seasonal.filter((v) => v != null);
  const maxP = (Math.max(...vals, weighted) || 1) * 1.16;
  const bw = (W - PADL - PADR) / 12;
  const Y = (v) => PADT + (1 - v / maxP) * (H - PADT - PADB);
  const base = Y(0);
  const maxW = Math.max(...SOLAR_SEASON) || 1;
  const SY = (w) => base - (w / maxW) * (base - PADT) * 0.76;
  const shape = SOLAR_SEASON
    .map((w, i) => (i ? "L" : "M") + (PADL + bw * (i + 0.5)).toFixed(1) + " " + SY(w).toFixed(1)).join(" ");
  return (
    <svg className="p-chart" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      {[1, 2, 3].filter((v) => v < maxP).map((v) => (
        <g key={v}>
          <line x1={PADL} y1={Y(v)} x2={W - PADR} y2={Y(v)} stroke="#E5E2D6" strokeWidth="1" strokeDasharray="2 4" />
          <text x={PADL - 5} y={Y(v) + 3} textAnchor="end" fontSize="8" fill="#999">{v}</text>
        </g>
      ))}
      <path d={`${shape} L ${(PADL + bw * 11.5).toFixed(1)} ${base} L ${(PADL + bw * 0.5).toFixed(1)} ${base} Z`}
        fill="#E89B2D" opacity=".16" />
      <path d={shape} fill="none" stroke="#E89B2D" strokeWidth="1.3" opacity=".8" />
      {seasonal.map((p, i) => p == null ? null : (
        <g key={i}>
          <rect x={PADL + bw * i + bw * 0.22} y={Y(p)} width={bw * 0.56}
            height={Math.max(1, base - Y(p))} rx="2" fill="#1E6B4E" opacity=".85" />
          <text x={PADL + bw * (i + 0.5)} y={Y(p) - 3.5} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#1E6B4E">
            {p.toFixed(2)}</text>
        </g>
      ))}
      <line x1={PADL} y1={Y(weighted)} x2={W - PADR + 5} y2={Y(weighted)} stroke="#111" strokeWidth="1.2" strokeDasharray="5 3" />
      <text x={W - PADR + 9} y={Y(weighted) - 1} fontSize="10" fontWeight="700" fill="#111">{weighted.toFixed(2)} lei</text>
      <text x={W - PADR + 9} y={Y(weighted) + 9} fontSize="7.5" fill="#666">
        {lang === "en" ? "weighted" : lang === "ru" ? "взвеш." : "ponderat"}</text>
      <line x1={PADL} y1={base} x2={W - PADR} y2={base} stroke="#D8D4C6" strokeWidth="1" />
      {MONTHS_RO.map((m, i) => (
        <text key={m} x={PADL + bw * (i + 0.5)} y={H - 20} textAnchor="middle" fontSize="7.5" fill="#888">{m}</text>
      ))}
      <rect x={PADL} y={H - 13} width="8" height="8" rx="2" fill="#1E6B4E" opacity=".85" />
      <text x={PADL + 12} y={H - 6} fontSize="8" fill="#777">{t("pdf_sp_legend_price", lang)}</text>
      <rect x={PADL + 190} y={H - 13} width="8" height="8" rx="2" fill="#E89B2D" opacity=".4" />
      <text x={PADL + 202} y={H - 6} fontSize="8" fill="#777">{t("pdf_sp_legend_export", lang)}</text>
    </svg>
  );
}

const CSS = `
  /* The sheet is an A4 page, on screen and on paper alike.
     A4 is 210mm wide; with the 14mm @page margins below, the content column is
     182mm. It used to be authored at 820px — wider than the page it printed
     onto — so every figure was silently scaled down by about a sixth, and on
     screen it read as a narrow column floating in empty space rather than a
     document. Both modes now resolve to the same 182mm column. */
  /* White everywhere, no exceptions. A tinted "desk" behind a floating white
     card looks right in a browser and then prints: Chrome paints the body
     background into the PDF, so the document arrives with a grey band around
     every page. The page IS the document — one white surface, on screen and on
     paper, with nothing behind it to leak. */
  html,body{background:#fff!important;margin:0}
  .print-sheet{width:182mm;max-width:100%;box-sizing:border-box;
    padding:14mm 0;margin:0 auto;background:#fff;color:#111;
    font-family:Inter,system-ui,sans-serif;font-size:13.5px;line-height:1.45}
  .print-sheet h1,.print-sheet h2{font-family:'Inter',system-ui,sans-serif}
  .print-sheet .p-co{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#1E6B4E;font-weight:700;margin-bottom:10px}
  .print-sheet h1{font-size:24px;margin:0 0 3px;letter-spacing:-.02em}
  .print-sheet .p-sub{color:#555;font-size:12.5px;margin-bottom:0}
  /* Single column since the QR came out — the identity block gets the full width. */
  .print-sheet .p-head{margin-bottom:18px}
  /* A 5-item flex row wrapped the most important figure onto a line of its own,
     left-aligned under four others — it read as an afterthought. The four spec
     figures now sit on a fixed 4-up grid, and the money the client actually
     cares about gets its own band, where gross and net sit side by side and
     can't be misread as two answers to the same question. */
  .print-sheet .p-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:13px}
  .print-sheet .p-kpis b{display:block;font-size:18.5px;font-family:'Inter',system-ui,sans-serif;letter-spacing:-.01em}
  .print-sheet .p-kpis span{font-size:10.5px;color:#666;display:block;margin-top:1px}
  /* No tinted panel: on paper the fill and border read as a highlighter box and
     cheapen the document. The two figures carry their own colour, which is
     enough emphasis — and dropping the box lets them align flush left with the
     spec grid above instead of sitting 16px inboard of it. */
  .print-sheet .p-hero{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px;
    background:#fff;padding:2px 0 0}
  .print-sheet .p-hero b{display:block;font-size:23px;font-family:'Inter',system-ui,sans-serif;letter-spacing:-.02em;color:#C97F14}
  .print-sheet .p-hero .net b{color:#1E6B4E}
  .print-sheet .p-hero span{font-size:10.5px;color:#666;display:block;margin-top:2px;line-height:1.35}
  /* Hybrid systems' own pitch: a distinct callout, not folded into the money
     band above — a battery is a different product (resilience), not just
     another number in the savings math. */
  .print-sheet .p-backup{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;
    background:#EFF1E9;border:1px solid #D9DEC9;border-radius:9px;padding:10px 14px;margin:-6px 0 20px}
  .print-sheet .p-backup b{font-size:16px;color:#3D5A2E;font-family:'Inter',system-ui,sans-serif;letter-spacing:-.01em}
  .print-sheet .p-backup span{font-size:11.5px;color:#333}
  .print-sheet .p-backup em{font-style:normal;font-size:10px;color:#777;flex-basis:100%}
  /* Numbered spine: the document reads as a sequence of answers, not a pile of
     tables. The number is muted so the title still carries. */
  .print-sheet h2{font-size:14.5px;margin:22px 0 8px;color:#1E6B4E;
    border-top:1.5px solid #E5E2D6;padding-top:11px}
  .print-sheet h2 .p-n{color:#B9B5A6;font-weight:700;margin-right:8px}
  .print-sheet h3{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#888;
    margin:15px 0 6px;font-weight:700}
  .print-sheet .p-lead{font-size:12px;color:#555;line-height:1.5;margin:0 0 9px;max-width:74ch}
  /* three scenarios as cards — the old table buried the headline figure in a
     row of jargon the client was never going to parse */
  .print-sheet .p-scen{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:4px 0 0}
  .print-sheet .p-scen > div{border:1px solid #E5E2D6;border-radius:9px;padding:10px 12px 11px;background:#fff}
  .print-sheet .p-scen > div.on{background:#F4F8F5;border-color:#CBD8CF}
  .print-sheet .p-scen .s-t{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em}
  .print-sheet .p-scen .s-y{font-size:20px;font-family:'Inter',system-ui,sans-serif;font-weight:700;
    letter-spacing:-.02em;line-height:1.15;margin-top:2px}
  .print-sheet .p-scen .s-y small{font-size:10.5px;font-weight:500;color:#777;letter-spacing:0}
  .print-sheet .p-scen .s-r{font-size:10px;color:#777;margin-top:2px}
  /* monthly cashflow: one strip, not a three-column table for three numbers */
  .print-sheet .p-mo{display:flex;gap:26px;align-items:baseline;flex-wrap:wrap;
    background:#F7F6F1;border-radius:9px;padding:11px 14px;margin-top:4px}
  .print-sheet .p-mo div b{font-size:16px;font-family:'Inter',system-ui,sans-serif;letter-spacing:-.01em}
  .print-sheet .p-mo div span{font-size:10px;color:#666;display:block}
  .print-sheet .p-mo .pos b{color:#1E6B4E}
  /* back matter: reference, deliberately quieter than the selling content */
  .print-sheet .p-annex h2{color:#666}
  .print-sheet .p-annex table{font-size:11px}
  .print-sheet .p-annex td{padding:5px 9px;color:#555}
  .print-sheet table{width:100%;border-collapse:collapse;font-size:12.5px}
  .print-sheet th{text-align:left;padding:7px 9px;background:#F0EEE6;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .print-sheet td{padding:7px 9px;border-bottom:1px solid #E5E2D6}
  /* Where the energy goes, and where it comes from — two stacked bars instead
     of a paragraph explaining self-consumption ratios. */
  .print-sheet .p-split{display:grid;gap:9px;margin:8px 0 2px}
  .print-sheet .p-split-r{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center}
  .print-sheet .p-split-k{font-size:10.5px;color:#666;text-align:right;line-height:1.3}
  .print-sheet .p-split-k b{display:block;font-size:12px;color:#111;font-family:'Inter',system-ui,sans-serif}
  .print-sheet .p-bar{display:flex;height:26px;border-radius:6px;overflow:hidden;background:#F0EEE6}
  .print-sheet .p-bar span{display:flex;align-items:center;justify-content:center;font-size:9.5px;
    font-weight:700;color:#fff;white-space:nowrap;overflow:hidden}
  .print-sheet .p-bar .s1{background:#1E6B4E}
  .print-sheet .p-bar .s2{background:#E89B2D}
  .print-sheet .p-bar .s3{background:#9FB3A7}
  .print-sheet .p-bar .s4{background:#CFC9B8;color:#555}
  /* 25-year cost of energy, with and without the system */
  .print-sheet .p-vs{display:grid;gap:7px;margin:6px 0 2px}
  .print-sheet .p-vs-r{display:grid;grid-template-columns:118px 1fr auto;gap:10px;align-items:center;font-size:11px}
  .print-sheet .p-vs-t{width:100%;height:20px;background:#F0EEE6;border-radius:5px;overflow:hidden}
  .print-sheet .p-vs-t i{display:block;height:100%}
  .print-sheet .p-vs-r b{font-family:'Inter',system-ui,sans-serif;font-size:13px;white-space:nowrap}
  .print-sheet .p-vs .bad i{background:#C4543B;opacity:.75}
  .print-sheet .p-vs .good i{background:#1E6B4E}
  .print-sheet .p-vs .bad b{color:#C4543B}
  .print-sheet .p-vs .good b{color:#1E6B4E}
  .print-sheet .p-foot{break-inside:avoid;page-break-inside:avoid;margin-top:18px;font-size:10.5px;color:#888;border-top:1px solid #ddd;padding-top:12px}
  /* Pagination: the money section is now taller than an A4 page, so forbidding
     a break inside it would push the whole thing to the next page and leave a
     half-empty one behind. Let sections flow, and protect the units that must
     not split instead — a chart, a card row, a table, a heading stranded at the
     foot of a page. */
  .print-sheet section{margin:0;break-inside:auto;page-break-inside:auto}
  .print-sheet h2{break-after:avoid;page-break-after:avoid}
  .print-sheet h3{break-after:avoid;page-break-after:avoid}
  .print-sheet table,.print-sheet .p-chart,.print-sheet .p-scen,.print-sheet .p-mo,
  .print-sheet .p-spread,.print-sheet .p-eco,.print-sheet .p-verdict{
    break-inside:avoid;page-break-inside:avoid}
  .print-sheet .p-chart{width:100%;height:auto;display:block;margin:4px 0 6px;border:1px solid #E5E2D6;border-radius:8px;background:#FCFBF7}
  .print-sheet .p-legend{display:flex;flex-wrap:wrap;gap:16px;font-size:10px;color:#666;margin-bottom:4px}
  .print-sheet .p-legend i{display:inline-block;width:15px;height:0;border-top:2px solid #1E6B4E;margin-right:5px;vertical-align:middle}
  .print-sheet .p-note{font-size:11.5px;color:#555;line-height:1.5;margin:2px 0 0}
  .print-sheet .p-eco{display:flex;gap:26px;margin:4px 0 2px;flex-wrap:wrap}
  .print-sheet .p-eco b{display:block;font-size:19px;font-family:'Inter',system-ui,sans-serif;color:#1E6B4E}
  .print-sheet .p-eco span{font-size:10.5px;color:#666}
  .print-sheet sub{font-size:.72em;line-height:0;vertical-align:-.22em}
  /* equipment table: the component name leads, the quantity sits right */
  .print-sheet td.p-qty{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;width:1%}
  .print-sheet .p-kind{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .print-sheet .p-gear{font-weight:600;color:#111}
  /* design checks: value right-aligned, the reasoning under it */
  .print-sheet td.p-chk{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}
  .print-sheet td.p-chk.bad{color:#C4543B}
  .print-sheet .p-chk-d{font-size:10.5px;color:#666;font-weight:400;line-height:1.4;margin:2px 0 0 18px;white-space:normal}
  .print-sheet .p-chk-d em{font-style:normal;color:#C4543B}
  .print-sheet .p-flag{display:inline-block;width:13px;text-align:center;font-weight:700;margin-right:5px}
  .print-sheet .p-flag.ok{color:#1E6B4E}
  .print-sheet .p-flag.warn{color:#C4543B}
  .print-sheet .p-spread{margin-top:10px;padding:11px 13px;background:#FBF3E4;border-radius:8px;font-size:11.5px;
    color:#333;line-height:1.5}
  .print-sheet .p-spread b{color:#C97F14;font-size:15px;font-family:'Inter',system-ui,sans-serif;margin-right:6px}
  .print-sheet .p-src{font-size:10px;color:#888;margin-top:6px}
  .print-sheet .p-steps{margin:4px 0 0;padding-left:18px;font-size:12.5px;color:#333}
  .print-sheet .p-steps li{margin-bottom:5px}
  .print-sheet .p-valid{margin-top:10px;font-size:11.5px;color:#666}
  .print-sheet .p-proof{margin-top:8px;display:inline-block;font-size:11px;font-weight:600;color:#1E6B4E;
    background:#E4EFE9;border-radius:99px;padding:4px 11px}
  /* A4, not the browser default. Without an @page rule Chrome fell back to the
     locale default — US Letter (612x792pt) — which rescales or clips on every
     A4 printer in RO/MD. The margin here replaces the on-screen padding. */
  @page{ size:A4; margin:14mm; }
  /* On paper @page supplies the margin, so the sheet drops its own padding and
     fills the printable area exactly — 182mm either way. */
  @media print{ .print-sheet{width:auto;padding:0;margin:0} }
`;

export default function PrintSheet({ company, inputs, quote: q, lang, sentAt = null, preparedBy = null, bom = [], roofAreaM2 = null, roofOrientation = null }) {
  const loc = { en: "en-IE", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-IE";
  // Minus ahead of the currency symbol. "€-31" reads as a broken string; a
  // client seeing it on a monthly cashflow line reads it twice before believing
  // it. Applies everywhere money can go negative — the strip, the chart axis.
  const fmt = (n) => (n < 0 ? "−€" : "€") + Math.abs(Math.round(n)).toLocaleString(loc);
  const yrsF = (n) => n === null ? "25+" : n === 0 ? t("pp_immediate", lang) : n.toFixed(1);
  // null = a grant covered the whole system, so return on outlay is undefined.
  const pct = (n) => (n == null ? "∞" : Math.round(n) + "%");
  const E = q.assumptions;
  const hz = q.horizon;
  const bands = q.bands;
  const mkt = MKT[inputs.market] || MKT.RO;

  const rowsE = bands.expc.rows || [];
  const lifeNet = rowsE.length ? rowsE[rowsE.length - 1] : 0;
  const lifeGross = lifeNet + q.cost;
  const net = q.year1 / 12 - (inputs.loan || 0);
  // Cost of doing nothing: the client's own consumption bought from the grid for
  // the whole horizon, inflating at the same rate the expected band assumes, so
  // it is directly comparable with the savings figures above rather than a
  // separate optimistic story.
  const inflPct = Number(E.bands?.expc?.infl ?? 0);
  const consY = Number(inputs.cons) || 0;
  const priceY = Number(inputs.price) || 0;
  const infl = inflPct / 100;
  const doNothing = consY > 0 && priceY > 0
    ? consY * priceY * (infl === 0 ? hz : ((Math.pow(1 + infl, hz) - 1) / infl))
    : 0;
  const co2Year = q.prod0 * mkt.co2;
  const co2Life = co2Year * hz / 1000;
  const trees = Math.max(1, Math.round(co2Year / 21));
  const carKm = Math.round(co2Year / 0.17);
  const panels = Math.max(1, Math.round(inputs.kw / 0.44));
  // Site Designer's own measured area/orientation beat the flat kw*5.5 rule
  // of thumb and the "South, 35° (assumed)" placeholder once they exist —
  // undefined on any quote that never had a roof drawn, which keeps every
  // proposal made before this feature (or without it) exactly as it was.
  const roofArea = roofAreaM2 ? Math.round(roofAreaM2) : Math.round(inputs.kw * 5.5);
  const orientText = roofOrientation
    ? `${Math.round(roofOrientation.tiltDeg)}°, ${compassLabel(roofOrientation.azimuthDeg, lang)}`
    : roofAreaM2
      ? t("pdf_orient_varies", lang)
      : t("pdf_orient_v", lang);

  // ---- what the client is actually buying, and whether it can be built ------
  // The bill of materials names the real parts; with no BOM the document keeps
  // the old size-derived estimate rather than inventing equipment.
  const lines = (Array.isArray(bom) ? bom : []).filter((l) => (Number(l.qty) || 0) > 0);
  const battKwh = inputs.batt ? (Number(inputs.battKwh) || 0) : 0;
  const consEff = Math.max(0, Number(effectiveConsumption(inputs)) || 0);
  // Hybrid systems get their own pitch, not just an add-on line item: real
  // hours of backup at this household's own average draw (lib/batteryBackup.js)
  // — never a monetized "avoided blackout" figure, since there's no reliable
  // RO/MD outage-frequency data to price that against.
  const backupHrs = battKwh > 0 ? backupHours(battKwh, consEff) : null;
  const dc = designCheck({ bom: lines, kw: Number(inputs.kw) || 0, battKwh, consKwh: consEff });
  const checks = designCheckRows(dc, { lang, battKwh });
  // Shown for any real BOM inverter, even a single MPPT input in use — a
  // genuine per-input compliance table (peak power, both ends of the voltage
  // window, the current limit) is exactly what a real inverter-design report
  // prints regardless of string count. Without a real inverter (representative
  // fallback gear) there's no per-input electrical limit to check, so it only
  // falls back to the old bare split once there's actually more than one input
  // to show — see hasRealInverter below.
  const mpptInputs = dc.strings >= 1 ? stringInputs(dc) : [];
  const hasRealInverter = !!dc.stringRangeInfo;

  // ---- what the exported surplus is worth (Moldova / net billing only) ------
  // Romania credits exports 1:1 at the retail price, so there is no separate
  // buy-back price to weight and the section simply doesn't apply there.
  const isMD = inputs.market === "MD";
  const buyback = isMD ? {
    seasonal: latestSeasonalMdl(),
    weightedMdl: weightedExportPriceMdl(SOLAR_SEASON),
    weightedEur: weightedExportPriceEur(SOLAR_SEASON, FX.MDL),
    flatMdl: flatAverageMdl(),
    spread: storageSpreadMdl((Number(inputs.price) || 0) * FX.MDL, SOLAR_SEASON),
    surplus: surplusRevenue(q.prod0, q.self, FX.MDL),
  } : null;
  const lei = (n) => Math.round(n).toLocaleString(loc) + " lei";

  // ---- energy, month by month -----------------------------------------------
  // PVGIS hands back this roof's own monthly shape when the address was looked
  // up; without it the engine's seasonal curve is the honest fallback.
  const shape = Array.isArray(inputs.monthlyYieldShape) && inputs.monthlyYieldShape.length === 12
    ? inputs.monthlyYieldShape : SOLAR_SEASON;
  const shapeSum = shape.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const prodMonthly = shape.map((f) => (q.prod0 * (Number(f) || 0)) / shapeSum);
  const consMonthly = (inputs.useMonthly && Array.isArray(inputs.consMonthly) && inputs.consMonthly.length === 12)
    ? inputs.consMonthly.map((v) => Number(v) || 0)
    : new Array(12).fill(consEff / 12);

  // Where production goes, and where consumption comes from. Two views of the
  // same split, and the pair is what a client actually wants to know.
  const selfPct = Math.round((q.self || 0) * 100);
  const selfKwh = (q.self || 0) * q.prod0;
  const expKwh = Math.max(0, q.prod0 - selfKwh);
  const fromSolar = Math.min(selfKwh, consEff);
  const fromGrid = Math.max(0, consEff - fromSolar);
  const coverPct = consEff > 0 ? Math.round((fromSolar / consEff) * 100) : 0;

  // 25-year cost of energy, with the system and without it. The "do nothing"
  // figure was a sentence; as a pair of bars it is the comparison the client is
  // actually making, and it needs no explaining.
  const gridAfter = Math.max(0, doNothing - lifeGross);
  const withSolar = gridAfter + q.cost;
  const vsMax = Math.max(doNothing, withSolar, 1);
  // Valid for the company's validity window from when the quote was sent
  // (frozen in the snapshot engine); falls back to today + 30 for old proposals.
  const validityDays = E.quoteValidityDays || 30;
  const validBase = sentAt ? new Date(sentAt).getTime() : Date.now();
  // Rendered in the app timezone: on a UTC server a quote generated late evening
  // in RO/MD printed a validity date one day earlier than the installer expects.
  const validUntil = fmtDate(new Date(validBase + validityDays * 864e5), loc);
  const battSuffix = inputs.batt ? t("pp_plus_batt", lang) : "";
  // "New quote" is the projects table default, so `title || fallback` never
  // fired and the client's proposal was headed with an internal placeholder.
  // Treat the untouched default as absent and describe the system instead.
  const placeholderTitle = !inputs.title || /^\s*new quote\s*$/i.test(inputs.title);
  const headline = placeholderTitle
    ? t("pdf_auto_title", lang, { kw: Number(inputs.kw).toFixed(1) })
    : inputs.title;
  const mktLine = t("market_" + (inputs.market || "RO").toLowerCase(), lang);
  const tr = (k, v) => t(k, lang, v);

  return (
    <div className="print-sheet">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="p-head">
        <div className="p-head-l">
          {company.logoUrl && /^(https?:\/\/|data:image\/)/i.test(company.logoUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" style={{ height: 26, marginBottom: 10 }} />
          )}
          <div className="p-co">{company.name} · {tr("pdf_title")} · {fmtDate(new Date(), loc)}</div>
          <h1>{headline}</h1>
          <div className="p-sub">{inputs.address || ""} — {tr("pdf_prepared")} {inputs.client || tr("pdf_the_client")}</div>
        </div>
      </div>

      <div className="p-kpis">
        <div><b>{Number(inputs.kw).toFixed(1)} kW{battSuffix}</b><span>{tr("pdf_system")}</span></div>
        <div><b>{fmt(q.cost)}</b><span>{tr("total_inv")}</span></div>
        <div><b>{Math.round(q.prod0).toLocaleString(loc)} kWh</b><span>{tr("prod_year")}</span></div>
        <div><b>{fmt(q.year1)}</b><span>{tr("save_y1")}</span></div>
      </div>
      <div className="p-hero">
        <div><b>{fmt(lifeGross)}</b><span>{tr("pdf_save_over", { n: hz })}</span></div>
        <div className="net"><b>{fmt(lifeNet)}</b><span>{tr("pdf_net_gain")}</span></div>
      </div>

      {/* Hybrid systems get their own pitch here, right at the top next to the
          headline money figures — a battery isn't just an add-on that shifts
          self-consumption, it's a different product with its own value:
          keeping the lights on. Only the honest, computable claim (hours at
          this household's own average draw), never a monetized "avoided
          blackout cost" — no reliable RO/MD outage data exists to price that
          against. */}
      {backupHrs != null && (
        <div className="p-backup">
          <b>~{Math.round(backupHrs)} {tr("pdf_backup_hunit")}</b>
          <span>{tr("pdf_backup_body", { kwh: battKwh })}</span>
          <em>{tr("pdf_backup_caveat")}</em>
        </div>
      )}

      {/* 1 — what they are actually buying. Moved ahead of the money: a serious
          buyer compares equipment first, and leading with the hardware is what
          separates a proposal from a price list. */}
      <section>
        <h2><span className="p-n">1</span>{tr("pdf_glance_h")}</h2>
        {/* Real parts when the installer has built a bill of materials — brand,
            model and spec, so the client can compare this against another quote
            on equipment rather than on price alone. Never the unit cost: the BOM
            carries the installer's purchase price and their margin. */}
        {lines.length > 0 ? (
          <table><tbody>
            <tr><th>{tr("pdf_component")}</th><th>{tr("pdf_gear")}</th><th className="p-qty">{tr("pdf_qty")}</th></tr>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="p-kind">{kindLabel(l.kind, lang)}</td>
                <td className="p-gear">{bomLineText(l)}</td>
                <td className="p-qty">× {Number(l.qty)}</td>
              </tr>
            ))}
            <tr><td className="p-kind">{tr(roofAreaM2 ? "pdf_roof_real" : "pdf_roof")}</td><td colSpan={2}>~{roofArea} m² · {orientText}</td></tr>
          </tbody></table>
        ) : (
          <table><tbody>
            <tr><td>{tr("pdf_panels")}</td><td>{tr("pdf_panels_v", { n: panels })}</td></tr>
            <tr><td>{tr("pdf_inverter")}</td><td>~{Number(inputs.kw).toFixed(1)} kW</td></tr>
            {inputs.batt && <tr><td>{tr("pdf_batt_row")}</td><td>{tr("pdf_included")}</td></tr>}
            <tr><td>{tr(roofAreaM2 ? "pdf_roof_real" : "pdf_roof")}</td><td>~{roofArea} m²</td></tr>
            <tr><td>{tr("pdf_orient")}</td><td>{orientText}</td></tr>
          </tbody></table>
        )}

        {/* The panel/inverter's own datasheet figures, straight from the
            supplier catalogue — only once the BOM names real gear, so this
            never prints numbers for equipment nobody chose. Sunny Design's
            module/inverter pages show exactly this; ours is two compact
            tables rather than two dedicated pages, but the numbers are the
            same real, checkable ones the annex validates against below. */}
        {(dc.fromBom.panel || dc.fromBom.inverter) && (
          <>
            <h3>{tr("pdf_specs_h")}</h3>
            <table><tbody>
              <tr><th>{tr("pdf_specs_panel_h")}</th><th></th></tr>
              <tr><td>{tr("pdf_specs_model")}</td><td>{dc.panel.brand} {dc.panel.model}</td></tr>
              <tr><td>{tr("pdf_specs_power")}</td><td>{dc.panel.watt} W</td></tr>
              <tr><td>{tr("pdf_specs_voc_vmp")}</td><td>{dc.panel.voc} V / {dc.panel.vmp} V</td></tr>
              <tr><td>{tr("pdf_specs_isc_imp")}</td><td>{dc.panel.isc} A / {dc.panel.imp} A</td></tr>
              <tr><td>{tr("pdf_specs_eff")}</td><td>{dc.panel.eff}% · {dc.panel.cells} {tr("pdf_specs_cells")}</td></tr>
            </tbody></table>
            <table style={{ marginTop: 8 }}><tbody>
              <tr><th>{tr("pdf_specs_inv_h")}</th><th></th></tr>
              {dc.inverter ? (
                <>
                  <tr><td>{tr("pdf_specs_model")}</td><td>{dc.inverter.brand} {dc.inverter.model}</td></tr>
                  <tr><td>{tr("pdf_specs_ac")}</td><td>{dc.inverter.kw} kW · {dc.inverter.type}</td></tr>
                  <tr><td>{tr("pdf_specs_maxdc")}</td><td>{dc.inverter.maxDcV} V</td></tr>
                  <tr><td>{tr("pdf_specs_minmppt")}</td><td>{dc.inverter.minMpptV ? `${dc.inverter.minMpptV} V` : "—"}</td></tr>
                  <tr><td>{tr("pdf_specs_maxcur")}</td><td>{dc.inverter.maxInputCurrentA ? `${dc.inverter.maxInputCurrentA} A` : "—"}</td></tr>
                  <tr><td>{tr("pdf_specs_mppt_n")}</td><td>{dc.inverter.mppt} · {dc.inverter.phases} {t3phase(dc.inverter.phases, lang)}</td></tr>
                </>
              ) : (
                <tr><td colSpan={2}>{tr("pdf_specs_na")}</td></tr>
              )}
            </tbody></table>
          </>
        )}
      </section>

      {/* 2 — the energy itself, as two pictures. Whether it covers the winter,
          and where every kWh ends up, were previously only implied by a
          self-consumption percentage buried in the assumptions table. */}
      <section>
        <h2><span className="p-n">2</span>{tr("pdf_energy_h")}</h2>
        <MonthlySVG prod={prodMonthly} cons={consMonthly} lang={lang} loc={loc} />
        <div className="p-split">
          <div className="p-split-r">
            <div className="p-split-k">{tr("pdf_m_prod")}<b>{Math.round(q.prod0).toLocaleString(loc)} kWh</b></div>
            <div className="p-bar">
              <span className="s1" style={{ width: `${selfPct}%` }}>{selfPct >= 12 ? `${tr("pdf_e_self")} ${selfPct}%` : ""}</span>
              <span className="s2" style={{ width: `${100 - selfPct}%` }}>{100 - selfPct >= 12 ? `${tr("pdf_e_exp")} ${100 - selfPct}%` : ""}</span>
            </div>
          </div>
          {consEff > 0 && (
            <div className="p-split-r">
              <div className="p-split-k">{tr("pdf_m_cons")}<b>{Math.round(consEff).toLocaleString(loc)} kWh</b></div>
              <div className="p-bar">
                <span className="s3" style={{ width: `${coverPct}%` }}>{coverPct >= 12 ? `${tr("pdf_e_fromsolar")} ${coverPct}%` : ""}</span>
                <span className="s4" style={{ width: `${100 - coverPct}%` }}>{100 - coverPct >= 12 ? `${tr("pdf_e_fromgrid")} ${100 - coverPct}%` : ""}</span>
              </div>
            </div>
          )}
        </div>
        <div className="p-eco" style={{ marginTop: 10 }}>
          <div><b>{Math.round(selfKwh).toLocaleString(loc)} kWh</b><span>{tr("pdf_e_self")}</span></div>
          <div><b>{Math.round(expKwh).toLocaleString(loc)} kWh</b><span>{tr("pdf_e_exp")}</span></div>
          {consEff > 0 && <div><b>{coverPct}%</b><span>{tr("pdf_e_cover")}</span></div>}
          <div><b>{Math.round(q.yieldPerKwp || E.baseYield).toLocaleString(loc)}</b><span>kWh/kWp · {tr("as_yield_exp")}</span></div>
        </div>
      </section>

      {/* 2 — the money, as one continuous argument: how fast it pays back, what
          the position looks like year by year, what it costs per month, and what
          standing still costs instead. These used to be four separate sections. */}
      <section>
        <h2><span className="p-n">3</span>{tr("pdf_money_h", { n: hz })}</h2>

        <h3>{tr("payback_title")}</h3>
        <div className="p-scen">
          {[["pess", tr("pessimistic"), bands.pess, "#C4543B"],
            ["expc", tr("expected"), bands.expc, "#1E6B4E"],
            ["opti", tr("optimistic"), bands.opti, "#2A8563"]].map(([k, label, b, c]) => (
            <div key={k} className={k === "expc" ? "on" : ""}>
              <div className="s-t" style={{ color: c }}>{label}</div>
              <div className="s-y">{yrsF(b.payback)} <small>{tr("years_w")}</small></div>
              <div className="s-r">{hz}{tr("yr_roi")} · {pct(b.roi)}</div>
            </div>
          ))}
        </div>
        <h3>{tr("pdf_position_h")}</h3>
        <CashflowSVG bands={bands} cost={q.cost} horizon={hz} lang={lang} money={fmt} />
        <div className="p-legend">
          <span><i />{tr("expected")}</span>
          <span><i style={{ borderColor: "#C4543B", borderTopStyle: "dashed" }} />{tr("pessimistic")}</span>
          <span><i style={{ borderColor: "#1E6B4E", borderTopStyle: "dashed", opacity: .6 }} />{tr("optimistic")}</span>
          <span><i style={{ borderColor: "#E89B2D", borderTopStyle: "dashed" }} />{tr("lg_break")}</span>
        </div>
        <p className="p-note">{tr("pdf_cash_cap", { v: fmt(lifeNet), n: hz })}</p>

        <h3>{tr("pdf_monthly_h")}</h3>
        <div className="p-mo">
          <div><b>{fmt(inputs.loan || 0)}</b><span>{tr("pdf_loan_h")}</span></div>
          <div><b>{fmt(q.year1 / 12)}</b><span>{tr("pdf_save_h")}</span></div>
          <div className={net >= 0 ? "pos" : ""}>
            <b>{(net >= 0 ? "+" : "") + fmt(net)}</b><span>{tr("pdf_net_h")}</span>
          </div>
        </div>

        {doNothing > 0 && (
          <>
            <h3>{tr("pdf_vs_h", { n: hz })}</h3>
            <div className="p-vs">
              <div className="p-vs-r bad">
                <span>{tr("pdf_vs_without")}</span>
                <span className="p-vs-t"><i style={{ width: `${(doNothing / vsMax) * 100}%` }} /></span>
                <b>{fmt(doNothing)}</b>
              </div>
              <div className="p-vs-r good">
                <span>{tr("pdf_vs_with")}</span>
                <span className="p-vs-t"><i style={{ width: `${(withSolar / vsMax) * 100}%` }} /></span>
                <b>{fmt(withSolar)}</b>
              </div>
            </div>
            <p className="p-note">{tr("pdf_vs_cap", { i: inflPct, c: fmt(q.cost) })}</p>
          </>
        )}
      </section>

      {/* 3 — whether the thing can be built, not just whether it pays. Most
          residential offers in RO/MD contain no engineering at all; a string
          voltage checked against the inverter's real DC limit is the difference
          between a proposal and a sales sheet. */}
      <section>
        <h2><span className="p-n">4</span>{tr("pdf_annex_h")}</h2>
        <p className="p-lead">{designCheckLead(dc, lang)}</p>
        <table><tbody>
          {checks.map((r, i) => (
            <tr key={i}>
              {/* The reasoning belongs under the check it explains. Sharing the
                  value's right-aligned cell left it stranded mid-page, reading
                  as neither label nor figure. */}
              <td>
                <span className={"p-flag " + (r.ok ? "ok" : "warn")}>{r.ok ? "✓" : "!"}</span>
                {r.label}
                <div className="p-chk-d">
                  {r.detail}{r.note ? ` · ${r.note}` : ""}
                  {r.warn ? <> — <em>{r.warn}</em></> : null}
                </div>
              </td>
              <td className={"p-chk" + (r.ok ? "" : " bad")}>{r.value}</td>
            </tr>
          ))}
        </tbody></table>

        {/* Per-MPPT-input compliance matrix — a real inverter-design report's
            level of detail: peak power on that input, and each electrical
            limit (voltage ceiling AND floor, current) checked against the
            SAME real inverter rating the summary check above already used.
            Every figure here comes from stringInputs() in lib/designCheck.js,
            so the annex above and this table can never disagree. Without a
            real inverter matched, there's no per-input rating to check
            against, so this only shows the bare split once there's actually
            more than one input to name. */}
        {mpptInputs.length > 0 && (hasRealInverter || mpptInputs.length > 1) && (
          <>
            <h3>{tr("pdf_mppt_h")}</h3>
            <table><tbody>
              <tr>
                <th></th>
                {mpptInputs.map((r) => <th key={r.label}>{tr("pdf_input_n", { n: r.label })}</th>)}
              </tr>
              <tr>
                <td>{tr("pdf_strings")}</td>
                {mpptInputs.map((r) => <td key={r.label}>{r.strings} × {r.modulesPerString}</td>)}
              </tr>
              {hasRealInverter && (
                <tr>
                  <td>{tr("pdf_peak_input")}</td>
                  {mpptInputs.map((r) => <td key={r.label}>{r.peakKw.toFixed(2)} kWp</td>)}
                </tr>
              )}
              <tr>
                <td>{tr("pdf_vstring")}</td>
                {mpptInputs.map((r) => (
                  <td key={r.label} className={r.vocOk ? "" : "p-chk bad"}>
                    {Math.round(r.vString)} / {r.maxDcV} V
                  </td>
                ))}
              </tr>
              {hasRealInverter && mpptInputs[0].vmppOk !== null && (
                <tr>
                  <td>{tr("pdf_vmpp_hot")}</td>
                  {mpptInputs.map((r) => (
                    <td key={r.label} className={r.vmppOk ? "" : "p-chk bad"}>
                      {Math.round(r.vmppHotActual)} / {r.minMpptV} V
                    </td>
                  ))}
                </tr>
              )}
              {hasRealInverter && mpptInputs[0].maxInputCurrentA !== null && (
                <tr>
                  <td>{tr("pdf_isc_input")}</td>
                  {mpptInputs.map((r) => (
                    <td key={r.label} className={r.currentOk ? "" : "p-chk bad"}>
                      {r.iscTotalA.toFixed(1)} / {r.maxInputCurrentA} A
                    </td>
                  ))}
                </tr>
              )}
            </tbody></table>
          </>
        )}
      </section>

      {/* 4 — what the exported surplus actually earns, from the operator's own
          published table: a figure the client can look up and verify. */}
      {buyback && (
        <section>
          <h2><span className="p-n">5</span>{tr("pdf_surplus_h")}</h2>
          <p className="p-note" style={{ marginBottom: 7 }}>{tr("pdf_surplus_cap")}</p>
          <BuybackSVG seasonal={buyback.seasonal} weighted={buyback.weightedMdl} lang={lang} />
          <div className="p-eco" style={{ marginTop: 8 }}>
            <div><b>{buyback.weightedMdl.toFixed(2)} lei</b><span>{tr("pdf_sp_weighted")}</span></div>
            <div><b>{buyback.flatMdl.toFixed(2)} lei</b><span>{tr("pdf_sp_flat")}</span></div>
            <div><b>{Math.round(buyback.surplus.totalKwh).toLocaleString(loc)} kWh</b><span>{tr("pdf_sp_exported")}</span></div>
            <div><b>{lei(buyback.surplus.mdl)}</b><span>{tr("pdf_sp_revenue")} · {fmt(buyback.surplus.eur)}</span></div>
          </div>
          {battKwh > 0 && (
            <div className="p-spread">
              <b>{buyback.spread.spreadMdl.toFixed(2)} lei</b>
              {tr("pdf_sp_spread", {
                r: buyback.spread.retailMdl.toFixed(2),
                b: buyback.spread.buybackMdl.toFixed(2),
                p: Math.round(buyback.spread.sharePct),
              })}
            </div>
          )}
          <div className="p-src">{BUYBACK_SOURCE.operator} — {tr("pdf_sp_src")}</div>
        </section>
      )}

      <section>
        <h2><span className="p-n">{buyback ? 6 : 5}</span>{tr("pdf_eco_h")}</h2>
        <div className="p-eco">
          <div><b>{Math.round(co2Year).toLocaleString(loc)} kg</b><span>{co2(tr("pdf_co2_year"))}</span></div>
          <div><b>{co2Life.toFixed(1)} t</b><span>{co2(tr("pdf_co2_life", { n: hz }))}</span></div>
          <div><b>{trees}</b><span>{tr("pdf_trees")}</span></div>
          <div><b>{carKm.toLocaleString(loc)} km</b><span>{tr("pdf_car")}</span></div>
        </div>
      </section>

      {/* What happens next, and how long this price holds. */}
      <section>
        <h2><span className="p-n">{buyback ? 7 : 6}</span>{tr("pdf_next_h")}</h2>
        <ol className="p-steps">
          <li>{tr("pdf_step1")}</li>
          <li>{tr("pdf_step2")}</li>
          <li>{tr("pdf_step3")}</li>
          <li>{tr("pdf_step4")}</li>
        </ol>
        <div className="p-valid">{tr("pdf_valid", { d: validUntil })}</div>
        {/* Only shown from 3 up: "1 system already installed" undersells a new
            installer more than saying nothing does. */}
        {company.wonCount >= 3 && (
          <div className="p-proof">{tr("pdf_installed", { n: company.wonCount, co: company.name })}</div>
        )}
      </section>

      {/* Back matter: reference the client can check, deliberately quieter than
          the selling content — it used to sit mid-document competing with it. */}
      <div className="p-annex">
        <section>
          <h2>{tr("pdf_assump_h")}</h2>
          <table><tbody>
            <tr><td>{tr("as_yield_exp")}</td><td>{tr("as_yield_v", { n: Math.round(q.yieldPerKwp || E.baseYield) })}</td></tr>
            <tr><td>{tr("as_export_scheme")}</td><td>{tr("pdf_scheme_v", { s: mktLine, f: mkt.feed })}</td></tr>
            {/* "8%" alone reads to a homeowner as "only 8% of my needs are met", when
                it means 8% of PRODUCTION is used on site — often while 100% of their
                own consumption is covered. State both so it can't be misread. */}
            <tr><td>{tr("as_selfcons")}</td><td>
              {Math.round((q.self || 0) * 100)}%{inputs.batt ? " " + tr("as_with_batt") : ""}
              {Number(inputs.cons) > 0 && (
                <> — {tr("as_covers", { n: Math.round(Math.min(1, ((q.self || 0) * (q.prod0 || 0)) / Number(inputs.cons)) * 100) })}</>
              )}
            </td></tr>
            <tr><td>{tr("as_cost_basis")}</td><td>{tr("pdf_cost_v", { c: E.costPerKw, b: E.batteryCost, o: E.opexPct })}</td></tr>
            <tr><td>{tr("pdf_horizon")}</td><td>{tr("as_horizon_v", { n: hz })}</td></tr>
            <tr><td>{co2(tr("pdf_co2_factor"))}</td><td>{mkt.co2} kg/kWh</td></tr>
          </tbody></table>
        </section>
      </div>

      {/* One atomic block, not two. These were separate divs that could split
          across a page boundary independently — on a quote where the back
          matter landed near the bottom of a page, the "prepared by" line fit
          but the bare company-name line after it didn't, leaving it stranded
          alone on a nearly blank trailing page. */}
      <div className="p-foot">
        {preparedBy?.name && (
          <div>{tr("pp_prepared_by")} {preparedBy.name}{preparedBy.phone ? " · " + preparedBy.phone : ""} · {company.name}</div>
        )}
        <div style={preparedBy?.name ? { marginTop: 3 } : undefined}>
          {company.name}{company.plan === "free" ? <> · {tr("pdf_foot")} · voltmira.com</> : null}
        </div>
      </div>
    </div>
  );
}
