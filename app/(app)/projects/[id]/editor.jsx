"use client";
// app/(app)/projects/[id]/editor.jsx — the quote editor, powered by the shared
// engine. Autosaves to Supabase (debounced 600ms). PVGIS button pulls real yield
// for the address. Proposal button creates the tracked link. Visual language
// matches the live demo (editor grid, cards, bands, financing, modal).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../../../../lib/supabase-browser.js";
import { createProposal, saveQuoteTemplate } from "../../../../lib/actions.js";
import AddressField from "../../../../components/AddressField.jsx";
import SiteDesigner from "../../../../components/SiteDesigner.jsx";
import BomCard from "../../../../components/BomCard.jsx";
import DesignChecks from "../../../../components/DesignChecks.jsx";
import DesignSuggestions from "../../../../components/DesignSuggestions.jsx";
import BatterySizingPanel from "../../../../components/BatterySizingPanel.jsx";
import SurplusPanel, { useBuyback } from "../../../../components/SurplusPanel.jsx";
import InstallChecklist from "./InstallChecklist.jsx";
import SignedContract from "./SignedContract.jsx";
import ShareCard from "./ShareCard.jsx";
import { quote, MARKETS, FX, effectiveConsumption } from "@voltmira/engine";
import { financials } from "../../../../lib/quoteAnalysis.js";
import { applyCalibration } from "../../../../lib/yieldCalibration.js";
import { t } from "../../../../lib/i18n.js";
import { autoBom } from "../../../../lib/supplierCatalog.js";
import { fmtDate } from "../../../../lib/tz.js";

// System-size slider range — raised to 500 kW: Site Designer's own real,
// drawn-roof panel counts can land well past a "residential" size for a large
// commercial roof, and the slider must be able to show whatever it applied.
const KW_MIN = 2, KW_MAX = 500;

// Short month labels in the app's language, via Intl — no extra i18n keys needed.
function monthLabels(lang) {
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";
  const fmt = new Intl.DateTimeFormat(loc, { month: "short" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2021, i, 1)));
}

/* ---------- small SVG helpers ---------- */
function Chart({ q, lang }) {
  const W = 560, H = 170, PAD = 8, years = q.e.horizon;
  const all = [...q.p.rows, ...q.e.rows, ...q.o.rows, 0, -q.e.cost];
  const min = Math.min(...all), max = Math.max(...all), span = (max - min) || 1;
  const X = i => PAD + (i / (years - 1)) * (W - 2 * PAD);
  const Y = v => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
  const line = rows => rows.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const zero = Y(0), be = q.e.payback;
  const bx = be !== null && be > 0 ? PAD + ((be - 1) / (years - 1)) * (W - 2 * PAD) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={t("aria_cashflow", lang)}>
      <line x1={PAD} y1={zero} x2={W - PAD} y2={zero} stroke="#B9B5A6" strokeWidth="1.5" strokeDasharray="2 4" />
      <path d={line(q.p.rows)} fill="none" stroke="#C4543B" strokeWidth="1.6" strokeDasharray="5 4" opacity=".55" />
      <path d={line(q.o.rows)} fill="none" stroke="#1E6B4E" strokeWidth="1.6" strokeDasharray="5 4" opacity=".55" />
      <path d={line(q.e.rows)} fill="none" stroke="#1E6B4E" strokeWidth="2.8" strokeLinecap="round" />
      {bx !== null && bx <= W - PAD && <>
        <line x1={bx} y1={PAD} x2={bx} y2={H - PAD} stroke="#E89B2D" strokeWidth="2" strokeDasharray="4 4" />
        <circle cx={bx} cy={zero} r="4.5" fill="#E89B2D" />
      </>}
    </svg>
  );
}

function Donut({ self, prod0, cons, lang }) {
  const r = 42, c = 2 * Math.PI * r, sc = Math.max(0, Math.min(1, self));
  // Two different questions, and the ring only ever answered the first:
  //   sc       = share of PRODUCTION consumed on site
  //   coverage = share of the CLIENT'S OWN USE the system covers
  // On an oversized system sc reads alarmingly low (8%) while coverage is 100%,
  // so showing the ring alone invited exactly the wrong conclusion.
  const consN = Number(cons) || 0;
  const coverage = consN > 0 ? Math.min(1, (sc * (Number(prod0) || 0)) / consN) : 0;
  // The ring is SVG only. The caption used to live inside this component,
  // centred under a 110px box, so "of production — covers 79% of the client's
  // own use" wrapped into four ragged lines. It now renders as a legend beside
  // the ring, where it has the width to read as one sentence.
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" className="ss-ring" role="img"
      aria-label={`${Math.round(sc * 100)}% of production self-consumed, covering ${Math.round(coverage * 100)}% of the client's use`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E89B2D" strokeWidth="12" opacity=".65"
        strokeDasharray={`${c * (1 - sc)} ${c}`} transform="rotate(-90 50 50)" strokeLinecap="round" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1E6B4E" strokeWidth="12"
        strokeDasharray={`${c * sc} ${c}`} strokeDashoffset={-(c * (1 - sc))}
        transform="rotate(-90 50 50)" strokeLinecap="round" />
      <text x="50" y="47" textAnchor="middle" fontFamily="Inter" fontSize="17" fontWeight="700" fill="var(--ink)">
        {Math.round(sc * 100)}%</text>
      <text x="50" y="60" textAnchor="middle" fontFamily="Inter" fontSize="7.5" fill="var(--muted)">{t("self_consumed", lang)}</text>
    </svg>
  );
}

