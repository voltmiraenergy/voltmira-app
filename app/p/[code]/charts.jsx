// app/p/[code]/charts.jsx — the real, hand-drawn SVG charts shared between the
// print/PDF proposal (PrintSheet.jsx) and the mobile/live proposal
// (page.jsx). Extracted so the mobile view gets the same real cashflow and
// monthly-production charts instead of numbers-in-cards only — no charting
// library, same inline-SVG-geometry approach as everywhere else in this
// product. Inline hex colors, not CSS variables: both call sites render
// outside AppTheme (print must not depend on custom properties; the public
// /p/[code] route never loaded AppTheme's tokens to begin with).
import { t } from "../../../lib/i18n.js";
import { MONTHS_RO } from "../../../lib/prosumerPrice.js";

/** A 1 / 2 / 5 × 10ⁿ step, so an axis lands on figures people actually read. */
export function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

// Cumulative cash position across the horizon. Labels the axis in the
// client's own currency, fills the gap between where they stand and
// break-even, and marks the year the system has paid for itself.
// `narrow` draws the same chart for a phone: a 360-unit canvas shown at nearly
// 1:1, so the labels read at about 10 px instead of shrinking to 4 px, which is
// what the 720-unit desktop drawing does on a 320 px wide screen. The page
// renders both and CSS shows one; print and PDF always use the wide one.
export function CashflowSVG({ bands, cost, horizon, lang, money, narrow = false, compact = false }) {
  // compact: the shorter drawing the two-page PDF uses.
  const [W, H, PADL, PADR, PADT, PADB] = narrow ? [360, 230, 64, 12, 18, 30] : compact ? [720, 205, 62, 18, 16, 30] : [720, 250, 62, 18, 16, 34];
  const FS = narrow ? 10.5 : 8.5, FS_BE = narrow ? 11 : 9.5;
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
          <text x={PADL - 7} y={Y(v) + 3} textAnchor="end" fontSize={FS} fill="#999">{money.compact ? money.compact(v) : money(v)}</text>
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
          <text x={bx + (bx > W - (narrow ? 130 : 150) ? -7 : 7)} y={PADT + 10} fontSize={FS_BE} fontWeight="700" fill="#C97F14"
            textAnchor={bx > W - (narrow ? 130 : 150) ? "end" : "start"}>
            {t("pdf_breakeven", lang)}: {be.toLocaleString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {t("years_w", lang)}
          </text>
        </g>
      )}
      <line x1={PADL} y1={H - PADB} x2={W - PADR} y2={H - PADB} stroke="#D8D4C6" strokeWidth="1" />
      {yearTicks.map((y) => (
        <text key={y} x={X(y - 1)} y={H - PADB + 16} textAnchor={narrow && y === horizon ? "end" : "middle"} fontSize={FS} fill="#999">
          {t("pdf_year_n", lang, { n: y })}
        </text>
      ))}
    </svg>
  );
}

// Month by month: what the roof makes against what the household uses —
// answers "will it cover my winter?" in one glance.
export function MonthlySVG({ prod, cons, lang, loc, narrow = false, compact = false }) {
  const [W, H, PADL, PADR, PADT, PADB] = narrow ? [360, 210, 38, 6, 12, 40] : compact ? [720, 176, 52, 14, 12, 34] : [720, 210, 52, 14, 14, 34];
  const FS = narrow ? 10 : 8, FS_KEY = narrow ? 10.5 : 8.5, KEY_GAP = narrow ? 120 : 132;
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
          <text x={PADL - 6} y={Y(v) + 3} textAnchor="end" fontSize={FS} fill="#999">
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
        <text key={m} x={PADL + bw * (i + 0.5)} y={H - (narrow ? 24 : 20)} textAnchor="middle" fontSize={FS} fill="#999">{m}</text>
      ))}
      <rect x={PADL} y={H - 13} width="8" height="8" rx="2" fill="#1E6B4E" opacity=".88" />
      <text x={PADL + 12} y={H - 5} fontSize={FS_KEY} fill="#777">{t("pdf_m_prod", lang)}</text>
      <rect x={PADL + KEY_GAP} y={H - 13} width="8" height="8" rx="2" fill="#C9C4B4" />
      <text x={PADL + KEY_GAP + 12} y={H - 5} fontSize={FS_KEY} fill="#777">{t("pdf_m_cons", lang)}</text>
    </svg>
  );
}
