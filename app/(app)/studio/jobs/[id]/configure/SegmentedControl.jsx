"use client";
// SegmentedControl.jsx — a rounded gray track with a solid brand-filled
// active pill, shared by Shading, Market and Payment method so the Workspace
// has one segmented-control look instead of three slightly different button
// rows. A solid brand-600 fill (not "white pill on gray track") is used
// deliberately: a same-shade white-on-gray active state reads as barely
// distinguishable from its neighbours once the surrounding card is also
// near-white — this version reads unambiguously in both themes.
export default function SegmentedControl({ options, value, onChange, columns }) {
  return (
    <div className={"gap-1 rounded-lg bg-slate-100 p-1 dark:bg-[#242424] " + (columns ? "grid w-full" : "inline-flex")}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={"rounded-md px-3 py-1.5 text-xs font-semibold transition-all " +
            (value === opt.value
              ? "ws-fill-brand bg-brand-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-white hover:text-slate-700 dark:text-[#B0B0B0] dark:hover:bg-[#2C2C2C] dark:hover:text-[#D4D4D4]")}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
