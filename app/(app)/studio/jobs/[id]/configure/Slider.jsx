"use client";
// Slider.jsx — a real <input type=range> (so dragging, arrow keys and screen
// readers work) with a filled track: workspace.css draws the fill from the
// --fill custom property set here, since CSS can't read the current value.
// The value sits in a pill beside the label. Used by Financials (term, rate).
export default function Slider({ id, label, value, min, max, step = 1, onChange, format }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="ws-slider-top">
        <label htmlFor={id}>{label}</label>
        <span className="ws-pill">{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ "--fill": pct + "%" }}
        className="ws-range" />
    </div>
  );
}
