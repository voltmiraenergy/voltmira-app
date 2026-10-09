// components/portfolio/SiteLayoutPlan.jsx — the site layout of a plant for the
// printed documents, where scripts are blocked: aerial tile images framed
// exactly on the plant (lib/portfolioMap.js fitView, a fractional zoom) with
// an SVG on top drawing the plot boundary, the panel tables in rows, the
// inverter stations, the medium-voltage cable, the wind turbines with their
// keep-out circles and collector cable, and the grid connection point, with a
// scale bar, a north arrow and a legend, and the figures beside it
// (lib/siteLayout.js, lib/windLayout.js, lib/plantLayout.js). Used as a page
// of the credit summary, inside each plant of the report, and on the plant's
// card. Server-renderable; nothing for a plant with no plot.
import { fitView } from "../../lib/portfolioMap.js";
import { layoutFor } from "../../lib/plantLayout.js";
import { moduleSides } from "../../lib/siteLayout.js";
import { plt } from "../../lib/plantText.js";
import { num } from "../../lib/portfolioFormat.js";

const SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const COLOR = { excl: "#E5484D", plot: "#FFD54A", table: "#1E3A5F", tableLine: "#CFE3FF", cable: "#FF9F1C", station: "#D946EF", conn: "#E11D48", turbine: "#38BDF8", rotor: "#0B2540" };
const NICE = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
const LABEL = { fontSize: "10", fontWeight: "700", fill: "#ffffff", stroke: "#1B1B1B", strokeWidth: "2.4", paintOrder: "stroke", fontFamily: "sans-serif" };

/** The figures of a layout as label and value pairs. */
export function layoutFacts(lay, lang = "en", declaredMwp = null) {
  const s = lay.result.stats;
  const f = (v, d = 1) => num(v, lang, d);
  const rows = [
    [plt(s.turbinesPlaced ? "ly_k_field" : "ly_k_plot", lang), `${f(s.plotHa)} ha`],
    [plt("ly_k_tables", lang), plt("ly_v_tables", lang, { tables: f(s.placedTables, 0), per: f(s.modulesPerTable, 0), mods: f(s.modulesPlaced, 0) })],
    ...(declaredMwp > 0 ? [[plt("ly_k_decl", lang), `${f(declaredMwp, 2)} MWp`]] : []),
    [plt("ly_k_cap", lang), `${f(s.mwpPlaced, 2)} MWp`],
    [plt("ly_k_fit", lang), `${f(s.mwpFit, 2)} MWp`],
    [plt("ly_k_pitch", lang), plt("ly_v_pitch", lang, { pitch: f(s.pitchM), gcr: f(s.gcr, 2) })],
  ];
  if (s.plotCount > 1) rows.push([plt("ly_k_plots", lang), plt("ly_v_plots", lang, { n: f(s.plotCount, 0), m: f(s.linkM, 0) })]);
  if (lay.result.stations.length) rows.push([plt("ly_k_cable", lang), plt("ly_v_cable", lang, { m: f(s.cableM, 0), n: f(lay.result.stations.length, 0) })]);
  if (s.needTurbines > 0) {
    rows.push([plt("ly_k_turbines", lang), plt("ly_v_turbines", lang, {
      n: f(s.turbineCount, 0), need: f(s.needTurbines, 0), d: f(s.rotorM || 0, 0), r: f(s.keepoutRadiusM || 0, 0), c: f(s.windCableM || 0, 0),
    })]);
  }
  return rows;
}

/** The sentence under the heading: what is drawn, or why the plot is too small. */
export function layoutLead(pl, lay, lang = "en") {
  const s = lay.result.stats;
  const f = (v, d = 1) => num(v, lang, d);
  if (s.short) return plt("ly_short", lang, { ha: f(s.plotHa), fit: f(s.mwpFit, 2), need: f(s.mwpNeed, 2) });
  const base = plt(s.tracker ? "ly_lead_tracker" : "ly_lead", lang, {
    mwp: f(s.mwpPlaced, 2), tables: f(s.placedTables, 0), mods: f(s.modulesPerTable, 0), ha: f(s.plotHa), pitch: f(s.pitchM), tilt: f(s.tiltDeg, 0), gcr: f(s.gcr, 2),
    n: f(lay.result.stations.length, 0), cable: f(s.cableM, 0),
  });
  if (!(s.needTurbines > 0)) return base;
  const tv = { n: f(s.turbineCount, 0), need: f(s.needTurbines, 0), d: f(s.rotorM || 0, 0), r: f(s.keepoutRadiusM || 0, 0), c: f(s.windCableM || 0, 0) };
  const key = s.turbinesShort ? "ly_turbines_short_line" : s.turbinesPlaced ? "ly_turbines_line_flank" : "ly_turbines_line";
  return `${base} ${plt(key, lang, tv)}`;
}

