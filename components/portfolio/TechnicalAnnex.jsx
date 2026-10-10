// components/portfolio/TechnicalAnnex.jsx — the technical annex of a plant for
// the bank's technical adviser: the equipment it is built from (maker, model,
// count, unit rating, total against the declared capacity, warranty) and the
// site it stands on (elevation, horizon, temperature, wind and snow from public
// data, beside the loads the structure is designed for). Used as pages of the
// credit summary and inside each plant of the report. Plain markup, no state.
import { plt } from "../../lib/plantText.js";
import { num } from "../../lib/portfolioFormat.js";
import { moduleMwp, inverterMw, turbineMw, transformerMva } from "../../lib/equipment.js";

const join = (...xs) => xs.filter(Boolean).join(" ");
const dash = (v) => (v == null || v === "" ? "-" : v);

/** The rows of the equipment table, each { id, part, item, sub, count, unit, total, declared, warranty }. @param {object} pl  a normalised plant */
export function equipmentRows(pl, lang = "en") {
  const eq = pl?.equipment;
  if (!eq) return [];
  const f = (v, d = 1) => num(v, lang, d);
  const warranty = (a, b) => (a > 0 && b > 0 ? plt("eq_w_pp", lang, { p: a, q: b }) : a > 0 || b > 0 ? plt("eq_w_y", lang, { y: a || b }) : "");
  const rows = [];
  if (eq.modules) {
    const m = eq.modules, t = moduleMwp(eq);
    rows.push({ id: "modules", part: plt("eq_modules", lang), item: join(m.maker, m.model), count: m.count > 0 ? f(m.count, 0) : "", unit: m.wp > 0 ? `${f(m.wp, 0)} Wp` : "",
      total: t != null ? `${f(t, 2)} MWp` : "", declared: t != null && pl.solar?.mwp > 0 ? plt("eq_declared", lang, { x: f(pl.solar.mwp, 2), unit: "MWp" }) : "", warranty: warranty(m.productYears, m.perfYears) });
  }
  if (eq.inverters) {
    const i = eq.inverters, t = inverterMw(eq);
    rows.push({ id: "inverters", part: plt("eq_inverters", lang), item: join(i.maker, i.model), count: i.count > 0 ? f(i.count, 0) : "", unit: i.kw > 0 ? `${f(i.kw, 0)} kW` : "",
      total: t != null ? `${f(t, 2)} MW` : "", declared: t != null && pl.solar?.acMw > 0 ? plt("eq_declared", lang, { x: f(pl.solar.acMw, 2), unit: "MW" }) : "", warranty: i.years > 0 ? plt("eq_w_y", lang, { y: i.years }) : "" });
  }
  if (eq.mounting) {
    const g = eq.mounting;
    const how = g.kind === "tracker" ? plt("eq_mount_tracker", lang)
      : g.tiltDeg != null && g.azimuthDeg != null ? plt("eq_mount_fixed", lang, { t: f(g.tiltDeg, 0), a: f(g.azimuthDeg, 0) }) : plt("eq_mount_fixed_open", lang);
    rows.push({ id: "mounting", part: plt("eq_mounting", lang), item: g.maker, sub: how, count: "", unit: "", total: "", declared: "", warranty: g.years > 0 ? plt("eq_w_y", lang, { y: g.years }) : "" });
  }
  if (eq.transformers) {
    const t = eq.transformers, tot = transformerMva(eq);
    rows.push({ id: "transformers", part: plt("eq_transformers", lang), item: join(t.maker, t.ratio && `${t.ratio} kV`), count: t.count > 0 ? f(t.count, 0) : "", unit: t.mva > 0 ? `${f(t.mva, 1)} MVA` : "",
      total: tot != null ? `${f(tot, 1)} MVA` : "", declared: "", warranty: t.years > 0 ? plt("eq_w_y", lang, { y: t.years }) : "" });
  }
  if (eq.turbines) {
    const w = eq.turbines, tot = turbineMw(eq);
    rows.push({ id: "turbines", part: plt("eq_turbines", lang), item: join(w.maker, w.model), count: w.count > 0 ? f(w.count, 0) : pl.wind ? f(pl.wind.turbines, 0) : "", unit: w.mw > 0 ? `${f(w.mw, 1)} MW` : "",
      total: tot != null ? `${f(tot, 1)} MW` : "", declared: tot != null && pl.wind?.mw > 0 ? plt("eq_declared", lang, { x: f(pl.wind.mw, 1), unit: "MW" }) : "", warranty: w.years > 0 ? plt("eq_w_y", lang, { y: w.years }) : "" });
  }
  if (eq.storage) {
    const s = eq.storage;
    rows.push({ id: "storage", part: plt("eq_storage", lang), item: join(s.maker, s.model), sub: s.chemistry, count: "", unit: pl.bess ? `${f(pl.bess.mw, 1)} MW / ${f(pl.bess.mwh, 1)} MWh` : "", total: "", declared: "", warranty: s.years > 0 ? plt("eq_w_y", lang, { y: s.years }) : "" });
  }
  return rows;
}

