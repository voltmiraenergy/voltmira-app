"use client";
// components/portfolio/LayoutPanel.jsx — the plant's site plan on its card: what
// land the plant needs, the button that opens the site planner (PlantDesigner,
// built like the roof designer), and once a plan is drawn, the same plan the
// credit summary prints (SiteLayoutPlan) with whether the plots hold the plant.
// The planner saves on the plant as it changes (plant.layout, and the tilt and
// facing on the equipment list) through `onSave`.
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { layoutFor } from "../../lib/plantLayout.js";
import { plt } from "../../lib/plantText.js";
import { num as fnum } from "../../lib/portfolioFormat.js";
import SiteLayoutPlan from "./SiteLayoutPlan.jsx";

const PlantDesigner = dynamic(() => import("./PlantDesigner.jsx"), { ssr: false });

export default function LayoutPanel({ lang = "en", pl, onSave }) {
  const [open, setOpen] = useState(false);
  // worked out again only when what it rests on changes, not on every keystroke elsewhere
  const key = JSON.stringify([pl.layout, pl.lat, pl.lon, pl.solar?.mwp, pl.solar?.acMw, pl.equipment?.modules, pl.equipment?.mounting, pl.equipment?.inverters, pl.equipment?.transformers, pl.grid?.choice, pl.grid?.at]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lay = useMemo(() => layoutFor(pl), [key]);
  const f = (v, d = 1) => fnum(v, lang, d);
  const reason = lay.reason ? plt(lay.reason === "tracker" ? "ly_tracker" : lay.reason === "no_site" ? "ly_no_site" : "ly_no_solar", lang) : "";
  const s = lay.result?.stats;
  const assumed = [lay.assumed.wp && lay.inputs && plt("ly_assume_wp", lang, { wp: f(lay.inputs.wp, 0) }), lay.assumed.tilt && lay.inputs && plt("ly_assume_tilt", lang, { t: f(lay.inputs.tiltDeg, 0) })].filter(Boolean);

  return (
    <section className="pl-comp" aria-label={plt("ly_h", lang)}>
      <div className="pl-comp-h"><h4>{plt("ly_h", lang)}</h4></div>
      {reason ? <p className="pf-hint">{reason}</p> : (
        <>
          {lay.need && (
            <p className="pl-line">{plt("ly_need", lang, { ha: f(lay.need.ha), tables: f(lay.need.tables, 0), mods: f(lay.need.modulesPerTable, 0), pitch: f(lay.need.pitchM), gcr: f(lay.need.gcr, 2) })}</p>
          )}
          {assumed.length > 0 && <p className="pf-hint">{plt("ly_assume", lang, { what: assumed.join(", ") })}</p>}
          <button type="button" className="ly-open" onClick={() => setOpen(true)}>
            <span className="ly-open-ic" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.7 21 9.2l-3.4 10.6H6.4L3 9.2z" /></svg>
            </span>
            <span className="ly-open-tx"><b>{plt(pl.layout ? "ly_edit" : "ly_open", lang)}</b><small>{plt("ly_open_sub", lang)}</small></span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          {s && !s.short && (
            <p className="pl-line ok">{plt("ly_fits", lang, { ha: f(s.plotHa), tables: f(s.placedTables, 0), mwp: f(s.mwpPlaced, 2), rows: f(s.rows, 0), n: f(lay.result.stations.length, 0), cable: f(s.cableM, 0) })}</p>
          )}
          {s && s.short && <p className="pf-warn" role="alert">{plt("ly_short", lang, { ha: f(s.plotHa), fit: f(s.mwpFit, 2), need: f(s.mwpNeed, 2) })}</p>}
          {lay.result && lay.result.tables.length > 0 && <div className="ly-preview"><SiteLayoutPlan pl={pl} lang={lang} heading={false} /></div>}
        </>
      )}
      {/* at the top of the app, so no card or animation around it can hold it in place: it covers the whole screen */}
      {open && createPortal(
        <PlantDesigner lang={lang} pl={pl} subtitle={[pl.name, pl.locality].filter(Boolean).join(", ")} onSave={onSave} onClose={() => setOpen(false)} />,
        document.querySelector(".app") || document.body,
      )}
    </section>
  );
}
