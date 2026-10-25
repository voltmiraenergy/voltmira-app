// lib/rangeFill.js — the orange part of an app slider (app/(app)/AppTheme.jsx draws it from --fill): up to the middle
// of the knob, whatever the value. A slider that does not set it is drawn 30% full whatever its value, so the bar and
// the knob disagree.
const KNOB_R = 11;   // half the 22px knob

/** The style for <input type="range">: { "--fill": "calc(...)" }, from its value and its bounds. */
export function rangeFill(value, min = 0, max = 100) {
  const lo = Number(min), hi = Number(max), v = Number(value);
  const t = hi > lo && Number.isFinite(v) ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0;
  return { "--fill": `calc(${KNOB_R}px + (100% - ${KNOB_R * 2}px) * ${Math.round(t * 10000) / 10000})` };
}
