"use client";
// Preview 1 — Site layout planner.
// Address-first: geocode the street, load real satellite imagery for that roof,
// trace the roof plane with four draggable corners, and fill it with panels. The
// system size / production / payback read back live from the shared engine.
// Deliberately 2D — it answers "can it lay out my roof?" without a LIDAR build.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLang, makeT, PreviewHeader, MockNote, DEMO_SYSTEM, NUM, engineSettings,
  useStudioClient, ClientBar, CLIENT_PRESETS,
} from "../studio-kit.jsx";
import { quote } from "../_engine.js";

const TX = {
  title: { en: "Site layout planner", ro: "Planificator amplasament", ru: "Планировщик участка" },
  sub: {
    en: "Find the address, trace the roof on the satellite view, drop panels on it. The system size reads back live.",
    ro: "Găsește adresa, trasează acoperișul pe vederea din satelit, pune panouri pe el. Puterea sistemului se actualizează live.",
    ru: "Найдите адрес, обведите крышу на спутниковом виде, расставьте панели. Мощность обновляется вживую.",
  },
  note: {
    en: "Satellite imagery for the client's address. Trace the roof with four corners, fill it with panels, and “Push to quote” writes the panel count and orientation straight onto the quote.",
    ro: "Imagini satelit pentru adresa clientului. Trasezi acoperișul cu patru colțuri, îl umpli cu panouri, iar „Trimite în ofertă” scrie numărul de panouri și orientarea direct în ofertă.",
    ru: "Спутниковые снимки по адресу клиента. Обведите крышу четырьмя углами, заполните панелями, и «В расчёт» запишет число панелей и ориентацию прямо в расчёт.",
  },
  address: { en: "Address", ro: "Adresă", ru: "Адрес" },
  locate: { en: "Locate", ro: "Localizează", ru: "Найти" },
  presets: { en: "or try", ro: "sau încearcă", ru: "или попробуйте" },
  empty: { en: "Enter an address to load the satellite view", ro: "Introdu o adresă pentru a încărca vederea din satelit", ru: "Введите адрес, чтобы загрузить спутниковый вид" },
  loading: { en: "Loading imagery…", ro: "Se încarcă imaginile…", ru: "Загрузка снимков…" },
  notfound: { en: "Address not found — try a nearby landmark or the town name.", ro: "Adresa nu a fost găsită — încearcă un reper apropiat sau numele localității.", ru: "Адрес не найден — попробуйте ближайший ориентир или название города." },
  imgfail: { en: "Imagery didn't load — you can still trace the roof.", ro: "Imaginile nu s-au încărcat — poți trasa acoperișul oricum.", ru: "Снимки не загрузились — крышу всё равно можно обвести." },
  array: { en: "Array", ro: "Câmp panouri", ru: "Массив" },
  panel: { en: "Panel", ro: "Panou", ru: "Панель" },
  orient: { en: "Orientation", ro: "Orientare", ru: "Ориентация" },
  portrait: { en: "Portrait", ro: "Vertical", ru: "Верт." },
  landscape: { en: "Landscape", ro: "Orizontal", ru: "Гориз." },
  tilt: { en: "Tilt", ro: "Înclinare", ru: "Наклон" },
  azimuth: { en: "Azimuth", ro: "Azimut", ru: "Азимут" },
  fill: { en: "Fill roof", ro: "Umple", ru: "Заполнить" },
  clear: { en: "Clear", ro: "Golește", ru: "Очистить" },
  push: { en: "Push to quote", ro: "Trimite în ofertă", ru: "В расчёт" },
  print: { en: "Print / PDF", ro: "Printează / PDF", ru: "Печать / PDF" },
  hint: { en: "Drag the four corners onto the roof edges · click a panel to remove it", ro: "Trage cele patru colțuri pe marginile acoperișului · click pe un panou ca să-l scoți", ru: "Перетащите четыре угла на края крыши · клик по панели — убрать" },
  m_panels: { en: "Panels", ro: "Panouri", ru: "Панелей" },
  m_dc: { en: "DC size", ro: "Putere DC", ru: "Мощность DC" },
  m_area: { en: "Array area", ro: "Suprafață panouri", ru: "Площадь панелей" },
  m_prod: { en: "Est. production / yr", ro: "Producție est. / an", ru: "Выработка / год" },
  m_yield: { en: "Specific yield", ro: "Randament specific", ru: "Удельн. выработка" },
  m_roof: { en: "Roof area", ro: "Suprafață acoperiș", ru: "Площадь крыши" },
  m_inv: { en: "Suggested inverter", ro: "Invertor sugerat", ru: "Инвертор" },
  m_pay: { en: "Expected payback", ro: "Amortizare estimată", ru: "Окупаемость" },
  south: { en: "S", ro: "S", ru: "Ю" }, east: { en: "E", ro: "E", ru: "В" }, west: { en: "W", ro: "V", ru: "З" },
  pushed: { en: "Layout attached to “{p}”", ro: "Schiță atașată la „{p}”", ru: "Раскладка добавлена к «{p}»" },
};

