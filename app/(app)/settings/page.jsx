"use client";
// app/(app)/settings/page.jsx — company identity, engine numbers, billing.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase-browser.js";
import { openCheckout } from "../../../lib/paddle.js";
import { saveCompany, seedSampleData, clearSampleData, getMyRole } from "../../../lib/actions.js";
import { defaultEngineSettings } from "@voltmira/engine";
import { t, normLang, LANGS, LANG_NAMES } from "../../../lib/i18n.js";

const ST_CSS = `
.st-wrap{max-width:660px;margin:0 auto}
.st-sec{margin-bottom:16px}
.st-head{display:flex;align-items:center;gap:10px;margin-bottom:3px}
.st-head svg{flex:none}
.st-head h3{margin:0;font-size:16px}
.st-desc{font-size:12.5px;color:var(--muted);margin:0 0 16px;line-height:1.5}
.st-glabel{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600;margin:16px 0 10px}
.st-glabel.first{margin-top:0}
.st-plan-badge{font-size:11.5px;font-weight:600;background:var(--amber-tint);color:var(--amber-deep);border-radius:99px;padding:2px 10px;text-transform:capitalize}
.st-logo{width:40px;height:40px;flex:none;border-radius:9px;object-fit:contain;border:1px solid var(--line);background:var(--paper-2)}
.st-logo-ph{display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:var(--green);background:var(--green-tint)}
.st-bands{width:100%;border-collapse:collapse;min-width:380px}
.st-bands th{font-size:12px;font-weight:600;padding:0 6px 10px;text-align:center;white-space:nowrap}
.st-bands td{padding:4px 6px}
.st-bands td.rlbl{font-size:12.5px;color:var(--muted);text-align:left;padding-left:0;white-space:nowrap}
.st-bands td.locked{text-align:center;font-size:13px;color:var(--muted)}
.st-bands input{text-align:center}
.st-band-wrap{overflow-x:auto}
.st-cdot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle}
.st-savebar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--paper-2);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:11px 16px;position:sticky;bottom:14px;margin-top:6px;z-index:5}
.st-savebar .msg{font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:7px}
@media(max-width:560px){.st-savebar{position:static}}
`;

