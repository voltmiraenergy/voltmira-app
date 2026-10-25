// lib/leadScore.js — how likely a lead is to become a signed job, 0 to 100, from what the lead itself says.
// Six signals, each worth 0 to 1: the size of the electricity bill, whether the address was found in its town,
// when they want to install, interest in financing, a phone number to call, and whether the district is one the
// installer serves. Each installer weighs them in Settings (companies.lead_score_weights). Worked out when the list
// is shown, never stored, so a change of weights rescores every lead at once. Pure, no I/O.

export const SCORE_SIGNALS = ["bill", "timeline", "phone", "located", "financing", "district"];

/** The weights a workspace starts with: the bill and the timeline say the most. */
export const DEFAULT_WEIGHTS = { bill: 30, timeline: 25, phone: 15, located: 10, financing: 10, district: 10 };

export const TIMELINES = ["now", "soon", "later"];

/** Weights as kept: whole numbers 0 to 100 for each signal; all zero (or nothing) falls back to the defaults. */
export function cleanWeights(raw) {
  const out = {};
  for (const k of SCORE_SIGNALS) {
    const n = Math.round(Number(raw?.[k]));
    out[k] = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_WEIGHTS[k];
  }
  return Object.values(out).some((v) => v > 0) ? out : { ...DEFAULT_WEIGHTS };
}

// a monthly bill in euros: under 15 is a small home, 60 and up a large one or a business
function billPart(bill, fx) {
  const b = Number(bill), r = Number(fx) > 0 ? Number(fx) : 1;
  if (!(b > 0)) return 0;
  const eur = b / r;
  if (eur >= 60) return 1;
  if (eur >= 30) return 0.8;
  if (eur >= 15) return 0.5;
  return 0.2;
}

/**
 * What each signal is worth for one lead, 0 to 1.
 * @param {object} lead  a leads row: monthly_bill, timeline, phone, lat/lon or estimate, wants_financing, district
 * @param {{fx?: number, serviceDistricts?: string[]}} [o]  fx: local currency per euro; the districts the installer serves
 */
export function scoreParts(lead, { fx = 1, serviceDistricts = [] } = {}) {
  const tl = TIMELINES.includes(lead?.timeline) ? lead.timeline : null;
  const lat = Number(lead?.lat ?? lead?.estimate?.lat), lon = Number(lead?.lon ?? lead?.estimate?.lon);
  const served = Array.isArray(serviceDistricts) ? serviceDistricts.filter(Boolean) : [];
  return {
    bill: billPart(lead?.monthly_bill, fx),
    timeline: tl === "now" ? 1 : tl === "soon" ? 0.6 : tl === "later" ? 0.2 : 0.3,
    phone: String(lead?.phone || "").replace(/\D/g, "").length >= 8 ? 1 : 0,
    located: Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? 1 : 0,
    financing: lead?.wants_financing === true ? 1 : 0.5,
    // a district the installer has not listed is not held against a lead until they list some
    district: !served.length ? 0.5 : lead?.district && served.includes(lead.district) ? 1 : 0,
  };
}

/** The score, 0 to 100, and what made it. */
export function leadScore(lead, opts = {}, weights = DEFAULT_WEIGHTS) {
  const w = cleanWeights(weights);
  const parts = scoreParts(lead, opts);
  const total = SCORE_SIGNALS.reduce((s, k) => s + w[k], 0);
  const got = SCORE_SIGNALS.reduce((s, k) => s + w[k] * parts[k], 0);
  return { score: Math.round((got / total) * 100), parts };
}

/** The band a score falls in, for the badge: hot from 70, warm from 40. */
export const scoreBand = (score) => (score >= 70 ? "hot" : score >= 40 ? "warm" : "cold");
