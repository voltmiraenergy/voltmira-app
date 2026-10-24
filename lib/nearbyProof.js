// lib/nearbyProof.js — "Proof from nearby systems" on the client's offer: what monitored systems in the same
// district really produced over the last 12 full months, in kWh per installed kWp. Shown only when it is a fair
// picture and names nobody: at least 3 systems, from at least 2 installers (a demo workspace, whose systems are all
// sample data, may show its own). The typical value is the median, so one shaded roof does not move it.
// Pure, no I/O: the caller hands in the systems and how to find a district from a place.

export const MIN_SYSTEMS = 3;
export const MIN_INSTALLERS = 2;

/** The 12 full months before `now`, oldest first, as "YYYY-MM". */
export function lastTwelveMonths(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const out = [];
  for (let i = 12; i >= 1; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(m.toISOString().slice(0, 7));
  }
  return out;
}

/** One system's kWh per kWp over the window, or null without a reading for every month of it. */
export function systemYield(system, months) {
  const kw = Number(system?.kw);
  if (!(kw > 0)) return null;
  const byMonth = new Map((system.readings || []).map((r) => [String(r.month).slice(0, 7), Number(r.kwh)]));
  let sum = 0;
  for (const m of months) {
    const v = byMonth.get(m);
    if (!(v >= 0)) return null;
    sum += v;
  }
  return sum / kw;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * The proof for one district, or null when there is not enough to show.
 * @param {string} district
 * @param {{companyId:string, kw:number, lat:number, lon:number, sample?:boolean, readings:{month:string, kwh:number}[]}[]} systems
 * @param {(lat:number, lon:number) => string|null} districtOf
 */
export function nearbyProof(district, systems, districtOf, now = new Date()) {
  if (!district) return null;
  const months = lastTwelveMonths(now);
  const here = [];
  for (const s of systems || []) {
    if (districtOf(Number(s.lat), Number(s.lon)) !== district) continue;
    const y = systemYield(s, months);
    // a figure no real roof gives is a data error, not proof
    if (y != null && y > 300 && y < 2200) here.push({ y, companyId: s.companyId, sample: !!s.sample });
  }
  if (here.length < MIN_SYSTEMS) return null;
  const installers = new Set(here.map((x) => x.companyId)).size;
  const allSample = here.every((x) => x.sample);
  if (installers < MIN_INSTALLERS && !allSample) return null;
  return { district, systems: here.length, kwhPerKwp: Math.round(median(here.map((x) => x.y))), from: months[0], to: months[11] };
}