/** Whether the plant has a layout to print. @param {object} pl  a normalised plant */
export const hasLayout = (pl) => { const l = layoutFor(pl); return !!(l.result && l.result.tables.length > 0); };

/** A wind turbine seen from above: three blades round a hub, the size of a symbol, not to scale. */
function TurbineMark({ x, y, n }) {
  const blade = (deg) => {
    const a = (deg * Math.PI) / 180, L = 9, W = 2.2;
    const tx = x + Math.cos(a) * L, ty = y + Math.sin(a) * L;
    const nx = -Math.sin(a) * W, ny = Math.cos(a) * W;
    return `${(x + nx).toFixed(1)},${(y + ny).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} ${(x - nx).toFixed(1)},${(y - ny).toFixed(1)}`;
  };
  return (
    <g>
      {[-90, 30, 150].map((d) => <polygon key={d} points={blade(d)} fill={COLOR.rotor} stroke="#ffffff" strokeWidth="1.1" strokeLinejoin="round" />)}
      <circle cx={x} cy={y} r="3.2" fill="#ffffff" stroke={COLOR.rotor} strokeWidth="1.4" />
      <text x={x + 10} y={y - 8} {...LABEL}>{`T${n}`}</text>
    </g>
  );
}

export default function SiteLayoutPlan({ pl, lang = "en", width = 720, height = 470, heading = true }) {
  const lay = layoutFor(pl);
  if (!lay.result || !lay.result.tables.length) return null;
  const r = lay.result;
  const s = r.stats;
  // frame the whole plant and nothing else: the plots, each turbine's keep-out circle, the cables and the connection point
  const pts = [
    ...pl.layout.plots.flat(), ...r.turbines.flatMap((t) => t.exclusion), ...(r.windCables || []).flat(), [r.connection.lat, r.connection.lon],
  ].map(([lat, lon]) => ({ lat, lon }));
  const v = fitView(pts, { width, height, pad: 16, maxZoom: 19, tiles: { base: SAT, ref: SAT } });
  if (!v) return null;
  const xy = v.xy;
  const poly = (cs) => cs.map((c) => xy(c[0], c[1]).map((n) => n.toFixed(1)).join(",")).join(" ");
  const barM = NICE.find((m) => m / v.mpp >= 70) || NICE[NICE.length - 1];
  const barPx = barM / v.mpp;
  const [cx, cy] = xy(r.connection.lat, r.connection.lon);
  const label = plt("ly_h_doc", lang);
  return (
    <>
      {heading && <h3 className="rp-sub">{label}</h3>}
      <p className="rp-small">{layoutLead(pl, lay, lang)}</p>
      <div className="pf-smap gr-smap ly-plan" style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label={label}>
        {v.tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.key} src={t.src} alt="" width={256} height={256} style={{ left: (t.left / width) * 100 + "%", top: (t.top / height) * 100 + "%", width: (t.size / width) * 100 + "%" }} />
        ))}
        <svg className="gr-smap-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="lyHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill={COLOR.excl} fillOpacity="0.28" /><line x1="0" y1="0" x2="0" y2="7" stroke={COLOR.excl} strokeWidth="2" /></pattern>
          </defs>
          {r.turbines.map((t) => <polygon key={"t" + t.n} points={poly(t.exclusion)} fill={COLOR.turbine} fillOpacity="0.12" stroke={COLOR.turbine} strokeWidth="1.4" strokeDasharray="4 3" />)}
          {pl.layout.plots.map((ring, i) => <polygon key={"p" + i} points={poly(ring)} fill={COLOR.plot} fillOpacity="0.06" stroke={COLOR.plot} strokeWidth="2.2" strokeLinejoin="round" />)}
          {pl.layout.exclusions.map((e, i) => <polygon key={"x" + i} points={poly(e.ring)} fill="url(#lyHatch)" stroke={COLOR.excl} strokeWidth="1.6" strokeDasharray="5 3" />)}
          {r.tables.map((t, i) => <polygon key={i} points={poly(t.corners)} fill={COLOR.table} fillOpacity="0.95" stroke={COLOR.tableLine} strokeWidth="0.4" />)}
          {(r.windCables || []).map((c, i) => <polyline key={"w" + i} points={poly(c)} fill="none" stroke={COLOR.cable} strokeWidth="2" strokeDasharray="6 3" strokeLinejoin="round" />)}
          {r.cables.map((c, i) => <polyline key={i} points={poly(c)} fill="none" stroke={COLOR.cable} strokeWidth="2" strokeDasharray="6 3" strokeLinejoin="round" />)}
          {r.stations.map((st) => {
            const [x, y] = xy(st.center[0], st.center[1]);
            return (
              <g key={st.n}>
                <rect x={x - 5} y={y - 3.5} width="10" height="7" fill={COLOR.station} stroke="#ffffff" strokeWidth="1" />
                <text x={x + 7} y={y - 6} {...LABEL}>{st.n}</text>
              </g>
            );
          })}
          {r.turbines.map((t) => { const [x, y] = xy(t.lat, t.lon); return <TurbineMark key={"tm" + t.n} x={x} y={y} n={t.n} />; })}
          <rect x={cx - 6} y={cy - 6} width="12" height="12" fill={COLOR.conn} stroke="#ffffff" strokeWidth="1.8" />
          <g transform={`translate(${width - 26} 34)`}>
            <polygon points="0,-18 7,6 0,1 -7,6" fill="#ffffff" stroke="#1B1B1B" strokeWidth="1.2" />
            <text x="0" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff" stroke="#1B1B1B" strokeWidth="2.4" paintOrder="stroke" fontFamily="sans-serif">{plt("ly_north", lang)}</text>
          </g>
          <g transform={`translate(14 ${height - 22})`}>
            <rect x="-6" y="-12" width={barPx + 56} height="26" fill="#ffffff" fillOpacity="0.85" rx="3" />
            <line x1="0" y1="3" x2={barPx} y2="3" stroke="#1B1B1B" strokeWidth="2.4" />
            <line x1="0" y1="-3" x2="0" y2="9" stroke="#1B1B1B" strokeWidth="1.6" />
            <line x1={barPx} y1="-3" x2={barPx} y2="9" stroke="#1B1B1B" strokeWidth="1.6" />
            <text x={barPx + 8} y="7" fontSize="11" fontWeight="600" fill="#1B1B1B" fontFamily="sans-serif">{barM >= 1000 ? `${barM / 1000} km` : `${barM} m`}</text>
          </g>
        </svg>
        <small className="pf-smap-attr">{plt("ly_attr", lang)}</small>
      </div>
      <ul className="ly-legend" aria-label={label}>
        <li><i style={{ background: COLOR.table }} />{plt("ly_leg_table", lang)}</li>
        {r.turbines.length > 0 && <li><i className="ly-excl" style={{ borderColor: COLOR.turbine, background: "rgba(56,189,248,.2)" }} />{plt("ly_leg_turbine", lang)}</li>}
        <li><i style={{ background: COLOR.station }} />{plt("ly_leg_station", lang)}</li>
        <li><i style={{ background: COLOR.conn }} />{plt("ly_leg_conn", lang)}</li>
        <li><i className="ly-dash" style={{ borderColor: COLOR.cable }} />{plt("ly_leg_cable", lang)}</li>
        <li><i className="ly-line" style={{ borderColor: COLOR.plot }} />{plt(s.turbinesPlaced ? "ly_leg_field" : "ly_leg_plot", lang)}</li>
        {pl.layout.exclusions.length > 0 && <li><i className="ly-excl" style={{ borderColor: COLOR.excl, background: "rgba(229,72,77,.3)" }} />{plt("ly_leg_excl", lang)}</li>}
      </ul>
      <table className="rp-kv ly-facts"><tbody>
        {layoutFacts(lay, lang, pl.solar?.mwp).map(([k, val]) => <tr key={k}><th scope="row">{k}</th><td>{val}</td></tr>)}
      </tbody></table>
      <p className="rp-small">{plt("ly_note", lang, { sb: num(s.setbackM, lang, 0), w: num(moduleSides(lay.inputs.wp).short, lang, 2), h: num(moduleSides(lay.inputs.wp).long, lang, 2) })}{r.turbines.length > 0 ? ` ${plt("ly_note_wind", lang)}` : ""}</p>
    </>
  );
}
