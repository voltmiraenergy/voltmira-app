"use client";
// app/(app)/studio/studio-kit.jsx — shared chrome, helpers and mock
// data for the product-preview surfaces. Everything here is client-side and
// self-contained: the previews never touch Supabase or an external service.
//
// Design language is the app's own (AppTheme.jsx tokens: --paper-2, --line,
// --green, --amber, --ink …). Preview-only classes are namespaced `.pv-`.
import { useEffect, useState, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { defaultEngineSettings } from "./_engine.js";
import { PREVIEW_FEATURES, PREVIEW_BASE } from "./features.js";

/* ------------------------------------------------------------------ i18n ---- */
// The authed layout stores the workspace language in localStorage so client
// components (which can't read the server-side company row) can localize.
export function useLang() {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    try {
      const v = localStorage.getItem("voltmira_lang");
      if (v === "en" || v === "ro" || v === "ru") setLang(v);
    } catch { /* private mode / disabled storage — stay English */ }
  }, []);
  return lang;
}

// tx({ en, ro, ru }, lang) → best string for the language, English as the floor.
export function tx(dict, lang) {
  if (!dict) return "";
  return dict[lang] || dict.en || dict.ro || "";
}

// Page-local dictionary helper: pass a { key: {en,ro,ru} } table, get t(key).
export function makeT(table, lang) {
  return (key, vars) => {
    const row = table[key];
    let s = (row && (row[lang] || row.en)) || key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  };
}

/* --------------------------------------------------------------- helpers ---- */
export const EUR = (n, dp = 0) =>
  "€" + Number(n || 0).toLocaleString("en-IE", { maximumFractionDigits: dp, minimumFractionDigits: dp });
export const NUM = (n, dp = 0) =>
  Number(n || 0).toLocaleString("en-IE", { maximumFractionDigits: dp, minimumFractionDigits: dp });
export const PCT = (n, dp = 1) => (n >= 0 ? "" : "−") + Math.abs(Number(n || 0)).toFixed(dp) + "%";

// Deterministic PRNG so charts / sparklines / mock keys never reshuffle between
// renders (mulberry32).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A believable price/PR history: `points` values ending at `end`, wandering by
// ~`vol` fraction, seeded so it's stable.
export function walk(seed, end, points = 12, vol = 0.04) {
  const r = seeded(seed);
  const out = [end];
  for (let i = 1; i < points; i++) {
    const prev = out[0];
    out.unshift(Math.max(0.01, prev * (1 + (r() - 0.5) * 2 * vol)));
  }
  return out;
}

export function engineSettings() {
  // No live FX (that needs the server) — the static engine table is fine here.
  return { ...defaultEngineSettings() };
}

/* ----------------------------------------------------------- shared data ---- */
// One representative prosumer used across the annex, bankability, pitch and the
// site-layout default. A real Chișinău net-billing case with a battery.
export const DEMO_PROJECT = {
  title: "Casă Ciocana — Ionescu",
  client: "Familia Ionescu",
  address: "str. Petru Zadnipru 12, Chișinău, MD-2044",
  contractNo: "PE-CHI-2026-04417",
  market: "MD",          // net billing
  kw: 6.53,
  price: 0.185,
  cons: 6200,
  batt: true,
  battKwh: 9.6,
  afmSubsidy: false,
  phases: 3,             // trifazat
  yieldOverride: 1187,   // PVGIS-SARAH3 for this roof, kWh/kWp/yr
  tilt: 32,
  azimuth: 8,            // ° from due south (E+)
  approvedKw: 12,        // putere aprobată consum
};

// The equipment the demo system is built from — brands RO/MD installers quote.
export const DEMO_SYSTEM = {
  panel: { brand: "LONGi", model: "Hi-MO 6 Explorer LR5-54HTH", watt: 435, voc: 39.6, isc: 13.9, cells: 108 },
  inverter: { brand: "Deye", model: "SUN-6K-SG04LP3", kw: 6, type: "hybrid", mppt: 2, phases: 3, std: "SR EN 50549-1" },
  battery: { brand: "Pylontech", model: "US5000 × 2", kwh: 9.6, vdc: 48, chem: "LiFePO₄" },
  mount: { brand: "K2 Systems", model: "SingleRail 48 / Speed Rail", type: "roof, tile hooks" },
};

