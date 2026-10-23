// lib/phoneTilt.js — a roof's pitch read from the phone: laid on the slope (or along a rafter) with its
// top edge up the slope, the phone's front-to-back tilt (the "beta" angle of the device orientation
// sensor) is the pitch. Measured over a short moment and the middle reading taken, so a shaky hand
// does not set the number. The browser asks the person's leave first on an iPhone; a phone or a
// desktop without the sensor says so, and the pitch is typed instead. Browser only.

/** The pitch a beta reading means: whole degrees, 0 to 60 (flat to a steep roof), whichever way up the phone lies. */
export function tiltFromBeta(beta) {
  const b = Number(beta);
  if (beta == null || !Number.isFinite(b)) return null;
  return Math.round(Math.min(60, Math.max(0, Math.abs(b))));
}

/** The middle reading of a list of angles. */
export function medianTilt(samples) {
  const v = (samples || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * @param {{ ms?: number }} [o]
 * @returns {Promise<{ ok: true, tiltDeg: number } | { ok: false, error: "no_sensor" | "denied" }>}
 */
export async function measurePhoneTilt({ ms = 1200 } = {}) {
  if (typeof window === "undefined" || typeof window.DeviceOrientationEvent === "undefined") return { ok: false, error: "no_sensor" };
  const D = window.DeviceOrientationEvent;
  // iOS 13+ asks first, and only from a tap
  if (typeof D.requestPermission === "function") {
    try { if ((await D.requestPermission()) !== "granted") return { ok: false, error: "denied" }; }
    catch { return { ok: false, error: "denied" }; }
  }
  return new Promise((resolve) => {
    const betas = [];
    const on = (e) => { if (Number.isFinite(e.beta)) betas.push(e.beta); };
    window.addEventListener("deviceorientation", on);
    setTimeout(() => {
      window.removeEventListener("deviceorientation", on);
      const tiltDeg = tiltFromBeta(medianTilt(betas.map(Math.abs)));
      resolve(tiltDeg == null ? { ok: false, error: "no_sensor" } : { ok: true, tiltDeg });
    }, ms);
  });
}
