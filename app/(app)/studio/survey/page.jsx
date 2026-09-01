"use client";
// Studio · Site survey (before the quote).
// Real roof pitch / azimuth / shading → an adjusted PVGIS yield (vs the flat
// 35°/south the app assumes today), a 1~/3~ + string-voltage buildability check,
// and the site photos on the job. Mock; the yield → payback maths is the engine.
import { useEffect, useMemo, useState } from "react";
import {
  useLang, tx, PreviewHeader, MockNote, NUM,
  useStudioClient, ClientBar, engineSettings, DEMO_SYSTEM,
} from "../studio-kit.jsx";
import { simulate } from "../_engine.js";

const TX = {
  title: { en: "Site survey", ro: "Vizită tehnică", ru: "Техобследование" },
  sub: {
    en: "The roof as it actually is — pitch, orientation, shading — turned into a yield for this house, plus a check that the design can be built and connected.",
    ro: "Acoperișul așa cum e de fapt — înclinare, orientare, umbrire — transformat într-un randament pentru această casă, plus o verificare că proiectul se poate construi și racorda.",
    ru: "Крыша как есть — уклон, ориентация, затенение — превращается в выработку для этого дома, плюс проверка, что схему можно построить и подключить.",
  },
  note: {
    en: "Today the app queries PVGIS at a fixed 35° facing south. This surface applies the real roof and hands the adjusted yield to the quote — the difference below is what's otherwise hidden in a payback number you're calling honest.",
    ro: "Azi aplicația interoghează PVGIS la 35° fix spre sud. Această suprafață aplică acoperișul real și dă randamentul ajustat ofertei — diferența de mai jos e ceea ce altfel se ascunde într-o amortizare pe care o numești onestă.",
    ru: "Сейчас приложение запрашивает PVGIS при фиксированных 35° на юг. Здесь применяется реальная крыша, и скорректированная выработка идёт в расчёт — разница ниже и есть то, что иначе спрятано в «честной» окупаемости.",
  },
  roof: { en: "Roof", ro: "Acoperiș", ru: "Крыша" },
  pitch: { en: "Pitch", ro: "Înclinare", ru: "Уклон" },
  azimuth: { en: "Orientation", ro: "Orientare", ru: "Ориентация" },
  shading: { en: "Shading", ro: "Umbrire", ru: "Затенение" },
  sh_none: { en: "None", ro: "Fără", ru: "Нет" },
  sh_light: { en: "Light", ro: "Ușoară", ru: "Лёгкое" },
  sh_mod: { en: "Moderate", ro: "Moderată", ru: "Умеренное" },
  sh_heavy: { en: "Heavy", ro: "Puternică", ru: "Сильное" },
  std: { en: "PVGIS standard (35° / S)", ro: "PVGIS standard (35° / S)", ru: "PVGIS стандарт (35° / Ю)" },
  thisRoof: { en: "This roof", ro: "Acoperișul acesta", ru: "Эта крыша" },
  delta: { en: "vs the number the quote uses today", ro: "față de numărul folosit azi în ofertă", ru: "против числа, что расчёт берёт сейчас" },
  pbShift: { en: "payback moves", ro: "amortizarea se mută", ru: "окупаемость сдвигается" },
  elec: { en: "Buildability check", ro: "Verificare de fezabilitate", ru: "Проверка реализуемости" },
  conn: { en: "Connection", ro: "Racordare", ru: "Подключение" },
  ph1: { en: "1~ single-phase", ro: "1~ monofazat", ru: "1~ однофазное" },
  ph3: { en: "3~ three-phase", ro: "3~ trifazat", ru: "3~ трёхфазное" },
  strings: { en: "String layout", ro: "Configurație șiruri", ru: "Схема цепочек" },
  vstr: { en: "String Voc at −10 °C", ro: "Voc șir la −10 °C", ru: "Voc цепочки при −10 °C" },
  invmax: { en: "Inverter max DC", ro: "Max DC invertor", ru: "Макс. DC инвертора" },
  ok: { en: "OK — buildable", ro: "OK — se poate construi", ru: "OK — реализуемо" },
  warnV: { en: "String voltage exceeds the inverter — fewer panels per string", ro: "Tensiunea șirului depășește invertorul — mai puține panouri pe șir", ru: "Напряжение цепочки выше инвертора — меньше панелей в цепочке" },
  warnPh: { en: "Single-phase inverter above ~5 kW — move to three-phase or cap the size", ro: "Invertor monofazat peste ~5 kW — treci pe trifazat sau limitează puterea", ru: "Однофазный инвертор выше ~5 кВт — на трёхфазный или ограничьте мощность" },
  photos: { en: "Site photos", ro: "Poze de la fața locului", ru: "Фото объекта" },
  ph_roof: { en: "Roof", ro: "Acoperiș", ru: "Крыша" },
  ph_board: { en: "Electrical panel", ro: "Tablou electric", ru: "Электрощит" },
  ph_meter: { en: "Meter", ro: "Contor", ru: "Счётчик" },
  ph_access: { en: "Access / façade", ro: "Acces / fațadă", ru: "Доступ / фасад" },
  add: { en: "add", ro: "adaugă", ru: "добавить" },
  added: { en: "added", ro: "adăugat", ru: "добавлено" },
  feeds: {
    en: "The adjusted yield, the string layout and the photos ride with this client into the quote and the connection file.",
    ro: "Randamentul ajustat, configurația șirurilor și pozele merg cu acest client în ofertă și în dosarul de racordare.",
    ru: "Скорректированная выработка, схема цепочек и фото идут с этим клиентом в расчёт и в пакет на подключение.",
  },
};

