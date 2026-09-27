"use client";
// SiteRoofStep.jsx — where the system goes: the address (with its map), the
// roof's pitch, orientation and shading, and the site photos. Writes to the
// job with a short debounce, and only after a real touch, so opening this
// step never marks a job "surveyed" from its untouched defaults.
import { useEffect, useRef, useState } from "react";
import { Home, Zap, Gauge, DoorOpen, MapPin, Ruler, Camera } from "lucide-react";
import { tx } from "../../../studio-kit.jsx";
import AddressField from "../../../address-field.jsx";
import { computeRoofFactor, dirLabel } from "../../../roof.js";
import { PhotoSlot } from "./PhotoCapture.jsx";
import SegmentedControl from "./SegmentedControl.jsx";

const SHADE_OPTIONS = (t) => [
  { value: "none", label: t({ en: "None", ro: "Fără", ru: "Нет" }) },
  { value: "light", label: t({ en: "Light", ro: "Ușoară", ru: "Лёгкое" }) },
  { value: "mod", label: t({ en: "Moderate", ro: "Moderată", ru: "Умеренное" }) },
  { value: "heavy", label: t({ en: "Heavy", ro: "Puternică", ru: "Сильное" }) },
];

// A slider with an editable number beside it, both bound to the same value:
// a surveyor often knows the exact pitch or azimuth from a tool and shouldn't
// have to drag a track to it.
function NumberSlider({ id, label, value, min, max, step = 1, suffix, extra, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  const clamp = (n) => Math.min(max, Math.max(min, n));
  return (
    <div>
      <div className="ws-slider-top">
        <label htmlFor={id}>{label}</label>
        <span className="ws-slider-val">
          {extra && <span>{extra}</span>}
          <input type="number" inputMode="numeric" min={min} max={max} step={step} value={value} className="ws-num"
            aria-label={label}
            onChange={(e) => { const n = +e.target.value; if (!Number.isNaN(n)) onChange(clamp(n)); }} />
          {suffix}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} style={{ "--fill": pct + "%" }} className="ws-range" />
    </div>
  );
}

export default function SiteRoofStep({ job, patch, lang }) {
  const t = (o) => tx(o, lang);
  const [pitch, setPitch] = useState(job.roofPitch ?? 18);
  const [az, setAz] = useState(job.roofAz ?? -70);
  const [shade, setShade] = useState(job.roofShade ?? "light");
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) return;
    const id = setTimeout(() => {
      patch({ roofPitch: pitch, roofAz: az, roofShade: shade, roofFactor: computeRoofFactor(pitch, az, shade) });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch, az, shade]);

  const live = computeRoofFactor(pitch, az, shade);
  // Defaults aren't a measurement: say what this roof yields only once it's measured.
  const measured = job.roofFactor != null || touched.current;
  return (
    <>
      <div className="ws-sec">
        <div className="ws-sec-h"><MapPin size={16} aria-hidden="true" />{t({ en: "Address", ro: "Adresă", ru: "Адрес" })}</div>
        <AddressField lang={lang} client={job} onPick={patch} />
      </div>

      <div className="ws-sec">
        <div className="ws-sec-h"><Ruler size={16} aria-hidden="true" />{t({ en: "The roof", ro: "Acoperișul", ru: "Крыша" })}</div>
        <div className="ws-box">
          <NumberSlider id="ws-pitch" label={t({ en: "Roof pitch", ro: "Înclinare acoperiș", ru: "Уклон крыши" })}
            value={pitch} min={0} max={90} suffix="°"
            onChange={(v) => { touched.current = true; setPitch(v); }} />
          <NumberSlider id="ws-az" label={t({ en: "Orientation", ro: "Orientare", ru: "Ориентация" })}
            value={az} min={-180} max={180} step={5} suffix="°" extra={dirLabel(az)}
            onChange={(v) => { touched.current = true; setAz(v); }} />
          <div>
            <span className="ws-label">{t({ en: "Shading", ro: "Umbrire", ru: "Затенение" })}</span>
            <SegmentedControl full options={SHADE_OPTIONS(t)} value={shade} label={t({ en: "Shading", ro: "Umbrire", ru: "Затенение" })}
              onChange={(v) => { touched.current = true; setShade(v); }} />
          </div>
          {measured ? (
            <div className="ws-callout">
              <span>{t({ en: "This roof yields", ro: "Acest acoperiș produce", ru: "Эта крыша даёт" })}</span>
              <b>{Math.round(live * 100)}%<small>{t({ en: "of an ideal south-facing roof", ro: "dintr-un acoperiș ideal spre sud", ru: "от идеальной южной крыши" })}</small></b>
            </div>
          ) : (
            <p className="ws-sec-note">{t({ en: "Set the pitch, orientation and shading you measured on site to work out this roof's yield.", ro: "Setează înclinarea, orientarea și umbrirea măsurate pe teren ca să afli producția acestui acoperiș.", ru: "Укажите уклон, ориентацию и затенение, измеренные на объекте, чтобы рассчитать выработку крыши." })}</p>
          )}
        </div>
      </div>

      <div className="ws-sec">
        <div className="ws-sec-h"><Camera size={16} aria-hidden="true" />{t({ en: "Site photos", ro: "Poze de la fața locului", ru: "Фото объекта" })}</div>
        <p className="ws-sec-note">{t({ en: "Tap a tile to take or pick a photo, or drop one on it.", ro: "Atinge o casetă ca să faci sau să alegi o poză, ori trage una peste ea.", ru: "Нажмите на плитку, чтобы сделать или выбрать фото, или перетащите его." })}</p>
        <div className="ws-photos">
          <PhotoSlot jobId={job.id} group="site-roof" icon={Home} label={t({ en: "Roof", ro: "Acoperiș", ru: "Крыша" })} />
          <PhotoSlot jobId={job.id} group="site-board" icon={Zap} label={t({ en: "Electrical panel", ro: "Tablou electric", ru: "Электрощит" })} />
          <PhotoSlot jobId={job.id} group="site-meter" icon={Gauge} label={t({ en: "Meter", ro: "Contor", ru: "Счётчик" })} />
          <PhotoSlot jobId={job.id} group="site-access" icon={DoorOpen} label={t({ en: "Access and façade", ro: "Acces și fațadă", ru: "Доступ и фасад" })} />
        </div>
      </div>
    </>
  );
}
