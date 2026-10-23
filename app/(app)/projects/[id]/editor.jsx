"use client";
// app/(app)/projects/[id]/editor.jsx — the quote editor, powered by the shared
// engine. Autosaves to Supabase (debounced 600ms). PVGIS button pulls real yield
// for the address. Proposal button creates the tracked link. Visual language
// matches the live demo (editor grid, cards, bands, financing, modal).
//
// A summary bar under the header stays pinned while the inputs scroll, so the
// numbers the client will see (price, payback, savings) and the margin behind
// them update in view as each input changes.
import "../../dx.css";
import "./builder.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "../../../../lib/supabase-browser.js";
import { regenerateProposal, saveQuoteTemplate, markProjectWon, offerPhone, issueInvoice } from "../../../../lib/actions.js";
import { sendOffer } from "../../../../lib/sendOffer.js";
import { isStandalone, openPdfInApp } from "../../../../lib/openPdf.js";
import { aiOn } from "../../../../lib/featureFlags.js";
import AddressField from "../../../../components/AddressField.jsx";
import SiteDesigner from "../../../../components/SiteDesigner.jsx";
import BackLink from "../../../../components/BackLink.jsx";
import NumInput from "../../../../components/NumInput.jsx";
import { productionPower } from "../../../../lib/gridPower.js";
import BomCard from "../../../../components/BomCard.jsx";
import DesignChecks from "../../../../components/DesignChecks.jsx";
import StructuralLoads from "../../../../components/StructuralLoads.jsx";
import BosEstimate from "../../../../components/BosEstimate.jsx";
import PeakShaving from "../../../../components/PeakShaving.jsx";
import DesignSuggestions from "../../../../components/DesignSuggestions.jsx";
import BatterySizingPanel from "../../../../components/BatterySizingPanel.jsx";
import SurplusPanel, { useBuyback } from "../../../../components/SurplusPanel.jsx";
import UaPanel from "../../../../components/UaPanel.jsx";
import InstallChecklist from "./InstallChecklist.jsx";
import GridFile from "./GridFile.jsx";
import RoofPhoto from "./RoofPhoto.jsx";
import FoldColumn from "../../../../components/FoldColumn.jsx";
import StudioJobLine from "./StudioJobLine.jsx";
import WorkflowRail from "../../../../components/WorkflowRail.jsx";
import AddToPortfolio from "../../../../components/AddToPortfolio.jsx";
import SupportCard from "../../../../components/SupportCard.jsx";
import RaionCard from "../../../../components/RaionCard.jsx";
import { batteryEur } from "../../../../lib/greenSupport.js";
import SignedContract from "./SignedContract.jsx";
import ShareCard from "./ShareCard.jsx";
import LegalDocsModal from "./LegalDocsModal.jsx";
import { quote, MARKETS, FX, effectiveConsumption } from "@voltmira/engine";
import { financials, bomTotal } from "../../../../lib/quoteAnalysis.js";
import { startYearOf, mdFeedFor } from "../../../../lib/quoteInput.js";
import { t } from "../../../../lib/i18n.js";
import { dec } from "../../../../lib/decimals.js";
import { kwUnit } from "../../../p/[code]/text.js";
import { xt } from "../../../../lib/integrationText.js";
import { autoBom, recommendMount, findPanel } from "../../../../lib/supplierCatalog.js";
import { fmtDate } from "../../../../lib/tz.js";
import { designCheck } from "../../../../lib/designCheck.js";
import { fitSidesFor, limitPanels } from "../../../../lib/roofLayout.js";
import { blendYields, fetchSideYield } from "../../../../lib/sideYield.js";
import { moneyFormatter, numFor } from "../../../../lib/money.js";
import { effectiveOfferCurrency, currencyOnMarketChange, betterCurrencyFor, normCurrency } from "../../../../lib/offerCurrency.js";
import { saveOutbox, readOutbox, clearOutbox, isNetworkError } from "../../../../lib/offline.js";
import LinkLabels from "../../../../components/LinkLabels.jsx";
import { isPlaceholderTitle } from "../../../../lib/quoteTitle.js";

// System-size slider range — raised to 500 kW: Site Designer's own real,
// drawn-roof panel counts can land well past a "residential" size for a large
// commercial roof, and the slider must be able to show whatever it applied.
const KW_MIN = 2, KW_MAX = 500;

// Short month labels in the app's language, via Intl — no extra i18n keys needed.
function monthLabels(lang) {
  const loc = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB";
  const fmt = new Intl.DateTimeFormat(loc, { month: "short" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2021, i, 1)));
}

/* ---------- small SVG helpers ---------- */
// Line icons for the header actions and tool buttons (Lucide geometry).
const QI = {
  pdf: <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" /></>,
  receipt: <><path d="M13 16H8" /><path d="M14 8H8" /><path d="M16 12H8" /><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" /></>,
  scale: <><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></>,
  bookmark: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  roof: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
  upload: <><path d="M12 3v12" /><path d="m17 8-5-5-5 5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></>,
  chev: <path d="m9 18 6-6-6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
};
const Qi = ({ d, size = 15, w = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{QI[d]}</svg>
);

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
      aria-label={t("ss_ring_aria", lang, { s: Math.round(sc * 100), c: Math.round(coverage * 100) })}>
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

/* ---------- the offer's currency ---------- */
// Copy for the currency choice, in the four languages, kept beside the one
// place that uses it rather than in lib/i18n.js (same helper as UaPanel).
const t3 = (lang, ro, en, ru, uk) => (lang === "en" ? en : lang === "ru" ? ru : lang === "uk" ? (uk ?? en) : ro);
// Each currency as an option, as the object of "switch the offer to ...", and
// the client it suits ("for a client in Ukraine").
const CUR_TXT = {
  MDL: { opt: ["Lei moldovenești (MDL)", "Moldovan lei (MDL)", "Молдавские леи (MDL)", "Молдовські леї (MDL)"],
    short: ["lei, MDL", "lei, MDL", "леи, MDL", "леї, MDL"],
    acc: ["lei moldovenești (MDL)", "Moldovan lei (MDL)", "молдавские леи (MDL)", "молдовські леї (MDL)"],
    who: ["un client din Moldova", "a client in Moldova", "клиента из Молдовы", "клієнта з Молдови"] },
  UAH: { opt: ["Grivne ucrainene (UAH)", "Ukrainian hryvnia (UAH)", "Украинские гривны (UAH)", "Українські гривні (UAH)"],
    short: ["grivne, UAH", "hryvnia, UAH", "гривны, UAH", "гривні, UAH"],
    acc: ["grivne (UAH)", "hryvnia (UAH)", "гривны (UAH)", "гривні (UAH)"],
    who: ["un client din Ucraina", "a client in Ukraine", "клиента из Украины", "клієнта з України"] },
  EUR: { opt: ["Euro (EUR)", "Euro (EUR)", "Евро (EUR)", "Євро (EUR)"],
    short: ["euro, EUR", "euro, EUR", "евро, EUR", "євро, EUR"],
    acc: ["euro (EUR)", "euro (EUR)", "евро (EUR)", "євро (EUR)"],
    who: ["", "", "", ""] },
  RON: { opt: ["Lei românești (RON)", "Romanian lei (RON)", "Румынские леи (RON)", "Румунські леї (RON)"],
    short: ["lei, RON", "lei, RON", "леи, RON", "леї, RON"],
    acc: ["lei românești (RON)", "Romanian lei (RON)", "румынские леи (RON)", "румунські леї (RON)"],
    who: ["un client din România", "a client in Romania", "клиента из Румынии", "клієнта з Румунії"] },
};
const curTxt = (lang, cur, k) => t3(lang, ...(CUR_TXT[cur] || CUR_TXT.EUR)[k]);

/* ---------- editor ---------- */
// A labelled switch. A component of its own (not a helper called while the page renders), so the handler it is
// given is never taken for something that runs during render.
function CheckRow({ on, label, sub, onChange }) {
  return (
    <label className="check" style={{ marginTop: 10 }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-pill" />
      <span className="txt">{label}<small>{sub}</small></span>
    </label>
  );
}

// A money field typed in the offer's own currency (lei, hryvnia), for the
// electricity price and the monthly loan payment. The quote stores EUR, so the
// field keeps the text being typed ("3," then "3,4") and only converts what it
// hands on; it shows the stored amount, in the offer's currency, again once it
// loses focus. allowZero: an empty or 0 field means 0 (a loan), not "ignore".
function LocalMoneyInput({ eur, fmt, onEur, dec = 2, allowZero = false, className = "input" }) {
  const [draft, setDraft] = useState(null);
  const f = 10 ** dec;
  const shown = draft ?? String(Math.round(fmt.toLocal(eur) * f) / f);
  return (
    <input className={className} type="number" step={dec > 0 ? 1 / f : 1} min="0" value={shown}
      onFocus={() => setDraft(shown)} onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = e.target.value === "" ? 0 : +e.target.value;
        if (allowZero ? v >= 0 : v > 0) onEur(fmt.fromLocal(v));
      }} />
  );
}