// Standardised grid-protection settings for the SLD / annex (SR EN 50549-1,
// aligned with ANRE Ord. 228/2018 and Moldelectrica connection rules).
// `fn` and the wordy parts of set/time are localised — render with protRows(lang).
export const PROTECTION = [
  { fn: { ro: "U< (subtensiune, treapta 1)", en: "U< (undervoltage, stage 1)", ru: "U< (пониж. напряжение, ступень 1)" }, set: "0,85 Un", time: "1,5 s" },
  { fn: { ro: "U< (subtensiune, treapta 2)", en: "U< (undervoltage, stage 2)", ru: "U< (пониж. напряжение, ступень 2)" }, set: "0,45 Un", time: "0,3 s" },
  { fn: { ro: "U> (supratensiune, treapta 1)", en: "U> (overvoltage, stage 1)", ru: "U> (повыш. напряжение, ступень 1)" }, set: "1,10 Un", time: "1,5 s" },
  { fn: { ro: "U> (medie pe 10 min.)", en: "U> (10-min mean)", ru: "U> (среднее за 10 мин.)" }, set: "1,10 Un", time: "3,0 s" },
  { fn: { ro: "f< (subfrecvență)", en: "f< (underfrequency)", ru: "f< (пониж. частота)" }, set: "47,5 Hz", time: "0,2 s" },
  { fn: { ro: "f> (suprafrecvență)", en: "f> (overfrequency)", ru: "f> (повыш. частота)" }, set: "51,5 Hz", time: "0,2 s" },
  { fn: { ro: "Anti-insularizare (LoM)", en: "Anti-islanding (LoM)", ru: "Защита от островного режима (LoM)" }, set: { ro: "salt de vector / RoCoF", en: "vector shift / RoCoF", ru: "векторный сдвиг / RoCoF" }, time: "≤ 0,15 s" },
  { fn: { ro: "Reconectare după declanșare", en: "Reconnection after trip", ru: "Повторное включение после отключения" }, set: "0,90–1,10 Un · 47,5–50,05 Hz", time: { ro: "temporizare 60 s", en: "60 s delay", ru: "задержка 60 с" } },
];
// Resolve PROTECTION for a language → [{fn, set, time}] of plain strings.
export function protRows(lang) {
  return PROTECTION.map((p) => ({
    fn: typeof p.fn === "string" ? p.fn : (p.fn[lang] || p.fn.en),
    set: typeof p.set === "string" ? p.set : (p.set[lang] || p.set.en),
    time: typeof p.time === "string" ? p.time : (p.time[lang] || p.time.en),
  }));
}

