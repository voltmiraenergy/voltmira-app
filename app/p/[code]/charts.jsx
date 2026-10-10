// app/p/[code]/charts.jsx — the real, hand-drawn SVG charts shared between the
// print/PDF proposal (PrintSheet.jsx) and the live proposal (page.jsx). No
// charting library, same inline-SVG-geometry approach as everywhere else in
// this product. Inline hex colors, not CSS variables: the PDF is rendered with
// every script blocked and must not depend on the page's stylesheet.
//
// Colors (CHART below) were validated with the dataviz skill's
// validate_palette.js against the chart surface #FFFEFA, light mode:
//   monthly   production #1F7A55, consumption #B88746: all six checks pass
//             (worst adjacent CVD dE 9.8, normal-vision dE 20.1, both >= 3:1).
//   scenarios pessimistic #E5733A, expected #1F7A55, optimistic #3B6FB0: all
//             pass (worst adjacent CVD dE 8.6, normal-vision dE 16.1, >= 3:1).
// The scenario lines also differ by weight and dash, so color is never the
// only channel. The brand green #1E6B4E sits just under the 0.10 chroma floor,
// hence the one-step-richer #1F7A55 for marks.
import { t } from "../../../lib/i18n.js";
import { kwhUnit } from "./text.js";

export const CHART = {
  prod: "#1F7A55", cons: "#B88746",
  pess: "#E5733A", expc: "#1F7A55", opti: "#3B6FB0",
  ink: "#142A21", surface: "#FFFEFA",
  grid: "#ECE9DF", axis: "#D3CFC0", zero: "#BDB8A7", text: "#5F6B63",
};
// One dash for both side scenarios; the expected line is the solid one.
export const SIDE_DASH = "5 4";

const LOCS = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

/** Short month names in the reader's language ("Jan", "ian", "січ"), without the trailing dot. */
export function monthNames(lang) {
  // en-US for English: three letters throughout ("Sep", where en-GB writes "Sept").
  const f = new Intl.DateTimeFormat(lang === "en" ? "en-US" : LOCS[lang] || LOCS.en, { month: "short", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2026, i, 15))).replace(/\.$/, ""));
}

/** A 1 / 2 / 5 × 10ⁿ step, so an axis lands on figures people actually read. */
export function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

// A column with a rounded data end and a square foot on the baseline.
function columnPath(x, y, w, base, r) {
  const h = base - y;
  const f = (v) => v.toFixed(1);
  if (h < 1) return `M${f(x)} ${f(base)}H${f(x + w)}V${f(base - 1)}H${f(x)}Z`;
  const rr = Math.min(r, w / 2, h);
  return `M${f(x)} ${f(base)}V${f(y + rr)}Q${f(x)} ${f(y)} ${f(x + rr)} ${f(y)}H${f(x + w - rr)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + rr)}V${f(base)}Z`;
}