// `currency` is the WORKSPACE's (companies.currency); the offer may name its
// own (p.offerCurrency, null = follow the workspace), see lib/offerCurrency.js.
export default function Editor({ initial, engineSettings: E, prosumerLimitKw, lang, currency: workspaceCurrency = "EUR", team = [], catalog = [], proposalSentAt = null, companyName = "VoltMira", companyLogo = "", companyLegal = {}, signed = null, signedOffer = null, canEditTechnical = true, vatRatePct = 0, cnedOn = false, loans = [], gridSub = null }) {
  const tr = (k, v) => t(k, lang, v);
  const [p, setP] = useState({
    title: initial.title, client: initial.client_name, clientEmail: initial.client_email || "", address: initial.address,
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
    tariffMode: initial.tariff_mode || "flat",
    ownerId: initial.owner_id || null,
    nextFollowUp: initial.next_follow_up || "",
    notes: initial.notes || "",
    // Ukraine: outage length, what stays on, generator, Energy Credit term (UaPanel)
    uaPlan: initial.ua_plan && typeof initial.ua_plan === "object" ? initial.ua_plan : {},
    // The currency this offer is written in; null follows the workspace.
    offerCurrency: normCurrency(initial.offer_currency),
  });
  // The newest state, for handlers that run after an await (a PVGIS lookup, the designer closing):
  // merging into the render's copy of `p` would put back whatever was typed in the meantime.
  const pRef = useRef(null);
  if (pRef.current === null) pRef.current = p;
  // The status the database is known to hold. The autosave never writes a status it read at page
  // load: a client who signed meanwhile turned the job to won, and writing "sent" back undid it.
  const statusRef = useRef(initial.status);
  // What the database holds for offer_currency, so the autosave writes it only
  // when it changes (it is stored best-effort, see persist).
  const storedOfferCur = useRef(normCurrency(initial.offer_currency));
  // What a market change did to the offer's currency, said once under the
  // selects: { kind: "switched" | "suggest", currency } (lib/offerCurrency.js).
  const [curNote, setCurNote] = useState(null);
  const [saved, setSaved] = useState("saved");     // saved | saving | error
  const [pvgisBusy, setPvgisBusy] = useState(false);
  const [billBusy, setBillBusy] = useState(false);   // AI bill extractor
  const [billRes, setBillRes] = useState(null);      // extracted values awaiting review
  const [billErr, setBillErr] = useState("");
  const billInput = useRef(null);
  const [propUrl, setPropUrl] = useState(null);
  const [sendingVia, setSendingVia] = useState(null);   // "viber" | "wa" while the header's one-tap send works
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState(null);
  // Emailing the PDF: the recipient isn't stored on the project (only the client's
  // NAME is), so this always starts empty rather than guessing an address.
  const [emailTo, setEmailTo] = useState("");
  // Deposit % for the proforma. The invoice page has supported ?deposit= since
  // it was written, but nothing ever passed it — so the single most useful part
  // of a proforma (asking for money up front) was reachable only by hand-editing
  // the URL. 0 = invoice the full amount.
  const [invOpen, setInvOpen] = useState(false);
  // what the workflow rail last saved (a ticked step, a grid-file stage), so the
  // checklist and grid-file cards below show it without a reload
  const [railProg, setRailProg] = useState(null);
  // after the grid card sends or records a step the page is refreshed: what the server now holds replaces what the
  // rail last saved here, or the grid-file and checklist cards kept showing the stages from before
  useEffect(() => { setRailProg(null); }, [initial.install_progress]);
  const [legalDocsOpen, setLegalDocsOpen] = useState(false);
  const [legalTab, setLegalTab] = useState("contract");
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
  const isUA = p.market === "UA";
  // the versioned tariff rule in force today for this job's operator
  // (lib/tariffRules.js, E.tariffRules from companyEngine): the same price an
  // offer issued now freezes, so the screen and the offer agree
  const feedOverride = useMemo(() => (isMD
    ? mdFeedFor({ install_progress: initial.install_progress, address: p.address, title: p.title }, E.tariffRules)
    : undefined), [isMD, initial.install_progress, p.address, p.title, E.tariffRules]);
  // Ukraine's green tariff ends with 2029, so the year the system starts decides
  // how many years of it the client gets (engine: startYear).
  const startYear = useMemo(() => startYearOf(initial.created_at), [initial.created_at]);

  // Quote price is driven entirely by system size (kW × rate + battery); the
  // bill of materials is the installer's cost, not a price override (see
  // lib/quoteInput.js).
  const q = useMemo(
    () => quote({ ...p, startYear, costOverride: 0, ...(feedOverride ? { feedOverride } : {}) }, E),
    [p, E, feedOverride, startYear]);
  // Money in the OFFER's currency (by default the workspace's: lei in Moldova)
  // at today's rate; the engine and the stored quote stay in EUR
  // (lib/money.js). Every figure below, and every panel handed `fmt`, follows it.
  const offerCur = effectiveOfferCurrency(p.offerCurrency, workspaceCurrency, p.market);
  const fmt = moneyFormatter({ currency: offerCur, lang, fx: E?.fx });
  const nf = numFor(lang);
  const num = n => Math.round(Number(n) || 0).toLocaleString({ en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB");
  const yrs = n => n === null ? "25+" : n === 0 ? tr("pp_immediate") : nf(n, 1);
  // per-kWh prices need decimals, and 0.036 must not print as "0.04"
  const eurKwh = v => fmt.local ? fmt.perKwh(v) : "€" + Number(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  // the system price per watt, in the offer's currency: "1,10 €/W", "21,78 lei/W"
  const perW = v => fmt.local ? `${nf(fmt.toLocal(v), 2)} ${fmt.unit}/W` : `${nf(v, 2)} €/W`;
  // The message that goes with the proposal link on Viber, WhatsApp and the share image.
  const shareMsg = tr("wa_message", { client: p.client || tr("your_client"), company: companyName, url: propUrl || "" });

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
    return { ...rest, startYear, costOverride: 0, ...(feedOverride ? { feedOverride } : {}) };
  }, [p, feedOverride, startYear]);

  /* debounced autosave — MUST surface failure: a false "Saved" while the write
     was rejected (expired session, offline, RLS) silently loses the edit. */
  async function persist(next) {
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from("projects").update({
        title: next.title, client_name: next.client, address: next.address,
        market: next.market,
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
      // The one status change the editor makes itself, draft to sent when the offer goes out: written
      // only while the job is still a draft, so a job won, lost or signed meanwhile keeps its status.
      if (!error && next.status === "sent" && statusRef.current === "draft") {
        const { error: se } = await sb.from("projects").update({ status: "sent" }).eq("id", initial.id).eq("status", "draft");
        if (!se) statusRef.current = "sent";
      }
      // No signal: keep the edit on this device and save it when the signal
      // is back (lib/offline.js), instead of calling it a failure.
      if (error && isNetworkError(error)) { if (saveOutbox(initial.id, next)) { setSaved("device"); return; } }
      // Ukraine before supabase/add-ukrainian.sql has run: the database still
      // refuses the UA market. Say that, not "check your connection".
      if (error && /projects_market_check/.test(error.message || "")) { setSaved("db"); return; }
      setSaved(error ? "error" : "saved");
      if (error) console.error("autosave failed:", error.message);
      // batt_kwh is written separately + best-effort so a workspace that hasn't
      // run add-battery-kwh.sql yet still autosaves everything else (the column
      // may not exist; swallow that error rather than fail the whole save).
      else {
        clearOutbox(initial.id);
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
        sb.from("projects").update({ client_email: next.clientEmail || "" }).eq("id", initial.id)
          .then(({ error: e7 }) => { if (e7) console.warn("client email not stored (run add-proposal-nudges.sql?):", e7.message); });
        sb.from("projects").update({ tariff_mode: next.tariffMode || "flat" }).eq("id", initial.id)
          .then(({ error: e8 }) => { if (e8) console.warn("tariff mode not stored (run add-tariff-mode.sql?):", e8.message); });
        if (next.market === "UA") sb.from("projects").update({ ua_plan: next.uaPlan || {} }).eq("id", initial.id)
          .then(({ error: e9 }) => { if (e9) console.warn("Ukraine plan not stored (run add-ukrainian.sql?):", e9.message); });
        // The offer's currency, only when it changed. Until add-offer-currency.sql
        // has run, the choice still drives this screen; the warning then shows
        // once per change rather than on every later save (a missing column
        // will not appear by retrying; any other failure is retried next save).
        const cur = normCurrency(next.offerCurrency);
        if (cur !== storedOfferCur.current) sb.from("projects").update({ offer_currency: cur }).eq("id", initial.id)
          .then(({ error: e10 }) => {
            if (e10) console.warn("offer currency not stored (run add-offer-currency.sql?):", e10.message);
            if (!e10 || /offer_currency/i.test(e10.message || "")) storedOfferCur.current = cur;
          });
      }
    } catch (e) {
      if (isNetworkError(e) && saveOutbox(initial.id, next)) { setSaved("device"); return; }
      setSaved("error");
      console.error("autosave threw:", e?.message || e);
    }
  }
  // A quote that was just created has nothing in it yet: put the cursor in the client's name, so the
  // first thing typed lands there instead of after a click. Desktop only (a phone's keyboard would
  // cover the page the moment it opens), and never on a quote that already has a client.
  const clientRef = useRef(null);
  useEffect(() => {
    if (initial.client_name || !isPlaceholderTitle(initial.title)) return;
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return;
    clientRef.current?.focus({ preventScroll: true });
  }, [initial.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Edits made with no signal wait on the device (see persist). When this quote
  // opens with some still waiting, they are the engineer's latest: show them
  // and save them as soon as there is a network, now or when it comes back.
  useEffect(() => {
    const flush = () => {
      const box = readOutbox(initial.id);
      if (!box) return;
      pRef.current = box.data;
      setP(box.data);
      setSaved(navigator.onLine === false ? "device" : "saving");
      if (navigator.onLine !== false) persist(box.data);
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
    // persist reads only initial.id and the edit it is handed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);
  function update(patch) {
    const next = { ...pRef.current, ...patch };
    pRef.current = next;
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
  // /projects/<id>?docs=contract (from the Documents page) opens the legal
  // documents straight on that tab.
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("docs");
    if (d) { setLegalTab(d); setLegalDocsOpen(true); }
  }, []);

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
      // a roof drawn side by side has the yield of those sides (their own pitch and facing, weighted by what each
      // holds); this button used to replace it with 35 degrees facing south and call it "this exact roof"
      const sides = (Array.isArray(p.siteDesign?.sides) ? p.siteDesign.sides : []).filter((s) => s.count > 0);
      if (sides.length && p.lat != null && p.lon != null) {
        const got = await Promise.all(sides.map(async (s) => ({ ...s, ...(await fetchSideYield({ lat: p.lat, lon: p.lon, tiltDeg: s.tiltDeg, azimuthDeg: s.azimuthDeg })) })));
        const b = blendYields(got);
        if (b.yieldOverride) {
          update({ yieldOverride: b.yieldOverride, ...(b.monthlyYieldShape ? { monthlyYieldShape: b.monthlyYieldShape } : {}) });
          if (b.failed) alert(t3(lang, `Pentru ${b.failed} parte/părți nu s-au găsit date solare: randamentul le numără pe celelalte.`, `No solar data for ${b.failed} side(s): the yield counts the others.`, `Нет данных о солнце для скатов: ${b.failed}. В выработке учтены остальные.`, `Немає даних про сонце для схилів: ${b.failed}. У виробітку враховано решту.`));
          return;
        }
      }
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
  // Lets the Site Designer preview real payback/ROI/CO2 for whatever kW its
  // current drawn layout implies — same engine call as the main quote above,
  // just with kw swapped for the layout's, so the two can never disagree.
  const computeSiteDesignQuote = useCallback((kw, extra) =>
    quote({ ...p, kw, costOverride: 0, ...(extra || {}), ...(feedOverride ? { feedOverride } : {}) }, E),
    [p, E, feedOverride]);

  // Rail/clamp quantities for BosEstimate: the SAME real drawn roof planes
  // and fitPanels() math applySiteDesignLayout/lib/actions.js's PDF snapshot
  // already use, not a separate guess — recomputed live here (not persisted
  // with the project) since a plane's geometry, or the BOM's real panel,
  // can change without reopening Site Designer.
  // the roof side that holds most of the panels: the one the structural loads and the evening peak read (they read
  // the first side drawn, which on a roof with a small dormer drawn first was the wrong one)
  const mainPlane = useMemo(() => {
    const planes = Array.isArray(p.siteDesign?.planes) ? p.siteDesign.planes : [];
    const sides = Array.isArray(p.siteDesign?.sides) ? p.siteDesign.sides : [];
    const best = [...sides].sort((a, b) => (b.count || 0) - (a.count || 0))[0];
    return (best && planes.find((pl) => pl.id === best.id)) || planes[0] || null;
  }, [p.siteDesign]);
  const siteRows = useMemo(() => {
    const planes = Array.isArray(p.siteDesign?.planes) ? p.siteDesign.planes : [];
    if (!planes.some((pl) => Array.isArray(pl.polygon) && pl.polygon.length >= 3)) return [];
    const dc = designCheck({ bom: p.bom, kw: p.kw });
    const { w, h } = dc.panel.dimensionsMm || { w: 1909, h: 1134 };
    // rails for the panels the quote sells, not for every place on the roof
    return limitPanels(fitSidesFor(p.siteDesign, { w, h }), Math.max(0, Number(dc.modules) || 0)).flatMap((f) => f.rows);
  }, [p.siteDesign, p.bom, p.kw]);

  async function applySiteDesignLayout(layout) {
    if (!layout || !layout.totalCount) return;
    setSiteDesignApplying(true);
    try {
      // each side's own yield: the designer already looked it up while it was open; any side still without one is
      // looked up now
      const results = await Promise.all(layout.perPlane.filter((pl) => pl.count > 0).map(async (pl) =>
        (pl.yieldPerKwp > 0 ? pl : { ...pl, ...(await fetchSideYield(pl)) })));
      const blend = blendYields(results);
      let patch = { kw: layout.kw };
      if (blend.yieldOverride) {
        patch.yieldOverride = blend.yieldOverride;
        if (blend.monthlyYieldShape) patch.monthlyYieldShape = blend.monthlyYieldShape;
      }
      // a side that got no solar data is counted in the roof's yield by the others: said, not dropped in silence
      if (blend.failed) alert(t3(lang, `Pentru ${blend.failed} parte/părți nu s-au găsit date solare: randamentul acoperișului le numără pe celelalte.`, `No solar data for ${blend.failed} side(s): the roof's yield counts the others.`, `Нет данных о солнце для скатов: ${blend.failed}. В выработке крыши учтены остальные.`, `Немає даних про сонце для схилів: ${blend.failed}. У виробітку даху враховано решту.`));
      // the sides' own figures stay with the roof: the offer shows them
      if (Array.isArray(layout.sides)) patch.siteDesign = { ...(pRef.current.siteDesign || {}), sides: layout.sides };
      // The roof material the most panels actually sit on, so a building with
      // one small trapezoidal-sheet dormer and one large tile main roof still
      // gets the mount that matches where the array actually is.
      const dominantPlane = layout.perPlane.reduce((best, pl) => (!best || pl.count > best.count) ? pl : best, null);
      const roofType = dominantPlane?.roofType;
      const matchedMount = recommendMount(roofType);

      const bomArr = Array.isArray(p.bom) ? p.bom : [];
      const hasPanelLine = bomArr.some((l) => l.kind === "panel");
      patch.bom = hasPanelLine
        ? bomArr.map((l) => {
            if (l.kind === "panel") {
              // a different model brings its own rating and list price; the same model keeps the installer's price
              const cat = findPanel(layout.panelId);
              const changed = l.brand !== layout.panelBrand || l.model !== layout.panelModel;
              return { ...l, qty: layout.totalCount, brand: layout.panelBrand, model: layout.panelModel, ...(changed && cat ? { spec: `${cat.watt} W`, unit_price: cat.price } : {}) };
            }
            // Only swap an EXISTING mount line's product, never add or
            // remove one — an installer's custom BOM keeps its own shape.
            if (l.kind === "mounting" && matchedMount) return { ...l, brand: matchedMount.brand, model: matchedMount.model, spec: matchedMount.type, unit_price: matchedMount.eurPerKw };
            return l;
          })
        : bomArr.length === 0
          ? autoBom(layout.kw, p.battKwh, roofType).map((l) => l.kind === "panel" ? { ...l, qty: layout.totalCount } : l)
          : bomArr; // has other lines but no panel line, an unusual manual BOM; leave it rather than guess
      update(patch);
      setSiteDesignerOpen(false);
    } finally {
      setSiteDesignApplying(false);
    }
  }

  async function makeProposal() {
    const code = await sendOffer(initial.id);
    setPropUrl(`${location.origin}/p/${code}`);
    if (p.status === "draft") update({ status: "sent" });
    return code;
  }

  // One tap from the header to the client's messenger, the way Moldovan
  // clients actually get links: makes (or reuses) the offer link, marks the
  // quote sent, and opens Viber or WhatsApp with the message and link written.
  // WhatsApp goes straight to the client's chat when their phone is known
  // (lib/actions.js offerPhone); Viber always lets you pick the contact.
  async function sendVia(app) {
    // the WhatsApp tab opens inside the click, before any await, or a phone's popup blocker eats it
    const tab = app === "wa" ? window.open("", "_blank") : null;
    setSendingVia(app);
    try {
      const [code, phone] = await Promise.all([
        propUrl ? propUrl.split("/p/")[1] : sendOffer(initial.id),
        app === "wa" ? offerPhone(initial.id).catch(() => "") : "",
      ]);
      if (p.status === "draft") update({ status: "sent" });
      const msg = tr("wa_message", { client: p.client || tr("your_client"), company: companyName, url: `${location.origin}/p/${code}` });
      if (app === "wa") {
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        if (tab) { tab.opener = null; tab.location.href = url; } else window.location.href = url;
      } else {
        window.location.href = `viber://forward?text=${encodeURIComponent(msg)}`;
      }
    } catch {
      if (tab) tab.close();
    } finally {
      setSendingVia(null);
    }
  }

  // The link itself never changes (createProposal is idempotent by design —
  // never bait-and-switch a client), but everything the link SHOWS is frozen
  // at first-generate time. Edited the BOM, drawn the roof, changed the price
  // since then? Nothing reaches the client until this runs. Refuses server-side
  // once the client has actually accepted — see regenerateProposal's own comment.
  async function refreshProposal() {
    setRefreshing(true); setRefreshMsg(null);
    try {
      await regenerateProposal(initial.id);
      setRefreshMsg({ ok: true, text: tr("prop_refreshed") });
    } catch (e) {
      setRefreshMsg({ ok: false, text: e.message === "already_accepted" ? tr("prop_refresh_accepted") : tr("prop_refresh_err") });
    } finally {
      setRefreshing(false);
    }
  }

  async function downloadPdf() {
    // The installed app: the PDF opens in the app's own viewer, with an X and
    // Save (lib/openPdf.js). Opened like a page, it used to fill the app with
    // no way back.
    if (isStandalone()) {
      let code = propUrl ? propUrl.split("/p/")[1] : null;
      if (!code) { try { code = await sendOffer(initial.id); } catch { return; } }
      if (p.status === "draft") update({ status: "sent" });
      openPdfInApp(`/api/proposal/${code}/pdf`, p.title || "");
      return;
    }
    // Open the tab synchronously, inside the click gesture, so mobile popup
    // blockers don't swallow it — they do when window.open runs after an await,
    // which is why "Download PDF" appeared to do nothing on a phone.
    const tab = window.open("", "_blank");
    let code = propUrl ? propUrl.split("/p/")[1] : null;
    if (!code) {
      // createProposal is idempotent (returns the existing code), so this does
      // NOT open the share modal — that's why it no longer mirrors "Generate".
      try { code = await sendOffer(initial.id); }
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

  // The PDF is of an issued invoice: Download issues it first (the one click that draws the number), then opens it.
  async function downloadProforma() {
    const w = window.open("", "_blank");
    setInvMsg(null);
    try {
      const r = await issueInvoice(initial.id, depPct);
      if (!r?.ok) throw new Error("issue");
      const url = `/api/projects/${initial.id}/invoice${depPct > 0 ? `?deposit=${depPct}` : ""}`;
      if (w) w.location.href = url; else window.open(url, "_blank");
    } catch {
      w?.close();
      setInvMsg({ ok: false, text: tr("inv_issue_fail") });
    }
  }

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
  const validUntilStr = validUntilDate ? fmtDate(validUntilDate, { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" }[lang] || "en-GB") : null;

  // Switching market pre-fills the electricity price with the new market's
  // regional default — but only when the user hasn't typed a custom price yet
  // (i.e. it still equals the old market's default).
  // The offer's currency follows the market by the same rule
  // (lib/offerCurrency.js): only while it is still on the default or on the old
  // market's own currency. Lei for a client in Ukraine is never right, so a lei
  // workspace switches the offer to hryvnia and says so; a euro workspace keeps
  // euro (a fair choice anywhere) and is offered the local currency in one click.
  function changeMarket(m) {
    const patch = { market: m };
    const oldDef = (MARKETS[p.market] || {}).defaultPrice;
    if (MARKETS[m] && Math.abs((p.price || 0) - (oldDef || 0)) < 0.0015) patch.price = MARKETS[m].defaultPrice;
    const c = currencyOnMarketChange({ offerCurrency: p.offerCurrency, workspaceCurrency, from: p.market, to: m });
    patch.offerCurrency = c.offerCurrency;
    setCurNote(c.note);
    update(patch);
  }
  function changeOfferCurrency(c) {
    setCurNote(null);
    update({ offerCurrency: normCurrency(c) });
  }
  // Under the selects: what a market change just did, or, for a quote still on
  // the default, a workspace currency that belongs to another country than the
  // client's (an older Ukrainian quote in a lei workspace).
  const curHint = curNote || (p.offerCurrency == null && betterCurrencyFor(offerCur, p.market)
    ? { kind: "mismatch", currency: betterCurrencyFor(offerCur, p.market) } : null);

  // A demo-style .check toggle row.

  // The margin behind the price, from the same bill-of-materials total BomCard shows.
  const materials = bomTotal(p.bom);
  const margin = q.e.grossCost - materials;
  const clientLine = [p.client, String(p.address || "").split(",").slice(0, 2).join(",").trim()].filter(Boolean).join(", ");

  return (
    <div className="qb">
      <header className="qb-head">
        <BackLink href="/projects">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
          {tr("nav_projects")}
        </BackLink>
        <div className="qb-head-main">
          <div className="qb-id">
            <div className="qb-title-row">
              {/* A hidden copy of the title sizes the field (see .qb-title-wrap), so the
                  status and save state sit right after the name at any length. */}
              <span className="qb-title-wrap" data-value={p.title || " "}>
                <input className="proj-title qb-title" value={p.title} aria-label={tr("col_project")} size={1}
                  onChange={e => update({ title: e.target.value })} />
              </span>
              <span className={"chip static " + p.status}>{tr("st_" + p.status)}</span>
              <span className={"qb-saved s-" + saved} role="status">
                {saved === "saving" ? tr("saving") : saved === "error" ? tr("save_failed") : saved === "device" ? tr("saved_device") : saved === "db" ? tr("save_needs_ua_db") : tr("saved")}
                {saved === "error" && (
                  <button className="btn sm danger" style={{ marginLeft: 8 }} onClick={() => { setSaved("saving"); persist(p); }}>{tr("retry")}</button>
                )}
              </span>
            </div>
            <p className="qb-sub">
              {clientLine}
              {/* once the client has signed, the offer's validity no longer matters */}
              {proposalSentAt && p.status !== "won" && p.status !== "lost" && (
                <span className={"qb-valid" + (quoteStale ? " stale" : "")}>
                  {tr("q_valid_until", { d: validUntilStr })}{quoteStale ? ", " + tr("q_stale").toLowerCase() : ""}
                </span>
              )}
            </p>
            {/* the client's loan applications from this offer (docs/FINANCING.md) */}
            {loans.length > 0 && (
              <p className="qb-loans">{loans.map((l) => <span key={l.id} className={"qb-loan s-" + l.status}>{l.text}</span>)}</p>
            )}
          </div>
          <div className="qb-actions">
            {tplOpen ? (
              <span className="qb-tpl">
                <input autoFocus className="input" value={tplName} maxLength={40}
                  onChange={e => setTplName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveTemplate(); if (e.key === "Escape") setTplOpen(false); }}
                  placeholder={tr("tpl_name_ph")} />
                <button className="btn primary sm" disabled={tplBusy || !tplName.trim()} onClick={saveTemplate}>{tr("tpl_save_confirm")}</button>
                <button className="btn ghost sm" onClick={() => setTplOpen(false)} aria-label={tr("tpl_cancel")}>✕</button>
              </span>
            ) : (
              <button className="btn ghost" onClick={openTemplate}><Qi d={tplSaved ? "check" : "bookmark"} />{tplSaved ? tr("tpl_saved") : tr("tpl_save")}</button>
            )}
            <button className="btn ghost" onClick={downloadPdf}><Qi d="pdf" />{tr("dl_pdf")}</button>
            <button className="btn ghost" onClick={() => setInvOpen(true)}><Qi d="receipt" />{tr("inv_button")}</button>
            <button className="btn ghost" onClick={() => { setLegalTab("contract"); setLegalDocsOpen(true); }}><Qi d="scale" />{tr("ld_open")}</button>
            {/* the three ways to send, kept together when the row wraps */}
            <span className="qb-sendgrp">
              <button className="btn ghost qb-send qb-send-viber" disabled={!!sendingVia} onClick={() => sendVia("viber")} title={tr("send_viber_t")}>{sendingVia === "viber" ? "..." : "Viber"}</button>
              <button className="btn ghost qb-send qb-send-wa" disabled={!!sendingVia} onClick={() => sendVia("wa")} title={tr("send_wa_t")}>{sendingVia === "wa" ? "..." : "WhatsApp"}</button>
              <button className="dx-new" onClick={makeProposal}><Qi d="link" w={2.2} />{tr("gen_proposal")}</button>
            </span>
          </div>
        </div>
      </header>

      {/* What the client will see, and what it leaves you, pinned while you edit. */}
      <dl className="qb-bar" aria-live="polite">
        <div><dt>{tr("qb_pays")}</dt><dd>{fmt(q.e.cost)}</dd>
          <dd className="qb-bar-sub">{grants > 0 ? tr("qb_pays_grant", { v: fmt(grants) }) : costPerW > 0 ? perW(costPerW) : ""}</dd></div>
        <div className="hi"><dt>{tr("qb_payback")}</dt><dd>{yrs(q.e.payback)} <small>{tr("yrs")}</small></dd>
          <dd className="qb-bar-sub">{tr("qb_range", { a: yrs(q.o.payback), b: yrs(q.p.payback) })}</dd></div>
        <div><dt>{tr("savings_y1")}</dt><dd>{fmt(q.e.year1)}</dd>
          <dd className="qb-bar-sub">{tr("qb_month", { v: fmt(mSave) })}</dd></div>
        <div><dt>{tr("qb_prod")}</dt><dd>{num(q.e.prod0)} <small>kWh</small></dd>
          <dd className="qb-bar-sub">{p.yieldOverride ? tr("qb_prod_pvgis") : tr("qb_prod_default")}</dd></div>
        <div><dt>{tr("qb_self")}</dt><dd>{Math.round(q.e.self * 100)}%</dd>
          <dd className="qb-bar-sub">{consEff > 0 ? tr("qb_cover", { n: Math.round(coverage * 100) }) : ""}</dd></div>
        <div className={materials > 0 ? (margin < 0 ? "neg" : "pos") : ""}><dt>{materials > 0 ? tr("qb_margin") : tr("qb_price")}</dt>
          <dd>{materials > 0 ? fmt(margin) : fmt(q.e.grossCost)}</dd>
          <dd className="qb-bar-sub">{materials > 0
            ? tr("qb_margin_sub", { p: q.e.grossCost > 0 ? Math.round((margin / q.e.grossCost) * 100) : 0, v: fmt(q.e.grossCost) })
            : tr("qb_margin_none")}</dd></div>
      </dl>

      {/* Where this job is in the workflow, and the one next thing to do
          (lib/workflow.js). The dashboard and the quotes list link here (#workflow). */}
      <WorkflowRail projectId={initial.id} lang={lang} status={p.status}
        onAction={async (a) => {
          if (a.type === "send" || a.type === "copy_link") { makeProposal(); return true; }
          if (a.type === "invoice") { setInvOpen(true); return true; }
          if (a.type === "won") {
            // Signed from the rail: record it (activity, CRM hook), then save the
            // status through this editor's own autosave, so a pending edit still
            // waiting on its timer cannot write the old status back.
            clearTimeout(timer.current);
            await markProjectWon(initial.id);
            const next = { ...pRef.current, status: "won" };
            pRef.current = next;
            statusRef.current = "won";
            setP(next);
            await persist(next);
            return true;
          }
          return false;
        }}
        onChange={({ installProgress, gridFile }) => {
          if (installProgress || gridFile) setRailProg((cur) => ({
            ...(cur || initial.install_progress || {}),
            ...(installProgress || {}),
            ...(gridFile ? { gridFile } : {}),
          }));
        }} />

      <LinkLabels root=".editor" />
      <div className="editor">
        {/* left: inputs */}
        <FoldColumn className="stack" lang={lang}>
          <section className="card">
            <h3>{tr("client_site")}</h3>
            <div className="field"><label>{tr("client_name")}</label>
              <input ref={clientRef} className="input" value={p.client} onChange={e => update({ client: e.target.value })} /></div>
            {/* Real prerequisite for the follow-up nudge automation (if
                enabled in Settings) — without a stored address there's
                nowhere to send a reminder. Optional: nudges just skip a
                proposal that has none. */}
            <div className="field"><label>{tr("client_email")}</label>
              <input type="email" className="input" value={p.clientEmail || ""} placeholder={tr("client_email_ph")}
                onChange={e => update({ clientEmail: e.target.value })} /></div>
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
            <div className="qb-tools">
              <button type="button" className={"qb-tool" + (Array.isArray(p.siteDesign?.planes) && p.siteDesign.planes.length ? " done" : "")}
                disabled={p.lat == null || p.lon == null}
                title={p.lat == null || p.lon == null ? tr("site_designer_need_address") : undefined}
                onClick={() => setSiteDesignerOpen(true)}>
                <span className="qb-tool-ic"><Qi d="roof" size={17} /></span>
                <span className="qb-tool-tx"><b>{tr("site_designer_open")}</b><small>{p.lat == null || p.lon == null ? tr("site_designer_need_address") : tr("qb_tool_roof_sub")}</small></span>
                <Qi d="chev" size={15} />
              </button>
              <button type="button" className={"qb-tool" + (p.yieldOverride ? " done" : "")} onClick={fetchPVGIS} disabled={pvgisBusy} aria-busy={pvgisBusy}>
                <span className="qb-tool-ic"><Qi d={p.yieldOverride ? "check" : "sun"} size={17} /></span>
                <span className="qb-tool-tx">
                  <b>{pvgisBusy ? tr("pvgis_fetching") : p.yieldOverride ? tr("qb_pvgis_done", { n: Math.round(p.yieldOverride) }) : tr("pvgis_use")}</b>
                  <small>{p.yieldOverride ? tr("qb_pvgis_again") : tr("qb_tool_pvgis_sub")}</small>
                </span>
                <Qi d="chev" size={15} />
              </button>
              {/* the installer's own roof photo, the offer's picture */}
              <RoofPhoto projectId={initial.id} url={p.siteDesign?.photoUrl || null} lang={lang}
                onChange={(url) => { const sd = { ...(p.siteDesign || {}) }; delete sd.photoPlace; if (url) sd.photoUrl = url; else delete sd.photoUrl; update({ siteDesign: sd }); }} />
            </div>
            {p.yieldOverride && (
              <div className="pvgis-data">
                <span className="pvg-k">{Math.round(p.yieldOverride)}</span> {tr("unit_kwp_yr")}
                {Array.isArray(p.monthlyYieldShape) && p.monthlyYieldShape.length === 12 && <>, {tr("pvgis_monthly")}</>}
                {/* Sunny Design names a "site for meteorological data" and a
                    distance to it — SMA runs on a network of physical
                    stations, so that number means something for them. PVGIS is
                    gridded satellite irradiance, not station lookups, so a
                    fabricated "X km away" would be a made-up number wearing
                    their UI's clothes. This states what the source actually is. */}
                <div className="pvgis-src">{tr("pvgis_src")}</div>
              </div>
            )}

            {team.length >= 1 && (
              <div className="field" style={{ marginTop: 15 }}><label>{tr("proj_owner")}</label>
                <select className="input" value={p.ownerId || ""} onChange={e => update({ ownerId: e.target.value || null })}>
                  <option value="">{tr("proj_owner_none")}</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                </select>
              </div>
            )}
            {/* The market and the currency the offer is written in, side by side:
                the second is what the client reads every amount in (proposal,
                PDF, proforma). They wrap one under the other on a phone. */}
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 12 }}>
              <div className="field" style={{ flex: "1 1 190px", minWidth: 0 }}><label>{tr("market")}</label>
                <select className="input" value={p.market} onChange={e => changeMarket(e.target.value)}>
                  <option value="MD">{tr("market_md")}</option>
                  <option value="UA">{tr("market_ua")}</option>
                  <option value="RO">{tr("market_ro")}</option>
                </select></div>
              {/* explicit margin: as the wrapper's last child, .field:last-child would drop it */}
              <div className="field" style={{ flex: "1 1 190px", minWidth: 0, marginBottom: 15 }}>
                <label htmlFor="offer-currency">{t3(lang, "Moneda ofertei", "Currency of the offer", "Валюта оферты", "Валюта пропозиції")}</label>
                <select id="offer-currency" className="input" value={p.offerCurrency || ""} onChange={e => changeOfferCurrency(e.target.value)}>
                  <option value="">{t3(lang, "Ca în setări", "Workspace default", "Как в настройках", "Як у налаштуваннях")} ({curTxt(lang, normCurrency(workspaceCurrency) || "EUR", "short")})</option>
                  {["MDL", "UAH", "EUR", "RON"].map(c => <option key={c} value={c}>{curTxt(lang, c, "opt")}</option>)}
                </select></div>
            </div>
            {curHint && (
              <div className="cal-note" style={{ marginTop: -4, marginBottom: 15 }} role="status">
                <div className="cal-h" style={{ fontWeight: 500 }}>
                  {curHint.kind === "switched"
                    ? t3(lang,
                      `Am trecut oferta pe ${curTxt(lang, curHint.currency, "acc")}, pentru ${curTxt(lang, curHint.currency, "who")}. Poți alege altă monedă oricând.`,
                      `Switched the offer to ${curTxt(lang, curHint.currency, "acc")} for ${curTxt(lang, curHint.currency, "who")}. You can pick another currency any time.`,
                      `Оферта переведена в ${curTxt(lang, curHint.currency, "acc")} для ${curTxt(lang, curHint.currency, "who")}. Валюту можно сменить в любой момент.`,
                      `Пропозицію переведено в ${curTxt(lang, curHint.currency, "acc")} для ${curTxt(lang, curHint.currency, "who")}. Валюту можна змінити будь-коли.`)
                    : curHint.kind === "suggest"
                      ? t3(lang,
                        `Oferta e în euro, ca în setări. Pentru ${curTxt(lang, curHint.currency, "who")} o poți trece pe ${curTxt(lang, curHint.currency, "acc")}.`,
                        `The offer is in euro, as in your settings. For ${curTxt(lang, curHint.currency, "who")} you can switch it to ${curTxt(lang, curHint.currency, "acc")}.`,
                        `Оферта в евро, как в настройках. Для ${curTxt(lang, curHint.currency, "who")} её можно перевести в ${curTxt(lang, curHint.currency, "acc")}.`,
                        `Пропозиція в євро, як у налаштуваннях. Для ${curTxt(lang, curHint.currency, "who")} її можна перевести в ${curTxt(lang, curHint.currency, "acc")}.`)
                      : t3(lang,
                        `Oferta e în ${offerCur}, pentru ${curTxt(lang, curHint.currency, "who")}.`,
                        `This offer is in ${offerCur}, for ${curTxt(lang, curHint.currency, "who")}.`,
                        `Оферта в ${offerCur} для ${curTxt(lang, curHint.currency, "who")}.`,
                        `Пропозиція в ${offerCur} для ${curTxt(lang, curHint.currency, "who")}.`)}
                </div>
                {curHint.kind !== "switched" && (
                  <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => changeOfferCurrency(curHint.currency)}>
                    {t3(lang, `Treci pe ${curHint.currency}`, `Switch to ${curHint.currency}`, `Перевести в ${curHint.currency}`, `Перевести в ${curHint.currency}`)}
                  </button>
                )}
              </div>
            )}
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
              <label>{tr("system_size")}<output>{dec(p.kw, 1, lang)} {kwUnit(lang)}</output></label>
              <div className="slider-row">
                <input type="range" min={KW_MIN} max={KW_MAX} step="0.5" value={p.kw} style={{ "--fill": kwFill + "%" }}
                  aria-valuemin={KW_MIN} aria-valuemax={KW_MAX} aria-valuenow={p.kw}
                  onChange={e => update({ kw: +e.target.value })} />
                {/* A drag is imprecise once the range spans 2-500 kW — this
                    lets an exact figure (from a real design, a client ask) be
                    typed directly instead of hunted for on the slider. */}
                <NumInput className="slider-num" inputMode="decimal" step="0.1" min={KW_MIN} max={KW_MAX}
                  aria-label={tr("system_size")} value={p.kw}
                  onValue={(v) => update({ kw: v })} />
              </div>
            </div>
            {/* Typed in the offer's currency (lei, hryvnia or euro); stored in EUR. */}
            <div className="field"><label>{fmt.local ? tr("elec_price_local", { u: fmt.unit }) : tr("elec_price")}</label>
              {fmt.local
                ? <LocalMoneyInput eur={p.price} fmt={fmt} onEur={(v) => update({ price: v })} />
                : <NumInput className="input" step="0.01" min="0.01" max="5" value={p.price}
                    onValue={(v) => update({ price: v })} />}</div>
            {/* Only Moldova has this plan (Premier Energy/RED Nord, ANRE-
                approved) — real self-consumption is ~entirely daytime, so a
                differentiated plan makes solar worth more than the flat
                price above implies. Defaults off: every existing/new project
                keeps computing against the flat price unless explicitly
                switched. */}
            {p.market === "MD" && <CheckRow on={p.tariffMode === "differentiated"} label={tr("md_tariff_diff")} sub={tr("md_tariff_diff_sub")}
              onChange={(v) => update({ tariffMode: v ? "differentiated" : "flat" })} />}
            {!p.useMonthly && (
              <div className="field"><label>{tr("annual_cons")}</label>
                <NumInput className="input" step="100" min="1" max="50000000" value={p.cons}
                  onValue={(v) => update({ cons: v })} /></div>
            )}
            <CheckRow on={p.useMonthly} label={tr("use_monthly")} sub={tr("use_monthly_sub")}
              onChange={(v) => update(v
                ? { useMonthly: true, consMonthly: (Array.isArray(p.consMonthly) && p.consMonthly.length === 12)
                    ? p.consMonthly : Array(12).fill(Math.round((p.cons || 5000) / 12)) }
                : { useMonthly: false })} />
            {p.useMonthly && (
              <div style={{ marginTop: 12 }}>
                <div className="mo-grid">
                  {monthLabels(lang).map((m, i) => (
                    <div className="mo-cell" key={i}>
                      <label>{m}</label>
                      <NumInput className="input mo-in" min="0" max="5000000" step="10"
                        value={(p.consMonthly && p.consMonthly[i]) ?? 0}
                        onValue={(v) => {
                          const cur = pRef.current.consMonthly;
                          const arr = (Array.isArray(cur) && cur.length === 12) ? cur.slice() : Array(12).fill(0);
                          arr[i] = v;
                          update({ consMonthly: arr });
                        }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, textAlign: "right" }}>
                  {tr("mo_total_yr", { v: num((p.consMonthly || []).reduce((a, b) => a + (+b || 0), 0)) })}
                </div>
              </div>
            )}
            {/* AI energy-bill extractor — snap the client's bill, review, apply.
                Hidden until AI is switched on (lib/featureFlags.js). */}
            {aiOn() && <>
              <input ref={billInput} type="file" accept="image/*,application/pdf" hidden onChange={handleBill} />
              <button type="button" className="qb-tool" style={{ marginTop: 10 }}
                onClick={() => billInput.current && billInput.current.click()} disabled={billBusy} aria-busy={billBusy}>
                <span className="qb-tool-ic"><Qi d="upload" size={17} /></span>
                <span className="qb-tool-tx"><b>{billBusy ? tr("bill_reading") : tr("bill_upload")}</b><small>{tr("qb_tool_bill_sub")}</small></span>
                <Qi d="chev" size={15} />
              </button>
            </>}
            {billErr && <div style={{ fontSize: 12.5, color: "var(--red)", marginTop: 6 }}>{billErr}</div>}
            {billRes && (
              <div className="pvgis-data" style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{tr("bill_found")}</div>
                <div>{tr("annual_cons")}: <span className="pvg-k">{billRes.annualKwh ? num(billRes.annualKwh) : "—"}</span> kWh</div>
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
                    <NumInput className="input" min="0" max="5000" step="0.5" style={{ width: 120 }}
                      value={p.battKwh} onValue={(v) => update({ battKwh: v })} />
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>kWh, {fmt(battCost)}</span>
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

          {/* RBAC (lib/rbac.js): the real backstop is the enforce_project_rbac
              DB trigger (add-rbac.sql) — this is just the UX signal, so a
              Sales-titled member on a workspace that's turned RBAC on isn't
              left guessing why their BOM edit didn't stick. Soft-disabled
              rather than unmounted: still visible so they can read the
              current config, just not interactive. */}
          {canEditTechnical ? (
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
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, zIndex: 1, cursor: "not-allowed" }} title={tr("ed_readonly_bom")} />
              <div style={{ opacity: .55, pointerEvents: "none" }}>
                <BomCard lang={lang} bom={p.bom} onChange={() => {}} catalog={catalog} kw={p.kw}
                  battKwh={p.batt ? (Number(p.battKwh) || 0) : 0} quotePrice={q.e.grossCost} money={fmt} />
              </div>
              <div className="set-note" style={{ marginTop: -6 }}>{tr("ed_readonly_bom")}</div>
            </div>
          )}

        </FoldColumn>

        {/* right: results */}
        <FoldColumn className="stack" lang={lang}>
          <section className="card">
            <h3>{tr("sys_investment")}</h3>
            <div className="cost-line">
              <div className="k"><b>{fmt(q.e.cost)}</b>
                <span>{tr("total_invest")}</span></div>
              <div className="k"><b>{num(q.e.prod0)} kWh</b>
                <span>{tr("prod_year")}{p.yieldOverride ? " " + tr("tag_pvgis") : " " + tr("tag_default")}</span></div>
              <div className="k"><b>{fmt(q.e.year1)}</b><span>{tr("savings_y1")}</span></div>
            </div>
            {/* Cost per watt is how installers sanity-check a price against the
                market in one glance. In the offer's currency, like every other
                figure on this screen (see fmt above): €/W for a euro offer,
                lei/W or грн/W otherwise. */}
            {costPerW > 0 && (
              <div className="cost-spec">{tr("cost_per_w")}: <b>{perW(costPerW)}</b></div>
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
                  x: oversize < 10 ? dec(oversize, 1, lang) : Math.round(oversize),
                  p: Math.round((1 - q.e.self) * 100),
                  fe: eurKwh(mkt.feed), pr: eurKwh(Number(p.price) || 0),
                })}
                {suggestKw > 0 ? " " + tr("oversize_hint", { kw: dec(suggestKw, 1, lang) }) : ""}
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
              <div className="fm"><b>{fmt(fin.npv)}</b><span>{tr("m_npv")} @ {dec(disc, 0, lang)}%</span></div>
              <div className="fm"><b>{fin.irr == null ? "—" : dec(fin.irr * 100, 1, lang) + "%"}</b><span>{tr("m_irr")}</span></div>
              <div className="fm"><b>{eurKwh(fin.lcoe)}</b>
                <span>{tr("m_lcoe")}, {tr("m_vs_price")} {eurKwh(Number(p.price) || 0)}</span></div>
            </div>
            <label className="disc-row">
              {tr("m_disc")}<output>{dec(disc, 1, lang)}%</output>
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
            market={p.market}
          />

          <StructuralLoads lang={lang} roofPitchDeg={mainPlane?.tiltDeg} />

          <BosEstimate lang={lang} bom={p.bom} kw={p.kw}
            battKwh={p.batt ? (Number(p.battKwh) || 0) : 0} consKwh={consEff} phases={undefined} market={p.market}
            rows={siteRows} />

          <PeakShaving lang={lang} lat={p.lat} lon={p.lon} kw={p.kw} cons={consEff}
            battKwh={p.batt ? (Number(p.battKwh) || 0) : 0} market={p.market}
            roofPitchDeg={mainPlane?.tiltDeg} roofAzimuthDeg={mainPlane?.azimuthDeg} />

          {/* Compare every inverter that could serve this array, not just the
              one in the BOM — applying a row swaps the BOM's inverter line. */}
          <DesignSuggestions
            lang={lang}
            bom={p.bom}
            kw={p.kw}
            battKwh={p.batt ? (Number(p.battKwh) || 0) : 0}
            market={p.market}
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

          {isUA && (
            <UaPanel
              lang={lang}
              kw={Number(p.kw) || 0}
              battKwh={p.batt ? (Number(p.battKwh) || 0) : 0}
              plan={p.uaPlan}
              onPlan={(uaPlan) => update({ uaPlan })}
              onApplyBattery={(kwh) => update({ batt: true, battKwh: kwh })}
              costEur={q.e.cost}
              fxUah={Number(E?.fx?.UAH) || FX.UAH}
              fitUah={Number(E?.uaFitUah) || 6.1331}
              afterUah={Number(E?.uaFeedAfterUah) || 2.5}
              money={fmt}
            />
          )}

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
              {/* The repayment is typed in the offer's currency too, so it sits
                  beside the savings it is compared with in the same unit. */}
              <div className="fin-box">
                <div className="lbl">{tr("monthly_loan")} ({fmt.local ? fmt.unit : "€"})</div>
                {fmt.local
                  ? <LocalMoneyInput eur={p.loan || 0} fmt={fmt} dec={0} allowZero className=""
                      onEur={(v) => update({ loan: v })} />
                  : <NumInput min="0" max="1000000" value={p.loan} onValue={(v) => update({ loan: v })} />}
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

          {/* What programmes may pay for part of this job (Moldova). The offer
              shows the same, frozen on the day it is sent (SupportOffer.jsx). */}
          {isMD && (
            <SupportCard projectId={initial.id} lang={lang} market={p.market} costEur={q.e.grossCost}
              batteryEur={batteryEur({ batt: p.batt, battKwh: p.battKwh, batteryCostPerKwh: E.batteryCostPerKwh })}
              vatRatePct={vatRatePct} fx={E.fx} initialKind={initial.client_kind ?? null} initialProfile={initial.client_profile ?? null} />
          )}

          {/* The job's area from CNED's register: a local preview while
              CNED_DATA is on, until CNED confirms its reuse (lib/cnedData.js). */}
          {isMD && cnedOn && (
            <RaionCard projectId={initial.id} lang={lang} lat={p.lat} lon={p.lon} initialShow={!!initial.show_raion} />
          )}

          {signed && <SignedContract signed={signed} lang={lang} />}

          {p.status === "won" && (
            <InstallChecklist key={railProg ? JSON.stringify(railProg) : "init"} projectId={initial.id}
              initial={railProg || initial.install_progress} lang={lang} />
          )}

          {/* The grid-connection file, Moldova's or Ukraine's: from the moment
              the offer is out (some installers apply for the approval before
              the client signs). */}
          {(isMD || isUA) && (p.status !== "draft" || initial.install_progress?.gridFile) && (
            <GridFile key={p.market + (railProg?.gridFile ? JSON.stringify(railProg.gridFile) : "")} projectId={initial.id}
              market={p.market} address={[p.address, p.title].filter(Boolean).join(", ")}
              initial={(railProg || initial.install_progress)?.gridFile} lang={lang}
              client={{ client_name: p.client || "", client_email: p.clientEmail || "", address: p.address || "", client_kind: initial.client_kind || null }} submission={{ ...gridSub, installedKw: productionPower({ kw: p.kw, bom: p.bom, batt: p.batt, batt_kwh: p.battKwh }).kw }} />
          )}

          {/* A signed job in Moldova or Ukraine goes into a portfolio for a
              lender (renders nothing otherwise). */}
          <AddToPortfolio projectId={initial.id} lang={lang} status={p.status} market={p.market} />
          {/* the Studio job this quote belongs to, when one is linked */}
          <StudioJobLine projectId={initial.id} kw={p.kw} lang={lang} />
        </FoldColumn>
      </div>

      {/* site designer: draw the roof on satellite imagery, full screen */}
      {siteDesignerOpen && p.lat != null && p.lon != null && (
        <SiteDesigner lang={lang} lat={p.lat} lon={p.lon} address={p.address} siteDesign={p.siteDesign} projectId={initial.id}
          onChange={(sd) => {
            // the designer sends the photo and its place with the roof; no photo, no place
            const next = { ...sd };
            if (!next.photoUrl) { delete next.photoUrl; delete next.photoPlace; }
            else if (!next.photoPlace) delete next.photoPlace;
            update({ siteDesign: next });
          }}
          onApply={applySiteDesignLayout} applying={siteDesignApplying}
          projectInputs={p} onComputeQuote={computeSiteDesignQuote} money={fmt}
          onClose={() => setSiteDesignerOpen(false)} />
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
              <button type="button" className="btn ghost" onClick={downloadProforma}>{tr("inv_dl")}</button>
              <a className="btn primary" target="_blank" rel="noopener noreferrer"
                href={`/projects/${initial.id}/invoice${depPct > 0 ? `?deposit=${depPct}` : ""}`}
                onClick={() => setInvOpen(false)}>{tr("inv_dep_open")}</a>
            </div>
            {/* e-Factura and the client's payments: their own page (billing/) */}
            <a className="btn ghost sm" style={{ marginTop: 10, width: "100%", justifyContent: "center" }} href={`/projects/${initial.id}/billing`}>{xt("bl_link", lang)}</a>
          </div>
        </div>
      )}

      {/* The contract states the price in the offer's currency, the same
          amount the client read on the proposal (it used to say EUR always). */}
      {legalDocsOpen && (
        <LegalDocsModal lang={lang} onClose={() => setLegalDocsOpen(false)} initialTab={legalTab}
          company={{ name: companyName, ...companyLegal }}
          project={{ id: initial.id, clientName: signedOffer?.clientName ?? p.client, address: signedOffer?.address ?? p.address, kw: signedOffer?.kw ?? p.kw, price: signedOffer?.price ?? fmt.toLocal(q.e.cost), currency: signedOffer?.currency ?? fmt.currency, batt: signedOffer ? signedOffer.batt : p.batt, battKwh: signedOffer?.battKwh ?? p.battKwh, market: p.market, bom: signedOffer?.bom ?? p.bom, gridOperator: initial.install_progress?.gridFile?.operator, title: p.title }} />
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
            {/* The link stays the same; this refreshes what it SHOWS from the
                project's current state — the escape hatch for edits made after
                the first "Generate" click, which createProposal() itself will
                never pick up. Server refuses once the client has accepted; the
                status check here just avoids showing a button that would fail. */}
            {p.status !== "won" && (
              <div className="prop-refresh-row">
                <button className="btn sm ghost" disabled={refreshing} onClick={refreshProposal}>
                  {refreshing ? tr("prop_refreshing") : tr("prop_refresh")}
                </button>
                {refreshMsg && <span className={"email-msg " + (refreshMsg.ok ? "ok" : "bad")} style={{ margin: 0 }}>{refreshMsg.text}</span>}
              </div>
            )}
            {/* Where Moldovan clients actually read messages: Viber first, then
                WhatsApp and Telegram. Each opens the app with the message and the
                tracked link already written. */}
            <div className="share-lbl">{tr("share_on")}</div>
            <div className="share-row">
              <a className="btn viber" href={`viber://forward?text=${encodeURIComponent(shareMsg)}`}>Viber</a>
              <a className="btn wapp" href={`https://wa.me/?text=${encodeURIComponent(shareMsg)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a className="btn tg" href={`https://t.me/share/url?url=${encodeURIComponent(propUrl)}&text=${encodeURIComponent(tr("share_msg_nolink", { client: p.client || tr("your_client"), company: companyName }))}`} target="_blank" rel="noopener noreferrer">Telegram</a>
            </div>
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
              systemLabel={`${nf(p.kw, 1)} kW${p.batt ? " + " + nf(p.battKwh || 10, Number.isInteger(+(p.battKwh || 10)) ? 0 : 1) + " kWh" : ""}`}
              bands={[
                { label: tr("pessimistic"), years: yrs(q.p.payback) + " " + tr("yrs") },
                { label: tr("expected"), years: yrs(q.e.payback) + " " + tr("yrs") },
                { label: tr("optimistic"), years: yrs(q.o.payback) + " " + tr("yrs") },
              ]}
              savings={fmt(lifetime)}
              waText={shareMsg} />
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