const TILT_PTS = [[0, 0.86], [10, 0.93], [20, 0.985], [33, 1.0], [45, 0.985], [60, 0.92], [75, 0.83], [90, 0.72]];
const AZ_PTS = [[0, 1.0], [30, 0.98], [45, 0.95], [90, 0.83], [135, 0.68], [180, 0.58]];
const SHADE = { none: 1.0, light: 0.95, mod: 0.88, heavy: 0.75 };
function lerpPts(pts, x) {
  x = Math.abs(x);
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return pts[pts.length - 1][1];
}
const DIRS = [[0, "S"], [45, "SV"], [90, "V"], [135, "NV"], [180, "N"], [-45, "SE"], [-90, "E"], [-135, "NE"]];
function dirLabel(az) {
  let best = DIRS[0], bd = 999;
  for (const d of DIRS) { const dd = Math.abs(((az - d[0] + 540) % 360) - 180); if (dd < bd) { bd = dd; best = d; } }
  return best[1];
}

export default function SurveyPreview() {
  const lang = useLang();
  const T = (o) => tx(o, lang);
  const { client } = useStudioClient();
  useEffect(() => { document.title = "Site survey — VoltMira Studio"; }, []);

  const [pitch, setPitch] = useState(18);
  const [az, setAz] = useState(-70);
  const [shade, setShade] = useState("light");
  const [photos, setPhotos] = useState({ roof: true, board: true, meter: false, access: false });

  const baseOptimal = client.market === "RO" ? 1210 : 1255;   // optimal-plane kWh/kWp/yr
  const roofFactor = lerpPts(TILT_PTS, pitch) * lerpPts(AZ_PTS, az) * SHADE[shade];
  const roofYield = Math.round(baseOptimal * roofFactor);
  const deltaPct = (roofYield / baseOptimal - 1) * 100;

  const eng = useMemo(() => {
    const E = engineSettings();
    const base = {
      market: client.market, kw: +client.kw || 0, price: +client.price || 0.185,
      cons: +client.cons || 0, batt: (+client.batteryKwh || 0) > 0, battKwh: +client.batteryKwh || 0,
    };
    const std = simulate({ ...base, yieldOverride: baseOptimal }, E, "expc");
    const real = simulate({ ...base, yieldOverride: roofYield }, E, "expc");
    return { stdPb: std.payback, realPb: real.payback };
  }, [client, roofYield, baseOptimal]);

  const panel = DEMO_SYSTEM.panel;
  const kw = +client.kw || 0;
  const modules = Math.max(1, Math.ceil((kw * 1000) / panel.watt));
  const dcKw = (modules * panel.watt) / 1000;
  const strings = dcKw > 5.2 ? Math.max(2, Math.ceil(dcKw / 5.5)) : 1;
  const perString = Math.ceil(modules / strings);
  const vCold = perString * panel.voc * 1.11;
  const invMaxV = client.phases === 3 ? 800 : 500;
  const vWarn = vCold > invMaxV;
  const phWarn = client.phases === 1 && kw > 5.2;

  const pbTxt = (v) => (v == null ? "25+" : v.toFixed(1));

  const PHOTO = [
    ["roof", TX.ph_roof], ["board", TX.ph_board], ["meter", TX.ph_meter], ["access", TX.ph_access],
  ];

  return (
    <>
      <PreviewHeader slug="survey" lang={lang} title={T(TX.title)} sub={T(TX.sub)} />
      <MockNote>{T(TX.note)}</MockNote>

      <ClientBar lang={lang} />

      {/* roof */}
      <div className="pv-panel">
        <h3>{T(TX.roof)}</h3>
        <div className="sv-grid">
          <label>{T(TX.pitch)} <output>{pitch}°</output>
            <input type="range" min="0" max="90" value={pitch} onChange={(e) => setPitch(+e.target.value)} /></label>
          <label>{T(TX.azimuth)} <output>{az}° · {dirLabel(az)}</output>
            <input type="range" min="-180" max="180" step="5" value={az} onChange={(e) => setAz(+e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>{T(TX.shading)}
            <div className="pv-seg" style={{ marginTop: 6 }}>
              {["none", "light", "mod", "heavy"].map((s) => (
                <button key={s} className={shade === s ? "on" : ""} onClick={() => setShade(s)}>
                  {tx(TX["sh_" + (s === "mod" ? "mod" : s)], lang)}
                </button>
              ))}
            </div>
          </label>
        </div>

        <div className="pv-metrics" style={{ marginTop: 16 }}>
          <div className="pv-metric"><b>{NUM(baseOptimal)}</b><span>{T(TX.std)} · kWh/kWp</span></div>
          <div className={"pv-metric " + (deltaPct < -3 ? "warn" : "good")}><b>{NUM(roofYield)}</b><span>{T(TX.thisRoof)} · kWh/kWp</span></div>
          <div className={"pv-metric " + (deltaPct < -3 ? "warn" : "")}><b>{deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(0)}%</b><span>{T(TX.delta)}</span></div>
          <div className="pv-metric"><b>{pbTxt(eng.stdPb)} → {pbTxt(eng.realPb)}</b><span>{T(TX.pbShift)} ({tx({ ro: "ani", en: "yrs", ru: "лет" }, lang)})</span></div>
        </div>
      </div>

      {/* buildability */}
      <div className="pv-panel">
        <h3>{T(TX.elec)}</h3>
        <div className="sv-list">
          <div className="sv-row"><span>{T(TX.conn)}</span><b>{client.phases === 3 ? T(TX.ph3) : T(TX.ph1)}</b></div>
          <div className="sv-row"><span>{T(TX.strings)}</span><b>{strings} × {perString} {tx({ ro: "module", en: "modules", ru: "модулей" }, lang)} · {dcKw.toFixed(2)} kWp</b></div>
          <div className="sv-row"><span>{T(TX.vstr)}</span><b className={vWarn ? "sv-bad" : ""}>{vCold.toFixed(0)} V</b></div>
          <div className="sv-row"><span>{T(TX.invmax)}</span><b>{invMaxV} V</b></div>
        </div>
        {vWarn && <div className="sv-flag bad">{T(TX.warnV)}</div>}
        {phWarn && <div className="sv-flag bad">{T(TX.warnPh)}</div>}
        {!vWarn && !phWarn && <div className="sv-flag ok">{T(TX.ok)}</div>}
      </div>

      {/* photos */}
      <div className="pv-panel">
        <h3>{T(TX.photos)} · {PHOTO.filter(([k]) => photos[k]).length}/4</h3>
        <div className="sv-photos">
          {PHOTO.map(([k, label]) => (
            <button key={k} className={"sv-photo" + (photos[k] ? " on" : "")}
              onClick={() => setPhotos((p) => ({ ...p, [k]: !p[k] }))}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.2" /><path d="M8 6l1.5-2h5L16 6" />
              </svg>
              <span>{tx(label, lang)}</span>
              <em>{photos[k] ? T(TX.added) : "+ " + T(TX.add)}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="pv-callout">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <p>{T(TX.feeds)}</p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sv-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px}
        @media(max-width:560px){.sv-grid{grid-template-columns:1fr}}
        .sv-grid label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:var(--muted)}
        .sv-grid output{color:var(--green);font-weight:700}
        .sv-list{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
        .sv-row{display:flex;justify-content:space-between;gap:12px;align-items:baseline;background:var(--paper-2);padding:11px 13px;font-size:13px;color:var(--muted)}
        .sv-row b{color:var(--ink);font-weight:700}
        .sv-bad{color:#B4472F}
        .sv-flag{margin-top:12px;border-radius:9px;padding:10px 13px;font-size:12.5px;font-weight:600;line-height:1.5}
        .sv-flag.ok{background:var(--green-tint);color:var(--green)}
        .sv-flag.bad{background:var(--amber-tint);color:#B4472F}
        .sv-photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
        .sv-photo{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;border-radius:12px;
          border:1px dashed var(--line);background:var(--paper);color:var(--muted);cursor:pointer;font-family:inherit;transition:.14s}
        .sv-photo:hover{border-color:var(--green);color:var(--ink)}
        .sv-photo.on{border-style:solid;border-color:var(--green);background:var(--green-tint);color:var(--ink)}
        .sv-photo span{font-size:12px;font-weight:600}
        .sv-photo em{font-size:10.5px;font-style:normal;color:var(--muted)}
        .sv-photo.on em{color:var(--green)}
      ` }} />
    </>
  );
}