// Cumulative cash position across the horizon. Labels the axis in the
// client's own currency, washes the gap between the expected position and
// break-even, and marks the year the system has paid for itself.
// `narrow` draws the same chart for a phone: a 360-unit canvas shown at nearly
// 1:1, so the labels read at about 10 px instead of shrinking to 4 px, which is
// what the 720-unit desktop drawing does on a 320 px wide screen. The page
// renders both and CSS shows one; print and PDF always use the wide one.
export function CashflowSVG({ bands, cost, horizon, lang, money, narrow = false, compact = false, title = "", labelScale = 1 }) {
  // compact: the shorter drawing the two-page PDF uses.
  const [W, H, PADL0, PADR, PADT, PADB] = narrow ? [360, 230, 64, 12, 18, 30] : compact ? [720, 188, 62, 18, 14, 30] : [720, 250, 62, 18, 16, 34];
  // labelScale: the live page shows the wide drawing at about 1:1 on a desktop,
  // where the PDF's 8.5-unit labels would read at 8 px.
  const FS = (narrow ? 10.5 : 8.5) * labelScale, FS_BE = (narrow ? 11 : 9.5) * labelScale;
  const rowsP = bands.pess.rows || [], rowsE = bands.expc.rows || [], rowsO = bands.opti.rows || [];
  const all = [...rowsP, ...rowsE, ...rowsO, -cost, 0];
  const step = niceStep((Math.max(...all) - Math.min(...all)) / 4);
  const lo = Math.floor(Math.min(...all) / step) * step;
  const hi = Math.ceil(Math.max(...all) / step) * step;
  const money1 = money.compact || money;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  // Room for the longest money label ("−1,2 млн грн" is far wider than "€-4k").
  const PADL = Math.max(PADL0, Math.ceil(Math.max(...ticks.map((v) => String(money1(v)).length)) * FS * 0.56 + 12));
  const X = (i) => PADL + (i / Math.max(1, horizon - 1)) * (W - PADL - PADR);
  const Y = (v) => PADT + (1 - (v - lo) / ((hi - lo) || 1)) * (H - PADT - PADB);
  const ln = (r) => r.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const zero = Y(0);
  const be = bands.expc.payback;
  const bx = be && be > 0 ? X(be - 1) : null;
  const loc = LOCS[lang] || LOCS.en;
  const yearTicks = [1, 5, 10, 15, 20, 25].filter((y) => y <= horizon);

  // The wash between the expected position and break-even: below the line the
  // system is still paying itself back, above it every unit of money is profit.
  const area = `${ln(rowsE)} L ${X(rowsE.length - 1).toFixed(1)} ${zero.toFixed(1)} L ${X(0).toFixed(1)} ${zero.toFixed(1)} Z`;
  // One invisible column per year: hovering anywhere in it names all three values.
  const colW = (W - PADL - PADR) / Math.max(1, horizon - 1);
  const beFlip = bx !== null && bx > W - (narrow ? 130 : 150);

  return (
    <svg className="p-chart" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title || undefined}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PADL} y1={Y(v)} x2={W - PADR} y2={Y(v)} stroke={CHART.grid} strokeWidth="1" />
          <text x={PADL - 7} y={Y(v) + 3} textAnchor="end" fontSize={FS} fill={CHART.text} style={{ fontVariantNumeric: "tabular-nums" }}>{money1(v)}</text>
        </g>
      ))}
      <path d={area} fill={CHART.expc} opacity=".10" />
      <line x1={PADL} y1={zero} x2={W - PADR} y2={zero} stroke={CHART.zero} strokeWidth="1.2" />
      <path d={ln(rowsP)} fill="none" stroke={CHART.pess} strokeWidth="1.6" strokeDasharray={SIDE_DASH} strokeLinecap="round" />
      <path d={ln(rowsO)} fill="none" stroke={CHART.opti} strokeWidth="1.6" strokeDasharray={SIDE_DASH} strokeLinecap="round" />
      <path d={ln(rowsE)} fill="none" stroke={CHART.expc} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {bx !== null && (
        <g>
          <line x1={bx} y1={PADT} x2={bx} y2={H - PADB} stroke={CHART.ink} strokeOpacity=".4" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={bx} cy={zero} r="4.5" fill={CHART.ink} stroke={CHART.surface} strokeWidth="2" />
          <text x={bx + (beFlip ? -7 : 7)} y={PADT + 10} fontSize={FS_BE} fontWeight="600" fill={CHART.ink} textAnchor={beFlip ? "end" : "start"}>
            {t("pdf_breakeven", lang)}: {be.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {t("years_w", lang)}
          </text>
        </g>
      )}
      <line x1={PADL} y1={H - PADB} x2={W - PADR} y2={H - PADB} stroke={CHART.axis} strokeWidth="1" />
      {yearTicks.map((y) => (
        <text key={y} x={X(y - 1)} y={H - PADB + 8 + FS} textAnchor={narrow && y === horizon ? "end" : "middle"} fontSize={FS} fill={CHART.text}>
          {t("pdf_year_n", lang, { n: y })}
        </text>
      ))}
      {rowsE.map((v, i) => (
        <rect key={i} x={Math.max(PADL, X(i) - colW / 2)} y={PADT} width={colW} height={H - PADT - PADB} fill="#000" fillOpacity="0">
          <title>{`${t("pdf_year_n", lang, { n: i + 1 })}: ${t("expected", lang)} ${money(v)}, ${t("pessimistic", lang)} ${money(rowsP[i] ?? 0)}, ${t("optimistic", lang)} ${money(rowsO[i] ?? 0)}`}</title>
        </rect>
      ))}
    </svg>
  );
}

