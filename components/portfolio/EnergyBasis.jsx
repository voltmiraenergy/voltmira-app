// components/portfolio/EnergyBasis.jsx — the tables behind a solar plant's
// energy figures: how the P90 is built (each part, its size and whether it is
// measured at the site or assumed, lib/p90Budget.js) and the losses PVGIS
// reports between the sun on the panels and the energy delivered. Plain
// markup, no state: used in the report, and in the plant editor.
import { plt } from "../../lib/plantText.js";
import { num, dscr } from "../../lib/portfolioFormat.js";
import { weakest } from "../../lib/weatherReplay.js";
import { replayLine, monthlyLine, monthName } from "../../lib/energyBasis.js";

const PART_KEY = { ghi: "p90_ghi", weather: "p90_weather", model: "p90_model", soiling: "p90_soiling", availability: "p90_availability", shading: "p90_shading", lid: "p90_lid" };

/** @param {{ solar: object|null, lang: string, className?: string, heading?: boolean }} p  solar = plantEnergy().solar */
export function P90Basis({ solar, lang = "en", className = "rp-t", heading = true }) {
  if (!solar || !(solar.p50Mwh > 0)) return null;
  const H = heading ? "h3" : "div";
  if (!solar.budget) {
    // a study's own P50 and P90 set the spread
    return (
      <>
        {heading && <H className="rp-sub">{plt("p90_h", lang)}</H>}
        <p className="rp-small">{plt("p90_study", lang, { x: num(solar.sigmaPct, lang, 1) })}</p>
      </>
    );
  }
  const b = solar.budget;
  const site = b.parts.find((p) => p.source === "site");
  return (
    <>
      {heading && <H className="rp-sub">{plt("p90_h", lang)}</H>}
      <p className="rp-small">{plt("p90_p", lang)}</p>
      <table className={className}>
        <thead><tr><th>{plt("p90_col_part", lang)}</th><th className="r">{plt("p90_col_pct", lang)}</th><th>{plt("p90_col_basis", lang)}</th></tr></thead>
        <tbody>
          {b.parts.map((p) => (
            <tr key={p.id}>
              <td>{plt(PART_KEY[p.id], lang)}</td>
              <td className="r">{num(p.pct, lang, 1)}</td>
              <td>{p.source === "site" ? plt("p90_site", lang, { db: p.db, years: p.years }) : plt("p90_assumed", lang)}</td>
            </tr>
          ))}
          <tr><td><b>{plt("p90_total", lang)}</b></td><td className="r"><b>{num(b.totalPct, lang, 1)}</b></td><td /></tr>
        </tbody>
      </table>
      <p className="rp-small">{site ? plt("p90_note_site", lang, { db: site.db, years: site.years }) : plt("p90_note_assumed", lang)}</p>
    </>
  );
}

/** The loan's cover on the weakest weather years on record. @param {{ replay: object|null, lang: string }} p  replay = weatherReplay() */
export function WeatherReplay({ replay, lang = "en", className = "rp-t", heading = true }) {
  if (!replay) return null;
  return (
    <>
      {heading && <h3 className="rp-sub">{plt("wr_h", lang)}</h3>}
      <p className="rp-small">{replayLine(replay, lang)}.</p>
      <p className="rp-small">{plt("wr_p", lang)}</p>
      <table className={className}>
        <thead><tr><th>{plt("wr_col_year", lang)}</th><th className="r">{plt("wr_col_sun", lang)}</th><th className="r">{plt("wr_col_dscr", lang)}</th></tr></thead>
        <tbody>
          {weakest(replay, 5).map((x) => (
            <tr key={x.y}><td>{x.y}</td><td className="r">{num(x.pct, lang, 1)}</td><td className="r">{x.dscrMin == null ? "-" : dscr(x.dscrMin, lang)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="rp-small">{plt("wr_note", lang)}</p>
    </>
  );
}

/** The loan's cover month by month in its leanest year. @param {{ mc: object|null, lang: string, money: object }} p  mc = monthlyCover() */
export function SeasonalCover({ mc, lang = "en", money, className = "rp-t", heading = true }) {
  if (!mc) return null;
  const eur = (v) => `${money.full(v)} ${money.cur}`;
  return (
    <>
      {heading && <h3 className="rp-sub">{plt("mc_h", lang)}</h3>}
      <p className="rp-small">{monthlyLine(mc, lang, eur)}.</p>
      <p className="rp-small">{plt("mc_p", lang)}</p>
      <div className="pf-scroll">
        <table className={className + " mc-t"}>
          <thead><tr><th />{mc.months.map((x) => <th key={x.m} className="r">{monthName(x.m, lang, true)}</th>)}</tr></thead>
          <tbody>
            <tr><td>{plt("mc_row_cfads", lang)}</td>{mc.months.map((x) => <td key={x.m} className="r">{money.compact(x.cfads)}</td>)}</tr>
            <tr><td>{plt("mc_row_ds", lang)}</td>{mc.months.map((x) => <td key={x.m} className="r">{money.compact(x.ds)}</td>)}</tr>
            <tr><td><b>{plt("mc_row_cover", lang)}</b></td>{mc.months.map((x) => <td key={x.m} className={"r" + (x.cover != null && x.cover < 1 ? " mc-low" : "")}><b>{x.cover == null ? "-" : dscr(x.cover, lang)}</b></td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="rp-small">{plt("mc_note", lang)}</p>
    </>
  );
}

/** PVGIS's loss breakdown; nothing when the plant has none stored. @param {{ losses: object|null, lang: string }} p */
export function YieldLosses({ losses, lang = "en", className = "rp-t" }) {
  if (!losses || losses.total == null) return null;
  const rows = [["yl_aoi", losses.aoi], ["yl_spec", losses.spectral], ["yl_temp", losses.tempIrr], ["yl_sys", losses.system == null ? null : -losses.system], ["yl_total", losses.total]]
    .filter(([, v]) => v != null);
  const sign = (v) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${num(Math.abs(v), lang, 2)}`;
  return (
    <>
      <h3 className="rp-sub">{plt("yl_h", lang)}</h3>
      <table className={className}>
        <tbody>
          {rows.map(([k, v]) => (k === "yl_total"
            ? <tr key={k}><td><b>{plt(k, lang)}</b></td><td className="r"><b>{sign(v)}%</b></td></tr>
            : <tr key={k}><td>{plt(k, lang)}</td><td className="r">{sign(v)}%</td></tr>))}
        </tbody>
      </table>
      <p className="rp-small">{plt("yl_src", lang)}</p>
    </>
  );
}
