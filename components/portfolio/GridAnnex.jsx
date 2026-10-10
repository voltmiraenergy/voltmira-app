// components/portfolio/GridAnnex.jsx — the grid connection on one page, for
// the bank and for the meeting with the operator: where the plant is planned
// to connect and through how much line, the map, the options compared, what
// the route crosses, where the connection steps stand, what only the operator
// can answer, and the basis of every figure. Used as the credit summary's
// annex (app/(app)/portfolios/[id]/bank) and inside each plant of the report
// (PlantReport.jsx). Server-rendered plain HTML and SVG.
import { normalizePlant } from "../../lib/plantFinance.js";
import { chosenPoint, optionRoute } from "../../lib/gridNear.js";
import { compareOptions } from "../../lib/gridOptions.js";
import { crossingCounts, CROSS_KINDS, routeKey } from "../../lib/gridCrossings.js";
import { permitProgress } from "../../lib/plantPermits.js";
import { plt } from "../../lib/plantText.js";
import { bt } from "../../lib/bankText.js";
import { num, dscr, pct, mwhUnit } from "../../lib/portfolioFormat.js";
import { namesList } from "../../lib/portfolioDisplay.js";
import GridStaticMap from "./GridStaticMap.jsx";

export default function GridAnnex({ plant, lang, money, E, fin, scenario, groups = null, todayKey, title = true }) {
  const pl = normalizePlant(plant);
  const g = pl.grid;
  if (!g || pl.lat == null) return null;
  const cmp = compareOptions(plant, { E, fin, scenario, groups });
  const chosen = chosenPoint(g);
  const route = chosen ? g.routes[chosen.key] || null : null;
  const applied = g.applied ? cmp.options.find((o) => o.key === g.applied.key) : null;
  const eur = (v) => `${money.full(v)} ${money.cur}`;
  const nameOf = (x) => x.name || (x.place ? bt("g_near", lang, { x: x.place }) : bt("g_unnamed", lang));
  const pointName = (o) => `${bt(o.kind === "sub" ? "ax_pt_sub" : "ax_pt_line", lang, { name: nameOf(o) })}, ${o.kvAt} kV`;
  let lead;
  if (applied) {
    const r = optionRoute(g, applied);
    lead = bt("ax_lead", lang, {
      name: pl.name, point: pointName(applied), km: num(r.km, lang, 1),
      how: r.drawn ? bt("ax_drawn", lang) : bt("ax_straight", lang, { f: num(g.routeFactor, lang, 2) }),
      cost: eur(g.applied.costEur), loss: `${num(g.applied.lossPct, lang, 2)}%`, mwh: `${num(applied.loss.mwh, lang, 0)} ${mwhUnit(lang)}`,
    });
    // the route moved after the option was applied: say what it would cost now
    if (applied.costEur != null && Math.abs(applied.costEur - g.applied.costEur) > 0.005 * Math.max(1, g.applied.costEur)) {
      lead += ` ${bt("ax_stale", lang, { cost: eur(applied.costEur) })}`;
    }
  } else {
    lead = bt("ax_lead_none", lang, { cost: eur(pl.costs.gridEur) });
  }
  const counts = crossingCounts(g.crossings?.items);
  const checkedNow = g.crossings && chosen && g.crossings.key === routeKey(optionRoute(g, chosen).points || []);
  const gridRow = permitProgress(pl.permits, todayKey).rows.find((r) => r.id === "grid");
  const conductors = [...new Set(cmp.options.map((o) => `${o.kvAt} kV ${o.conductor}`))].join(", ");
  const H = title ? "h2" : "h3";
  // the rows that matter on paper: the nearest substation and line of each
  // voltage, the best option, and the one in use
  const keep = new Set([cmp.recommended, g.applied?.key, chosen?.key].filter(Boolean));
  for (const c of ["hv", "110", "35"]) {
    const s = cmp.options.filter((o) => o.cls === c && o.kind === "sub").sort((a, b) => a.km - b.km)[0];
    const l = cmp.options.filter((o) => o.cls === c && o.kind === "line")[0];
    if (s) keep.add(s.key);
    if (l) keep.add(l.key);
  }
  const rows = cmp.options.filter((o) => keep.has(o.key));
  return (
    <div className="gr-annex">
      <H className={title ? "" : "rp-sub"}>{title ? bt("ax_title", lang) : plt("grid_h", lang)}{title ? <small className="rp-dim"> {pl.name}</small> : null}</H>
      <p className="rp-lead gr-annex-lead">{lead}</p>
      <GridStaticMap grid={g} site={{ lat: pl.lat, lon: pl.lon }} chosen={chosen} route={route} width={720} height={240} label={plt("grid_map", lang)} />
      <p className="gr-legend rp-small"><span><i className="gr-k gr-k-hv" />{plt("grid_cls_hv", lang)}</span><span><i className="gr-k gr-k-110" />110 kV</span><span><i className="gr-k gr-k-35" />35 kV</span></p>

      <h3>{bt("ax_options", lang)}</h3>
      <table className="rp-t gr-annex-t"><thead><tr>
        <th>{plt("ox_col_opt", lang)}</th><th className="r">{plt("ox_col_route", lang)}<small>* {bt("ax_straight", lang, { f: num(g.routeFactor, lang, 2) })}</small></th><th>{plt("ox_col_carry", lang)}</th>
        <th className="r">{plt("ox_col_loss", lang)}</th><th className="r">{plt("ox_col_cost", lang)}, {money.cur}</th><th className="r">{plt("ox_col_effect", lang)}</th>
      </tr></thead><tbody>
        {rows.map((o) => (
          <tr key={o.key} className={(g.applied?.key === o.key ? "on " : "") + (cmp.recommended === o.key ? "best" : "")}>
            <td><i className={"gr-k gr-k-" + o.cls} />{nameOf(o)}<small>{o.kvAt} kV, {plt(o.kind === "sub" ? "grid_sub" : "grid_line", lang).toLowerCase()}
              {g.applied?.key === o.key ? `, ${plt("ox_in_use", lang).toLowerCase()}` : ""}{cmp.recommended === o.key ? `, ${plt("ox_best", lang).toLowerCase()}` : ""}</small></td>
            <td className="r nw">{num(o.route.km, lang, 1)}{o.route.drawn ? "" : "*"}</td>
            <td className="nw">{o.fits ? plt("ox_yes", lang, { cap: num(o.capacityMw, lang, 0) }) : plt("ox_no", lang, { mw: num(o.totalMw, lang, 0), cap: num(o.capacityMw, lang, 0) })}</td>
            <td className="r nw">{num(o.loss.pct, lang, 2)}%</td>
            <td className="r nw">{o.costEur != null ? money.full(o.costEur) : "-"}</td>
            <td className="r nw">{o.effect ? `${o.effect.dscrMin == null ? "-" : dscr(o.effect.dscrMin, lang)}, ${o.effect.irr == null ? "-" : pct(o.effect.irr, lang)}` : "-"}</td>
          </tr>
        ))}
      </tbody></table>

      <div className="gr-annex-3">
        <div>
          <h3>{plt("cx_h", lang)}</h3>
          {!g.crossings || !checkedNow ? <p className="rp-small">{bt("ax_not_checked", lang)}</p>
            : !g.crossings.items.length ? <p className="rp-small">{plt("cx_none", lang)}</p> : (
              <ul className="rp-list">
                {CROSS_KINDS.filter((k) => counts[k]).map((k) => (
                  <li key={k}><b>{plt("cx_" + k, lang)}</b>: {counts[k]}{" "}
                    <span className="rp-dim">{namesList(g.crossings.items.filter((x) => x.kind === k).map((x) => [x.ref, x.name].filter(Boolean).join(" ")).filter(Boolean), lang, 3)}</span></li>
                ))}
              </ul>
            )}
        </div>
        <div>
          <h3>{bt("ax_steps", lang)}</h3>
          {gridRow?.steps ? (
            <ul className="rp-list">
              {gridRow.steps.map((s) => <li key={s.id}>{plt("gs_" + s.id, lang)}: <b>{plt("ps_" + s.status, lang)}</b>{s.due ? `, ${bt("m_due", lang, { x: s.due })}` : ""}{s.overdue ? `, ${plt("p_overdue", lang)}` : ""}</li>)}
            </ul>
          ) : <p className="rp-small">{plt("pm_grid", lang)}: <b>{plt("ps_" + (gridRow?.status || "todo"), lang)}</b></p>}
        </div>
        <div>
          <h3>{bt("ax_open_h", lang)}</h3>
          <p className="rp-small">{bt("ax_open", lang)}</p>
        </div>
      </div>
      <p className="rp-small rp-foot">{bt("ax_basis", lang, { cond: conductors, date: g.fetched })}</p>
    </div>
  );
}