// Month by month: what the roof makes against what the household uses,
// answers "will it cover my winter?" in one glance. `legend={false}` drops the
// key drawn inside the picture, for a page that sets its own above the chart.
export function MonthlySVG({ prod, cons, lang, loc, narrow = false, compact = false, legend = true, title = "", labelScale = 1 }) {
  const KEY = 14;
  const [W, H0, PADL, PADR, PADT, PADB0] = narrow ? [360, 210, 38, 6, 12, 40] : compact ? [720, 176, 52, 14, 12, 34] : [720, 210, 52, 14, 14, 34];
  const FS = (narrow ? 10 : 8) * labelScale, FS_KEY = narrow ? 10.5 : 8.5, KEY_GAP = narrow ? 120 : 132;
  // Without the key the bottom band holds only the month names; larger names get a little more room.
  const extra = legend ? 0 : Math.max(0, Math.round(FS - 8));
  const H = legend ? H0 : H0 - KEY + extra, PADB = legend ? PADB0 : PADB0 - KEY + extra;
  const maxV = Math.max(...prod, ...cons, 1);
  const step = niceStep(maxV / 3);
  const hi = Math.ceil(maxV / step) * step;
  const slot = (W - PADL - PADR) / 12;
  // Two columns per month with a 2 px gap; capped so the month keeps some air.
  const bar = Math.min(narrow ? 10 : 20, (slot * 0.8 - 2) / 2);
  const groupW = bar * 2 + 2;
  const Y = (v) => PADT + (1 - v / hi) * (H - PADT - PADB);
  const base = Y(0);
  const ticks = [];
  for (let v = 0; v <= hi + 1e-9; v += step) ticks.push(v);
  const months = monthNames(lang);
  const unit = kwhUnit(lang);
  const n0 = (v) => Math.round(v).toLocaleString(loc);
  return (
    <svg className="p-chart" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title || undefined}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PADL} y1={Y(v)} x2={W - PADR} y2={Y(v)} stroke={CHART.grid} strokeWidth="1" />
          <text x={PADL - 6} y={Y(v) + 3} textAnchor="end" fontSize={FS} fill={CHART.text} style={{ fontVariantNumeric: "tabular-nums" }}>{n0(v)}</text>
        </g>
      ))}
      {prod.map((p, i) => {
        const x = PADL + slot * i + (slot - groupW) / 2;
        const c = cons[i] || 0;
        return (
          <g key={i}>
            <path d={columnPath(x, Y(p), bar, base, 4)} fill={CHART.prod} />
            <path d={columnPath(x + bar + 2, Y(c), bar, base, 4)} fill={CHART.cons} />
            <rect x={PADL + slot * i} y={PADT} width={slot} height={base - PADT} fill="#000" fillOpacity="0">
              <title>{`${months[i]}: ${t("pdf_m_prod", lang)} ${n0(p)} ${unit}, ${t("pdf_m_cons", lang)} ${n0(c)} ${unit}`}</title>
            </rect>
          </g>
        );
      })}
      <line x1={PADL} y1={base} x2={W - PADR} y2={base} stroke={CHART.axis} strokeWidth="1" />
      {months.map((m, i) => (
        <text key={i} x={PADL + slot * (i + 0.5)} y={base + 5 + FS} textAnchor="middle" fontSize={FS} fill={CHART.text}>{m}</text>
      ))}
      {legend && (
        <g>
          <rect x={PADL} y={H - 13} width="8" height="8" rx="2" fill={CHART.prod} />
          <text x={PADL + 12} y={H - 5} fontSize={FS_KEY} fill={CHART.text}>{t("pdf_m_prod", lang)}</text>
          <rect x={PADL + KEY_GAP} y={H - 13} width="8" height="8" rx="2" fill={CHART.cons} />
          <text x={PADL + KEY_GAP + 12} y={H - 5} fontSize={FS_KEY} fill={CHART.text}>{t("pdf_m_cons", lang)}</text>
        </g>
      )}
    </svg>
  );
}
