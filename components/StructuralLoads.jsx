"use client";
// components/StructuralLoads.jsx — a real Eurocode EN 1991-1-3/1-4 sanity
// check for the mounting structure, computed live (lib/ncmLoads.js), not a
// persisted project field: type in this site's real sk/vb,0 (from the NCM
// National Annex's own zonal maps, or a site survey) and see the resulting
// snow/wind load to hand to a structural engineer for sign-off — not a
// stamped calculation itself, same status as the DC/AC headroom check next
// to it.
import { useMemo, useState } from "react";
import { snowLoad, windLoad, windPeakPressure, TERRAIN_CATEGORIES, FLAT_ROOF_CPE_ZONES, MD_WIND_ZONES_MPS, MD_SNOW_EXAMPLE } from "../lib/ncmLoads.js";

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

// Real EN 1991-1-4 Table 7.2 zone values (flat roof, sharp eaves) as the
// primary options — F/G are the array positions worth checking first (worst
// case), H/I the milder central-field case. "custom" is last, for a pitched
// roof's own Table 7.4a/7.4b value (not implemented here — see
// lib/ncmLoads.js's own comment) or a manufacturer-tested figure.
const CPE_PRESETS = [
  ...Object.entries(FLAT_ROOF_CPE_ZONES).map(([id, z]) => ({ id, cpe: z.cpe, label: z.label })),
  { id: "custom", cpe: null, label: { ro: "Personalizat", en: "Custom", ru: "Свой вариант" } },
];

