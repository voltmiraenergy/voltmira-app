"use client";
// components/portfolio/GridPanel.jsx — the grid connection of one plant.
// Left, from what is near to what it means: the substations and lines around
// the site by voltage (lib/gridNear.js), the route to the chosen point (drawn
// on the map, or the straight line times the route factor), the options
// compared side by side (lib/gridOptions.js: route, capacity, losses, cost,
// effect on the deal, the best that can carry the plant), the user's costs
// and conductor per voltage, a point shared with other plants of the
// portfolio, and what the route crosses (lib/gridCrossings.js). Right, a tall
// map that stays in view while the left scrolls, with satellite, full screen
// and route drawing (GridMap.jsx). Applying an option sets the plant's grid
// cost and takes the line's losses off its energy; nothing changes until the
// user applies one. What OpenStreetMap cannot say is said beside it, and the
// data is credited.
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gridNearAt, routeCrossingsAt } from "../../lib/plantActions.js";
import { chosenPoint, optionRoute, GRID_CLASSES, ROUTE_FACTOR } from "../../lib/gridNear.js";
import { compareOptions, circuitMw, CONDUCTORS, DEFAULT_CONDUCTOR } from "../../lib/gridOptions.js";
import { routeKey, crossingCounts, CROSS_KINDS } from "../../lib/gridCrossings.js";
import { siteDrift } from "../../lib/sitePick.js";
import { normalizePlant } from "../../lib/plantFinance.js";
import { plt } from "../../lib/plantText.js";
import { namesList } from "../../lib/portfolioDisplay.js";
import { num as fnum, dscr, pct } from "../../lib/portfolioFormat.js";

const GridMap = dynamic(() => import("./GridMap.jsx"), { ssr: false, loading: () => <div className="gr-map" /> });
const today = () => new Date().toISOString().slice(0, 10);