/** The rows of the site table, each { id, q, pub, design }; rows with nothing in either column are left out. @param {object} pl  a normalised plant */
export function siteRows(pl, lang = "en") {
  const c = pl?.climate, d = pl?.equipment?.design;
  const f = (v, k = 1) => num(v, lang, k);
  const out = [];
  const add = (id, q, pub, design) => { if (pub || design) out.push({ id, q: plt(q, lang), pub: pub || "", design: design || "" }); };
  add("elev", "cl_elev", c && c.elevationM != null ? plt("cl_v_elev", lang, { m: f(c.elevationM, 0) }) : "", "");
  add("horizon", "cl_horizon", c && c.horizonMaxDeg != null ? plt("cl_v_horizon", lang, { max: f(c.horizonMaxDeg), south: f(c.horizonSouthMaxDeg ?? 0) }) : "", "");
  const tempPub = c && c.tMinC != null && c.tMaxC != null
    ? (c.hotDays != null && c.frostDays != null ? plt("cl_v_temp", lang, { min: f(c.tMinC), max: f(c.tMaxC), hot: f(c.hotDays), frost: f(c.frostDays) }) : plt("cl_v_temp_ext", lang, { min: f(c.tMinC), max: f(c.tMaxC) })) : "";
  const tempDesign = d && d.tMinC != null && d.tMaxC != null ? plt("cl_v_temp_ext", lang, { min: f(d.tMinC), max: f(d.tMaxC) }) : d && (d.tMinC != null || d.tMaxC != null) ? `${d.tMinC != null ? f(d.tMinC) : "-"} / ${d.tMaxC != null ? f(d.tMaxC) : "-"} C` : "";
  add("temp", "cl_temp", tempPub, tempDesign);
  add("wind", "cl_wind", c && c.wind10MaxMs != null ? plt("cl_v_wind", lang, { max: f(c.wind10MaxMs), avg: c.wind10AnnualMaxMs != null ? f(c.wind10AnnualMaxMs) : "-" }) : "", d && d.windMs != null ? plt("cl_d_wind", lang, { v: f(d.windMs) }) : "");
  add("snow", "cl_snow", c && c.snowDepthMaxCm != null ? plt("cl_v_snow", lang, { max: f(c.snowDepthMaxCm), avg: c.snowDepthAnnualMaxCm != null ? f(c.snowDepthAnnualMaxCm) : "-" }) : "", d && d.snowKnM2 != null ? plt("cl_d_snow", lang, { v: f(d.snowKnM2, 2) }) : "");
  add("std", "cl_std", "", d && d.standard ? d.standard : "");
  return out;
}

export function EquipmentTable({ pl, lang = "en", className = "rp-t", heading = true }) {
  const rows = equipmentRows(pl, lang);
  if (!rows.length) return null;
  return (
    <>
      {heading && <h3 className="rp-sub">{plt("ax_eq_h", lang)}</h3>}
      <table className={className + " rp-eq"}>
        <thead><tr>
          <th>{plt("eq_col_part", lang)}</th><th>{plt("eq_col_item", lang)}</th><th className="r">{plt("eq_col_count", lang)}</th>
          <th className="r">{plt("eq_col_unit", lang)}</th><th className="r">{plt("eq_col_total", lang)}</th><th>{plt("eq_col_warranty", lang)}</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><b>{r.part}</b></td>
              <td>{dash(r.item)}{r.sub ? <small>{r.sub}</small> : null}</td>
              <td className="r">{r.count}</td><td className="r">{r.unit}</td>
              <td className="r">{r.total}{r.declared ? <small>{r.declared}</small> : null}</td>
              <td>{r.warranty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rp-small">{plt("eq_note", lang)}</p>
    </>
  );
}

export function SiteClimateTable({ pl, lang = "en", className = "rp-t", heading = true }) {
  const rows = siteRows(pl, lang);
  if (!rows.length) return null;
  const c = pl.climate;
  const hasDesign = rows.some((r) => r.design);
  return (
    <>
      {heading && <h3 className="rp-sub">{plt("cl_h", lang)}</h3>}
      <table className={className + " rp-site"}>
        <thead><tr><th>{plt("cl_col_q", lang)}</th><th>{plt("cl_col_public", lang)}</th>{hasDesign && <th>{plt("cl_col_design", lang)}</th>}</tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}><td><b>{r.q}</b></td><td>{dash(r.pub)}</td>{hasDesign && <td>{dash(r.design)}</td>}</tr>)}
        </tbody>
      </table>
      {c && (c.db || c.horizonDb) && <p className="rp-small">{plt("cl_src", lang, { hdb: c.horizonDb || "-", db: c.db || "-", period: c.period || "-" })} {plt("cl_note", lang)}</p>}
      {(!c || !(c.db || c.horizonDb)) && <p className="rp-small">{plt("cl_note", lang)}</p>}
    </>
  );
}

/** Both tables; nothing for a plant with neither. */
export default function TechnicalAnnex({ pl, lang = "en", className = "rp-t", heading = true }) {
  return (
    <>
      <EquipmentTable pl={pl} lang={lang} className={className} heading={heading} />
      <SiteClimateTable pl={pl} lang={lang} className={className} heading={heading} />
    </>
  );
}

/** Whether the plant has anything for the technical annex. @param {object} pl  a normalised plant */
export const hasTechnicalAnnex = (pl) => !!(pl?.equipment?.modules || pl?.equipment?.inverters || pl?.equipment?.mounting || pl?.equipment?.transformers || pl?.equipment?.turbines || pl?.equipment?.storage || pl?.equipment?.design || pl?.climate);