const PANELS = [
  { id: "longi435", label: "LONGi Hi-MO 6 · 435 W", watt: 435, w: 1.134, h: 1.722 },
  { id: "jinko440", label: "Jinko Tiger Neo · 440 W", watt: 440, w: 1.134, h: 1.722 },
  { id: "canadian450", label: "Canadian TOPHiKu6 · 450 W", watt: 450, w: 1.134, h: 1.762 },
  { id: "ja585", label: "JA Solar DeepBlue 4.0 · 585 W", watt: 585, w: 1.134, h: 2.278 },
];
const INVERTERS = [3, 3.6, 4, 5, 6, 8, 10, 12, 15, 20, 25, 33, 50, 75, 110, 150, 200, 250];
const W = 960, H = 560, GAP = 1.4;
const VIEW_M = 34;                 // vertical ground span for the Esri fallback, metres
const YIELD_KWP = 1180;            // representative kWh/kWp/yr for the preview

// Google Maps Static API key. Set NEXT_PUBLIC_GOOGLE_MAPS_KEY in the environment
// to use real Google satellite imagery. With no key it falls back to keyless
// Esri World Imagery.
const GMAPS_KEY =
  (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) || "";
const GMAPS_ZOOM = 20;

// Displayed metres-per-pixel of the backdrop image (so the panel grid scales to
// the real roof). Google: Web-Mercator resolution at the zoom, halved for scale=2.
// Esri: we control the bbox, so it's a fixed VIEW_M / H.
function mppFor(lat) {
  if (GMAPS_KEY) {
    return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, GMAPS_ZOOM) / 2;
  }
  return VIEW_M / H;
}
function mapImgUrl(lat, lng) {
  if (GMAPS_KEY) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat.toFixed(7)},${lng.toFixed(7)}` +
      `&zoom=${GMAPS_ZOOM}&size=${W / 2}x${H / 2}&scale=2&maptype=satellite&key=${GMAPS_KEY}`;
  }
  const dLat = VIEW_M / 110540;
  const dLng = (W / H) * dLat * 110540 / (111320 * Math.cos((lat * Math.PI) / 180));
  const b = [lng - dLng / 2, lat - dLat / 2, lng + dLng / 2, lat + dLat / 2].map((v) => v.toFixed(7)).join(",");
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${b}&bboxSR=4326&imageSR=3857&size=${W},${H}&f=image&format=jpg`;
}
async function geocode(q) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null;
  } catch { return null; }
}

// Orientation-loss model around an optimal 34° tilt / due-south. Separable and
// intentionally gentle — a preview, not a ray-tracer.
function orientFactor(tilt, az) {
  return Math.max(0.45, 1 - 0.000148 * Math.pow(tilt - 34, 2)) * Math.max(0.42, 1 - 0.00004 * Math.pow(az, 2));
}
const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const distP = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
}
const DEFAULT_ROOF = () => [
  { x: 348, y: 176 }, { x: 624, y: 166 }, { x: 612, y: 402 }, { x: 336, y: 392 },
];

