"use client";
// app/(app)/portfolios/start/StartPlantForm.jsx — the guided start's form:
// four short sections, the site picked on the satellite map
// (components/portfolio/SitePicker.jsx). The action (lib/plantActions.js
// startPlantProject) answers with what is missing, named field by field, and
// keeps what was typed; once everything is there it opens the new plant.
import { useActionState, useState } from "react";
import { plt } from "../../../../lib/plantText.js";
import { pt } from "../../../../lib/portfolioText.js";
import { startPlantProject } from "../../../../lib/plantActions.js";
import SitePicker from "../../../../components/portfolio/SitePicker.jsx";

// the server action, numbered, so the form remounts with what was typed after each answer
async function run(prev, fd) {
  const r = await startPlantProject(prev, fd);
  return r ? { ...r, n: (prev?.n || 0) + 1 } : r;
}

function F({ name, label, values, hint, step = "any", required = true }) {
  return (
    <div className="field">
      <label htmlFor={"st-" + name}>{label}</label>
      <input id={"st-" + name} name={name} className="input" inputMode="decimal" step={step} defaultValue={values?.[name] ?? ""} required={required} autoComplete="off" />
      {hint && <small className="pf-hint">{hint}</small>}
    </div>
  );
}

export default function StartPlantForm({ lang = "en" }) {
  const [state, act, pending] = useActionState(run, null);
  const v = state?.values || {};
  const [site, setSite] = useState(v.lat ? { lat: Number(v.lat), lon: Number(v.lon), locality: v.locality || "" } : null);
  const [picking, setPicking] = useState(false);
  const [parts, setParts] = useState({ solar: v.hasSolar === "on" || !state, wind: v.hasWind === "on", bess: v.hasBess === "on" });
  const [kind, setKind] = useState(v.revKind || "auction");
  const errs = state?.errors || [];
  const t = (k) => plt(k, lang);

  return (
    <form key={state?.n || 0} action={act} className="st-form" noValidate>
      {errs.length > 0 && (
        <section className="card" role="alert">
          <p className="pf-warn"><b>{t("st_err_h")}</b></p>
          <ul className="st-errs">{errs.map((e) => <li key={e}>{t(e)}</li>)}</ul>
        </section>
      )}

      <section className="card">
        <div className="pl-sec-h"><h2>{t("st_site_h")}</h2><p>{t("st_site_p")}</p></div>
        <div className="pl-grid">
          <div className="field">
            <label htmlFor="st-name">{t("f_name")}</label>
            <input id="st-name" name="name" className="input" maxLength={160} defaultValue={v.name || ""} placeholder={t("new_plant_ph")} required />
          </div>
        </div>
        <input type="hidden" name="lat" value={site?.lat ?? ""} />
        <input type="hidden" name="lon" value={site?.lon ?? ""} />
        <input type="hidden" name="locality" value={site?.locality ?? ""} />
        {site && !picking && <p className="pl-line">{[site.locality, `${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}`].filter(Boolean).join("; ")}</p>}
        {picking
          ? <SitePicker id="start" mode="add" lang={lang} start={site} locality={site?.locality || ""}
              onPick={(r) => { setSite({ lat: r.lat, lon: r.lon, locality: r.locality || site?.locality || "" }); setPicking(false); }}
              onCancel={() => setPicking(false)} />
          : <button type="button" className="btn ghost" onClick={() => setPicking(true)}>{t(site ? "st_site_change" : "st_site_pick")}</button>}
      </section>

      <section className="card">
        <div className="pl-sec-h"><h2>{t("st_build_h")}</h2><p>{t("st_build_p")}</p></div>
        <div className="pl-row st-parts">
          {[["solar", "c_solar", "hasSolar"], ["wind", "c_wind", "hasWind"], ["bess", "c_bess", "hasBess"]].map(([k, label, field]) => (
            <label key={k} className="st-check">
              <input type="checkbox" name={field} checked={parts[k]} onChange={(e) => setParts((p) => ({ ...p, [k]: e.target.checked }))} />
              {t(label)}
            </label>
          ))}
        </div>
        {parts.solar && (
          <div className="pl-comp"><h4>{t("c_solar")}</h4><div className="pl-grid">
            <F name="solarMwp" label={t("sol_mwp")} values={v} />
            <F name="solarCapex" label={t("k_solar")} values={v} />
            <F name="solarOpex" label={t("k_ops")} values={v} />
          </div></div>
        )}
        {parts.wind && (
          <div className="pl-comp"><h4>{t("c_wind")}</h4><div className="pl-grid">
            <F name="windMw" label={t("w_mw")} values={v} />
            <F name="windTurbines" label={t("w_turbines")} values={v} step="1" />
            <F name="windHub" label={t("w_hub")} values={v} />
            <F name="windCapex" label={t("k_wind")} values={v} />
            <F name="windOpex" label={t("k_opw")} values={v} />
          </div></div>
        )}
        {parts.bess && (
          <div className="pl-comp"><h4>{t("c_bess")}</h4><div className="pl-grid">
            <F name="bessMw" label={t("b_mw")} values={v} />
            <F name="bessMwh" label={t("b_mwh")} values={v} />
            <F name="bessCapex" label={t("k_bess")} values={v} />
          </div></div>
        )}
        <div className="pl-grid">
          <F name="gridEur" label={t("k_grid")} values={v} hint={t("st_grid_hint")} required={false} />
        </div>
      </section>

      <section className="card">
        <div className="pl-sec-h"><h2>{t("st_rev_h")}</h2></div>
        <div className="pl-grid">
          <div className="field">
            <label htmlFor="st-revKind">{t("rev_kind")}</label>
            <select id="st-revKind" name="revKind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {["auction", "ppa", "merchant"].map((k) => <option key={k} value={k}>{t("rk_" + k)}</option>)}
            </select>
          </div>
          <F name="revPrice" label={t("rev_price")} values={v} />
          {kind !== "merchant" && <F name="revYears" label={t("rev_years")} values={v} step="1" />}
          {kind !== "merchant" && <F name="revAfter" label={t("rev_after")} values={v} required={false} />}
        </div>
      </section>

      <section className="card">
        <div className="pl-sec-h"><h2>{t("st_loan_h")}</h2><p>{t("st_loan_p")}</p></div>
        <div className="pl-grid">
          <F name="gearingPct" label={pt("f_gearing", lang)} values={v} />
          <F name="ratePct" label={pt("f_rate", lang)} values={v} />
          <F name="tenorYears" label={pt("f_tenor", lang)} values={v} step="1" />
        </div>
      </section>

      <div className="pl-row st-submit">
        <button type="submit" className="btn primary" disabled={pending}>{t("st_submit")}</button>
        {pending && <span className="pf-hint" role="status">{t("st_busy")}</span>}
      </div>
    </form>
  );
}
