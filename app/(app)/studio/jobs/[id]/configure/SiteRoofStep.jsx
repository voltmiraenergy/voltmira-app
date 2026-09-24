"use client";
// SiteRoofStep.jsx — Site & Roof, extracted out of WizardSteps.jsx into its
// own file (matching the other 6 steps) and given the full premium visual
// pass: a proper map card, real custom sliders with the value in a badge
// next to the label, a segmented control for shading, and a photo grid with
// a distinct icon per category instead of one generic camera glyph for all
// four. The underlying behaviour is unchanged: a debounced write to the job
// only after a real touch (so opening this step never silently marks a job
// "surveyed" from its untouched defaults).
import { useEffect, useRef, useState } from "react";
import { Home, Zap, Gauge, DoorOpen, MapPin } from "lucide-react";
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

// Site & Roof's own slider row — same .ws-range track as the shared
// Slider.jsx, but with a real editable number box in place of the read-only
// value badge (two-way bound to the same state the track drives), since a
// surveyor on site often knows the exact pitch/azimuth from a tool and
// shouldn't have to drag a track to it. Kept local rather than changing the
// shared Slider (Financials' term/rate sliders don't want this).
function NumberSlider({ label, value, min, max, step = 1, suffix, extra, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-700 dark:text-[#D4D4D4]">{label}</label>
        <div className="flex items-center gap-1.5">
          {extra && <span className="text-xs font-medium text-slate-400 dark:text-[#8A8A8A]">{extra}</span>}
          <input type="number" inputMode="numeric" min={min} max={max} step={step} value={value}
            onChange={(e) => {
              const n = +e.target.value;
              if (Number.isNaN(n)) return;
              onChange(Math.min(max, Math.max(min, n)));
            }}
            className="w-16 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-right text-xs font-bold tabular-nums text-brand-700 focus:border-brand-500 focus:outline-none dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-brand-300" />
          {suffix && <span className="text-xs font-semibold text-slate-400 dark:text-[#8A8A8A]">{suffix}</span>}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ "--fill": pct + "%" }}
        className="ws-range w-full" />
    </div>
  );
}

export default function SiteRoofStep({ job, patch, lang }) {
  const t = (o) => tx(o, lang);
  const [pitch, setPitch] = useState(job.roofPitch ?? 18);
  const [az, setAz] = useState(job.roofAz ?? -70);
  const [shade, setShade] = useState(job.roofShade ?? "light");
  // Same guard as the standalone Survey tool used to have: opening this step
  // shouldn't silently mark the job "surveyed" just because it has defaults.
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) return;
    const id = setTimeout(() => {
      patch({ roofPitch: pitch, roofAz: az, roofShade: shade, roofFactor: computeRoofFactor(pitch, az, shade) });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch, az, shade]);

  return (
    <div className="space-y-7">
      {/* Address + map card */}
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-[#D4D4D4]">
          <MapPin className="h-3.5 w-3.5 text-slate-400" /> {t({ en: "Address", ro: "Adresă", ru: "Адрес" })}
        </label>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2C2C2C] dark:bg-[#242424]/60">
          <AddressField lang={lang} client={job} onPick={patch} />
        </div>
      </div>

      {/* Roof geometry */}
      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
        <NumberSlider label={t({ en: "Roof pitch", ro: "Înclinare acoperiș", ru: "Уклон крыши" })}
          value={pitch} min={0} max={90} suffix="°"
          onChange={(v) => { touched.current = true; setPitch(v); }} />

        <NumberSlider label={t({ en: "Orientation", ro: "Orientare", ru: "Ориентация" })}
          value={az} min={-180} max={180} step={5} suffix="°" extra={dirLabel(az)}
          onChange={(v) => { touched.current = true; setAz(v); }} />

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-[#D4D4D4]">
            {t({ en: "Shading", ro: "Umbrire", ru: "Затенение" })}
          </label>
          <SegmentedControl columns={4} options={SHADE_OPTIONS(t)} value={shade}
            onChange={(v) => { touched.current = true; setShade(v); }} />
        </div>

        {job.roofFactor != null && (
          <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2.5 text-xs dark:bg-brand-500/10">
            <span className="text-brand-700 dark:text-brand-300">
              {t({ en: "Roof yield factor", ro: "Factor de randament acoperiș", ru: "Коэффициент выработки крыши" })}
            </span>
            <span className="font-bold text-brand-800 dark:text-brand-200">{(job.roofFactor * 100).toFixed(0)}% {t({ en: "of optimal", ro: "din optim", ru: "от идеала" })}</span>
          </div>
        )}
      </div>

      {/* Site photos */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-[#D4D4D4]">
          {t({ en: "Site photos", ro: "Poze de la fața locului", ru: "Фото объекта" })}
        </label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <PhotoSlot jobId={job.id} group="site-roof" icon={Home} label={t({ en: "Roof", ro: "Acoperiș", ru: "Крыша" })} />
          <PhotoSlot jobId={job.id} group="site-board" icon={Zap} label={t({ en: "Electrical panel", ro: "Tablou electric", ru: "Электрощит" })} />
          <PhotoSlot jobId={job.id} group="site-meter" icon={Gauge} label={t({ en: "Meter", ro: "Contor", ru: "Счётчик" })} />
          <PhotoSlot jobId={job.id} group="site-access" icon={DoorOpen} label={t({ en: "Access / façade", ro: "Acces / fațadă", ru: "Доступ / фасад" })} />
        </div>
      </div>
    </div>
  );
}