export default function SiteLayoutPreview() {
  const lang = useLang();
  const t = makeT(TX, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Site layout — VoltMira Studio"; }, []);

  const [loc, setLoc] = useState(null);           // { lat, lng }
  const [imgUrl, setImgUrl] = useState("");
  const [imgErr, setImgErr] = useState(false);
  const [mpp, setMpp] = useState(VIEW_M / H);      // displayed metres per pixel
  const [status, setStatus] = useState("loading"); // "" | "loading" | "notfound" | "imgfail"
  const [tilt, setTilt] = useState(30);
  const [az, setAz] = useState(8);
  const [orient, setOrient] = useState("portrait");
  const [panelId, setPanelId] = useState("longi435");
  const [roof, setRoof] = useState(DEFAULT_ROOF);
  const [removed, setRemoved] = useState(() => new Set());
  const [drag, setDrag] = useState(null);
  const [toast, setToast] = useState("");
  const svgRef = useRef(null);

  const panel = PANELS.find((p) => p.id === panelId) || PANELS[0];
  const pw = (orient === "portrait" ? panel.w : panel.h) / mpp;
  const ph = (orient === "portrait" ? panel.h : panel.w) / mpp;

  // Geocode the client's address (using preset coordinates when it matches one)
  // and load the satellite imagery for it.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      const preset = CLIENT_PRESETS.find((p) => p.address === client.address);
      let c = preset ? { lat: preset.lat, lng: preset.lng } : await geocode(client.address);
      if (cancelled) return;
      if (!c) { setStatus("notfound"); setLoc(null); return; }
      setStatus(""); setImgErr(false); setLoc(c);
      setMpp(mppFor(c.lat)); setImgUrl(mapImgUrl(c.lat, c.lng));
      setRoof(DEFAULT_ROOF()); setRemoved(new Set());
    })();
    return () => { cancelled = true; };
  }, [client.address]);

  // panel grid via bilinear map of the roof quad
  const grid = useMemo(() => {
    const [A, B, C, D] = roof;
    const cols = Math.max(1, Math.floor(((distP(A, B) + distP(D, C)) / 2) / (pw + GAP)));
    const rows = Math.max(1, Math.floor(((distP(A, D) + distP(B, C)) / 2) / (ph + GAP)));
    const at = (u, v) => lerpP(lerpP(A, B, u), lerpP(D, C, u), v);
    const cells = [];
    const inset = 0.06;
    for (let ri = 0; ri < rows; ri++) for (let ci = 0; ci < cols; ci++) {
      const u0 = (ci + inset) / cols, u1 = (ci + 1 - inset) / cols, v0 = (ri + inset) / rows, v1 = (ri + 1 - inset) / rows;
      cells.push({ key: ri + ":" + ci, pts: [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)] });
    }
    return { rows, cols, cells };
  }, [roof, pw, ph]);

  useEffect(() => {
    setRemoved((prev) => {
      let changed = false;
      const next = new Set();
      for (const k of prev) { const [r, c] = k.split(":").map(Number); if (r < grid.rows && c < grid.cols) next.add(k); else changed = true; }
      return changed ? next : prev;
    });
  }, [grid.rows, grid.cols]);

  useEffect(() => {
    if (drag == null) return;
    const move = (e) => {
      const svg = svgRef.current; if (!svg) return;
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const m = svg.getScreenCTM(); if (!m) return;
      const p = pt.matrixTransform(m.inverse());
      setRoof((prev) => prev.map((q, i) => i === drag
        ? { x: Math.max(12, Math.min(W - 12, p.x)), y: Math.max(12, Math.min(H - 12, p.y)) } : q));
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag]);

  const active = grid.cells.filter((c) => !removed.has(c.key));
  const n = active.length;
  const kw = (n * panel.watt) / 1000;
  const arrayArea = n * panel.w * panel.h;
  const roofArea = polyArea(roof) * mpp * mpp;
  const specYield = YIELD_KWP * orientFactor(tilt, az);
  const prod = kw * specYield;
  const invKw = INVERTERS.find((v) => v >= kw / 1.15) || INVERTERS[INVERTERS.length - 1];

  const cliKey = `${client.price}|${client.cons}|${client.batteryKwh}|${client.market}`;
  const payback = useMemo(() => {
    if (kw <= 0) return null;
    return quote({
      kw, price: +client.price || 0.2, cons: +client.cons || 5000,
      batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0,
      market: client.market, afmSubsidy: false, yieldOverride: Math.round(specYield),
    }, engineSettings()).e.payback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw, specYield, cliKey]);

  function pushToQuote() {
    setToast(t("pushed", { p: client.name }));
    setTimeout(() => setToast(""), 2600);
  }
  const azLabel = az === 0 ? t("south") : `${Math.abs(az)}° ${az > 0 ? t("east") : t("west")}`;
  const rng = (v, lo, hi) => ((v - lo) / (hi - lo)) * 100;
  const roofPath = roof.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ") + " Z";

  return (
    <>
      <PreviewHeader slug="site-layout" lang={lang} title={t("title")} sub={t("sub")}
        right={<>
          <button className="btn ghost sm" onClick={pushToQuote} disabled={!n}>{t("push")}</button>
          <button className="btn ghost sm" onClick={() => window.print()}>{t("print")}</button>
        </>} />
      <MockNote>{t("note")}</MockNote>

      <ClientBar lang={lang} />

      <div className="pv-side">
        {/* ---- controls ---- */}
        <div className="pv-panel">
          <h3>{t("array")}</h3>
          {(status === "notfound" || status === "imgfail") && (
            <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12 }}>
              {status === "notfound" ? t("notfound") : t("imgfail")}
            </div>
          )}
          <div className="pv-field">
            <label>{t("panel")}</label>
            <select className="pv-input" value={panelId} onChange={(e) => setPanelId(e.target.value)}>
              {PANELS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="pv-field">
            <label>{t("orient")}</label>
            <div className="pv-seg" role="group">
              <button className={orient === "portrait" ? "on" : ""} onClick={() => setOrient("portrait")}>{t("portrait")}</button>
              <button className={orient === "landscape" ? "on" : ""} onClick={() => setOrient("landscape")}>{t("landscape")}</button>
            </div>
          </div>
          <div className="pv-field">
            <label>{t("tilt")} <output>{tilt}°</output></label>
            <input type="range" min="0" max="55" step="1" value={tilt}
              style={{ "--fill": rng(tilt, 0, 55) + "%" }} onChange={(e) => setTilt(+e.target.value)} />
          </div>
          <div className="pv-field">
            <label>{t("azimuth")} <output>{azLabel}</output></label>
            <input type="range" min="-90" max="90" step="1" value={az}
              style={{ "--fill": rng(az, -90, 90) + "%" }} onChange={(e) => setAz(+e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => setRemoved(new Set())} disabled={!loc}>{t("fill")}</button>
            <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => setRemoved(new Set(grid.cells.map((c) => c.key)))} disabled={!loc}>{t("clear")}</button>
          </div>
        </div>

        {/* ---- stage + readout ---- */}
        <div style={{ minWidth: 0 }}>
          <div className="sl-stage">
            {!loc ? (
              <div className="sl-empty">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>{status === "loading" ? t("loading") : t("empty")}</span>
              </div>
            ) : (
              <>
                {imgErr
                  ? <div className="sl-fallback" />
                  : <img className="sl-img" src={imgUrl} alt="" onError={() => { setImgErr(true); setStatus("imgfail"); }} />}
                <svg ref={svgRef} className="sl-svg" viewBox={`0 0 ${W} ${H}`}>
                  <path d={roofPath} fill="rgba(20,42,33,0.18)" stroke="#F4B45C" strokeWidth="2.4" strokeDasharray="7 5" />
                  {active.map((c) => {
                    const d = c.pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ") + " Z";
                    const my = (c.pts[0].y + c.pts[2].y) / 2;
                    return (
                      <g key={c.key}>
                        <path d={d} fill="#14305a" fillOpacity="0.95" stroke="#7CC0FF" strokeOpacity="0.9" strokeWidth="0.9"
                          style={{ cursor: "pointer" }} onClick={() => setRemoved((prev) => new Set(prev).add(c.key))} />
                        <line x1={c.pts[0].x} y1={my} x2={c.pts[1].x} y2={my} stroke="#0a1c38" strokeWidth="0.6" strokeOpacity="0.6" />
                      </g>
                    );
                  })}
                  {roof.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={drag === i ? 10 : 7.5} fill="#F4B45C" stroke="#fff" strokeWidth="2"
                      style={{ cursor: "grab" }} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag(i); }} />
                  ))}
                  <g transform={`translate(${W - 42} 42)`} opacity="0.92">
                    <circle r="17" fill="#0D1F18" fillOpacity="0.55" />
                    <path d="M0 -12 L5 6 L0 2 L-5 6 Z" fill="#F4B45C" transform={`rotate(${-az})`} />
                    <text y="24" textAnchor="middle" fontSize="9" fill="#fff" fontFamily="Inter">N</text>
                  </g>
                  <text x="8" y={H - 8} fontSize="8.5" fill="#fff" opacity="0.7" fontFamily="Inter">
                    {GMAPS_KEY ? "Imagery © Google" : "Imagery © Esri, Maxar"}
                  </text>
                </svg>
              </>
            )}
          </div>
          <p className="pv-noprint" style={{ fontSize: 12, color: "var(--muted)", margin: "8px 2px 0" }}>{loc ? t("hint") : " "}</p>

          <div className="pv-panel" style={{ marginTop: 14 }}>
            <div className="pv-metrics">
              <div className="pv-metric"><b>{n}</b><span>{t("m_panels")} · {panel.watt} W</span></div>
              <div className="pv-metric good"><b>{kw.toFixed(2)} kW</b><span>{t("m_dc")}</span></div>
              <div className="pv-metric"><b>{NUM(arrayArea, 1)} m²</b><span>{t("m_area")}</span></div>
              <div className="pv-metric"><b>{NUM(prod)} kWh</b><span>{t("m_prod")}</span></div>
              <div className="pv-metric"><b>{NUM(specYield)}</b><span>{t("m_yield")} · kWh/kWp</span></div>
              <div className="pv-metric"><b>~{NUM(roofArea)} m²</b><span>{t("m_roof")}</span></div>
              <div className="pv-metric"><b>{invKw} kW</b><span>{t("m_inv")} · {DEMO_SYSTEM.inverter.type}</span></div>
              <div className="pv-metric"><b>{payback == null ? "—" : payback === 0 ? "0" : payback.toFixed(1)} {payback ? "yr" : ""}</b><span>{t("m_pay")}</span></div>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="pv-toast show">{toast}</div>}
      <style dangerouslySetInnerHTML={{ __html: `
        .sl-stage{position:relative;aspect-ratio:960/560;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#5b6a4c;box-shadow:var(--shadow)}
        .sl-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
        .sl-fallback{position:absolute;inset:0;background:repeating-linear-gradient(45deg,#63705a,#63705a 22px,#5c6a53 22px,#5c6a53 44px)}
        .sl-svg{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
        .sl-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
          color:var(--muted);background:var(--paper-2);text-align:center;padding:24px;font-size:13px}
        .sl-empty svg{color:var(--hair)}
        .sl-addr{display:flex;gap:8px}
        .sl-addr .pv-input{flex:1;min-width:0}
        @media print{ .sl-stage{box-shadow:none} }
      ` }} />
    </>
  );
}