/* ------------------------------------------------------- editable client ---- */
// Every Studio surface reads its client + system inputs from here, so the annex,
// the site layout, the pricing view and the P50/P90 export all reflect the same
// client and update together. Persisted per browser; NOT written to Supabase.
export const CLIENT_PRESETS = [
  { id: "ionescu", name: "Familia Ionescu", address: "str. Petru Zadnipru 12, Chișinău, MD-2044", lat: 47.0509, lng: 28.8785, contractNo: "PE-CHI-2026-04417", ref: "VM-2026-0417", market: "MD", kw: 6.5, cons: 6200, price: 0.185, batteryKwh: 9.6, phases: 3, atestat: "ANRE-MC nr. 2026/PV-0148" },
  { id: "popescu", name: "Familie Popescu", address: "str. Donath 128, Cluj-Napoca", lat: 46.7623, lng: 23.5558, contractNo: "DEER-CJ-2026-11832", ref: "VM-2026-1183", market: "RO", kw: 8.5, cons: 8000, price: 0.21, batteryKwh: 0, phases: 1, atestat: "ANRE tip B nr. 2026/24417" },
  { id: "logipark", name: "Hala Chiajna — LogiPark SRL", address: "DN7 km 12, Chiajna, jud. Ilfov", lat: 44.4682, lng: 25.9760, contractNo: "EDMuntenia-2026-55901", ref: "VM-BNK-2026-0093", market: "RO", kw: 180, cons: 240000, price: 0.142, batteryKwh: 0, phases: 3, atestat: "ANRE tip B nr. 2026/24417" },
];
const StudioClientCtx = createContext(null);
export function StudioClientProvider({ children }) {
  // Start from the preset on both server AND first client render (identical HTML,
  // no hydration mismatch), then hydrate from localStorage in an effect.
  const [client, setClient] = useState(() => ({ ...CLIENT_PRESETS[0] }));
  useEffect(() => {
    try {
      const s = localStorage.getItem("voltmira_studio_client");
      if (s) setClient((c) => ({ ...c, ...JSON.parse(s) }));
    } catch { /* private mode / disabled storage */ }
  }, []);
  const update = (patch) => setClient((c) => {
    const n = { ...c, ...patch };
    try { localStorage.setItem("voltmira_studio_client", JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });
  return <StudioClientCtx.Provider value={{ client, update }}>{children}</StudioClientCtx.Provider>;
}
export function useStudioClient() {
  return useContext(StudioClientCtx) || { client: { ...CLIENT_PRESETS[0] }, update: () => {} };
}

// The editable client + system bar shown at the top of each surface.
export function ClientBar({ lang }) {
  const { client, update } = useStudioClient();
  const [open, setOpen] = useState(true);
  const T = (o) => tx(o, lang);
  const num = (k, step, min, max) => (
    <input className="pv-input" type="number" step={step} min={min} max={max} value={client[k]}
      onChange={(e) => update({ [k]: +e.target.value || 0 })} />
  );
  return (
    <div className="pv-panel cl-bar">
      <div className="cl-head">
        <h3 style={{ margin: 0 }}>{T({ en: "Client & system", ro: "Client și sistem", ru: "Клиент и система" })}</h3>
        <select className="cl-preset" value=""
          onChange={(e) => { const p = CLIENT_PRESETS.find((x) => x.id === e.target.value); if (p) update({ ...p }); }}>
          <option value="">{T({ en: "Load a sample client…", ro: "Încarcă un client exemplu…", ru: "Загрузить пример…" })}</option>
          {CLIENT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn ghost sm" onClick={() => setOpen((o) => !o)}>
          {open ? T({ en: "Collapse", ro: "Restrânge", ru: "Свернуть" }) : T({ en: "Edit", ro: "Editează", ru: "Изменить" })}
        </button>
      </div>
      {open ? (
        <div className="cl-grid">
          <label>{T({ en: "Client", ro: "Client", ru: "Клиент" })}
            <input className="pv-input" value={client.name} onChange={(e) => update({ name: e.target.value })} /></label>
          <label>{T({ en: "Address", ro: "Adresă", ru: "Адрес" })}
            <input className="pv-input" value={client.address} onChange={(e) => update({ address: e.target.value })} /></label>
          <label>{T({ en: "Contract no.", ro: "Nr. contract", ru: "№ договора" })}
            <input className="pv-input" value={client.contractNo} onChange={(e) => update({ contractNo: e.target.value })} /></label>
          <label>{T({ en: "Market", ro: "Piață", ru: "Рынок" })}
            <div className="pv-seg">
              <button className={client.market === "MD" ? "on" : ""} onClick={() => update({ market: "MD" })}>MD</button>
              <button className={client.market === "RO" ? "on" : ""} onClick={() => update({ market: "RO" })}>RO</button>
            </div></label>
          <label>{T({ en: "System size", ro: "Putere sistem", ru: "Мощность" })} <output>{(+client.kw).toFixed(1)} kW</output>
            <input type="range" min="2" max="300" step="0.5" value={client.kw}
              style={{ "--fill": ((+client.kw - 2) / 298) * 100 + "%" }}
              onChange={(e) => update({ kw: +e.target.value })} /></label>
          <label>{T({ en: "Annual use (kWh)", ro: "Consum anual (kWh)", ru: "Потребление (кВт·ч)" })}{num("cons", 100)}</label>
          <label>{T({ en: "Price (€/kWh)", ro: "Preț (€/kWh)", ru: "Цена (€/кВт·ч)" })}{num("price", 0.005)}</label>
          <label>{T({ en: "Battery (kWh)", ro: "Baterie (kWh)", ru: "Батарея (кВт·ч)" })}{num("batteryKwh", 0.5)}</label>
          <label>{T({ en: "Connection", ro: "Racordare", ru: "Подключение" })}
            <div className="pv-seg">
              <button className={client.phases === 1 ? "on" : ""} onClick={() => update({ phases: 1 })}>
                {T({ en: "1~ single", ro: "1~ monofazat", ru: "1~ однофазн." })}</button>
              <button className={client.phases === 3 ? "on" : ""} onClick={() => update({ phases: 3 })}>
                {T({ en: "3~ three", ro: "3~ trifazat", ru: "3~ трёхфазн." })}</button>
            </div></label>
        </div>
      ) : (
        <div className="cl-summary">
          {client.name} · {String(client.address).split(",")[0]} · {(+client.kw).toFixed(1)} kW · {client.market}
          {+client.batteryKwh > 0 ? ` · ${client.batteryKwh} kWh` : ""} · {client.phases === 3 ? "3~" : "1~"}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- icons ------ */
const IC = {
  // the VoltMira mark (three rising rays + sun dot), monochrome — Studio's home glyph
  overview: <><path d="M5 19 8.6 9" /><path d="M10.6 19 15 6" /><path d="M16 19 19.4 8" /><circle cx="15" cy="6" r="1.6" fill="currentColor" stroke="none" /></>,
  survey: <><path d="M3 20h18" /><path d="M5 20V10l7-5 7 5v10" /><path d="M9 20v-5h6v5" /><circle cx="18" cy="6" r="2.2" /></>,
  quote: <><path d="M7 3h8l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h4" /><path d="M12 9.5V8m0 3.5c1 0 1.6.5 1.6 1.2S13 14 12 14s-1.6.5-1.6 1.2S11 16.5 12 16.5m0-8v1.5m0 8V16.5" /></>,
  connection: <><path d="M6 4v5a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v5" /><circle cx="6" cy="4" r="1.8" fill="currentColor" stroke="none" /><circle cx="18" cy="20" r="1.8" fill="currentColor" stroke="none" /></>,
  annex: <><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2" /></>,
  pricing: <><path d="M3 7h18M3 12h18M3 17h18" /><circle cx="8" cy="7" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="10" cy="17" r="1.6" /></>,
  payments: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></>,
  schedule: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /><path d="M8 14l2.5 2.5L16 11" /></>,
  monitoring: <><path d="M3 12h4l3 8 4-16 3 8h4" /></>,
  bankability: <><path d="M4 10h16M6 10v8M18 10v8M4 18h16M12 3 4 7h16z" /></>,
  "lead-widget": <><path d="M3 5h18l-7 8v6l-4 2v-8z" /></>,
};
export function FeatureIcon({ slug, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {IC[slug] || IC.overview}
    </svg>
  );
}

/* ----------------------------------------------------------- chrome --------- */
// Studio ships as a real section, so the "Preview" chip is gone. Kept as a
// no-op so every call site (landing + each surface header) needs no edit.
export function PreviewBadge() {
  return null;
}

// Pill row — the one nav model for the whole section: a "Studio" home pill + one
// short pill per surface. Wraps compactly on a surface page; on the landing it
// spreads to a full-width grid of larger pills (`pv-tabs-wide`).
export function PreviewNav({ lang }) {
  const path = usePathname() || "";
  const onLanding = path === PREVIEW_BASE;
  const active = (slug) => path === `${PREVIEW_BASE}/${slug}`;
  return (
    <nav className={"pv-tabs" + (onLanding ? " pv-tabs-wide" : "")} aria-label="Studio">
      <Link href={PREVIEW_BASE} className={"pv-tab pv-tab-home" + (onLanding ? " here" : "")}
        aria-current={onLanding ? "page" : undefined}>
        <FeatureIcon slug="overview" /><span>{tx({ en: "Studio", ro: "Studio", ru: "Studio" }, lang)}</span>
      </Link>
      {PREVIEW_FEATURES.map((f) => (
        <Link key={f.slug} href={`${PREVIEW_BASE}/${f.slug}`} className={"pv-tab" + (active(f.slug) ? " on" : "")}
          aria-current={active(f.slug) ? "page" : undefined}>
          <FeatureIcon slug={f.slug} />
          <span>{(f[lang] || f.en).nav}</span>
        </Link>
      ))}
    </nav>
  );
}

// Standard header for a single feature page.
export function PreviewHeader({ slug, lang, title, sub, right = null }) {
  return (
    <div className="pv-head">
      <div className="pv-head-ic"><FeatureIcon slug={slug} size={20} /></div>
      <div className="pv-head-tx">
        <div className="pv-head-t">
          <h1>{title}</h1>
          <PreviewBadge lang={lang} />
        </div>
        {sub && <p>{sub}</p>}
      </div>
      {right && <div className="pv-head-right">{right}</div>}
    </div>
  );
}

// A small "this is a mock" disclosure line, worded per feature.
export function MockNote({ children }) {
  return (
    <p className="pv-mocknote">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
      {children}
    </p>
  );
}

// Tiny inline sparkline for tables.
export function Spark({ data, w = 84, h = 24, up }) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), sp = (mx - mn) || 1;
  const X = (i) => (i / (data.length - 1)) * w;
  const Y = (v) => h - 2 - ((v - mn) / sp) * (h - 4);
  const d = data.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const col = up ? "var(--red)" : "var(--green)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: "block" }}>
      <path d={d} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={X(data.length - 1)} cy={Y(data[data.length - 1])} r="2" fill={col} />
    </svg>
  );
}

// Copy-to-clipboard button that flips to a tick for ~1.6s.
export function CopyButton({ text, label, done, className = "btn sm ghost" }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className={className} onClick={() => {
      try { navigator.clipboard?.writeText(text); } catch {}
      setOk(true); setTimeout(() => setOk(false), 1600);
    }}>{ok ? (done || "Copied ✓") : label}</button>
  );
}

// Print helper — the preview docs (annex, bankability) render a white A4-ish
// sheet and hand off to the browser's Save-as-PDF, exactly like the invoice page.
export function printDoc() {
  if (typeof window !== "undefined") window.print();
}

/* --------------------------------------------------------------- styles ---- */
export const TOKENS_CSS = `
:root{
  --paper:#F6F5F0; --paper-2:#FFFFFF;
  --ink:#142A21; --ink-soft:#2B4438;
  --green:#1E6B4E; --green-soft:#2A8563; --green-tint:#E4EFE9;
  --amber:#E89B2D; --amber-soft:#F4B45C; --amber-tint:#FBF0DD;
  --muted:#66756C; --line:#E3E1D6; --hair:#CBC7B6;
  --red:#C4543B; --red-tint:#F7E6E1;
  --blue:#3D6B8E; --blue-tint:#E4EDF4;
  --shadow:0 1px 2px rgba(20,42,33,.05),0 4px 16px rgba(20,42,33,.06);
  --shadow-lg:0 8px 34px rgba(20,42,33,.16);
  --radius:14px;
  --font-d:'Inter',system-ui,-apple-system,sans-serif;
  --font-b:'Inter',system-ui,-apple-system,sans-serif;
  --font-m:ui-monospace,'IBM Plex Mono',SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --paper:#0F1310; --paper-2:#171B16; --ink:#EEF1EA; --ink-soft:#C4D0C6;
    --green:#4FB584; --green-soft:#3FAE6A; --green-tint:rgba(79,181,132,.16);
    --amber:#EBA542; --amber-soft:#F2B85F; --amber-tint:rgba(232,155,45,.15);
    --muted:#8E998F; --line:#28302A; --hair:#39443B;
    --red:#E0725A; --red-tint:rgba(196,84,59,.2);
    --blue:#6FA0C4; --blue-tint:rgba(61,107,142,.22);
    --shadow:0 1px 2px rgba(0,0,0,.35),0 4px 16px rgba(0,0,0,.4);
    --shadow-lg:0 10px 36px rgba(0,0,0,.55);
  }
}
:root[data-theme="dark"]{
  --paper:#0F1310; --paper-2:#171B16; --ink:#EEF1EA; --ink-soft:#C4D0C6;
  --green:#4FB584; --green-soft:#3FAE6A; --green-tint:rgba(79,181,132,.16);
  --amber:#EBA542; --amber-soft:#F2B85F; --amber-tint:rgba(232,155,45,.15);
  --muted:#8E998F; --line:#28302A; --hair:#39443B;
  --red:#E0725A; --red-tint:rgba(196,84,59,.2);
  --blue:#6FA0C4; --blue-tint:rgba(61,107,142,.22);
  --shadow:0 1px 2px rgba(0,0,0,.35),0 4px 16px rgba(0,0,0,.4);
  --shadow-lg:0 10px 36px rgba(0,0,0,.55);
}
.pv-wrap .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;
  font-family:var(--font-b);padding:10px 16px;border-radius:11px;border:1px solid transparent;text-decoration:none;
  white-space:nowrap;cursor:pointer;transition:transform .14s,box-shadow .18s,background .18s,border-color .18s,color .18s}
.pv-wrap .btn:active{transform:scale(.97)}
.pv-wrap .btn.primary{background:var(--green);color:#fff;box-shadow:0 3px 12px rgba(30,107,78,.25)}
.pv-wrap .btn.primary:hover{background:var(--green-soft)}
.pv-wrap .btn.ghost{background:var(--paper-2);border-color:var(--line);color:var(--ink)}
.pv-wrap .btn.ghost:hover{border-color:var(--green);color:var(--green)}
.pv-wrap .btn.sm{padding:7px 12px;font-size:13px;border-radius:9px}
.pv-wrap .btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important;box-shadow:none!important}
.pv-wrap input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;
  background:linear-gradient(90deg,var(--amber) var(--fill,30%),var(--line) var(--fill,30%))}
.pv-wrap input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;
  border-radius:50%;background:var(--amber);border:3px solid var(--paper-2);box-shadow:0 0 0 1px var(--amber),0 2px 8px rgba(20,42,33,.25);cursor:grab}
.pv-wrap input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--amber);border:3px solid var(--paper-2)}
`;

export const PREVIEW_CSS = `
.pv-wrap{max-width:1180px;margin:0 auto}
.pv-topbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.pv-back{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:13px;font-weight:600;
  text-decoration:none;padding:7px 11px 7px 8px;border-radius:9px;transition:background .15s,color .15s}
.pv-back:hover{background:var(--paper-2);color:var(--ink)}
.pv-badge{flex:none;font-family:var(--font-d);font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:var(--ink);background:var(--amber);border-radius:99px;padding:3px 9px}
.pv-kicker{font-family:var(--font-m,monospace);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--green);font-weight:600}

.pv-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:22px}
.pv-tab{display:inline-flex;align-items:center;gap:7px;text-decoration:none;color:var(--muted);
  font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:9px;border:1px solid var(--line);
  background:var(--paper-2);white-space:nowrap;transition:color .15s,background .15s,border-color .15s}
.pv-tab:hover{color:var(--ink);border-color:#CBC7B6}
html[data-theme="dark"] .pv-tab:hover{border-color:#39443B}
.pv-tab svg{flex:none;opacity:.85}
.pv-tab.on{background:var(--green);border-color:var(--green);color:#fff}
.pv-tab.on svg{opacity:1}
.pv-tab-home{color:var(--ink);border-color:transparent;background:var(--paper);padding-left:9px}
.pv-tab-home svg{opacity:1;color:var(--green)}
.pv-tab-home:hover{background:var(--green-tint);border-color:transparent}
.pv-tab-home.here{background:var(--green-tint);color:var(--green)}
/* Studio landing — pills span the full width as a grid of larger tiles */
.pv-tabs-wide{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;margin-bottom:26px}
.pv-tabs-wide .pv-tab{justify-content:center;padding:13px 10px;font-size:13px;border-radius:12px;min-width:0}
.pv-tabs-wide .pv-tab span{overflow:hidden;text-overflow:ellipsis}
.pv-tabs-wide .pv-tab svg{width:17px;height:17px}
@media(max-width:820px){.pv-tabs-wide{grid-template-columns:repeat(3,1fr)}}
@media(max-width:520px){.pv-tabs-wide{grid-template-columns:repeat(2,1fr)}.pv-tabs-wide .pv-tab{padding:12px 8px}}

/* Client & system bar (editable inputs on every surface) */
.cl-bar{margin-bottom:16px}
.cl-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cl-preset{font-size:12px;font-weight:600;border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:var(--paper-2);color:var(--ink);cursor:pointer}
.cl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px 16px;margin-top:14px}
.cl-grid > label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--muted)}
.cl-grid > label output{color:var(--green);font-weight:700}
.cl-summary{margin-top:10px;font-size:13px;color:var(--ink);font-weight:600;line-height:1.5}
/* Phones: 2-up client editor (name/address/contract span the row) and a
   one-line scrollable pill row instead of a 750px stack and a 2-row wrap. */
@media(max-width:520px){
  .cl-grid{grid-template-columns:1fr 1fr;gap:11px 12px}
  .cl-grid > *:nth-child(-n+3){grid-column:1 / -1}
  .pv-tabs:not(.pv-tabs-wide){flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:4px}
  .pv-tabs:not(.pv-tabs-wide)::-webkit-scrollbar{display:none}
  .pv-tabs:not(.pv-tabs-wide) .pv-tab{flex:none}
}

.pv-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:20px}
.pv-head-ic{flex:none;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;
  background:var(--green-tint);color:var(--green)}
.pv-head-tx{flex:1;min-width:0}
.pv-head-t{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pv-head-t h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0}
.pv-head-tx p{margin:6px 0 0;font-size:13.5px;color:var(--muted);line-height:1.55;max-width:70ch}
.pv-head-right{flex:none;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
/* Phones: drop the header action buttons to their own full-width row so the
   title and blurb get the whole width instead of one word per line. After the
   base rule so its flex:none cannot reset the basis. */
@media(max-width:520px){
  .pv-head{flex-wrap:wrap}
  .pv-head-right{order:3;flex-basis:100%;margin-top:2px}
}

.pv-mocknote{display:flex;gap:9px;align-items:flex-start;font-size:12px;color:var(--muted);line-height:1.5;
  background:var(--paper-2);border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin:0 0 18px}
.pv-mocknote svg{flex:none;margin-top:1px;color:var(--amber)}

/* Studio landing — one hairline-divided list of every surface (2-up on desktop) */
.st-list{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);
  border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:var(--shadow)}
@media(max-width:820px){.st-list{grid-template-columns:1fr}}
.st-row{display:flex;align-items:flex-start;gap:14px;padding:18px 20px;background:var(--paper-2);
  text-decoration:none;color:inherit;transition:background .15s}
.st-row:hover{background:var(--paper)}
.st-row:focus-visible{outline:2px solid var(--amber);outline-offset:-2px}
.st-row-ic{flex:none;width:38px;height:38px;border-radius:10px;display:grid;place-items:center;
  background:var(--green-tint);color:var(--green);margin-top:1px}
.st-row-tx{flex:1;min-width:0}
.st-row-tx b{display:block;font-size:15px;font-weight:700;color:var(--ink);letter-spacing:-.01em}
.st-row-tx span{display:block;font-size:12.5px;color:var(--muted);line-height:1.55;margin-top:5px}
.st-row-go{flex:none;color:var(--muted);transition:color .15s,transform .15s;margin-top:3px}
.st-row:hover .st-row-go{color:var(--green);transform:translateX(2px)}

/* generic building blocks reused by feature pages */
.pv-panel{background:var(--paper-2);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:var(--shadow)}
.pv-panel + .pv-panel{margin-top:16px}
.pv-panel h3{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin:0 0 14px}
.pv-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.pv-3col{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.pv-side{display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:start}
@media(max-width:900px){.pv-2col,.pv-3col,.pv-side{grid-template-columns:minmax(0,1fr)}}

.pv-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.pv-metric{background:var(--paper);border:1px solid var(--line);border-radius:11px;padding:12px 13px}
.pv-metric b{display:block;font-family:var(--font-d);font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.15}
.pv-metric span{font-size:11px;color:var(--muted);display:block;margin-top:3px;line-height:1.35}
.pv-metric.good b{color:var(--green)}
.pv-metric.warn b{color:#B4700F}

.pv-tbl{width:100%;border-collapse:collapse;font-size:13px}
.pv-tbl th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);
  text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.pv-tbl td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
.pv-tbl tr:last-child td{border-bottom:none}
.pv-tbl tbody tr:hover{background:var(--paper)}
.pv-tbl .num{text-align:right;font-variant-numeric:tabular-nums}
.pv-tbl .th-r{text-align:right}
.pv-tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}

.pv-seg{display:inline-flex;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:3px;gap:2px}
.pv-seg button{font-size:12.5px;font-weight:600;color:var(--muted);padding:6px 12px;border-radius:8px;cursor:pointer;
  background:none;border:none;font-family:inherit;transition:background .14s,color .14s}
.pv-seg button.on{background:var(--paper-2);color:var(--ink);box-shadow:var(--shadow)}
html[data-theme="dark"] .pv-seg button.on{background:var(--ink);color:#fff}

.pv-fchips{display:flex;flex-wrap:wrap;gap:7px}
.pv-fchip{font-size:12px;font-weight:600;padding:6px 12px;border-radius:99px;background:var(--paper-2);
  border:1px solid var(--line);color:var(--muted);cursor:pointer;transition:all .14s;user-select:none}
.pv-fchip:hover{border-color:var(--green);color:var(--green)}
.pv-fchip.on{background:var(--ink);border-color:var(--ink);color:#fff}
html[data-theme="dark"] .pv-fchip.on{background:#080B09;border-color:#080B09}

.pv-delta.up{color:var(--red);font-weight:600}
.pv-delta.down{color:var(--green);font-weight:600}
.pv-tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:99px;padding:2px 9px;letter-spacing:.02em}
.pv-tag.in{background:var(--green-tint);color:var(--green)}
.pv-tag.low{background:var(--amber-tint);color:#B4700F}
.pv-tag.order{background:var(--blue-tint);color:var(--blue)}

.pv-callout{display:flex;gap:12px;align-items:flex-start;background:var(--green-tint);
  border:1px solid color-mix(in srgb,var(--green) 34%,transparent);border-radius:13px;padding:15px 17px;margin-top:16px}
.pv-callout svg{flex:none;color:var(--green);margin-top:1px}
.pv-callout b{color:var(--ink);font-weight:700}
.pv-callout p{margin:4px 0 0;font-size:13px;color:var(--ink);opacity:.92;line-height:1.55}

.pv-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,90px);background:var(--ink);color:#fff;
  font-size:13.5px;font-weight:600;padding:12px 18px;border-radius:12px;box-shadow:var(--shadow-lg);z-index:200;
  transition:transform .3s cubic-bezier(.2,.9,.3,1.2)}
.pv-toast.show{transform:translate(-50%,0)}

.pv-code{background:var(--ink);color:#D6E5DE;font-family:var(--font-m,ui-monospace,monospace);font-size:12px;
  padding:14px 16px;border-radius:11px;overflow-x:auto;white-space:pre;line-height:1.65}
html[data-theme="dark"] .pv-code{background:#080B09}
.pv-code .k{color:#7FD1A8}.pv-code .s{color:#E8B673}.pv-code .c{color:#6B8778}.pv-code .n{color:#9FB8D8}

.pv-field{margin-bottom:13px}
.pv-field label{display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:6px}
.pv-field label output{color:var(--green);font-family:var(--font-d);font-weight:700}
.pv-input{width:100%;background:var(--paper-2);border:1px solid var(--line);font-size:14px;padding:9px 11px;border-radius:9px}
.pv-input:focus{border-color:var(--green);outline:none;box-shadow:0 0 0 3px rgba(30,107,78,.12)}

/* white "document" sheet for the export previews (annex, bankability) */
.pv-doc{background:#fff;color:#14211b;border:1px solid var(--line);border-radius:12px;
  padding:34px 40px;max-width:860px;margin:0 auto;font-size:12.7px;line-height:1.5;
  font-family:Inter,system-ui,sans-serif}
.pv-doc h1{font-size:20px;margin:0 0 3px;letter-spacing:-.01em;color:#14211b}
.pv-doc h2{font-size:13.5px;margin:20px 0 8px;color:#1E6B4E;text-transform:uppercase;letter-spacing:.05em}
.pv-doc h3{font-size:12.5px;margin:14px 0 6px;color:#14211b}
.pv-doc p{margin:0 0 8px;color:#333}
.pv-doc .doc-co{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#1E6B4E;font-weight:700;margin-bottom:10px}
.pv-doc .doc-sub{color:#555;font-size:11.5px}
.pv-doc table{width:100%;border-collapse:collapse;font-size:11.5px;margin:4px 0 6px}
.pv-doc th{background:#F0EEE6;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#444}
.pv-doc td{padding:6px 8px;border-bottom:1px solid #E5E2D6;color:#222}
.pv-doc .doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 22px}
.pv-doc .doc-kv{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid #EEEBDF}
.pv-doc .doc-kv span{color:#666}.pv-doc .doc-kv b{color:#14211b;font-weight:600;text-align:right}
.pv-doc .doc-note{font-size:10.5px;color:#777;line-height:1.5;margin-top:6px}
.pv-doc .doc-sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:26px}
.pv-doc .doc-sign div{border-top:1px solid #999;padding-top:6px;font-size:10.5px;color:#666}
.pv-doc-scroll{overflow-x:auto}

@media print{
  .sidebar,.skip-link,.demo-bar,.pv-tabs,.pv-topbar,.pv-head-right,.pv-noprint,.pv-toast{display:none!important}
  .app .main{margin:0!important;padding:0!important;background:#fff!important}
  .pv-wrap,.pv-doc{max-width:none;margin:0}
  .pv-doc{border:none;padding:0}
  .pv-head{margin-bottom:10px}
  body{background:#fff!important}
  @page{size:A4;margin:14mm}
}
`;
