"use client";
// components/PeakShaving.jsx — battery peak-shaving, for one representative
// day: real hourly PV output (PVGIS seriescalc, via /api/pvgis-hourly) laid
// against a real published residential consumption shape
// (lib/residentialLoadProfile.js) — never an invented hourly curve on
// either side. lib/peakShaving.js does the real hour-by-hour battery
// bookkeeping; this just fetches, picks a season, and draws it.
import { useEffect, useMemo, useState } from "react";
import { hourlyLoadShape, RO_URBAN_LOAD_SHAPE_SOURCE } from "../lib/residentialLoadProfile.js";
import { simulatePeakShaving } from "../lib/peakShaving.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);
const fmt1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toString();

function PeakChart({ hours, battKwh }) {
  const W = 680, H = 220, PADL = 40, PADR = 40, PADT = 14, PADB = 22;
  const maxFlow = Math.max(1, ...hours.map((h) => Math.max(h.prodKwh, h.consKwh)));
  const X = (h) => PADL + (h / 24) * (W - PADL - PADR);
  const barW = (W - PADL - PADR) / 24 - 2;
  const zero = PADT + (H - PADT - PADB) / 2;
  const scaleUp = (H - PADT - PADB) / 2 / maxFlow;
  const maxSoc = Math.max(1, battKwh);
  const Ysoc = (v) => PADT + (H - PADT - PADB) * (1 - v / maxSoc);
  const socPath = hours.map((h, i) => `${i === 0 ? "M" : "L"}${X(h.h) + barW / 2},${Ysoc(h.socKwh)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img">
      <line x1={PADL} y1={zero} x2={W - PADR} y2={zero} stroke="var(--line)" strokeWidth="1" />
      {hours.map((h) => (
        <g key={h.h}>
          <rect x={X(h.h)} y={zero - h.prodKwh * scaleUp} width={barW} height={h.prodKwh * scaleUp} fill="#2E7D5B" fillOpacity="0.75" />
          <rect x={X(h.h)} y={zero} width={barW} height={h.consKwh * scaleUp} fill="#B4472F" fillOpacity="0.55" />
        </g>
      ))}
      <path d={socPath} fill="none" stroke="#C99A2E" strokeWidth="2" />
      {[0, 6, 12, 18, 23].map((h) => (
        <text key={h} x={X(h) + barW / 2} y={H - 4} fontSize="9" textAnchor="middle" fill="var(--muted)">{h}h</text>
      ))}
    </svg>
  );
}

export default function PeakShaving({ lang, lat, lon, kw, cons, battKwh, market, roofPitchDeg, roofAzimuthDeg }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pv, setPv] = useState(null); // { cold, warm, coldKwhPerKwpDay, warmKwhPerKwpDay }
  const nowMonth = new Date().getMonth();
  const [season, setSeason] = useState(nowMonth <= 2 || nowMonth >= 9 ? "cold" : "warm");
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [battOverride, setBattOverride] = useState(String(battKwh > 0 ? battKwh : 5));

  useEffect(() => {
    if (!open || pv || lat == null || lon == null) return;
    setLoading(true); setError(null);
    const params = new URLSearchParams({
      lat: String(lat), lon: String(lon),
      angle: String(roofPitchDeg ?? 35), aspect: String(roofAzimuthDeg ?? 0),
    });
    fetch(`/api/pvgis-hourly?${params}`).then((r) => r.json()).then((j) => {
      if (j.error) setError(j.error); else setPv(j);
    }).catch(() => setError("network")).finally(() => setLoading(false));
  }, [open, pv, lat, lon, roofPitchDeg, roofAzimuthDeg]);

  const loadShape = useMemo(() => hourlyLoadShape(season === "cold" ? 0 : 6, isWorkingDay), [season, isWorkingDay]);
  const dailyConsKwh = (Number(cons) || 0) / 365;
  const dailyProdKwh = pv ? (Number(kw) || 0) * (season === "cold" ? pv.coldKwhPerKwpDay : pv.warmKwhPerKwpDay) : 0;
  const prodShape = pv ? (season === "cold" ? pv.cold : pv.warm) : null;

  const sim = useMemo(() => {
    if (!prodShape) return null;
    return simulatePeakShaving({ prodShape, loadShape, dailyProdKwh, dailyConsKwh, battKwh: Number(battOverride) || 0 });
  }, [prodShape, loadShape, dailyProdKwh, dailyConsKwh, battOverride]);

  if (!open) {
    return (
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        {t3(lang, "Descărcare de vârf (baterie)", "Peak shaving (battery)", "Сглаживание пика (батарея)")}
      </button>
    );
  }

  return (
    <section className="card ps-card">
      <div className="ps-head">
        <h4>{t3(lang, "Descărcare de vârf, o zi reprezentativă", "Peak shaving, a representative day", "Сглаживание пика, типовой день")}</h4>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>✕</button>
      </div>
      <p className="ps-note">
        {t3(lang,
          "Producția orară e din PVGIS (aceleași date reale de iradiere, reduse la o zi tipică pe sezon). Consumul orar e profilul rezidențial oficial publicat de DEER (Transilvania Sud, decizia ANRE 122/2020), nu o curbă inventată.",
          "Hourly production is real PVGIS data (the same reanalysis irradiance, reduced to a typical day per season). Hourly consumption is DEER's own officially published residential profile (Transilvania Sud, ANRE decision 122/2020), not an invented curve.",
          "Часовая выработка, реальные данные PVGIS (те же данные облучённости, сведённые к типовому дню сезона). Часовое потребление, официальный жилой профиль DEER (Трансильвания Sud, решение ANRE 122/2020), не выдуманная кривая.")}
      </p>
      {market === "MD" && (
        <p className="ps-warn">
          {t3(lang,
            "Profilul de consum e românesc (niciun profil orar public nu a putut fi găsit pentru Moldova), folosit aici doar ca reper de formă, nu ca datele reale ale clientului din Moldova.",
            "The consumption shape is Romanian (no public hourly profile could be found for Moldova), used here only as a reference shape, not this Moldovan client's real data.",
            "Профиль потребления, румынский (публичный часовой профиль для Молдовы не найден), используется только как ориентир формы, не как реальные данные клиента из Молдовы.")}
        </p>
      )}

      {loading && <p className="ps-note">{t3(lang, "Se încarcă…", "Loading…", "Загрузка…")}</p>}
      {error && <p className="ps-warn">{t3(lang, "PVGIS indisponibil momentan.", "PVGIS unavailable right now.", "PVGIS сейчас недоступен.")}</p>}

      {pv && (
        <>
          <div className="ps-controls">
            <div className="field">
              <label>{t3(lang, "Sezon", "Season", "Сезон")}</label>
              <select className="input" value={season} onChange={(e) => setSeason(e.target.value)}>
                <option value="cold">{t3(lang, "Rece (oct-mar)", "Cold (Oct-Mar)", "Холодный (окт-мар)")}</option>
                <option value="warm">{t3(lang, "Cald (apr-sep)", "Warm (Apr-Sep)", "Тёплый (апр-сен)")}</option>
              </select>
            </div>
            <div className="field">
              <label>{t3(lang, "Zi", "Day", "День")}</label>
              <select className="input" value={isWorkingDay ? "1" : "0"} onChange={(e) => setIsWorkingDay(e.target.value === "1")}>
                <option value="1">{t3(lang, "Lucrătoare", "Working", "Рабочий")}</option>
                <option value="0">{t3(lang, "Weekend", "Weekend", "Выходной")}</option>
              </select>
            </div>
            <div className="field">
              <label>{t3(lang, "Baterie (kWh)", "Battery (kWh)", "Батарея (кВт·ч)")}</label>
              <input className="input" type="number" min="0" step="0.5" value={battOverride} onChange={(e) => setBattOverride(e.target.value)} />
            </div>
          </div>

          {sim && (
            <>
              <PeakChart hours={sim.hours} battKwh={Number(battOverride) || 1} />
              <div className="ps-legend">
                <span><i className="sw prod" /> {t3(lang, "Producție", "Production", "Выработка")}</span>
                <span><i className="sw cons" /> {t3(lang, "Consum", "Consumption", "Потребление")}</span>
                <span><i className="sw soc" /> {t3(lang, "Nivel baterie", "Battery level", "Заряд батареи")}</span>
              </div>
              <div className="ps-stats">
                <div className="ps-stat">
                  <b>{fmt1(sim.shiftedKwh)} kWh</b>
                  <span>{t3(lang, "mutate din surplus în seară", "shifted from surplus to evening", "перенесено с излишка на вечер")}</span>
                </div>
                <div className="ps-stat">
                  <b>{Math.round(sim.eveningCoverPct)}%</b>
                  <span>{t3(lang, "din consumul de seară (18-22h) acoperit din baterie", "of evening (18-22h) draw covered by the battery", "вечернего потребления (18-22ч) покрыто батареей")}</span>
                </div>
                <div className="ps-stat">
                  <b>{fmt1(sim.gridExportKwh)} kWh</b>
                  <span>{t3(lang, "exportat în rețea (ziua tipică)", "exported to the grid (typical day)", "экспортировано в сеть (типовой день)")}</span>
                </div>
              </div>
            </>
          )}
          <p className="ps-source">
            {t3(lang, "Sursă profil consum: ", "Consumption profile source: ", "Источник профиля потребления: ")}
            <a href={RO_URBAN_LOAD_SHAPE_SOURCE.url} target="_blank" rel="noopener noreferrer">{RO_URBAN_LOAD_SHAPE_SOURCE.org}, {RO_URBAN_LOAD_SHAPE_SOURCE.legal}</a>
          </p>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .ps-card{margin-top:16px}
        .ps-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
        .ps-head h4{margin:0;font-size:14px}
        .ps-note{font-size:12px;color:var(--muted);line-height:1.55;margin:0 0 10px}
        .ps-warn{font-size:12px;color:#B4472F;line-height:1.5;margin:0 0 10px}
        .ps-controls{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px}
        .ps-controls .field{margin:0}
        .ps-legend{display:flex;gap:16px;margin-top:8px;font-size:11.5px;color:var(--muted)}
        .ps-legend .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
        .ps-legend .prod{background:#2E7D5B}
        .ps-legend .cons{background:#B4472F}
        .ps-legend .soc{background:#C99A2E;border-radius:0;height:2px;width:12px;vertical-align:3px}
        .ps-stats{display:flex;gap:20px;flex-wrap:wrap;padding-top:12px;margin-top:10px;border-top:1px solid var(--line)}
        .ps-stat{display:flex;flex-direction:column;gap:2px}
        .ps-stat b{font-size:17px;font-variant-numeric:tabular-nums;color:var(--ink)}
        .ps-stat span{font-size:11px;color:var(--muted);max-width:22ch}
        .ps-source{font-size:10.5px;color:var(--muted);margin:14px 0 0}
        .ps-source a{color:var(--green)}
      ` }} />
    </section>
  );
}
