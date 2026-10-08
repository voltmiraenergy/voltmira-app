"use client";
// app/(app)/settings/page.jsx — company identity, documents, calculation
// numbers, assistants, notifications and billing.
//
// Six sections, one on screen at a time: a side menu on a computer, a row of
// tabs on a phone. It used to be thirteen cards in one column, ten phone
// screens long. Every edit, on any tab, goes into one draft; a bar appears
// with Save and Discard as soon as something changed, and the browser warns
// before leaving with unsaved changes. The open tab is kept in ?tab= so a
// reload (or a link from elsewhere) lands on the same section.
import "../dx.css";
import "./settings.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Receipt, Calculator, Bot, Bell, CreditCard, Upload, Trash2, RotateCcw, Download, Lock, PencilLine } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabase-browser.js";
import { openCheckout } from "../../../lib/paddle.js";
import { saveCompany, seedSampleData, clearSampleData, getMyRole } from "../../../lib/actions.js";
import { defaultEngineSettings } from "@voltmira/engine";
import { t, normLang, LANGS, LANG_NAMES } from "../../../lib/i18n.js";
import { dlt } from "../../../lib/deadlineText.js";
import { hasFeature, planFor } from "../../../lib/features.js";
import UpsellModal from "../../../components/UpsellModal.jsx";
import { CONTRACT_TOKENS, COMMISSIONING_TOKENS } from "../../../lib/legalDocs.js";
import LeadAssistant from "./LeadAssistant.jsx";
import { clearOfflineData } from "../../../lib/offline.js";

const TABS = [
  { id: "company", Icon: Building2, label: "st_tab_company", hint: "st_tab_company_h" },
  { id: "documents", Icon: Receipt, label: "st_tab_docs", hint: "st_tab_docs_h" },
  { id: "calculations", Icon: Calculator, label: "st_tab_calc", hint: "st_tab_calc_h" },
  { id: "assistants", Icon: Bot, label: "st_tab_ai", hint: "st_tab_ai_h" },
  { id: "notifications", Icon: Bell, label: "st_tab_alerts", hint: "st_tab_alerts_h" },
  { id: "plan", Icon: CreditCard, label: "st_tab_plan", hint: "st_tab_plan_h" },
];
const TAB_IDS = TABS.map((x) => x.id);

/* The embeddable lead widget. The snippet carries the company id; the widget
   page resolves the form language from the company automatically. */