export default function GridPanel({ id, lang = "en", raw, hasSite, money, E, fin, scenario, groups = null, onRaw }) {
  const [busy, setBusy] = useState(null);           // null | "grid" | "cross"
  const [err, setErr] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [base, setBase] = useState("plain");
  const [full, setFull] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const pl = normalizePlant(raw);
  const g = pl.grid;
  const drift = siteDrift(pl);
  const chosen = chosenPoint(g);
  const route = g && chosen ? g.routes[chosen.key] || null : null;
  const cmp = useMemo(() => (raw?.grid ? compareOptions(raw, { E, fin, scenario, groups }) : null), [raw, E, fin, scenario, groups]);
  const km = (v) => fnum(v, lang, 1);
  const eur = (v) => `${money.full(v)} ${money.cur}`;
  const clsName = (c) => plt("grid_cls_" + c, lang);
  // a point OpenStreetMap leaves unnamed is named by the village nearest to it
  const nameOf = (x) => x.name || (x.place ? plt("grid_near_place", lang, { x: x.place }) : plt("grid_unnamed", lang));
  const optName = (o) => `${nameOf(o)}, ${o.kvAt} kV${o.kind === "line" ? ` (${plt("grid_line", lang).toLowerCase()})` : ""}`;
  // full screen: the browser's own, so nothing on the page can clip it
  const sideRef = useRef(null);
  useEffect(() => {
    const on = () => { setFull(document.fullscreenElement === sideRef.current); setFrameKey((k) => k + 1); };
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  function toggleFull() {
    const el = sideRef.current;
    if (el && el.requestFullscreen && document.fullscreenEnabled) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else el.requestFullscreen().catch(() => setFull(!full));
    } else {
      setFull(!full); setTimeout(() => setFrameKey((k) => k + 1), 60);
    }
  }

  // every change goes onto the plant as it is now, not as it was when the panel rendered
  const setGrid = (fn) => onRaw((r) => ({ ...r, grid: fn({ ...(r.grid || {}) }) }));

  async function look() {
    setBusy("grid"); setErr(null);
    const r = await gridNearAt(pl.lat, pl.lon).catch(() => null);
    setBusy(null);
    if (!r || !r.ok) { setErr("grid_failed"); return; }
    // a new lookup keeps the user's figures, routes and choice
    setGrid((prev) => ({ ...r.grid, choice: prev.choice || null, routes: prev.routes || {}, costs: prev.costs, conductors: prev.conductors,
      routeFactor: prev.routeFactor, applied: prev.applied || null, shared: !!prev.shared, crossings: prev.crossings || null }));
    setFrameKey((k) => k + 1);
  }
  async function checkCrossings() {
    const pts = optionRoute(g, chosen).points;
    if (!pts) return;
    setBusy("cross"); setErr(null);
    const r = await routeCrossingsAt(pts).catch(() => null);
    setBusy(null);
    if (!r || !r.ok) { setErr("cx_failed"); return; }
    setGrid((prev) => ({ ...prev, crossings: r.crossings }));
  }
  const choose = (o) => { setDrawing(false); setGrid((prev) => ({ ...prev, choice: { kind: o.kind, id: o.id, cls: o.cls } })); };
  function apply(o) {
    const costEur = Math.round(o.costEur);
    const lossPct = Math.round(o.loss.pct * 1000) / 1000;
    onRaw((r) => ({ ...r, costs: { ...(r.costs || {}), gridEur: costEur },
      grid: { ...(r.grid || {}), choice: { kind: o.kind, id: o.id, cls: o.cls }, applied: { key: o.key, costEur, lossPct, on: today() } } }));
  }
  const setRoute = (pts) => setGrid((prev) => ({ ...prev, routes: { ...(prev.routes || {}), [chosen.key]: pts } }));
  const undoBend = () => { if (route && route.length > 2) setRoute([...route.slice(0, -2), route[route.length - 1]]); else clearRoute(); };
  function clearRoute() { setGrid((prev) => { const routes = { ...(prev.routes || {}) }; delete routes[chosen.key]; return { ...prev, routes }; }); }
  const setCost = (cls, k, v) => setGrid((prev) => ({ ...prev, costs: { ...(prev.costs || {}), [cls]: { ...(prev.costs?.[cls] || {}), [k]: v === "" ? null : +v } } }));
  const setConductor = (cls, v) => setGrid((prev) => ({ ...prev, conductors: { ...(prev.conductors || {}), [cls]: v } }));

  const rows = g ? GRID_CLASSES.map((c) => ({
    c, subs: g.substations.filter((s) => (s.classes || [s.cls]).includes(c)).slice(0, 3), line: g.lines.filter((l) => l.cls === c)[0] || null,
  })).filter((r) => r.subs.length || r.line) : [];
  const isChosen = (kind, x, cls) => chosen && chosen.kind === kind && chosen.id === x.id && chosen.cls === cls;
  const crossKey = chosen ? routeKey(optionRoute(g, chosen).points || []) : "";
  const crossOld = g?.crossings && g.crossings.key !== crossKey;
  const counts = crossingCounts(g?.crossings?.items);
  const group = chosen && groups ? groups.get(chosen.key) : null;
  const others = group ? group.members.filter((m) => m.id !== pl.id) : [];
  const chosenOpt = cmp?.options.find((o) => o.key === chosen?.key);
  const applied = g?.applied ? cmp?.options.find((o) => o.key === g.applied.key) : null;
  const anyCost = cmp?.options.some((o) => o.costEur != null);
  const r1 = chosenOpt ? optionRoute(g, chosenOpt) : null;

  return (
    <section className="gr" aria-labelledby={`gr-h-${id}`}>
      <div className="gr-top">
        <div>
          <h4 id={`gr-h-${id}`}>{plt("grid_h", lang)}</h4>
          <p className="pf-hint">{plt("grid_p", lang)}</p>
        </div>
        <button type="button" className="btn sm" disabled={!hasSite || !!busy} aria-busy={busy === "grid"} onClick={look}>
          {g ? plt("grid_again", lang) : plt("grid_find", lang)}{busy === "grid" ? "..." : ""}
        </button>
      </div>
      {!hasSite && <small className="pf-hint">{plt("f_need_site", lang)}</small>}
      {busy === "grid" && <small className="pf-hint" role="status">{plt("grid_busy", lang)}</small>}
      {err && <p className="pf-warn" role="alert">{plt(err, lang)}</p>}
      {drift.grid != null && <p className="pf-warn">{plt("grid_moved", lang, { km: km(drift.grid) })}</p>}
      {g && !rows.length && <p className="pf-hint">{plt("grid_none", lang)}</p>}

      {g && rows.length > 0 && (
        <div className="gr-body">
          <div className="gr-main">
            {/* ---- the points around the site, by voltage */}
            <div className="pf-scroll">
              <table className="pf-t gr-t">
                <thead><tr><th /><th>{plt("grid_col_point", lang)}</th><th className="r">kV</th><th className="r">{plt("grid_col_km", lang)}</th></tr></thead>
                {rows.map((r) => (
                  <tbody key={r.c}>
                    <tr className="gr-cls"><th colSpan={4} scope="colgroup"><i className={"gr-k gr-k-" + r.c} />{clsName(r.c)}</th></tr>
                    {[...r.subs.map((s) => ({ kind: "sub", x: s })), ...(r.line ? [{ kind: "line", x: r.line }] : [])].map(({ kind, x }) => {
                      const rid = `gr-${id}-${x.id}-${r.c}`;
                      return (
                        <tr key={kind + x.id} className={isChosen(kind, x, r.c) ? "on" : ""}>
                          <td><input type="radio" name={`gr-${id}`} id={rid} checked={!!isChosen(kind, x, r.c)} onChange={() => choose({ kind, id: x.id, cls: r.c })} /></td>
                          <td><label htmlFor={rid}><b>{nameOf(x)}</b><small>{plt(kind === "sub" ? "grid_sub" : "grid_line", lang)}{x.operator ? `, ${x.operator}` : ""}</small></label></td>
                          <td className="r nw">{x.kv.join("/")}</td><td className="r">{km(x.km)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>

            {/* ---- the route to the chosen point */}
            {chosenOpt && (
              <div className="gr-route">
                <p className="pl-line">{plt("rt_len", lang, { opt: optName(chosenOpt), km: km(r1.km), how: r1.drawn ? plt("rt_drawn", lang) : plt("rt_straight", lang, { f: fnum(g.routeFactor, lang, 2) }) })}</p>
                <div className="pl-row">
                  {!drawing && <button type="button" className="btn sm" onClick={() => { setDrawing(true); if (!route) setRoute([[pl.lat, pl.lon], [chosenOpt.to.lat, chosenOpt.to.lon]]); }}>{plt(route ? "rt_edit" : "rt_draw", lang)}</button>}
                  {drawing && <button type="button" className="btn primary sm" onClick={() => setDrawing(false)}>{plt("rt_done", lang)}</button>}
                  {drawing && route && route.length > 2 && <button type="button" className="btn ghost sm" onClick={undoBend}>{plt("rt_undo", lang)}</button>}
                  {route && <button type="button" className="btn ghost sm" onClick={() => { setDrawing(false); clearRoute(); }}>{plt("rt_clear", lang)}</button>}
                </div>
                {drawing && <small className="pf-hint" role="status">{plt("rt_hint", lang)}</small>}
              </div>
            )}

            {/* ---- a point other plants of the portfolio use too */}
            {others.length > 0 && chosenOpt && (
              <div className="gr-shared" role="note">
                <h5>{plt("sh_h", lang)}</h5>
                <p className="pl-line">{plt("sh_p", lang, { names: namesList(others.map((m) => m.name || "?"), lang, 3), point: optName(chosenOpt), mw: fnum(group.mw, lang, 1) })}</p>
                {!chosenOpt.fits && <p className="pf-warn">{plt("sh_over", lang, { kv: chosenOpt.kvAt, cap: fnum(chosenOpt.capacityMw, lang, 0) })}</p>}
                <label className="pk-check" htmlFor={`gr-sh-${id}`}>
                  <input id={`gr-sh-${id}`} type="checkbox" checked={g.shared} onChange={(e) => setGrid((prev) => ({ ...prev, shared: e.target.checked }))} />
                  {plt("sh_tick", lang)}
                </label>
                {chosenOpt.shareOf != null && chosenOpt.aloneEur != null && <p className="pl-line ok">{plt("sh_save", lang, { x: eur(chosenOpt.costEur), y: eur(chosenOpt.aloneEur) })}</p>}
              </div>
            )}

            {/* ---- the options compared */}
            {cmp && cmp.options.length > 0 && (
              <div className="gr-cmp">
                <h5>{plt("ox_h", lang)}</h5>
                <p className="pf-hint">{plt("ox_p", lang)}</p>
                {!anyCost && <p className="pf-warn">{plt("ox_need_costs", lang)}</p>}
                <div className="pf-scroll">
                  <table className="pf-t gr-ox">
                    <thead><tr>
                      <th>{plt("ox_col_opt", lang)}</th><th className="r">{plt("ox_col_route", lang)}</th><th>{plt("ox_col_carry", lang)}</th>
                      <th className="r">{plt("ox_col_loss", lang)}</th><th className="r">{plt("ox_col_cost", lang)}</th><th className="r">{plt("ox_col_effect", lang)}</th><th />
                    </tr></thead>
                    <tbody>
                      {cmp.options.map((o) => {
                        const best = cmp.recommended === o.key;
                        const inUse = g.applied?.key === o.key;
                        // the option in use, after its route changed: its cost or losses moved
                        const stale = inUse && o.costEur != null && (Math.abs(o.costEur - g.applied.costEur) > 0.005 * Math.max(1, g.applied.costEur) || Math.abs(o.loss.pct - g.applied.lossPct) > 0.005);
                        return (
                          <tr key={o.key} className={(o.chosen ? "on " : "") + (best ? "best" : "")}>
                            <td><i className={"gr-k gr-k-" + o.cls} /><b>{nameOf(o)}</b>
                              <small>{o.kvAt} kV, {plt(o.kind === "sub" ? "grid_sub" : "grid_line", lang).toLowerCase()}{best ? <em className="gr-best"> {plt("ox_best", lang)}</em> : null}</small></td>
                            <td className="r nw">{km(o.route.km)}<small>{o.route.drawn ? plt("ox_drawn", lang) : plt("ox_straight", lang, { f: fnum(g.routeFactor, lang, 2) })}</small></td>
                            <td className={o.fits ? "gr-yes" : "gr-no"}>{o.fits ? plt("ox_yes", lang, { cap: fnum(o.capacityMw, lang, 0) })
                              : plt("ox_no", lang, { mw: fnum(o.totalMw, lang, 0), cap: fnum(o.capacityMw, lang, 0) })}{o.othersMw > 0 ? <small>{plt("ox_with", lang)}</small> : null}</td>
                            <td className="r nw">{fnum(o.loss.pct, lang, 2)}%<small>{fnum(o.loss.mwh, lang, 0)} MWh, {eur(o.loss.eurYr)}</small></td>
                            <td className="r nw">{o.costEur != null ? eur(o.costEur) : "-"}</td>
                            <td className="r nw">{o.effect ? <>{o.effect.dscrMin == null ? "-" : dscr(o.effect.dscrMin, lang)}<small>{o.effect.irr == null ? "-" : pct(o.effect.irr, lang)}</small></> : "-"}</td>
                            <td>{inUse && stale ? <button type="button" className="btn primary sm" onClick={() => apply(o)}>{plt("ox_update", lang)}</button>
                              : inUse ? <span className="gr-inuse">{plt("ox_in_use", lang)}</span>
                              : <button type="button" className={"btn sm" + (best ? " primary" : " ghost")} disabled={!o.effect} onClick={() => apply(o)}>{plt("ox_use", lang)}</button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {applied && <p className="pl-line">{plt("ox_used", lang, { opt: optName(applied), cost: eur(g.applied.costEur), loss: `${fnum(g.applied.lossPct, lang, 2)}%` })}</p>}
                {applied && applied.costEur != null && Math.abs(applied.costEur - g.applied.costEur) > 0.005 * Math.max(1, g.applied.costEur)
                  && <p className="pf-warn">{plt("ox_stale", lang, { cost: eur(applied.costEur) })}</p>}
                <p className="pf-hint">{plt("ox_note", lang)}</p>
              </div>
            )}

            {/* ---- the user's figures per voltage */}
            <div className="gr-costs">
              <h5>{plt("cs_h", lang)}</h5>
              <div className="pf-scroll">
                <table className="pf-t gr-ct">
                  <thead><tr><th /><th>{plt("cs_perkm", lang)}</th><th>{plt("cs_sub", lang)}</th><th>{plt("cs_tap", lang)}</th><th>{plt("cs_cond", lang)}</th></tr></thead>
                  <tbody>
                    {GRID_CLASSES.map((c) => (
                      <tr key={c}>
                        <th scope="row"><i className={"gr-k gr-k-" + c} />{clsName(c)}</th>
                        {["perKm", "sub", "tap"].map((k) => (
                          <td key={k}><input className="input" type="number" inputMode="decimal" min="0" step="1000" aria-label={`${clsName(c)}: ${plt("cs_" + (k === "perKm" ? "perkm" : k), lang)}`}
                            value={raw.grid?.costs?.[c]?.[k] ?? ""} onChange={(e) => setCost(c, k, e.target.value)} /></td>
                        ))}
                        <td>
                          <select className="input" aria-label={`${clsName(c)}: ${plt("cs_cond", lang)}`} value={raw.grid?.conductors?.[c] || DEFAULT_CONDUCTOR[c]} onChange={(e) => setConductor(c, e.target.value)}>
                            {Object.keys(CONDUCTORS).map((k) => <option key={k} value={k}>{k}, {fnum(circuitMw(c === "hv" ? 330 : Number(c), k), lang, 0)} MW</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pl-grid">
                <div className="field">
                  <label htmlFor={`gre-rf-${id}`}>{plt("est_route", lang)}</label>
                  <input id={`gre-rf-${id}`} className="input" type="number" inputMode="decimal" step="0.05" min="1" max="3"
                    value={raw.grid?.routeFactor ?? ROUTE_FACTOR} onChange={(e) => setGrid((prev) => ({ ...prev, routeFactor: e.target.value === "" ? "" : +e.target.value }))} />
                  <small className="pf-hint">{plt("est_route_h", lang)}</small>
                </div>
              </div>
            </div>

            {/* ---- what the route crosses */}
            {chosenOpt && (
              <div className="gr-cx">
                <div className="pl-row">
                  <h5>{plt("cx_h", lang)}</h5>
                  <button type="button" className="btn sm" disabled={!!busy} aria-busy={busy === "cross"} onClick={checkCrossings}>{plt("cx_btn", lang)}{busy === "cross" ? "..." : ""}</button>
                </div>
                {busy === "cross" && <small className="pf-hint" role="status">{plt("cx_busy", lang)}</small>}
                {crossOld && <p className="pf-warn">{plt("cx_old", lang)}</p>}
                {g.crossings && !g.crossings.items.length && <p className="pl-line">{plt("cx_none", lang)}</p>}
                {g.crossings && g.crossings.items.length > 0 && (
                  <ul className="gr-cx-list">
                    {CROSS_KINDS.filter((k) => counts[k]).map((k) => (
                      <li key={k} className={"cx-" + k}>
                        <b>{plt("cx_" + k, lang)}</b> <span className="dx-count">{counts[k]}</span>
                        <small>{namesList(g.crossings.items.filter((x) => x.kind === k).map((x) => [x.ref, x.name].filter(Boolean).join(" ") || plt("cx_unnamed", lang)), lang, 4)}</small>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="pf-hint">{plt("cx_note", lang)}</p>
              </div>
            )}
          </div>

          {/* ---- the map, in view while the left scrolls */}
          <div ref={sideRef} className={"gr-side" + (full ? " full" : "")}>
            <div className="gr-tools">
              <div className="pk-base" role="group" aria-label={plt("mp_plain", lang)}>
                {["plain", "sat"].map((b) => (
                  <button key={b} type="button" className={"btn ghost sm" + (base === b ? " on" : "")} aria-pressed={base === b} onClick={() => setBase(b)}>{plt(b === "sat" ? "mp_sat" : "mp_plain", lang)}</button>
                ))}
              </div>
              <button type="button" className="btn ghost sm" onClick={() => setFrameKey((k) => k + 1)}>{plt("mp_frame", lang)}</button>
              <button type="button" className="btn ghost sm" onClick={toggleFull}>{plt(full ? "mp_exit" : "mp_full", lang)}</button>
              {full && drawing && <button type="button" className="btn primary sm" onClick={() => setDrawing(false)}>{plt("rt_done", lang)}</button>}
              {full && drawing && route && route.length > 2 && <button type="button" className="btn ghost sm" onClick={undoBend}>{plt("rt_undo", lang)}</button>}
            </div>
            <GridMap site={{ lat: pl.lat, lon: pl.lon }} substations={g.substations} lines={g.lines} paths={drift.grid == null ? g.paths : []}
              chosen={chosen} route={route} drawing={drawing} onRoute={setRoute} base={base} frameKey={frameKey}
              label={plt("grid_map", lang)} nameOf={nameOf} />
            {full && drawing && <small className="gr-full-hint">{plt("rt_hint", lang)}</small>}
            <p className="gr-legend">{GRID_CLASSES.map((c) => <span key={c}><i className={"gr-k gr-k-" + c} />{clsName(c)}</span>)}</p>
          </div>
        </div>
      )}
      {g && <p className="pf-hint">{plt("grid_caveat", lang)} {plt("grid_credit", lang, { date: g.fetched })}</p>}
    </section>
  );
}
