"use client";
// components/portfolio/LayoutPanel.jsx — the plant's site layout in the editor:
// outline the plot on the map and the panel tables are laid out inside it
// (lib/siteLayout.js through lib/plantLayout.js), with the figures a lender
// asks for: what land the plant needs, whether the plot holds it, how many
// inverter stations and how much cable. The plot is stored on the plant
// (plant.layout.boundary) and saved with the portfolio.
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { layoutFor } from "../../lib/plantLayout.js";
import { plt } from "../../lib/plantText.js";
import { num as fnum } from "../../lib/portfolioFormat.js";

const LayoutMap = dynamic(() => import("./LayoutMap.jsx"), { ssr: false, loading: () => <div className="gr-map ly-map" /> });

export default function LayoutPanel({ id, lang = "en", raw, pl, onChange }) {
  const [drawing, setDrawing] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  // the layout is worked out again only when what it rests on changes, not on every keystroke elsewhere
  const key = JSON.stringify([pl.layout, pl.lat, pl.lon, pl.solar?.mwp, pl.solar?.acMw, pl.equipment?.modules, pl.equipment?.mounting, pl.equipment?.inverters, pl.equipment?.transformers, pl.grid?.choice, pl.grid?.at]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lay = useMemo(() => layoutFor(pl), [key]);
  const boundary = pl.layout?.boundary || (raw.layout?.boundary || []);
  const f = (v, d = 1) => fnum(v, lang, d);
  const setBoundary = (b) => onChange({ ...raw, layout: b.length ? { boundary: b } : null });
  const site = pl.lat != null && pl.lon != null ? { lat: pl.lat, lon: pl.lon } : null;

  const reason = lay.reason ? plt(lay.reason === "tracker" ? "ly_tracker" : lay.reason === "no_site" ? "ly_no_site" : "ly_no_solar", lang) : "";
  const s = lay.result?.stats;
  const assumed = [lay.assumed.wp && lay.inputs && plt("ly_assume_wp", lang, { wp: f(lay.inputs.wp, 0) }), lay.assumed.tilt && lay.inputs && plt("ly_assume_tilt", lang, { t: f(lay.inputs.tiltDeg, 0) })].filter(Boolean);

  return (
    <section className="pl-comp" aria-label={plt("ly_h", lang)}>
      <div className="pl-comp-h"><h4>{plt("ly_h", lang)}</h4></div>
      <p className="pf-hint">{plt("ly_p", lang)}</p>
      {reason && <p className="pf-hint">{reason}</p>}
      {!reason && lay.need && (
        <p className="pl-line">{plt("ly_need", lang, { ha: f(lay.need.ha), tables: f(lay.need.tables, 0), mods: f(lay.need.modulesPerTable, 0), pitch: f(lay.need.pitchM), gcr: f(lay.need.gcr, 2) })}</p>
      )}
      {!reason && assumed.length > 0 && <p className="pf-hint">{plt("ly_assume", lang, { what: assumed.join(", ") })}</p>}
      {!reason && (
        <>
          <div className="pl-row">
            <button type="button" className={"btn sm" + (drawing ? " primary" : "")} aria-pressed={drawing} onClick={() => { if (drawing) setFrameKey((k) => k + 1); setDrawing(!drawing); }}>
              {drawing ? plt("ly_done", lang) : plt(boundary.length ? "ly_edit" : "ly_draw", lang)}
            </button>
            {drawing && boundary.length > 0 && <button type="button" className="btn ghost sm" onClick={() => setBoundary(boundary.slice(0, -1))}>{plt("ly_undo", lang)}</button>}
            {boundary.length > 0 && <button type="button" className="btn ghost sm" onClick={() => { setDrawing(false); setBoundary([]); setFrameKey((k) => k + 1); }}>{plt("ly_clear", lang)}</button>}
          </div>
          {drawing && <small className="pf-hint" role="status">{plt("ly_hint", lang)}</small>}
          {site && <LayoutMap key={id} site={site} boundary={boundary} drawing={drawing} onBoundary={setBoundary} layout={lay.result} frameKey={frameKey} label={plt("ly_h", lang)} />}
          {s && !s.short && (
            <p className="pl-line ok">{plt("ly_fits", lang, { ha: f(s.plotHa), tables: f(s.placedTables, 0), mwp: f(s.mwpPlaced, 2), rows: f(s.rows, 0), n: f(lay.result.stations.length, 0), cable: f(s.cableM, 0) })}</p>
          )}
          {s && s.short && <p className="pf-warn" role="alert">{plt("ly_short", lang, { ha: f(s.plotHa), fit: f(s.mwpFit, 2), need: f(s.mwpNeed, 2) })}</p>}
        </>
      )}
    </section>
  );
}
