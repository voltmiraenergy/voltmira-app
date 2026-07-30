"use client";
// app/(app)/settings/page.jsx — company identity, engine numbers, billing.
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabase-browser.js";
import { openCheckout } from "../../../lib/paddle.js";
import { saveCompany } from "../../../lib/actions.js";
import { defaultEngineSettings } from "@voltmira/engine";
import { t, normLang, LANGS, LANG_NAMES } from "../../../lib/i18n.js";

/* Pro attribute: the embeddable lead widget. The snippet carries the company id;
   the widget page resolves the form language from the company automatically. */
function WidgetEmbed({ companyId, lang }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof location !== "undefined" ? location.origin : "https://voltmira.com";
  const snippet = `<iframe src="${origin}/widget?c=${companyId}" width="380" height="560" style="border:none;max-width:100%"></iframe>`;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
      <code className="embed-code" style={{ flex: "1 1 280px", whiteSpace: "nowrap" }}>{snippet}</code>
      <button className={copied ? "btn primary" : "btn ghost"}
        onClick={() => { navigator.clipboard?.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
        {copied ? t("s_copied", lang) : t("s_copy", lang)}
      </button>
    </div>
  );
}

export default function Settings() {
  const sb = supabaseBrowser();
  const [co, setCo] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    document.title = "Settings — VoltMira";
    sb.from("companies").select("*").single().then(({ data }) => setCo(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!co) return <div style={{ padding: 40, color: "var(--muted)" }}>{t("loading", "en")}</div>;

  // Full engine incl. scenario bands, with defaults filled in for any missing
  // field so the bands editor always has values to bind to.
  const DEF = defaultEngineSettings();
  const ce = co.engine || {};
  const eng = {
    ...DEF, ...ce,
    bands: {
      pess: { ...DEF.bands.pess, ...(ce.bands?.pess) },
      expc: { ...DEF.bands.expc, ...(ce.bands?.expc) },
      opti: { ...DEF.bands.opti, ...(ce.bands?.opti) },
    },
  };
  const lang = normLang(co.lang);

  async function save() {
    setMsg(t("s_saving", lang));
    try {
      await saveCompany({
        name: co.name, short_name: co.short_name, logo_url: co.logo_url,
        default_market: co.default_market, currency: co.currency, lang: normLang(co.lang),
        subsidy_amount_ron: co.subsidy_amount_ron, prosumer_limit_kw: co.prosumer_limit_kw,
        notify_open: co.notify_open !== false,
        engine: eng,
      });
      setMsg(t("s_saved", lang));
    } catch (e) {
      setMsg(e.message || "Error");
    }
  }

  async function upgrade(plan) {
    setMsg(t("checkout_opening", lang));
    try {
      const { data: { user } } = await sb.auth.getUser();
      await openCheckout({
        plan,
        email: user?.email,
        companyId: co.id,
        successUrl: (process.env.NEXT_PUBLIC_APP_URL || location.origin) + "/settings?upgraded=1",
      });
      setMsg("");
    } catch (e) {
      setMsg(e.message || t("checkout_failed", lang));
    }
  }

  const set = (k) => (e) => setCo({ ...co, [k]: e.target.value });
  const setEng = (k) => (e) => setCo({ ...co, engine: { ...eng, [k]: +e.target.value } });
  const setBand = (band, k) => (e) => setCo({
    ...co, engine: { ...eng, bands: { ...eng.bands, [band]: { ...eng.bands[band], [k]: +e.target.value } } },
  });
  const setCoNum = (k) => (e) => setCo({ ...co, [k]: +e.target.value });
  function restoreDefaults() { setCo({ ...co, engine: defaultEngineSettings() }); }

  // one number field with an optional unit suffix (demo's num() helper).
  // A CALLED function (not a <Component/>) so the <input> keeps a stable identity
  // across renders and never loses focus while typing.
  const numField = (id, label, value, step, suffix, onChange) => (
    <div className="field" key={id}>
      <label htmlFor={id}>{label}{suffix ? <span style={{ fontWeight: 400 }}> ({suffix})</span> : null}</label>
      <input className="input" id={id} type="number" step={step} value={value} onChange={onChange} />
    </div>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="page-head">
        <h1>{t("settings_title", lang)}</h1>
        <span className="sub">{t("settings_sub", lang)}</span>
      </div>
      <div className="grid-2">
        {/* left stack: identity, widget, plan */}
        <div className="stack">
          <section className="card">
            <h3>{t("company", lang)}</h3>
            <div className="field"><label>{t("s_company_name", lang)}</label>
              <input className="input" value={co.name || ""} onChange={set("name")} /></div>
            <div className="field"><label>{t("short_name", lang)}</label>
              <input className="input" value={co.short_name || ""} onChange={set("short_name")} placeholder="VoltMira" /></div>
            <div className="field"><label>{t("s_logo", lang)}</label>
              <input className="input" value={co.logo_url || ""} onChange={set("logo_url")} placeholder="https://…/logo.png" /></div>
            <div className="field"><label>{t("s_default_mkt", lang)}</label>
              <select className="input" value={co.default_market} onChange={set("default_market")}>
                <option value="RO">{t("market_ro", lang)}</option><option value="MD">{t("market_md", lang)}</option><option value="DE">{t("market_de", lang)}</option>
              </select></div>
            <div className="field"><label>{t("s_language", lang)}</label>
              <select className="input" value={normLang(co.lang)} onChange={set("lang")}>
                {LANGS.map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
              </select></div>
            <div className="field"><label>{t("s_currency", lang)}</label>
              <select className="input" value={co.currency} onChange={set("currency")}>
                <option value="EUR">{t("cur_eur", lang)}</option><option value="RON">{t("cur_ron", lang)}</option><option value="MDL">{t("cur_mdl", lang)}</option>
              </select></div>
            <label className="check" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={co.notify_open !== false}
                onChange={e => setCo({ ...co, notify_open: e.target.checked })} />
              <span className="toggle-pill" />
              <span className="txt">{t("s_notify", lang)}<small>{t("s_notify_note", lang)}</small></span>
            </label>
            <div className="set-note">{t("co_note", lang)}</div>
          </section>

          <section className="card">
            <h3>{t("s_widget", lang)}</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>{t("s_widget_note", lang)}</p>
            <WidgetEmbed companyId={co.id} lang={lang} />
          </section>

          <section className="card">
            <h3>{t("s_plan", lang)}: {co.plan}</h3>
            {co.plan === "free" ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn amber" style={{ flex: 1 }} onClick={() => upgrade("pro")}>{t("s_upgrade_pro", lang)}</button>
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => upgrade("team")}>{t("s_team", lang)}</button>
              </div>
            ) : <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>{t("s_billing_note", lang, { plan: co.plan })}</p>}
          </section>
        </div>

        {/* right: calculation engine + scenario bands */}
        <section className="card">
          <h3>{t("calc_engine", lang)}</h3>
          <div className="set-grid">
            {numField("eCost", t("e_cost", lang), eng.costPerKw, 10, "€/kW", setEng("costPerKw"))}
            {numField("eBatt", t("e_batt_kwh", lang), eng.batteryCostPerKwh ?? 500, 25, "€/kWh", setEng("batteryCostPerKwh"))}
            {numField("eYield", t("e_yield", lang), eng.baseYield, 10, t("unit_kwp_yr", lang), setEng("baseYield"))}
            {numField("eOpex", t("as_om", lang), eng.opexPct, 0.1, t("opex_unit", lang), setEng("opexPct"))}
            {numField("eHorizon", t("pdf_horizon", lang), eng.horizon, 1, t("unit_years", lang), setEng("horizon"))}
            {numField("eSubsidy", t("afm_amount", lang), co.subsidy_amount_ron, 500, null, setCoNum("subsidy_amount_ron"))}
            {numField("eSubsidyMdl", t("s_subsidy_mdl", lang), eng.subsidyAmountMdl, 500, null, setEng("subsidyAmountMdl"))}
            {numField("eProsumer", t("prosumer_limit", lang), co.prosumer_limit_kw, 0.1, null, setCoNum("prosumer_limit_kw"))}
            {numField("eValidity", t("s_validity", lang), eng.quoteValidityDays, 5, t("unit_days", lang), setEng("quoteValidityDays"))}
          </div>

          <h3 style={{ marginTop: 20 }}>{t("scenario_bands", lang)}</h3>
          <div className="set-grid">
            {numField("ePym", t("e_pym", lang), eng.bands.pess.ym, 0.01, null, setBand("pess", "ym"))}
            {numField("ePdg", t("e_pdg", lang), eng.bands.pess.degr, 0.1, t("opex_unit", lang), setBand("pess", "degr"))}
            {numField("ePin", t("e_pin", lang), eng.bands.pess.infl, 0.5, t("opex_unit", lang), setBand("pess", "infl"))}
            {numField("eOym", t("e_oym", lang), eng.bands.opti.ym, 0.01, null, setBand("opti", "ym"))}
            {numField("eOdg", t("e_odg", lang), eng.bands.opti.degr, 0.1, t("opex_unit", lang), setBand("opti", "degr"))}
            {numField("eOin", t("e_oin", lang), eng.bands.opti.infl, 0.5, t("opex_unit", lang), setBand("opti", "infl"))}
            {numField("eEdg", t("e_edg", lang), eng.bands.expc.degr, 0.1, t("opex_unit", lang), setBand("expc", "degr"))}
            {numField("eEin", t("e_ein", lang), eng.bands.expc.infl, 0.5, t("opex_unit", lang), setBand("expc", "infl"))}
          </div>

          <div className="modal-acts" style={{ marginTop: 16, alignItems: "center" }}>
            <button className="btn primary" onClick={save}>{t("save_settings", lang)}</button>
            <button className="btn ghost" onClick={restoreDefaults}>{t("restore_defaults", lang)}</button>
          </div>
          {msg && <p style={{ color: "var(--muted)", fontSize: 13, margin: "10px 0 0" }}>{msg}</p>}
        </section>
      </div>
    </div>
  );
}
