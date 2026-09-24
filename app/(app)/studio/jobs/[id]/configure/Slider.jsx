"use client";
// Slider.jsx — a real <input type=range> with a custom brand-green filled
// track (styled in workspace.css via the .ws-range class + a --fill custom
// property computed here, since plain CSS can't read the current value) and
// the value shown as a small pill badge next to the label, not floating off
// on its own. Shared by Site & Roof (tilt/orientation) and Financials
// (term/rate) so every slider in the Workspace looks and behaves the same.
export default function Slider({ label, value, min, max, step = 1, onChange, format }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-[#D4D4D4]">{label}</label>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ "--fill": pct + "%" }}
        className="ws-range w-full" />
    </div>
  );
}
