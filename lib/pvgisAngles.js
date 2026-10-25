// lib/pvgisAngles.js — the tilt and facing a PVGIS lookup may ask for. They arrive from the browser as
// free text, and every distinct number is a new call to the JRC service and a new row in pvgis_cache,
// so they are kept to the real range (tilt 0 to 90, facing -180 to 180, 0 is south) and rounded to the
// whole degree, which is all the service resolves anyway. Pure.
const clampRound = (v, lo, hi, dflt) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n))) : dflt;
};

export function pvgisAngles(angle, aspect) {
  return { angle: clampRound(angle, 0, 90, 35), aspect: clampRound(aspect, -180, 180, 0) };
}