export default function StructuralLoads({ lang, roofPitchDeg }) {
  const [open, setOpen] = useState(false);
  const [sk, setSk] = useState("");
  const [vb0, setVb0] = useState("");
  const [terrain, setTerrain] = useState("II");
  const [height, setHeight] = useState("8");
  const [pitchOverride, setPitchOverride] = useState("");
  const [cpePreset, setCpePreset] = useState("G");
  const [cpeCustom, setCpeCustom] = useState("-1.0");

  const pitch = pitchOverride !== "" ? Number(pitchOverride) : (roofPitchDeg ?? 35);
  const cpe = cpePreset === "custom" ? Number(cpeCustom) : CPE_PRESETS.find((p) => p.id === cpePreset).cpe;

  const snow = useMemo(() => snowLoad({ sk: Number(sk), pitchDeg: pitch }), [sk, pitch]);
  const qp = useMemo(() => windPeakPressure({ vb0: Number(vb0), height: Number(height), terrainCategory: terrain }), [vb0, height, terrain]);
  const wind = useMemo(() => windLoad({ vb0: Number(vb0), height: Number(height), terrainCategory: terrain, cpe }), [vb0, height, terrain, cpe]);

  if (!open) {
    return (
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        {t3(lang, "Sarcini structurale (NCM)", "Structural loads (NCM)", "Нагрузки (НКМ)")}
      </button>
    );
  }

  return (
    <section className="card sl-card">
      <div className="sl-head">
        <h4>{t3(lang, "Sarcini structurale, NCM EN 1991-1-3 / 1-4", "Structural loads, NCM EN 1991-1-3 / 1-4", "Нагрузки, NCM EN 1991-1-3 / 1-4")}</h4>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>✕</button>
      </div>
      <p className="sl-note">
        {t3(lang,
          "Formulele Eurocode sunt exacte. vb,0: alege una din cele 5 viteze oficiale ale Anexei Naționale (nu se cunoaște aici care raion e în care zonă, confirmă pe harta reală sau printr-un studiu de teren). sₖ: niciun tabel pe zone nu a putut fi extras, doar un exemplu documentat, e un reper, nu valoarea site-ului tău. Rezultatul e un reper pentru inginerul de structură, nu un calcul ștampilat.",
          "The Eurocode formulas are exact. vb,0: pick one of the National Annex's 5 official speeds (which raion falls in which zone isn't known here, confirm on the real map or via a site survey). sₖ: no per-zone table could be extracted, only one documented example, a reference point, not your site's real value. The result is a reference figure for your structural engineer, not a stamped calculation.",
          "Формулы Eurocode точны. vb,0: выберите одну из 5 официальных скоростей Национального приложения (какой район в какой зоне, здесь неизвестно, уточните по реальной карте). sₖ: таблицу по зонам извлечь не удалось, есть только один документированный пример, ориентир, а не значение вашего участка. Результат, ориентир для инженера-конструктора, а не заверенный расчёт.")}
      </p>

      <div className="sl-grid">
        <div className="field">
          <label>{t3(lang, "sₖ: încărcare zăpadă pe sol (kN/m²)", "sₖ: characteristic ground snow load (kN/m²)", "sₖ: снеговая нагрузка на грунт (кН/м²)")}</label>
          <input className="input" type="number" min="0" step="0.1" value={sk} onChange={(e) => setSk(e.target.value)} placeholder="—" />
          <button type="button" className="sl-fill-btn" onClick={() => setSk(String(MD_SNOW_EXAMPLE.skKNm2))}>
            {t3(lang, `Completează exemplul documentat (${MD_SNOW_EXAMPLE.skKNm2})`, `Fill the documented example (${MD_SNOW_EXAMPLE.skKNm2})`, `Заполнить документированный пример (${MD_SNOW_EXAMPLE.skKNm2})`)}
          </button>
        </div>
        <div className="field">
          <label>{t3(lang, "Înclinare acoperiș (°)", "Roof pitch (°)", "Уклон крыши (°)")}</label>
          <input className="input" type="number" min="0" max="90" step="1" value={pitchOverride}
            onChange={(e) => setPitchOverride(e.target.value)}
            placeholder={roofPitchDeg != null ? `${t3(lang, "din Proiectare amplasament: ", "from Site Designer: ", "из Проектирования: ")}${Math.round(roofPitchDeg)}°` : "35°"} />
        </div>
        <div className="field">
          <label>{t3(lang, "vb,0: viteza de bază a vântului (m/s)", "vb,0: fundamental basic wind velocity (m/s)", "vb,0: базовая скорость ветра (м/с)")}</label>
          <select className="input" value={vb0} onChange={(e) => setVb0(e.target.value)}>
            <option value="">{t3(lang, "Alege zona reală", "Pick the real zone", "Выберите реальную зону")}</option>
            {MD_WIND_ZONES_MPS.map((v) => <option key={v} value={v}>{v} m/s</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t3(lang, "Categorie de teren", "Terrain category", "Категория местности")}</label>
          <select className="input" value={terrain} onChange={(e) => setTerrain(e.target.value)}>
            {Object.keys(TERRAIN_CATEGORIES).map((k) => (
              <option key={k} value={k}>{TERRAIN_CATEGORIES[k].label[lang] || TERRAIN_CATEGORIES[k].label.ro}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t3(lang, "Înălțime clădire (m)", "Building height (m)", "Высота здания (м)")}</label>
          <input className="input" type="number" min="0" step="0.5" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
        <div className="field">
          <label>{t3(lang, "cₚₑ: coeficient de presiune", "cₚₑ: pressure coefficient", "cₚₑ: коэффициент давления")}</label>
          <select className="input" value={cpePreset} onChange={(e) => setCpePreset(e.target.value)}>
            {CPE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label[lang] || p.label.ro}</option>)}
          </select>
          {cpePreset === "custom" && (
            <input className="input" style={{ marginTop: 6 }} type="number" step="0.1" value={cpeCustom}
              onChange={(e) => setCpeCustom(e.target.value)} />
          )}
          <p className="sl-cpe-hint">
            {t3(lang,
              "Valorile F–I sunt tabelul real EN 1991-1-4 pentru acoperiș plat, margine ascuțită. Pentru un acoperiș înclinat, tabelul propriu (7.4a/7.4b) diferă, folosește F/G ca aproximare conservatoare sau introdu o valoare proprie la Personalizat.",
              "F–I are the real EN 1991-1-4 flat-roof (sharp eaves) table. A pitched roof has its own table (7.4a/7.4b), which differs, use F/G as a conservative stand-in, or enter your own figure under Custom.",
              "F–I: реальная таблица EN 1991-1-4 для плоской крыши. Скатная крыша имеет свою таблицу (7.4a/7.4b), используйте F/G как консервативную оценку или введите своё значение.")}
          </p>
        </div>
      </div>

      <div className="sl-results">
        <div className="sl-stat">
          <b>{snow != null ? `${snow.toFixed(2)} kN/m²` : "—"}</b>
          <span>{t3(lang, "Sarcină zăpadă (s)", "Snow load (s)", "Снеговая нагрузка (s)")}</span>
        </div>
        <div className="sl-stat">
          <b>{qp != null ? `${qp.toFixed(2)} kN/m²` : "—"}</b>
          <span>{t3(lang, "Presiune vânt de vârf, qp(z)", "Peak wind pressure, qp(z)", "Пиковое давление ветра, qp(z)")}</span>
        </div>
        <div className="sl-stat">
          <b>{wind != null ? `${wind.toFixed(2)} kN/m²` : "—"}</b>
          <span>{t3(lang, "Acțiune netă vânt pe structură", "Net wind action on structure", "Чистое ветровое воздействие")}</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sl-card{margin-top:16px}
        .sl-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
        .sl-head h4{margin:0;font-size:14px}
        .sl-note{font-size:12px;color:var(--muted);line-height:1.55;margin:0 0 14px}
        .sl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-bottom:16px}
        .sl-cpe-hint{font-size:11px;color:var(--muted);line-height:1.45;margin:6px 0 0}
        .sl-fill-btn{display:block;margin-top:5px;font-family:inherit;font-size:11px;font-weight:600;
          color:var(--green);background:none;border:none;padding:0;cursor:pointer;text-decoration:underline;text-align:left}
        .sl-results{display:flex;gap:20px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--line)}
        .sl-stat{display:flex;flex-direction:column;gap:2px}
        .sl-stat b{font-size:18px;font-variant-numeric:tabular-nums;color:var(--ink)}
        .sl-stat span{font-size:11.5px;color:var(--muted)}
      ` }} />
    </section>
  );
}