// Small inline section icons (stroke = currentColor; colour set on the parent).
const ICONS = {
  company: <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 21V9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M2 21h20" />,
  star: <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.9 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3z" />,
  code: <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13.5 6l-3 12" />,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h13M21 18h-1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="19" cy="18" r="2" /></>,
  chart: <path d="M4 20V4M4 20h16M9 20v-7M14 20V9M19 20v-4" />,
  demo: <path d="M12 3l1.7 4.9L19 9.5l-5.3 1.6L12 16l-1.7-4.9L5 9.5l5.3-1.6L12 3z" />,
};
function SecIcon({ name, color = "var(--green)" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color }} aria-hidden="true">{ICONS[name]}</svg>;
}

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
  const router = useRouter();
  const [co, setCo] = useState(null);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");
  const [isOwner, setIsOwner] = useState(true);   // default true so owners see no flash

  useEffect(() => {
    document.title = "Settings — VoltMira";
    sb.from("companies").select("*").single().then(({ data }) => setCo(data));
    getMyRole().then(r => setIsOwner(r === "owner")).catch(() => {});
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
        // company legal details for invoicing
        legal_name: co.legal_name, reg_no: co.reg_no, vat_no: co.vat_no,
        legal_address: co.legal_address, iban: co.iban, invoice_prefix: co.invoice_prefix,
        vat_rate: co.vat_rate,
        engine: eng,
      });
      setMsg(t("s_saved", lang));
      setDirty(false);
      // Re-render the shared layout (sidebar nav) and clear the client Router
      // Cache so a language change is reflected on every tab immediately, not
      // just here. Pairs with revalidatePath("/","layout") in saveCompany.
      router.refresh();
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

  async function loadDemo() {
    setDemoBusy(true); setDemoMsg(t("dd_loading", lang));
    try { await seedSampleData(); setDemoMsg(t("dd_loaded", lang)); router.refresh(); }
    catch (e) { setDemoMsg(e.message || "Error"); }
    finally { setDemoBusy(false); }
  }
  async function clearDemo() {
    if (!confirm(t("dd_clear_confirm", lang))) return;
    setDemoBusy(true);
    try { await clearSampleData(); setDemoMsg(t("dd_cleared", lang)); router.refresh(); }
    catch (e) { setDemoMsg(e.message || "Error"); }
    finally { setDemoBusy(false); }
  }

  // Logo upload: read the chosen image, downscale to 256px, and store it inline
  // as a data URL in logo_url — no storage bucket needed, works everywhere the
  // logo renders (CSP allows data: images).
  function onLogoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg(t("s_logo_bad", lang)); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        setCo(c => ({ ...c, logo_url: canvas.toDataURL("image/png") })); touch();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // Any edit marks the form dirty (drives the save bar) and clears a stale
  // "Saved" message so the two indicators never contradict each other.
  const touch = () => { setDirty(true); if (msg) setMsg(""); };
  const set = (k) => (e) => { setCo({ ...co, [k]: e.target.value }); touch(); };
  const setEng = (k) => (e) => { setCo({ ...co, engine: { ...eng, [k]: +e.target.value } }); touch(); };
  const setBand = (band, k) => (e) => { setCo({
    ...co, engine: { ...eng, bands: { ...eng.bands, [band]: { ...eng.bands[band], [k]: +e.target.value } } },
  }); touch(); };
  const setCoNum = (k) => (e) => { setCo({ ...co, [k]: +e.target.value }); touch(); };
  function restoreDefaults() { setCo({ ...co, engine: defaultEngineSettings() }); touch(); }

  // one number field with an optional unit suffix (demo's num() helper).
  // A CALLED function (not a <Component/>) so the <input> keeps a stable identity
  // across renders and never loses focus while typing.
  const numField = (id, label, value, step, suffix, onChange) => (
    <div className="field" key={id}>
      <label htmlFor={id}>{label}{suffix ? <span style={{ fontWeight: 400 }}> ({suffix})</span> : null}</label>
      <input className="input" id={id} type="number" step={step} value={value} onChange={onChange} />
    </div>
  );

  const isDataLogo = /^data:image\//i.test(co.logo_url || "");
  const hasLogo = /^(https:\/\/|data:image\/)/i.test(co.logo_url || "");
  const bandInput = (band, k, step) => (
    <input className="input" type="number" step={step} value={eng.bands[band][k]} onChange={setBand(band, k)} />
  );

  return (
    <div className="st-wrap">
      <style dangerouslySetInnerHTML={{ __html: ST_CSS }} />
      <div className="page-head">
        <h1>{t("settings_title", lang)}</h1>
        <span className="sub">{t("settings_sub", lang)}</span>
      </div>

      {/* Company profile */}
      <section className="card st-sec">
        <div className="st-head"><SecIcon name="company" /><h3>{t("company", lang)}</h3></div>
        <p className="st-desc">{t("st_company_desc", lang)}</p>
        <div className="set-grid">
          <div className="field"><label>{t("s_company_name", lang)}</label>
            <input className="input" value={co.name || ""} onChange={set("name")} /></div>
          <div className="field"><label>{t("short_name", lang)}</label>
            {/* The old placeholder was the literal string "VoltMira", which read as a
                value someone had typed rather than an example. Show a hint from the
                installer's OWN name instead, and say what the field actually does. */}
            <input className="input" value={co.short_name || ""} onChange={set("short_name")}
              placeholder={(co.name || "").trim().split(/\s+/)[0] || t("s_short_name_ph", lang)} />
            <p className="set-note" style={{ marginTop: 6 }}>{t("s_short_name_note", lang)}</p></div>
        </div>
        <div className="field"><label>{t("s_logo", lang)}</label>
          <div style={{ display: "flex", gap: 11, alignItems: "center", flexWrap: "wrap" }}>
            {hasLogo
              ? <img className="st-logo" src={co.logo_url} alt="" />
              : <span className="st-logo st-logo-ph">{(co.short_name || co.name || "?").trim()[0]?.toUpperCase() || "?"}</span>}
            {isDataLogo
              ? <span style={{ flex: 1, minWidth: 140, fontSize: 13, color: "var(--muted)" }}>{t("s_logo_uploaded", lang)}</span>
              : <input className="input" style={{ flex: 1, minWidth: 160 }} value={co.logo_url || ""} onChange={set("logo_url")} placeholder="https://…/logo.png" />}
            <label className="btn ghost" style={{ cursor: "pointer" }}>
              {t("s_logo_upload", lang)}
              <input type="file" accept="image/*" onChange={onLogoFile} style={{ display: "none" }} />
            </label>
            {hasLogo && <button type="button" className="btn ghost" onClick={() => { setCo(c => ({ ...c, logo_url: "" })); touch(); }}>{t("s_logo_remove", lang)}</button>}
          </div>
          <div className="set-note">{t("s_logo_hint", lang)}</div>
        </div>
        <div className="set-grid">
          <div className="field"><label>{t("s_default_mkt", lang)}</label>
            <select className="input" value={co.default_market} onChange={set("default_market")}>
              <option value="MD">{t("market_md", lang)}</option><option value="RO">{t("market_ro", lang)}</option>
            </select></div>
          <div className="field"><label>{t("s_language", lang)}</label>
            <select className="input" value={normLang(co.lang)} onChange={set("lang")}>
              {LANGS.map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
            </select></div>
          <div className="field"><label>{t("s_currency", lang)}</label>
            <select className="input" value={co.currency} onChange={set("currency")}>
              <option value="EUR">{t("cur_eur", lang)}</option><option value="RON">{t("cur_ron", lang)}</option><option value="MDL">{t("cur_mdl", lang)}</option>
            </select></div>
        </div>
        <label className="check" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={co.notify_open !== false}
            onChange={e => { setCo({ ...co, notify_open: e.target.checked }); touch(); }} />
          <span className="toggle-pill" />
          <span className="txt">{t("s_notify", lang)}<small>{t("s_notify_note", lang)}</small></span>
        </label>
        <div className="set-note">{t("co_note", lang)}</div>
      </section>

      {/* Invoicing — company legal details printed on proforma invoices */}
      <section className="card st-sec">
        <div className="st-head"><SecIcon name="company" /><h3>{t("s_invoicing", lang)}</h3></div>
        <div className="set-note" style={{ marginTop: -4, marginBottom: 12 }}>{t("s_invoicing_sub", lang)}</div>
        <div className="set-grid">
          <div className="field"><label>{t("s_legal_name", lang)}</label>
            <input className="input" value={co.legal_name || ""} onChange={set("legal_name")} placeholder={co.name || "SolarTech SRL"} /></div>
          <div className="field"><label>{t("s_reg_no", lang)}</label>
            <input className="input" value={co.reg_no || ""} onChange={set("reg_no")} placeholder="CUI / IDNO" /></div>
          <div className="field"><label>{t("s_vat_no", lang)}</label>
            <input className="input" value={co.vat_no || ""} onChange={set("vat_no")} placeholder="RO12345678" /></div>
          {numField("iVat", t("s_vat_rate", lang), co.vat_rate ?? 0, 1, "%", setCoNum("vat_rate"))}
          <div className="field"><label>{t("s_iban", lang)}</label>
            <input className="input" value={co.iban || ""} onChange={set("iban")} placeholder="RO49 AAAA 1B31…" /></div>
          <div className="field"><label>{t("s_inv_prefix", lang)}</label>
            <input className="input" value={co.invoice_prefix || ""} onChange={set("invoice_prefix")} placeholder="PF" maxLength={6} /></div>
        </div>
        <div className="field" style={{ marginTop: 12 }}><label>{t("s_legal_address", lang)}</label>
          <input className="input" value={co.legal_address || ""} onChange={set("legal_address")} placeholder={t("s_legal_address_ph", lang)} /></div>
        <div className="set-note">{t("s_invoicing_note", lang)}</div>
      </section>

      {/* Plan */}
      <section className="card st-sec">
        <div className="st-head"><SecIcon name="star" color="var(--amber)" /><h3>{t("s_plan", lang)}</h3>
          <span className="st-plan-badge">{co.plan}</span></div>
        {co.plan === "free" ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <button className="btn amber" style={{ flex: 1 }} onClick={() => upgrade("pro")}>{t("s_upgrade_pro", lang)}</button>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => upgrade("team")}>{t("s_team", lang)}</button>
          </div>
        ) : <p className="st-desc" style={{ margin: "8px 0 0" }}>{t("s_billing_note", lang, { plan: co.plan })}</p>}
      </section>

      {/* Website widget */}
      <section className="card st-sec">
        <div className="st-head"><SecIcon name="code" /><h3>{t("s_widget", lang)}</h3></div>
        <p className="st-desc">{t("s_widget_note", lang)}</p>
        <WidgetEmbed companyId={co.id} lang={lang} />
      </section>

      {isOwner ? (<>
      {/* Calculation engine — owner only */}
      <section className="card st-sec">
        <div className="st-head"><SecIcon name="sliders" /><h3>{t("calc_engine", lang)}</h3></div>
        <p className="st-desc">{t("st_engine_desc", lang)}</p>

        <div className="st-glabel first">{t("st_grp_cost", lang)}</div>
        <div className="set-grid">
          {numField("eCost", t("e_cost", lang), eng.costPerKw, 10, "€/kW", setEng("costPerKw"))}
          {numField("eBatt", t("e_batt_kwh", lang), eng.batteryCostPerKwh ?? 500, 25, "€/kWh", setEng("batteryCostPerKwh"))}
        </div>

        <div className="st-glabel">{t("st_grp_prod", lang)}</div>
        <div className="set-grid">
          {numField("eYield", t("e_yield", lang), eng.baseYield, 10, t("unit_kwp_yr", lang), setEng("baseYield"))}
          {numField("eOpex", t("as_om", lang), eng.opexPct, 0.1, t("opex_unit", lang), setEng("opexPct"))}
          {numField("eHorizon", t("pdf_horizon", lang), eng.horizon, 1, t("unit_years", lang), setEng("horizon"))}
        </div>

        <div className="st-glabel">{t("st_grp_subs", lang)}</div>
        <div className="set-grid">
          {numField("eSubsidy", t("afm_amount", lang), co.subsidy_amount_ron, 500, null, setCoNum("subsidy_amount_ron"))}
          {numField("eSubsidyMdl", t("s_subsidy_mdl", lang), eng.subsidyAmountMdl, 500, null, setEng("subsidyAmountMdl"))}
          {numField("eProsumer", t("prosumer_limit", lang), co.prosumer_limit_kw, 0.1, null, setCoNum("prosumer_limit_kw"))}
        </div>

        <div className="st-glabel">{t("st_grp_valid", lang)}</div>
        <div className="set-grid">
          {numField("eValidity", t("s_validity", lang), eng.quoteValidityDays, 5, t("unit_days", lang), setEng("quoteValidityDays"))}
        </div>
      </section>

      {/* Payback scenarios */}
      <section className="card st-sec">
        <div className="st-head"><SecIcon name="chart" /><h3>{t("scenario_bands", lang)}</h3></div>
        <p className="st-desc">{t("st_bands_desc", lang)}</p>
        <div className="st-band-wrap">
          <table className="st-bands">
            <thead><tr>
              <th />
              <th><span className="st-cdot" style={{ background: "var(--red)" }} />{t("st_col_pess", lang)}</th>
              <th><span className="st-cdot" style={{ background: "var(--amber)" }} />{t("st_col_exp", lang)}</th>
              <th><span className="st-cdot" style={{ background: "var(--green)" }} />{t("st_col_opt", lang)}</th>
            </tr></thead>
            <tbody>
              <tr>
                <td className="rlbl">{t("st_band_yield", lang)}</td>
                <td>{bandInput("pess", "ym", 0.01)}</td>
                <td className="locked">1.00</td>
                <td>{bandInput("opti", "ym", 0.01)}</td>
              </tr>
              <tr>
                <td className="rlbl">{t("st_band_degr", lang)}</td>
                <td>{bandInput("pess", "degr", 0.1)}</td>
                <td>{bandInput("expc", "degr", 0.1)}</td>
                <td>{bandInput("opti", "degr", 0.1)}</td>
              </tr>
              <tr>
                <td className="rlbl">{t("st_band_infl", lang)}</td>
                <td>{bandInput("pess", "infl", 0.5)}</td>
                <td>{bandInput("expc", "infl", 0.5)}</td>
                <td>{bandInput("opti", "infl", 0.5)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Demo data */}
      <section className="card st-sec">
        <div className="st-head"><SecIcon name="demo" color="var(--amber)" /><h3>{t("dd_title", lang)}</h3></div>
        <p className="st-desc">{t("dd_desc", lang)}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn primary" disabled={demoBusy} onClick={loadDemo}>{t("dd_load", lang)}</button>
          <button className="btn ghost" disabled={demoBusy} onClick={clearDemo}>{t("dd_clear", lang)}</button>
        </div>
        {demoMsg && <p className="set-note" style={{ marginTop: 12 }}>{demoMsg}</p>}
      </section>

      </>) : (
        <section className="card st-sec">
          <div className="st-head"><SecIcon name="sliders" /><h3>{t("calc_engine", lang)}</h3></div>
          <p className="st-desc" style={{ margin: 0 }}>{t("s_owner_only", lang)}</p>
        </section>
      )}

      {/* Sticky save bar */}
      <div className="st-savebar">
        <span className="msg">
          {msg ? msg : dirty
            ? <><span className="st-cdot" style={{ background: "var(--amber)", margin: 0 }} />{t("st_unsaved", lang)}</>
            : null}
        </span>
        <span className="spacer" />
        <button className="btn ghost" onClick={restoreDefaults}>{t("restore_defaults", lang)}</button>
        <button className="btn primary" onClick={save}>{t("save_settings", lang)}</button>
      </div>
    </div>
  );
}