/* ---------- editor ---------- */
export default function Editor({ initial, engineSettings: E, prosumerLimitKw, lang, team = [], catalog = [], proposalSentAt = null, companyName = "VoltMira", companyLogo = "", signed = null, calibration = null }) {
  const tr = (k, v) => t(k, lang, v);
  const [p, setP] = useState({
    title: initial.title, client: initial.client_name, address: initial.address,
    // Coordinates of the resolved address pick. Null until someone picks a
    // suggestion (or until add-project-coords.sql has been run); PVGIS then
    // uses them directly instead of re-geocoding the text every time.
    lat: initial.lat != null ? +initial.lat : null,
    lon: initial.lon != null ? +initial.lon : null,
    market: initial.market, status: initial.status,
    kw: +initial.kw, price: +initial.price, cons: +initial.cons,
    batt: initial.batt, battKwh: initial.batt_kwh != null ? +initial.batt_kwh : 10,
    options: Array.isArray(initial.options) ? initial.options : [],
    bom: Array.isArray(initial.bom) ? initial.bom : [],
    siteDesign: initial.site_design && typeof initial.site_design === "object" ? initial.site_design : {},
    loan: +initial.loan_monthly,
    yieldOverride: initial.yield_per_kwp ? +initial.yield_per_kwp : undefined,
    monthlyYieldShape: initial.monthly_yield_shape || undefined,
    useMonthly: initial.use_monthly, consMonthly: initial.cons_monthly,
    ownerId: initial.owner_id || null,
    nextFollowUp: initial.next_follow_up || "",
    notes: initial.notes || "",
  });
  const [saved, setSaved] = useState("saved");     // saved | saving | error
  const [pvgisBusy, setPvgisBusy] = useState(false);
  const [billBusy, setBillBusy] = useState(false);   // AI bill extractor
  const [billRes, setBillRes] = useState(null);      // extracted values awaiting review
  const [billErr, setBillErr] = useState("");
  const billInput = useRef(null);
  const [propUrl, setPropUrl] = useState(null);
  // Emailing the PDF: the recipient isn't stored on the project (only the client's
  // NAME is), so this always starts empty rather than guessing an address.
  const [emailTo, setEmailTo] = useState("");
  // Deposit % for the proforma. The invoice page has supported ?deposit= since
  // it was written, but nothing ever passed it — so the single most useful part
  // of a proforma (asking for money up front) was reachable only by hand-editing
  // the URL. 0 = invoice the full amount.
  const [invOpen, setInvOpen] = useState(false);
  const [siteDesignerOpen, setSiteDesignerOpen] = useState(false);
  const [siteDesignApplying, setSiteDesignApplying] = useState(false);
  const [depPct, setDepPct] = useState(30);
  const [invTo, setInvTo] = useState("");
  const [invBusy, setInvBusy] = useState(false);
  const [invMsg, setInvMsg] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tplSaved, setTplSaved] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplBusy, setTplBusy] = useState(false);
  const [disc, setDisc] = useState(6);   // % real discount rate, for NPV/LCOE
  const timer = useRef(null);

  function openTemplate() { setTplName(p.title || "Template"); setTplOpen(true); }
  async function saveTemplate() {
    const name = tplName.trim();
    if (!name) return;
    setTplBusy(true);
    try {
      await saveQuoteTemplate({ name, kw: p.kw, market: p.market, batt: p.batt, price: p.price, cons: p.cons });
      setTplOpen(false); setTplSaved(true); setTimeout(() => setTplSaved(false), 2200);
    } catch { /* non-fatal */ } finally { setTplBusy(false); }
  }

  // Moldova's exported surplus is bought back at the operator's published
  // monthly price, weighted by the months this system actually exports in — not
  // the market's flat constant. Same figure Studio and the bankability export
  // use, so an offer and its supporting documents never disagree.
  const buyback = useBuyback(Number(p.price) || 0.18, FX.MDL);
  const isMD = p.market === "MD";
  const feedOverride = isMD ? buyback.weightedEur : undefined;

  // Quote price is driven entirely by system size (kW × rate + battery); the
  // bill of materials is the installer's cost, not a price override (see
  // lib/quoteInput.js).
  const q = useMemo(
    () => quote({ ...p, costOverride: 0, ...(feedOverride ? { feedOverride } : {}) }, E),
    [p, E, feedOverride]);
  const fmt = n => "€" + Math.round(n).toLocaleString("en-IE");
  const num = n => Math.round(Number(n) || 0).toLocaleString("en-IE");
  const yrs = n => n === null ? "25+" : n === 0 ? tr("pp_immediate") : n.toFixed(1);
  // per-kWh prices need decimals, and 0.036 must not print as "0.04"
  const eurKwh = v => "€" + Number(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

  // How far the array overshoots what the client can actually use, and the size
  // that would roughly match their annual consumption. Honours the monthly
  // profile via the engine's own helper so the two never disagree.
  const consEff = Math.max(0, Number(effectiveConsumption(p)) || 0);
  const oversize = consEff > 0 ? q.e.prod0 / consEff : 0;
  const yieldPerKwp = Number(p.yieldOverride) || Number(E.baseYield) || 1100;
  const suggestKw = consEff > 0 ? consEff / yieldPerKwp : 0;

  /* ---- headline derivations for the System & investment card ---- */
  // Share of the client's OWN use the array covers (distinct from self-consumption,
  // which is the share of PRODUCTION used on site — see Donut).
  const coverage = consEff > 0 ? Math.min(1, (q.e.self * q.e.prod0) / consEff) : 0;
  // grossCost, NOT cost: €/W is the benchmark an installer checks against market
  // rates (~1.0-1.2 €/W), so it has to be the system price. Using the
  // after-grant figure rendered a subsidised 6 kW job at 0.38 €/W — a number
  // that looks broken next to any real quote.
  const costPerW = Number(p.kw) > 0 ? q.e.grossCost / (Number(p.kw) * 1000) : 0;
  // `rows` is cumulative cashflow seeded at -cost, so the final element is the
  // net profit over the horizon and lifetime savings = net + cost.
  const netProfit = q.e.rows.length ? q.e.rows[q.e.rows.length - 1] : 0;
  const lifetime = netProfit + q.e.cost;
  // What the grant knocked off: grossCost is the invoice, cost is out-of-pocket.
  const grants = Math.max(0, q.e.grossCost - q.e.cost);
  const cbMax = Math.max(q.e.cost, lifetime, 1);

  /* ---- commercial metrics: what payback alone doesn't answer ---- */
  const fin = useMemo(() => financials(q.e, q.e.grossCost, disc, E), [q.e, disc, E]);

  // Inputs for the battery sweep: the same project WITHOUT a battery, so the
  // curve measures what each added kWh is worth rather than re-stating the
  // current pick.
  const sweepBase = useMemo(() => {
    const { batt, battKwh, ...rest } = p;
    return { ...rest, costOverride: 0, ...(feedOverride ? { feedOverride } : {}) };
  }, [p, feedOverride]);

  /* debounced autosave — MUST surface failure: a false "Saved" while the write
     was rejected (expired session, offline, RLS) silently loses the edit. */
  async function persist(next) {
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from("projects").update({
        title: next.title, client_name: next.client, address: next.address,
        market: next.market, status: next.status,
        kw: next.kw, price: next.price, cons: next.cons,
        batt: next.batt,
        loan_monthly: next.loan,
        use_monthly: !!next.useMonthly,
        cons_monthly: (next.useMonthly && Array.isArray(next.consMonthly) && next.consMonthly.length === 12)
          ? next.consMonthly : null,
        yield_per_kwp: next.yieldOverride ?? null,
        monthly_yield_shape: next.monthlyYieldShape ?? null,
        owner_id: next.ownerId ?? null,
        next_follow_up: next.nextFollowUp || null,
        notes: next.notes ?? "",
      }).eq("id", initial.id);
      setSaved(error ? "error" : "saved");
      if (error) console.error("autosave failed:", error.message);
      // batt_kwh is written separately + best-effort so a workspace that hasn't
      // run add-battery-kwh.sql yet still autosaves everything else (the column
      // may not exist; swallow that error rather than fail the whole save).
      else {
        sb.from("projects").update({ batt_kwh: next.battKwh }).eq("id", initial.id)
          .then(({ error: e2 }) => { if (e2) console.warn("batt_kwh not stored (run add-battery-kwh.sql?):", e2.message); });
        sb.from("projects").update({ options: next.options }).eq("id", initial.id)
          .then(({ error: e3 }) => { if (e3) console.warn("options not stored (run add-quote-options.sql?):", e3.message); });
        sb.from("projects").update({ bom: next.bom }).eq("id", initial.id)
          .then(({ error: e4 }) => { if (e4) console.warn("bom not stored (run add-quote-bom.sql?):", e4.message); });
        sb.from("projects").update({ lat: next.lat ?? null, lon: next.lon ?? null }).eq("id", initial.id)
          .then(({ error: e5 }) => { if (e5) console.warn("coordinates not stored (run add-project-coords.sql?):", e5.message); });
        sb.from("projects").update({ site_design: next.siteDesign || {} }).eq("id", initial.id)
          .then(({ error: e6 }) => { if (e6) console.warn("site design not stored (run add-site-design.sql?):", e6.message); });
      }
    } catch (e) {
      setSaved("error");
      console.error("autosave threw:", e?.message || e);
    }
  }
  function update(patch) {
    const next = { ...p, ...patch };
    setP(next); setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(next), 600);
  }
  // AI energy-bill extractor: upload a photo/PDF → /api/extract-bill reads it →
  // installer reviews the values → applyBill() fills them in. Never auto-applies.
  async function handleBill(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";                       // allow re-picking the same file
    if (!file) return;
    setBillErr(""); setBillRes(null); setBillBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/extract-bill", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) setBillErr(d.message || tr("bill_err"));
      else setBillRes(d);
    } catch { setBillErr(tr("bill_err")); }
    finally { setBillBusy(false); }
  }
  function applyBill() {
    if (billRes && billRes.annualKwh > 0) {
      const kwh = Math.round(billRes.annualKwh);
      update(p.useMonthly
        ? { cons: kwh, consMonthly: Array(12).fill(Math.round(kwh / 12)) }
        : { cons: kwh });
    }
    setBillRes(null);
  }

  // side-by-side comparison options (max 2 alternatives beyond the base quote)
  const setOption = (i, patch) => update({ options: p.options.map((o, j) => j === i ? { ...o, ...patch } : o) });
  const addOption = () => { if (p.options.length < 2) update({ options: [...p.options, { label: "", kw: p.kw, battKwh: 0 }] }); };
  const removeOption = (i) => update({ options: p.options.filter((_, j) => j !== i) });
  useEffect(() => () => clearTimeout(timer.current), []);

  // A row picked from Design Suggestions replaces whatever inverter line(s)
  // are already in the BOM — never adds a second, competing one alongside it.
  // Supplier-sourced, like autoBom's own lines: no productId, since this isn't
  // the installer's own stocked catalog.
  function applyInverterChoice(row) {
    const kept = (Array.isArray(p.bom) ? p.bom : []).filter((l) => l.kind !== "inverter");
    const line = {
      kind: "inverter", brand: row.inverter.brand, model: row.inverter.model,
      spec: `${row.inverter.kw} kW ${row.inverter.type}`,
      qty: row.count, unit_price: row.inverter.price, source: "supplier",
    };
    update({ bom: [...kept, line] });
  }

  // Picking a different place invalidates a PVGIS yield fetched for the old one
  // — keeping it would quote this roof with another town's sunshine. Moving the
  // pin within ~1 km is the same PVGIS cache cell, so that keeps the yield.
  function pickAddress(a) {
    const moved = p.lat == null || p.lon == null
      || Math.abs(p.lat - a.lat) > 0.01 || Math.abs(p.lon - a.lng) > 0.01;
    update({
      address: a.address, lat: a.lat, lon: a.lng,
      ...(moved && p.yieldOverride ? { yieldOverride: undefined, monthlyYieldShape: undefined } : {}),
    });
  }

  async function fetchPVGIS() {
    if (!p.address && p.lat == null) return alert(tr("add_address"));
    setPvgisBusy(true);
    try {
      // Coordinates from a picked address beat re-geocoding its text: the same
      // street name exists in several towns, and the text lookup can resolve to
      // a different one than the installer saw on the pin.
      const query = p.lat != null && p.lon != null
        ? `lat=${p.lat}&lon=${p.lon}`
        : `address=${encodeURIComponent(p.address)}`;
      const r = await fetch(`/api/pvgis?${query}`);
      const j = await r.json();
      if (j.yieldPerKwp) update({ yieldOverride: j.yieldPerKwp, monthlyYieldShape: j.monthlyShape });
      else alert(j.error || "PVGIS lookup failed");
    } finally { setPvgisBusy(false); }
  }

  // The Site Designer hands back a real, physical panel count per roof plane
  // (lib/roofLayout.js's fitPanels), each with its own drawn tilt/azimuth —
  // so this is the one place that actually exercises /api/pvgis's angle/
  // aspect params instead of always taking the route's 35°/south default.
  // Per-plane yields are combined panel-count-weighted into the single
  // yieldOverride/monthlyYieldShape the engine already consumes.
  async function applySiteDesignLayout(layout) {
    if (!layout || !layout.totalCount) return;
    setSiteDesignApplying(true);
    try {
      const results = await Promise.all(layout.perPlane.filter((pl) => pl.count > 0).map(async (pl) => {
        try {
          const r = await fetch(`/api/pvgis?lat=${pl.lat}&lon=${pl.lon}&angle=${pl.tiltDeg}&aspect=${pl.azimuthDeg}`);
          const j = await r.json();
          return { ...pl, yieldPerKwp: j.yieldPerKwp, monthlyShape: j.monthlyShape };
        } catch { return { ...pl, yieldPerKwp: null }; }
      }));
      const valid = results.filter((r) => r.yieldPerKwp);
      let patch = { kw: layout.kw };
      if (valid.length) {
        const totalCount = valid.reduce((s, r) => s + r.count, 0) || 1;
        patch.yieldOverride = valid.reduce((s, r) => s + r.yieldPerKwp * r.count, 0) / totalCount;
        if (valid.every((r) => Array.isArray(r.monthlyShape) && r.monthlyShape.length === 12)) {
          patch.monthlyYieldShape = Array.from({ length: 12 },
            (_, i) => valid.reduce((s, r) => s + r.monthlyShape[i] * r.count, 0) / totalCount);
        }
      }
      const bomArr = Array.isArray(p.bom) ? p.bom : [];
      const hasPanelLine = bomArr.some((l) => l.kind === "panel");
      patch.bom = hasPanelLine
        ? bomArr.map((l) => l.kind === "panel" ? { ...l, qty: layout.totalCount, brand: layout.panelBrand, model: layout.panelModel } : l)
        : bomArr.length === 0
          ? autoBom(layout.kw, p.battKwh).map((l) => l.kind === "panel" ? { ...l, qty: layout.totalCount } : l)
          : bomArr; // has other lines but no panel line — an unusual manual BOM; leave it rather than guess
      update(patch);
      setSiteDesignerOpen(false);
    } finally {
      setSiteDesignApplying(false);
    }
  }

  async function makeProposal() {
    const code = await createProposal(initial.id);
    setPropUrl(`${location.origin}/p/${code}`);
    if (p.status === "draft") update({ status: "sent" });
    return code;
  }

  async function downloadPdf() {
    // Open the tab synchronously, inside the click gesture, so mobile popup
    // blockers don't swallow it — they do when window.open runs after an await,
    // which is why "Download PDF" appeared to do nothing on a phone.
    const tab = window.open("", "_blank");
    let code = propUrl ? propUrl.split("/p/")[1] : null;
    if (!code) {
      // createProposal is idempotent (returns the existing code), so this does
      // NOT open the share modal — that's why it no longer mirrors "Generate".
      try { code = await createProposal(initial.id); }
      catch { if (tab) tab.close(); return; }
    }
    if (p.status === "draft") update({ status: "sent" });
    // Clean, server-rendered PDF: headless Chromium with displayHeaderFooter:false,
    // so there's NO browser header/footer stamp (page title, URL, date) the way
    // a client-side window.print() leaves. Chromium is pre-warmed when the share
    // panel opens (see the effect below), so this is a short wait, and the tab
    // shows the actual PDF — saveable on desktop and on a phone.
    const url = `/api/proposal/${code}/pdf`;
    if (tab) tab.location.href = url; else window.location.href = url;
  }

  // Chromium's cold launch is ~3.5s. Kick it off when the share modal appears so
  // it finishes while the installer is still reading the link — fire-and-forget,
  // because a failed warm-up must never affect the UI.
  useEffect(() => {
    if (!propUrl && !invOpen) return;
    fetch("/api/proposal/warm", { method: "POST", keepalive: true }).catch(() => { });
  }, [propUrl, invOpen]);

  async function sendProforma() {
    if (!invTo.trim()) return;
    setInvBusy(true); setInvMsg(null);
    try {
      const r = await fetch(`/api/projects/${initial.id}/invoice`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: invTo.trim(), deposit: depPct }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setInvMsg({ ok: true, text: tr("email_sent_to", { to: invTo.trim() }) });
      else setInvMsg({ ok: false, text: d.error === "email_not_configured" ? tr("email_off") : tr("email_failed") });
    } catch {
      setInvMsg({ ok: false, text: tr("email_failed") });
    } finally { setInvBusy(false); }
  }

  async function sendByEmail() {
    const code = propUrl ? propUrl.split("/p/")[1] : null;
    if (!code || !emailTo.trim()) return;
    setEmailBusy(true); setEmailMsg(null);
    try {
      const r = await fetch(`/api/proposal/${code}/email`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: emailTo.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setEmailMsg({ ok: true, text: tr("email_sent_to", { to: emailTo.trim() }) });
      else setEmailMsg({ ok: false, text: d.error === "email_not_configured" ? tr("email_off") : tr("email_failed") });
    } catch {
      setEmailMsg({ ok: false, text: tr("email_failed") });
    } finally { setEmailBusy(false); }
  }

  const mSave = q.e.year1 / 12, net = mSave - (p.loan || 0);
  const mkt = MARKETS[p.market] || MARKETS.RO;
  const prosumerWarn = mkt.prosumer && p.kw > prosumerLimitKw;
  const kwFill = ((p.kw - KW_MIN) / (KW_MAX - KW_MIN)) * 100;

  // Proposal validity: a sent quote is valid for `quoteValidityDays` from when the
  // link was created; older = stale (panel/inverter prices drift — flag it).
  const validityDays = E.quoteValidityDays || 30;
  const validUntilDate = proposalSentAt ? new Date(new Date(proposalSentAt).getTime() + validityDays * 86400000) : null;
  const quoteStale = validUntilDate ? validUntilDate.getTime() < Date.now() : false;
  // app timezone, so this matches the date printed on the client's PDF
  const validUntilStr = validUntilDate ? fmtDate(validUntilDate, { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB") : null;

  // Switching market pre-fills the electricity price with the new market's
  // regional default — but only when the user hasn't typed a custom price yet
  // (i.e. it still equals the old market's default).
  function changeMarket(m) {
    const patch = { market: m };
    const oldDef = (MARKETS[p.market] || {}).defaultPrice;
    if (MARKETS[m] && Math.abs((p.price || 0) - (oldDef || 0)) < 0.0015) patch.price = MARKETS[m].defaultPrice;
    update(patch);
  }

  // A demo-style .check toggle row.
  const check = (on, l, sub, fn) => (
    <label className="check" style={{ marginTop: 10 }}>
      <input type="checkbox" checked={on} onChange={e => fn(e.target.checked)} />
      <span className="toggle-pill" />
      <span className="txt">{l}<small>{sub}</small></span>
    </label>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="ed-head">
        <Link className="back-link" href="/projects">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
          {tr("back_projects").replace("← ", "")}
        </Link>
        <input className="proj-title" value={p.title} onChange={e => update({ title: e.target.value })} />
        <span style={{ fontSize: 12, color: saved === "error" ? "var(--red)" : "var(--muted)", fontWeight: saved === "error" ? 700 : 400 }}>
          {saved === "saving" ? tr("saving") : saved === "error" ? tr("save_failed") : tr("saved")}
          {saved === "error" && (
            <button className="btn sm danger" style={{ marginLeft: 8 }} onClick={() => { setSaved("saving"); persist(p); }}>{tr("retry")}</button>
          )}
        </span>
        <span className="spacer" />
        {tplOpen ? (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input autoFocus className="input" value={tplName} maxLength={40}
              onChange={e => setTplName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveTemplate(); if (e.key === "Escape") setTplOpen(false); }}
              placeholder={tr("tpl_name_ph")} style={{ width: 160, padding: "8px 11px" }} />
            <button className="btn primary" disabled={tplBusy || !tplName.trim()} onClick={saveTemplate}>{tr("tpl_save_confirm")}</button>
            <button className="btn ghost" onClick={() => setTplOpen(false)} aria-label={tr("tpl_cancel")}>✕</button>
          </span>
        ) : (
          <button className="btn ghost" onClick={openTemplate}>{tplSaved ? tr("tpl_saved") : tr("tpl_save")}</button>
        )}
        <button className="btn ghost" onClick={downloadPdf}>{tr("dl_pdf")}</button>
        <button className="btn ghost" onClick={() => setInvOpen(true)}>{tr("inv_button")}</button>
        <button className="btn primary" onClick={makeProposal}>{tr("gen_proposal")}</button>
      </div>

      {proposalSentAt && (
        <div style={{ margin: "-8px 0 16px", fontSize: 12.5, fontWeight: quoteStale ? 700 : 400,
          color: quoteStale ? "var(--red)" : "var(--muted)" }}>
          {tr("q_valid_until", { d: validUntilStr })}{quoteStale ? " · " + tr("q_stale") : ""}
        </div>
      )}

      <div className="editor">
        {/* left: inputs */}
        <div className="stack">
          <section className="card">
            <h3>{tr("client_site")}</h3>
            <div className="field"><label>{tr("client_name")}</label>
              <input className="input" value={p.client} onChange={e => update({ client: e.target.value })} /></div>
            <div className="field"><label>{tr("address")}</label>
              <AddressField
                lang={lang}
                value={p.address}
                lat={p.lat}
                lng={p.lon}
                mapSize={260}
                onText={(s) => update({ address: s, lat: null, lon: null })}
                onPick={pickAddress}
              />
            </div>

            {/* Draw the roof on real satellite imagery instead of assuming one
                flat 35°-south plane — see components/SiteDesigner.jsx. Needs a
                resolved pin, same requirement as the PVGIS fetch below. */}
            <button className="btn ghost" style={{ width: "100%", marginBottom: 10 }}
              disabled={p.lat == null || p.lon == null}
              title={p.lat == null || p.lon == null ? tr("site_designer_need_address") : undefined}
              onClick={() => setSiteDesignerOpen(true)}>
              {tr("site_designer_open")}
            </button>

            <button className={p.yieldOverride ? "btn amber" : "btn ghost"} style={{ width: "100%" }}
              onClick={fetchPVGIS} disabled={pvgisBusy}>
              {pvgisBusy ? tr("pvgis_fetching")
                : p.yieldOverride ? tr("pvgis_real", { n: Math.round(p.yieldOverride) })
                : tr("pvgis_use")}
            </button>
            {p.yieldOverride && (
              <div className="pvgis-data">
                <span className="pvg-k">{Math.round(p.yieldOverride)}</span> {tr("unit_kwp_yr")}
                {Array.isArray(p.monthlyYieldShape) && p.monthlyYieldShape.length === 12 && <> · {tr("pvgis_monthly")}</>}
                {/* Sunny Design names a "site for meteorological data" and a
                    distance to it — SMA runs on a network of physical
                    stations, so that number means something for them. PVGIS is
                    gridded satellite irradiance, not station lookups, so a
                    fabricated "X km away" would be a made-up number wearing
                    their UI's clothes. This states what the source actually is. */}
                <div className="pvgis-src">{tr("pvgis_src")}</div>
              </div>
            )}

            {/* What the installed base measured. Offered, never applied on its
                own: a yield that drifts by itself is the opposite of the
                promise this product is sold on. */}
            {calibration?.confident && p.yieldOverride && (() => {
              const tuned = Math.round(applyCalibration(p.yieldOverride, calibration));
              const deltaPct = (calibration.factor - 1) * 100;
              const applied = Math.abs(tuned - Math.round(p.yieldOverride)) < 1;
              return (
                <div className="cal-note">
                  <div className="cal-h">
                    {tr("cal_title", { n: Math.abs(deltaPct).toFixed(0), d: tr(deltaPct >= 0 ? "cal_above" : "cal_below") })}
                  </div>
                  <div className="cal-s">{tr("cal_basis", { s: calibration.systems, m: calibration.months })}</div>
                  {!applied && (
                    <button className="btn ghost sm" style={{ marginTop: 8 }}
                      onClick={() => update({ yieldOverride: tuned })}>
                      {tr("cal_apply", { n: tuned })}
                    </button>
                  )}
                </div>
              );
            })()}

            {team.length >= 1 && (
              <div className="field" style={{ marginTop: 15 }}><label>{tr("proj_owner")}</label>
                <select className="input" value={p.ownerId || ""} onChange={e => update({ ownerId: e.target.value || null })}>
                  <option value="">—</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                </select>
              </div>
            )}
            <div className="field"><label>{tr("market")}</label>
              <select className="input" value={p.market} onChange={e => changeMarket(e.target.value)}>
                <option value="MD">{tr("market_md")}</option>
                <option value="RO">{tr("market_ro")}</option>
              </select></div>
            <div className="field"><label>{tr("next_followup")}</label>
              <input className="input" type="date" value={p.nextFollowUp || ""}
                onChange={e => update({ nextFollowUp: e.target.value })} /></div>
            <div className="field"><label>{tr("notes_label")}</label>
              <textarea className="input" rows={3} value={p.notes} placeholder={tr("notes_ph")}
                onChange={e => update({ notes: e.target.value })} /></div>
            {initial.referral_source && (
              <div className="field" style={{ marginBottom: 0 }}><label>{tr("ref_source_label")}</label>
                <div style={{ fontSize: 13.5, color: "var(--ink)", background: "var(--green-tint)", borderRadius: 8, padding: "8px 11px", fontWeight: 600 }}>
                  {tr("ref_opt_" + initial.referral_source)}
                </div></div>
            )}
            {prosumerWarn && <div className="warn-card" style={{ marginTop: 15 }}>{tr("prosumer_warn", { n: prosumerLimitKw })}</div>}
          </section>

          <section className="card">
            <h3>{tr("system")}</h3>
            <div className="field">
              <label>{tr("system_size")}<output>{p.kw.toFixed(1)} kW</output></label>
              <div className="slider-row">
                <input type="range" min={KW_MIN} max={KW_MAX} step="0.5" value={p.kw} style={{ "--fill": kwFill + "%" }}
                  aria-valuemin={KW_MIN} aria-valuemax={KW_MAX} aria-valuenow={p.kw}
                  onChange={e => update({ kw: +e.target.value })} />
                {/* A drag is imprecise once the range spans 2-500 kW — this
                    lets an exact figure (from a real design, a client ask) be
                    typed directly instead of hunted for on the slider. */}
                <input type="number" className="slider-num" inputMode="decimal" step="0.1"
                  aria-label={tr("system_size")} value={p.kw}
                  onChange={e => update({ kw: +e.target.value || KW_MIN })} />
              </div>
            </div>
            <div className="field"><label>{tr("elec_price")}</label>
              <input className="input" type="number" step="0.01" value={p.price}
                onChange={e => update({ price: +e.target.value || 0.21 })} /></div>
            {!p.useMonthly && (
              <div className="field"><label>{tr("annual_cons")}</label>
                <input className="input" type="number" step="100" value={p.cons}
                  onChange={e => update({ cons: +e.target.value || 5000 })} /></div>
            )}
            {check(p.useMonthly, tr("use_monthly"), tr("use_monthly_sub"),
              v => update(v
                ? { useMonthly: true, consMonthly: (Array.isArray(p.consMonthly) && p.consMonthly.length === 12)
                    ? p.consMonthly : Array(12).fill(Math.round((p.cons || 5000) / 12)) }
                : { useMonthly: false }))}
            {p.useMonthly && (
              <div style={{ marginTop: 12 }}>
                <div className="mo-grid">
                  {monthLabels(lang).map((m, i) => (
                    <div className="mo-cell" key={i}>
                      <label>{m}</label>
                      <input className="input mo-in" type="number" min="0" step="10"
                        value={(p.consMonthly && p.consMonthly[i]) ?? 0}
                        onChange={e => {
                          const arr = (Array.isArray(p.consMonthly) && p.consMonthly.length === 12)
                            ? p.consMonthly.slice() : Array(12).fill(0);
                          arr[i] = +e.target.value || 0;
                          update({ consMonthly: arr });
                        }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, textAlign: "right" }}>
                  {tr("mo_total_yr", { v: (p.consMonthly || []).reduce((a, b) => a + (+b || 0), 0).toLocaleString() })}
                </div>
              </div>
            )}
            {/* AI energy-bill extractor — snap the client's bill, review, apply */}
            <input ref={billInput} type="file" accept="image/*,application/pdf" hidden onChange={handleBill} />
            <button type="button" className="btn ghost" style={{ width: "100%", marginTop: 8 }}
              onClick={() => billInput.current && billInput.current.click()} disabled={billBusy}>
              {billBusy ? tr("bill_reading") : tr("bill_upload")}
            </button>
            {billErr && <div style={{ fontSize: 12.5, color: "var(--red)", marginTop: 6 }}>{billErr}</div>}
            {billRes && (
              <div className="pvgis-data" style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{tr("bill_found")}</div>
                <div>{tr("annual_cons")}: <span className="pvg-k">{billRes.annualKwh ? Math.round(billRes.annualKwh).toLocaleString() : "—"}</span> kWh</div>
                {billRes.meterNumber && <div>{tr("bill_meter")}: {billRes.meterNumber}</div>}
                {billRes.supplier && <div>{tr("bill_supplier")}: {billRes.supplier}</div>}
                {billRes.subsidy && <div>{tr("bill_subsidy")}: {billRes.subsidy}</div>}
                {billRes.notes && <div style={{ color: "var(--muted)", marginTop: 2 }}>{billRes.notes}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn sm primary" onClick={applyBill} disabled={!billRes.annualKwh}>{tr("bill_apply")}</button>
                  <button type="button" className="btn sm ghost" onClick={() => setBillRes(null)}>{tr("bill_cancel")}</button>
                </div>
              </div>
            )}
            {/* System type as a real, first-class choice — grid-tied and
                hybrid are different products (different pitch: bill savings
                vs. bill savings + backup resilience), not one checkbox among
                many sizing inputs. Still just p.batt underneath, so the
                capacity input below and the rest of the app (engine, PDF,
                design checks) are unchanged. */}
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{tr("sys_type_label")}</label>
              <div className="seg2">
                <button type="button" className={!p.batt ? "on" : ""} onClick={() => update({ batt: false })}>
                  {tr("sys_type_grid")}
                </button>
                <button type="button" className={p.batt ? "on" : ""} onClick={() => update({ batt: true })}>
                  {tr("sys_type_hybrid")}
                </button>
              </div>
            </div>
            {p.batt && (() => {
              const battCost = (Number(p.battKwh) || 0) * (Number(E.batteryCostPerKwh) || 500);
              return (
                <div className="field" style={{ margin: "2px 0 4px 30px" }}>
                  <label>{tr("battery_cap")}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <input className="input" type="number" min="0" step="0.5" style={{ width: 120 }}
                      value={p.battKwh} onChange={e => update({ battKwh: +e.target.value || 0 })} />
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>kWh · {fmt(battCost)}</span>
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="card">
            <h3>{tr("opt_title")}</h3>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>{tr("opt_sub")}</p>
            {p.options.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: "1 1 120px" }}><label>{tr("opt_label")}</label>
                  <input className="input" value={o.label} maxLength={40} placeholder={`${tr("pp_option")} ${i + 2}`}
                    onChange={e => setOption(i, { label: e.target.value })} /></div>
                <div className="field" style={{ width: 74 }}><label>kW</label>
                  <input className="input" type="number" min="0" step="0.5" value={o.kw}
                    onChange={e => setOption(i, { kw: +e.target.value || 0 })} /></div>
                <div className="field" style={{ width: 84 }}><label>{tr("opt_batt")}</label>
                  <input className="input" type="number" min="0" step="0.5" value={o.battKwh}
                    onChange={e => setOption(i, { battKwh: +e.target.value || 0 })} /></div>
                <button className="btn ghost" style={{ padding: "9px 12px" }} onClick={() => removeOption(i)}
                  aria-label={tr("opt_remove")}>✕</button>
              </div>
            ))}
            {p.options.length < 2 && (
              <button className="btn ghost" onClick={addOption}>+ {tr("opt_add")}</button>
            )}
          </section>

          <BomCard
            lang={lang}
            bom={p.bom}
            onChange={(bom) => update({ bom })}
            catalog={catalog}
            kw={p.kw}
            battKwh={p.batt ? (Number(p.battKwh) || 0) : 0}
            quotePrice={q.e.grossCost}
            money={fmt}
          />

        </div>

        {/* right: results */}
        <div className="stack">
          <section className="card">
            <h3>{tr("sys_investment")}</h3>
            <div className="cost-line">
              <div className="k"><b>{fmt(q.e.cost)}</b>
                <span>{tr("total_invest")}</span></div>
              <div className="k"><b>{Math.round(q.e.prod0).toLocaleString()} kWh</b>
                <span>{tr("prod_year")}{p.yieldOverride ? " " + tr("tag_pvgis") : " " + tr("tag_default")}</span></div>
              <div className="k"><b>{fmt(q.e.year1)}</b><span>{tr("savings_y1")}</span></div>
            </div>
            {/* Cost per watt is how installers sanity-check a price against the
                market in one glance — €/W here, not the demo's lei/W, because
                this installer-side view is EUR throughout (see fmt above). */}
            {costPerW > 0 && (
              <div className="cost-spec">{tr("cost_per_w")}: <b>{costPerW.toFixed(2)} €/W</b></div>
            )}
            {/* Ring + legend side by side. Previously a spacer shoved the ring to
                the far right of the number row, leaving a dead gap across the
                card and squeezing the caption into four wrapped lines. */}
            <div className="self-split">
              <Donut self={q.e.self} prod0={q.e.prod0} cons={consEff} lang={lang} />
              <div className="ss-legend">
                <div className="ss-item"><i style={{ background: "var(--green)" }} />
                  {tr("self_consumed")}<b>{Math.round(q.e.self * 100)}%</b></div>
                <div className="ss-item"><i style={{ background: "var(--amber)", opacity: .65 }} />
                  {tr("exported")}<b>{Math.round((1 - q.e.self) * 100)}%</b></div>
                {consEff > 0 && (
                  <div className="ss-cov">{tr("donut_covers", { n: Math.round(coverage * 100) })}</div>
                )}
              </div>
            </div>
            {/* Installer-side only (never reaches the client). An array that dwarfs the
                household's use looks fine on every headline number except payback —
                because the surplus earns the export tariff, not the retail price. */}
            {oversize > 1.8 && (
              <div className="warn-card">
                {tr("oversize_warn", {
                  x: oversize < 10 ? oversize.toFixed(1) : Math.round(oversize),
                  p: Math.round((1 - q.e.self) * 100),
                  fe: eurKwh(mkt.feed), pr: eurKwh(Number(p.price) || 0),
                })}
                {suggestKw > 0 ? " " + tr("oversize_hint", { kw: suggestKw.toFixed(1) }) : ""}
              </div>
            )}

            {/* Investment vs lifetime return: two proportional bars and the net.
                The engine returns neither `lifetime` nor `netProfit`, but `rows`
                is the cumulative cashflow starting at -cost, so its last element
                IS the net profit and lifetime = net + cost. Derived that way
                rather than from `roi`, which is null when a grant covers the
                whole system and would drop the block exactly when it matters. */}
            <div className="cost-break">
              <div className="cb-t">{tr("cb_title", { h: E.horizon })}</div>
              {[[tr("cb_cost"), q.e.cost, "cb-cost"], [tr("cb_life"), lifetime, "cb-life"]].map(([lbl, val, cls]) => (
                <div className="cb-row" key={cls}>
                  <span className="cb-lbl">{lbl}</span>
                  <span className="cb-track">
                    <i className={cls} style={{ width: Math.max(3, (val / cbMax) * 100).toFixed(1) + "%" }} />
                  </span>
                  <b className="cb-val">{fmt(val)}</b>
                </div>
              ))}
              {grants > 0 && <div className="cb-grant">{tr("cb_grants")}: −{fmt(grants)}</div>}
              <div className="cb-net">
                <span>{tr("cb_net")}</span>
                <b className={netProfit >= 0 ? "" : "neg"}>{fmt(netProfit)}</b>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>{tr("payback_title")}</h3>
            <div className="bands">
              {[["pess", tr("pessimistic"), q.p], ["expc", tr("expected"), q.e], ["opti", tr("optimistic"), q.o]]
                .map(([cls, l, b]) => (
                <div key={cls} className={`band ${cls}`}>
                  <div className="tag">{l}</div>
                  <div className="yrs">{yrs(b.payback)} <small>{tr("yrs")}</small></div>
                  {/* roi is null when a grant covers the whole system — return on a
                      zero outlay is undefined, so show ∞ rather than a made-up number. */}
                  <div className="roi">{tr("roi_line", { h: E.horizon, n: b.roi == null ? "∞" : Math.round(b.roi) })}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}><Chart q={q} lang={lang} /></div>

            {/* NPV / IRR / LCOE — what a commercial client or a lender asks for
                once payback alone stops being the whole question. */}
            <div className="fin-metrics">
              <div className="fm"><b>{fmt(fin.npv)}</b><span>{tr("m_npv")} @ {disc.toFixed(0)}%</span></div>
              <div className="fm"><b>{fin.irr == null ? "—" : (fin.irr * 100).toFixed(1) + "%"}</b><span>{tr("m_irr")}</span></div>
              <div className="fm"><b>€{fin.lcoe.toFixed(3)}</b>
                <span>{tr("m_lcoe")} · {tr("m_vs_price")} {eurKwh(Number(p.price) || 0)}</span></div>
            </div>
            <label className="disc-row">
              {tr("m_disc")}<output>{disc.toFixed(1)}%</output>
              <input type="range" min="3" max="12" step="0.5" value={disc}
                style={{ "--fill": ((disc - 3) / 9) * 100 + "%" }}
                onChange={e => setDisc(+e.target.value)} />
            </label>
          </section>

          {/* Whether the thing is buildable, before whether it's profitable —
              run against the equipment actually picked in the bill of materials. */}
          <DesignChecks
            lang={lang}
            bom={p.bom}
            kw={p.kw}
            battKwh={p.batt ? (Number(p.battKwh) || 0) : 0}
            consKwh={consEff}
          />

          {/* Compare every inverter that could serve this array, not just the
              one in the BOM — applying a row swaps the BOM's inverter line. */}
          <DesignSuggestions
            lang={lang}
            bom={p.bom}
            kw={p.kw}
            battKwh={p.batt ? (Number(p.battKwh) || 0) : 0}
            onApply={applyInverterChoice}
          />

          {/* Battery sizing and the surplus price: the two questions an offer in
              Moldova actually turns on. Both computed by the engine for THIS
              client — the same panels Studio shows, not a second implementation. */}
          <BatterySizingPanel
            lang={lang}
            base={sweepBase}
            E={E}
            battKwh={p.batt ? (Number(p.battKwh) || 0) : 0}
            onApply={(kwh) => update({ batt: kwh > 0, battKwh: kwh })}
            money={fmt}
            spread={isMD ? buyback.spread : null}
            netMetering={mkt.oneToOne}
          />

          {isMD && (
            <SurplusPanel
              lang={lang}
              buyback={buyback}
              prodKwh={q.e.prod0}
              selfRatio={q.e.self}
              mdlPerEur={FX.MDL}
              money={fmt}
              num={num}
            />
          )}

          <section className="card">
            <h3>{tr("financing")}</h3>
            <div className="fin-split">
              <div className="fin-box">
                <div className="lbl">{tr("monthly_loan")}</div>
                <input type="number" value={p.loan} onChange={e => update({ loan: +e.target.value || 0 })} />
              </div>
              <div className="fin-box">
                <div className="lbl">{tr("est_savings")}</div>
                <div className="big">{fmt(mSave)}</div>
              </div>
            </div>
            <div className={`verdict ${net >= 0 ? "good" : "bad"}`}>
              {net >= 0 ? tr("save_pos", { x: fmt(net) }) : tr("save_neg")}
            </div>
          </section>

          {signed && <SignedContract signed={signed} lang={lang} />}

          {p.status === "won" && (
            <InstallChecklist projectId={initial.id} initial={initial.install_progress} lang={lang} />
          )}
        </div>
      </div>

      {/* site designer modal: draw the roof on satellite imagery */}
      {siteDesignerOpen && p.lat != null && p.lon != null && (
        <div className="overlay" onClick={() => setSiteDesignerOpen(false)}>
          <div className="modal sd-modal" onClick={e => e.stopPropagation()}>
            <h4>{tr("site_designer_title")}</h4>
            <SiteDesigner lang={lang} lat={p.lat} lon={p.lon} siteDesign={p.siteDesign}
              onChange={(sd) => update({ siteDesign: sd })}
              onApply={applySiteDesignLayout} applying={siteDesignApplying} />
            <div className="modal-acts" style={{ marginTop: 14 }}>
              <button className="btn ghost" onClick={() => setSiteDesignerOpen(false)}>{tr("close")}</button>
            </div>
          </div>
        </div>
      )}

      {/* proforma modal: pick a deposit, then open the document */}
      {invOpen && (
        <div className="overlay" onClick={() => setInvOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h4>{tr("inv_dep_title")}</h4>
            <p className="sub">{tr("inv_dep_sub")}</p>
            <div className="dep-seg" role="radiogroup" aria-label={tr("inv_dep_title")}>
              {[0, 30, 50].map(v => (
                <button key={v} type="button" role="radio" aria-checked={depPct === v}
                  className={"dep-opt" + (depPct === v ? " on" : "")}
                  onClick={() => setDepPct(v)}>
                  {v === 0 ? tr("inv_dep_full") : v + "%"}
                </button>
              ))}
            </div>
            <div className="dep-amount">
              {depPct > 0
                ? <>{fmt(q.e.grossCost * depPct / 100)} <span>/ {fmt(q.e.grossCost)}</span></>
                : fmt(q.e.grossCost)}
            </div>
            <div className="email-row">
              <input type="email" inputMode="email" autoComplete="email"
                placeholder={tr("email_ph")} value={invTo}
                onChange={e => { setInvTo(e.target.value); setInvMsg(null); }} />
              <button className="btn sm primary" onClick={sendProforma}
                disabled={invBusy || !invTo.trim()}>
                {invBusy ? tr("email_sending") : tr("inv_email")}
              </button>
            </div>
            {invMsg && <div className={"email-msg" + (invMsg.ok ? " ok" : " bad")}>{invMsg.text}</div>}
            <div className="modal-acts">
              <button className="btn ghost" onClick={() => setInvOpen(false)}>{tr("close")}</button>
              {/* Server-rendered: the browser print path stamped Chrome's header
                  and the internal /projects/<uuid> URL onto a financial document. */}
              <a className="btn ghost" target="_blank" rel="noopener noreferrer"
                href={`/api/projects/${initial.id}/invoice${depPct > 0 ? `?deposit=${depPct}` : ""}`}>{tr("inv_dl")}</a>
              <a className="btn primary" target="_blank" rel="noopener noreferrer"
                href={`/projects/${initial.id}/invoice${depPct > 0 ? `?deposit=${depPct}` : ""}`}
                onClick={() => setInvOpen(false)}>{tr("inv_dep_open")}</a>
            </div>
          </div>
        </div>
      )}

      {/* proposal modal */}
      {propUrl && (
        <div className="overlay" onClick={() => setPropUrl(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h4>{tr("prop_title")}</h4>
            <p className="sub">{tr("prop_desc", { client: p.client || tr("your_client") })}</p>
            <div className="link-row">
              <code>{propUrl}</code>
              <button className="btn sm amber" onClick={() => {
                navigator.clipboard?.writeText(propUrl);
                setCopied(true); setTimeout(() => setCopied(false), 1800);
              }}>{copied ? tr("t_copied") : tr("copy")}</button>
            </div>
            {/* WhatsApp is how solar sells in RO/MD — pre-write the message + link */}
            <a className="btn wapp" style={{ width: "100%", marginBottom: 10 }}
              href={`https://wa.me/?text=${encodeURIComponent(tr("wa_message", { client: p.client || tr("your_client"), company: companyName, url: propUrl }))}`}
              target="_blank" rel="noopener noreferrer">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.22 8.22 0 0 1-1.26-4.4c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.24-8.22 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.42.06-.64.31-.22.25-.84.83-.84 2.02 0 1.19.86 2.34.98 2.5.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.5.57.19 1.1.16 1.51.1.46-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" /></svg>
              {tr("wa_share")}
            </a>
            {/* Email the PDF. Rendering happens server-side, so this takes a
                couple of seconds — the button states say so rather than looking
                dead. */}
            <div className="email-row">
              <input type="email" inputMode="email" autoComplete="email"
                placeholder={tr("email_ph")} value={emailTo}
                onChange={e => { setEmailTo(e.target.value); setEmailMsg(null); }} />
              <button className="btn sm primary" onClick={sendByEmail}
                disabled={emailBusy || !emailTo.trim()}>
                {emailBusy ? tr("email_sending") : tr("send_email")}
              </button>
            </div>
            {emailMsg && (
              <div className={"email-msg" + (emailMsg.ok ? " ok" : " bad")}>{emailMsg.text}</div>
            )}

            <ShareCard lang={lang} companyName={companyName} companyLogo={companyLogo}
              client={p.client || tr("your_client")}
              systemLabel={`${p.kw.toFixed(1)} kW${p.batt ? " + " + (p.battKwh || 10) + " kWh" : ""}`}
              bands={[
                { label: tr("pessimistic"), years: yrs(q.p.payback) + " " + tr("yrs") },
                { label: tr("expected"), years: yrs(q.e.payback) + " " + tr("yrs") },
                { label: tr("optimistic"), years: yrs(q.o.payback) + " " + tr("yrs") },
              ]}
              savings={fmt(q.e.rows[q.e.rows.length - 1])}
              waText={tr("wa_message", { client: p.client || tr("your_client"), company: companyName, url: propUrl })} />
            <div className="modal-acts">
              <button className="btn ghost" onClick={() => setPropUrl(null)}>{tr("close")}</button>
              <a className="btn primary" href={propUrl} target="_blank" rel="noopener noreferrer">{tr("open_as_client")}</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
