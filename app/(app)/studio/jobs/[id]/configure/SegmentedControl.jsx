"use client";
// SegmentedControl.jsx — one segmented-control look for Shading, Market,
// Payment method and document language: a quiet track with the chosen option
// filled in the brand green, readable in both themes. `full` stretches it to
// the width of its container.
export default function SegmentedControl({ options, value, onChange, full, label }) {
  return (
    <div className={"ws-seg" + (full ? " full" : "")} role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button key={opt.value} type="button" role="radio" aria-checked={value === opt.value}
          className={value === opt.value ? "on" : ""} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