function WidgetEmbed({ companyId, lang }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof location !== "undefined" ? location.origin : "https://voltmira.com";
  const snippet = `<iframe src="${origin}/widget?c=${companyId}" width="380" height="560" style="border:none;max-width:100%"></iframe>`;
  return (
    <div className="st-embed">
      <code className="embed-code">{snippet}</code>
      <button type="button" className={"dx-btn" + (copied ? " primary" : "")}
        onClick={() => { navigator.clipboard?.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
        {copied ? t("s_copied", lang) : t("s_copy", lang)}
      </button>
    </div>
  );
}

/* A titled block inside a section. */
function Card({ title, desc, extra, tone, children }) {
  return (
    <section className={"dx-card st-card" + (tone ? " " + tone : "")}>
      <div className="st-card-h">
        <div><h3>{title}</h3>{desc ? <p>{desc}</p> : null}</div>
        {extra}
      </div>
      {children}
    </section>
  );
}

/* One on/off setting with its explanation. */
function Toggle({ checked, onChange, title, note }) {
  return (
    <label className="check st-toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="toggle-pill" />
      <span className="txt">{title}{note ? <small>{note}</small> : null}</span>
    </label>
  );
}

const COUNTRY_CURRENCY = { MD: "MDL", UA: "UAH", RO: "RON" };

export default function Settings() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [co, setCo] = useState(null);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTabState] = useState("company");
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");
  const [isOwner, setIsOwner] = useState(true);   // default true so owners see no flash
  const [upsell, setUpsell] = useState(null);      // feature key, or null
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [askUa, setAskUa] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const load = () => sb.from("companies").select("*").single().then(({ data }) => setCo(data));

  useEffect(() => {
    document.title = "Settings | VoltMira";
    load();
    getMyRole().then(r => setIsOwner(r === "owner")).catch(() => {});
    try {
      const want = new URLSearchParams(location.search).get("tab");
      if (TAB_IDS.includes(want)) setTabState(want);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The tab title in the workspace language once the company row is in.
  const coLang = co?.lang;
  useEffect(() => {
    if (coLang) document.title = `${t("nav_settings", normLang(coLang))} | VoltMira`;
  }, [coLang]);

  // Leaving with unsaved edits asks first, like any form a person fills in.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // "Saved" says so briefly, then the bar gets out of the way.
  useEffect(() => {
    if (!msg || dirty || saving) return;
    const id = setTimeout(() => setMsg(""), 2600);
    return () => clearTimeout(id);
  }, [msg, dirty, saving]);

  function setTab(id) {
    setTabState(id);
    try {
      const u = new URL(location.href);
      u.searchParams.set("tab", id);
      history.replaceState(null, "", u.pathname + u.search);
    } catch {}
    if (typeof window !== "undefined" && window.innerWidth < 900) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!co) return <div className="st-loading">{t("loading", "en")}</div>;

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
    setSaving(true);
    setMsg(t("s_saving", lang));
    try {
      await saveCompany({
        name: co.name, short_name: co.short_name, logo_url: co.logo_url,
        default_market: co.default_market, currency: co.currency, lang: normLang(co.lang),
        subsidy_amount_ron: co.subsidy_amount_ron, prosumer_limit_kw: co.prosumer_limit_kw,
        notify_open: co.notify_open !== false,
        notify_deadlines: co.notify_deadlines !== false,
        nudge_enabled: co.nudge_enabled === true,
        crm_webhook_enabled: co.crm_webhook_enabled === true,
        crm_webhook_url: co.crm_webhook_url,
        // company legal details for invoicing
        legal_name: co.legal_name, reg_no: co.reg_no, vat_no: co.vat_no,
        legal_address: co.legal_address, iban: co.iban, invoice_prefix: co.invoice_prefix,
        vat_rate: co.vat_rate, install_warranty_years: co.install_warranty_years,
        // Only once add-proposal-agent.sql has added the column (select("*") then returns it).
        ...("negotiation" in co ? { negotiation: co.negotiation || {} } : {}),
        contract_template_override: co.contract_template_override || "",
        commissioning_template_override: co.commissioning_template_override || "",
        engine: eng,
      });
      setMsg(t("s_saved", lang));
      setDirty(false);
      // Re-render the shared layout (sidebar nav) and clear the client Router
      // Cache so a language change shows on every tab at once. Pairs with
      // revalidatePath("/","layout") in saveCompany.
      router.refresh();
    } catch (e) {
      setMsg(e.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    await load();
    setDirty(false);
    setMsg("");
  }

  async function deleteAccount() {
    if (deleteBusy) return;
    setDeleteBusy(true); setDeleteErr("");
    try {
      const res = await fetch("/api/account", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: deleteConfirm }),
      });
      if (res.ok) { await clearOfflineData(); await sb.auth.signOut(); router.push("/login"); return; }
      const j = await res.json().catch(() => ({}));
      const ERR = {
        active_subscription: t("s_delete_err_sub", lang),
        confirm_mismatch: t("s_delete_err_mismatch", lang),
        owner_only: t("s_delete_err_owner", lang),
      };
      setDeleteErr(ERR[j.error] || t("s_delete_err_generic", lang));
    } catch {
      setDeleteErr(t("s_delete_err_generic", lang));
    } finally {
      setDeleteBusy(false);
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
        successUrl: (process.env.NEXT_PUBLIC_APP_URL || location.origin) + "/settings?tab=plan&upgraded=1",
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

  // Logo upload: downscale to 256 px and upload to the public-media Storage
  // bucket (supabase/add-storage-media.sql), so logo_url is a real public URL
  // rather than a data: URL inlined into the companies row.
  function onLogoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg(t("s_logo_bad", lang)); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = async () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(async (blob) => {
          if (!blob) { setMsg(t("s_logo_bad", lang)); return; }
          setMsg(t("s_logo_uploading", lang));
          // Two folder levels: the Storage RLS policy reads the company id from
          // foldername(name)[2], so "logos/<id>.png" would always be rejected.
          const path = `logos/${co.id}/logo.png`;
          const { error } = await sb.storage.from("public-media").upload(path, blob, { upsert: true, contentType: "image/png", cacheControl: "3600" });
          if (error) { setMsg(error.message); return; }
          const { data } = sb.storage.from("public-media").getPublicUrl(path);
          // Cache-bust: the path never changes, so the old image would stick.
          setCo(c => ({ ...c, logo_url: `${data.publicUrl}?v=${Date.now()}` }));
          setMsg(""); touch();
        }, "image/png");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // Any edit marks the draft dirty (drives the save bar) and clears a stale
  // "Saved" message so the two never contradict each other.
  const touch = () => { setDirty(true); if (msg) setMsg(""); };
  const set = (k) => (e) => { setCo({ ...co, [k]: e.target.value }); touch(); };
  // The country a workspace works in decides its money: lei in Moldova,
  // hryvnia in Ukraine. Ukraine also switches the interface to Ukrainian.
  // All three stay editable on their own afterwards.
  const setCountry = (e) => {
    const m = e.target.value;
    setCo({ ...co, default_market: m, currency: COUNTRY_CURRENCY[m] || co.currency, ...(m === "UA" ? { lang: "uk" } : {}) });
    setAskUa(false); touch();
  };
  // Picking Ukrainian while the workspace still works in Moldova asks whether
  // the business is in Ukraine; a Ukrainian speaker in Moldova keeps lei.
  const setLangPick = (e) => {
    const l = e.target.value;
    setCo({ ...co, lang: l });
    setAskUa(l === "uk" && co.default_market !== "UA"); touch();
  };
  const goUkraine = () => { setCo({ ...co, lang: "uk", default_market: "UA", currency: "UAH" }); setAskUa(false); touch(); };
  const setEng = (k) => (e) => { setCo({ ...co, engine: { ...eng, [k]: +e.target.value } }); touch(); };
  const setBand = (band, k) => (e) => { setCo({
    ...co, engine: { ...eng, bands: { ...eng.bands, [band]: { ...eng.bands[band], [k]: +e.target.value } } },
  }); touch(); };
  const setCoNum = (k) => (e) => { setCo({ ...co, [k]: +e.target.value }); touch(); };
  function restoreDefaults() { setCo({ ...co, engine: defaultEngineSettings() }); touch(); }

  // One number field with an optional unit. A CALLED function, not a
  // <Component/>, so the <input> keeps its identity and never loses focus.
  const numField = (id, label, value, step, suffix, onChange) => (
    <div className="field" key={id}>
      <label htmlFor={id}>{label}{suffix ? <span className="st-unit">{suffix}</span> : null}</label>
      <input className="input" id={id} type="number" step={step} value={value} onChange={onChange} />
    </div>
  );
  const textField = (id, label, key, placeholder, extra = {}) => (
    <div className="field" key={id}>
      <label htmlFor={id}>{label}</label>
      <input className="input" id={id} value={co[key] || ""} onChange={set(key)} placeholder={placeholder} {...extra} />
    </div>
  );

  const isDataLogo = /^data:image\//i.test(co.logo_url || "");
  const hasLogo = /^(https:\/\/|data:image\/)/i.test(co.logo_url || "");
  const bandInput = (band, k, step) => (
    <input className="input" type="number" step={step} value={eng.bands[band][k]} onChange={setBand(band, k)} aria-label={`${band} ${k}`} />
  );
  const ownerOnly = (
    <section className="dx-card st-card">
      <div className="st-locked"><Lock size={18} aria-hidden="true" /><div><b>{t("st_owner_only_h", lang)}</b><p>{t("s_owner_only", lang)}</p></div></div>
    </section>
  );
  const current = TABS.find((x) => x.id === tab) || TABS[0];

  // ---------------------------------------------------------------- sections
  const panels = {
    company: (
      <>
        <Card title={t("st_profile_h", lang)} desc={t("st_company_desc", lang)}>
          <div className="set-grid">
            {textField("sName", t("s_company_name", lang), "name")}
            <div className="field">
              <label htmlFor="sShort">{t("short_name", lang)}</label>
              <input className="input" id="sShort" value={co.short_name || ""} onChange={set("short_name")}
                placeholder={(co.name || "").trim().split(/\s+/)[0] || t("s_short_name_ph", lang)} />
              <p className="set-note st-note-tight">{t("s_short_name_note", lang)}</p>
            </div>
          </div>
          <div className="field st-logo-field">
            <label>{t("s_logo", lang)}</label>
            <div className="st-logo-row">
              {hasLogo
                ? <img className="st-logo" src={co.logo_url} alt="" />
                : <span className="st-logo st-logo-ph">{(co.short_name || co.name || "?").trim()[0]?.toUpperCase() || "?"}</span>}
              <div className="st-logo-acts">
                <label className="dx-btn st-upload">
                  <Upload size={14} aria-hidden="true" />{t("s_logo_upload", lang)}
                  <input type="file" accept="image/*" onChange={onLogoFile} />
                </label>
                {hasLogo && <button type="button" className="dx-btn del" onClick={() => { setCo(c => ({ ...c, logo_url: "" })); touch(); }}><Trash2 size={14} aria-hidden="true" />{t("s_logo_remove", lang)}</button>}
              </div>
            </div>
            {!isDataLogo && (
              <input className="input st-logo-url" value={co.logo_url || ""} onChange={set("logo_url")} placeholder="https://…/logo.png" aria-label={t("s_logo", lang)} />
            )}
            <p className="set-note st-note-tight">{isDataLogo ? t("s_logo_uploaded", lang) : t("s_logo_hint", lang)}</p>
          </div>
        </Card>
        <Card title={t("st_region_h", lang)} desc={t("st_region_p", lang)}>
          <div className="set-grid">
            <div className="field"><label htmlFor="sMkt">{t("s_default_mkt", lang)}</label>
              <select className="input" id="sMkt" value={co.default_market} onChange={setCountry}>
                <option value="MD">{t("country_md", lang)}</option>
                <option value="UA">{t("country_ua", lang)}</option>
                <option value="RO">{t("country_ro", lang)}</option>
              </select></div>
            <div className="field"><label htmlFor="sLang">{t("s_language", lang)}</label>
              <select className="input" id="sLang" value={normLang(co.lang)} onChange={setLangPick}>
                {LANGS.map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
              </select></div>
            <div className="field"><label htmlFor="sCur">{t("s_currency", lang)}</label>
              <select className="input" id="sCur" value={co.currency} onChange={set("currency")}>
                <option value="MDL">{t("cur_mdl", lang)}</option><option value="UAH">{t("cur_uah", lang)}</option>
                <option value="EUR">{t("cur_eur", lang)}</option><option value="RON">{t("cur_ron", lang)}</option>
              </select></div>
          </div>
          {askUa && (
            <div className="st-ua" role="status">
              <div className="st-ua-t"><b>{t("ua_mode_h", lang)}</b><span>{t("ua_mode_p", lang)}</span></div>
              <div className="st-ua-a">
                <button type="button" className="dx-btn primary" onClick={goUkraine}>{t("ua_mode_yes", lang)}</button>
                <button type="button" className="dx-btn" onClick={() => setAskUa(false)}>{t("ua_mode_lang_only", lang)}</button>
              </div>
            </div>
          )}
          {co.default_market === "UA" && <p className="set-note">{t("ua_mode_on", lang)}</p>}
          <p className="set-note">{t("co_note", lang)}</p>
        </Card>
      </>
    ),

    documents: (
      <>
        <Card title={t("s_invoicing", lang)} desc={t("s_invoicing_sub", lang)}
          extra={<a className="dx-btn" href="/api/export-invoices"><Download size={14} aria-hidden="true" />CSV</a>}>
          <div className="set-grid">
            {textField("sLegal", t("s_legal_name", lang), "legal_name", co.name || "SolarTech SRL")}
            {textField("sReg", t("s_reg_no", lang), "reg_no", "IDNO")}
            {textField("sVat", t("s_vat_no", lang), "vat_no", "")}
            {numField("iVat", t("s_vat_rate", lang), co.vat_rate ?? 0, 1, "%", setCoNum("vat_rate"))}
            {textField("sIban", t("s_iban", lang), "iban", "MD24 AG00 0000 0225 1000 1310")}
            {textField("sPrefix", t("s_inv_prefix", lang), "invoice_prefix", "PF", { maxLength: 6 })}
          </div>
          <div className="st-gap">{textField("sAddr", t("s_legal_address", lang), "legal_address", t("s_legal_address_ph", lang))}</div>
          <p className="set-note">{t("s_invoicing_note", lang)} {t("s_export_invoices_md_note", lang)}</p>
        </Card>
        <Card title={t("s_install_warranty", lang)} desc={t("s_install_warranty_sub", lang)}>
          <div className="set-grid st-narrow">
            {numField("iInstWarr", t("s_install_warranty_years", lang), co.install_warranty_years ?? "", 1, t("unit_years", lang), setCoNum("install_warranty_years"))}
          </div>
        </Card>
        {/* The installer's own wording on the two documents a client signs.
            Team+ (lib/features.js). The Premier Energy form is a real
            government form and stays exactly what it is. Folded away by
            default: most installers never change it. */}
        <Card title={t("s_whitelabel", lang)} desc={t("s_whitelabel_note", lang)}>
          <details className="st-fold" open={Boolean(co.contract_template_override)}>
            <summary>{t("s_wl_contract", lang)}</summary>
            <textarea className="input st-mono" value={co.contract_template_override || ""}
              onFocus={() => { if (!hasFeature(co.plan, "customTemplates")) setUpsell("customTemplates"); }}
              onChange={e => { if (!hasFeature(co.plan, "customTemplates")) { setUpsell("customTemplates"); return; } setCo({ ...co, contract_template_override: e.target.value }); touch(); }}
              placeholder={t("s_wl_placeholder", lang)} aria-label={t("s_wl_contract", lang)} />
          </details>
          <details className="st-fold" open={Boolean(co.commissioning_template_override)}>
            <summary>{t("s_wl_commissioning", lang)}</summary>
            <textarea className="input st-mono" value={co.commissioning_template_override || ""}
              onFocus={() => { if (!hasFeature(co.plan, "customTemplates")) setUpsell("customTemplates"); }}
              onChange={e => { if (!hasFeature(co.plan, "customTemplates")) { setUpsell("customTemplates"); return; } setCo({ ...co, commissioning_template_override: e.target.value }); touch(); }}
              placeholder={t("s_wl_placeholder", lang)} aria-label={t("s_wl_commissioning", lang)} />
          </details>
          <p className="set-note">{t("s_wl_tokens", lang, { tokens: [...CONTRACT_TOKENS, ...COMMISSIONING_TOKENS].filter((v, i, a) => a.indexOf(v) === i).map(x => `{{${x}}}`).join(" ") })}</p>
        </Card>
      </>
    ),

    calculations: isOwner ? (
      <>
        <Card title={t("st_grp_cost", lang)} desc={t("st_engine_desc", lang)}
          extra={<button type="button" className="dx-btn" onClick={restoreDefaults}><RotateCcw size={14} aria-hidden="true" />{t("restore_defaults", lang)}</button>}>
          <div className="set-grid">
            {numField("eCost", t("e_cost", lang), eng.costPerKw, 10, "€/kW", setEng("costPerKw"))}
            {numField("eBatt", t("e_batt_kwh", lang), eng.batteryCostPerKwh ?? 500, 25, "€/kWh", setEng("batteryCostPerKwh"))}
          </div>
        </Card>
        <Card title={t("st_grp_prod", lang)}>
          <div className="set-grid">
            {numField("eYield", t("e_yield", lang), eng.baseYield, 10, t("unit_kwp_yr", lang), setEng("baseYield"))}
            {numField("eOpex", t("as_om", lang), eng.opexPct, 0.1, t("opex_unit", lang), setEng("opexPct"))}
            {numField("eHorizon", t("pdf_horizon", lang), eng.horizon, 1, t("unit_years", lang), setEng("horizon"))}
          </div>
        </Card>
        <Card title={t("st_grp_md_tariff", lang)} desc={t("st_md_tariff_note", lang)}>
          {/* Two suppliers, two ANRE-approved rate tables: Premier Energy in the
              centre and south, FEE-Nord in RED Nord's northern territory. The
              buttons only fill the fields below; nothing is locked afterwards. */}
          <div className="st-presets">
            <button type="button" className="dx-btn"
              onClick={() => { setCo(c => ({ ...c, engine: { ...eng, mdDayRateMdl: 3.75, mdNightRateMdl: 2.94 } })); touch(); }}>
              {t("e_md_preset_premier", lang)}
            </button>
            <button type="button" className="dx-btn"
              onClick={() => { setCo(c => ({ ...c, engine: { ...eng, mdDayRateMdl: 4.89, mdNightRateMdl: 3.91 } })); touch(); }}>
              {t("e_md_preset_feenord", lang)}
            </button>
          </div>
          <div className="set-grid">
            {numField("eMdDay", t("e_md_day_rate", lang), eng.mdDayRateMdl ?? 3.75, 0.01, "MDL/kWh", setEng("mdDayRateMdl"))}
            {numField("eMdNight", t("e_md_night_rate", lang), eng.mdNightRateMdl ?? 2.94, 0.01, "MDL/kWh", setEng("mdNightRateMdl"))}
          </div>
        </Card>
        <Card title={t("st_grp_limits", lang)}>
          <div className="set-grid">
            {numField("eProsumer", t("prosumer_limit", lang), co.prosumer_limit_kw, 0.1, "kW", setCoNum("prosumer_limit_kw"))}
            {numField("eValidity", t("s_validity", lang), eng.quoteValidityDays, 5, t("unit_days", lang), setEng("quoteValidityDays"))}
          </div>
        </Card>
        <Card title={t("st_grp_finance", lang)} desc={t("st_finance_note", lang)}>
          <div className="set-grid">
            {numField("eFinRate", t("e_finance_rate", lang), eng.financeRatePct ?? 9, 0.5, "%/yr", setEng("financeRatePct"))}
            {numField("eFinTerm", t("e_finance_term", lang), eng.financeTermYears ?? 10, 1, t("unit_years", lang), setEng("financeTermYears"))}
          </div>
        </Card>
        <Card title={t("scenario_bands", lang)} desc={t("st_bands_desc", lang)}>
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
        </Card>
      </>
    ) : ownerOnly,

    assistants: (
      <>
        {/* How far the chat on a client's proposal may go on the owner's
            behalf (lib/negotiation.js, enforced server-side). Off by default.
            Owner-only; hidden until add-proposal-agent.sql has run. */}
        {isOwner && "negotiation" in co && (() => {
          const neg = co.negotiation || {};
          const setNeg = (patch) => { setCo({ ...co, negotiation: { ...neg, ...patch } }); touch(); };
          return (
            <Card title={t("s_assistant", lang)} desc={t("s_assistant_sub", lang)}>
              <div className="st-toggles">
                <Toggle checked={neg.enabled === true} onChange={(e) => setNeg({ enabled: e.target.checked })}
                  title={t("s_neg_enable", lang)} note={t("s_neg_enable_note", lang)} />
                {neg.enabled === true && (
                  <div className="set-grid st-narrow st-indent">
                    <div className="field">
                      <label htmlFor="iNegMax">{t("s_neg_max", lang)}<span className="st-unit">%</span></label>
                      <input className="input" id="iNegMax" type="number" min={0} max={15} step={0.5}
                        value={neg.maxDiscountPct ?? ""} onChange={(e) => setNeg({ maxDiscountPct: e.target.value === "" ? "" : Math.min(15, Math.max(0, +e.target.value)) })} />
                    </div>
                  </div>
                )}
                <Toggle checked={neg.allowOptions !== false} onChange={(e) => setNeg({ allowOptions: e.target.checked })}
                  title={t("s_neg_options", lang)} note={t("s_neg_options_note", lang)} />
              </div>
            </Card>
          );
        })()}
        <Card title={t("s_lead_assistant", lang)} desc={t("s_lead_assistant_sub", lang)}>
          <LeadAssistant lang={lang} />
        </Card>
        <Card title={t("s_widget", lang)} desc={t("s_widget_note", lang)}>
          <WidgetEmbed companyId={co.id} lang={lang} />
        </Card>
      </>
    ),

    notifications: (
      <>
        <Card title={t("st_emails_h", lang)} desc={t("st_emails_p", lang)}>
          <div className="st-toggles">
            <Toggle checked={co.notify_open !== false} onChange={e => { setCo({ ...co, notify_open: e.target.checked }); touch(); }}
              title={t("s_notify", lang)} note={t("s_notify_note", lang)} />
            <Toggle checked={co.notify_deadlines !== false} onChange={e => { setCo({ ...co, notify_deadlines: e.target.checked }); touch(); }}
              title={dlt("st_toggle", lang)} note={dlt("st_note", lang)} />
            {/* Opt-in: emails a real client under this company's brand, so it
                stays off until someone turns it on (add-proposal-nudges.sql). */}
            <Toggle checked={co.nudge_enabled === true} onChange={e => { setCo({ ...co, nudge_enabled: e.target.checked }); touch(); }}
              title={t("s_nudge", lang)} note={t("s_nudge_note", lang)} />
          </div>
        </Card>
        {/* Sends real pipeline data to a URL the installer controls: opt-in,
            Pro and up, and owner-only (saveCompany drops it for anyone else). */}
        {isOwner && (
          <Card title={t("st_crm_h", lang)}>
            <div className="st-toggles">
              <Toggle checked={co.crm_webhook_enabled === true}
                onChange={e => {
                  if (e.target.checked && !hasFeature(co.plan, "crmWebhook")) { setUpsell("crmWebhook"); return; }
                  setCo({ ...co, crm_webhook_enabled: e.target.checked }); touch();
                }}
                title={t("s_crm", lang)} note={t("s_crm_note", lang)} />
              {co.crm_webhook_enabled === true && (
                <div className="field st-indent">
                  <label htmlFor="sCrm">{t("s_crm_url", lang)}</label>
                  <input className="input" id="sCrm" value={co.crm_webhook_url || ""} onChange={set("crm_webhook_url")}
                    placeholder="https://hooks.bitrix24.com/rest/…" />
                </div>
              )}
            </div>
          </Card>
        )}
      </>
    ),

    plan: (
      <>
        <Card title={t("s_plan", lang)} extra={<span className="st-plan-badge">{co.plan}</span>}>
          {co.plan === "free" ? (
            <div className="st-plan-acts">
              <button className="dx-btn primary" onClick={() => upgrade("pro")}>{t("s_upgrade_pro", lang)}</button>
              <button className="dx-btn" onClick={() => upgrade("team")}>{t("s_team", lang)}</button>
            </div>
          ) : <p className="st-p">{t("s_billing_note", lang, { plan: co.plan })}</p>}
        </Card>
        {isOwner && (
          <>
            <Card title={t("dd_title", lang)} desc={t("dd_desc", lang)}>
              <div className="st-plan-acts">
                <button className="dx-btn primary" disabled={demoBusy} onClick={loadDemo}>{t("dd_load", lang)}</button>
                <button className="dx-btn" disabled={demoBusy} onClick={clearDemo}>{t("dd_clear", lang)}</button>
              </div>
              {demoMsg && <p className="set-note">{demoMsg}</p>}
            </Card>
            {/* GDPR erasure, self-service. Type-to-confirm with the real company
                name, never a plain "are you sure?". */}
            <Card title={t("s_danger", lang)} desc={t("s_delete_note", lang)} tone="st-danger">
              <button className="dx-btn del" onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteErr(""); }}>
                <Trash2 size={14} aria-hidden="true" />{t("s_delete_cta", lang)}
              </button>
            </Card>
          </>
        )}
      </>
    ),
  };

  return (
    <div className="dx st">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{t("settings_title", lang)}</h1>
          <p className="dx-summary">{t("settings_sub", lang)}</p>
        </div>
      </header>

      <div className="st-layout">
        <nav className="st-nav" aria-label={t("st_nav_label", lang)}>
          {TABS.map(({ id, Icon, label, hint }) => (
            <button key={id} type="button" className={"st-nav-i" + (tab === id ? " on" : "")} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
              <span className="st-nav-ic"><Icon size={17} aria-hidden="true" /></span>
              <span className="st-nav-tx"><b>{t(label, lang)}</b><small>{t(hint, lang)}</small></span>
            </button>
          ))}
        </nav>

        <div className="st-panel" key={tab}>
          <div className="st-panel-h">
            <h2>{t(current.label, lang)}</h2>
            <p>{t(current.hint, lang)}</p>
          </div>
          {panels[tab]}
        </div>
      </div>

      {upsell && (
        <UpsellModal lang={lang} plan={planFor(upsell)} onClose={() => setUpsell(null)}
          onUpgrade={(p) => { setUpsell(null); upgrade(p); }} />
      )}

      {deleteOpen && (
        <div className="overlay" onClick={() => !deleteBusy && setDeleteOpen(false)}>
          <div className="modal" style={{ width: "min(440px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <h4>{t("s_delete_title", lang)}</h4>
            <p className="st-p">{t("s_delete_body", lang, { name: co.name || "" })}</p>
            <div className="field" style={{ margin: "12px 0" }}>
              <label htmlFor="sDel">{t("s_delete_type", lang, { name: co.name || "" })}</label>
              <input className="input" id="sDel" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} disabled={deleteBusy} />
            </div>
            {deleteErr && <p className="st-err">{deleteErr}</p>}
            <div className="st-plan-acts" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="dx-btn" disabled={deleteBusy} onClick={() => setDeleteOpen(false)}>{t("upsell_close", lang)}</button>
              <button type="button" className="dx-btn st-del-go"
                disabled={deleteBusy || deleteConfirm.trim() !== (co.name || "").trim()}
                onClick={deleteAccount}>
                {deleteBusy ? t("s_deleting", lang) : t("s_delete_confirm", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appears only when there is something to say: unsaved changes, saving, saved, or an error. */}
      {(dirty || msg) && (
        <div className={"st-savebar" + (dirty ? " is-dirty" : "")} role="status" aria-live="polite">
          <span className="st-savebar-msg">
            {dirty && !saving ? <><PencilLine size={16} aria-hidden="true" />{t("st_unsaved", lang)}</> : msg}
          </span>
          {dirty && (
            <span className="st-savebar-acts">
              <button type="button" className="dx-btn" onClick={discard} disabled={saving}>{t("st_discard", lang)}</button>
              <button type="button" className="dx-btn primary" onClick={save} disabled={saving} aria-busy={saving}>{t("save_settings", lang)}</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
