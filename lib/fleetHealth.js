// lib/fleetHealth.js — is each installed system keeping the promise its quote
// made, and if not, what is most likely wrong?
//
// Rule-based on purpose. An installer acts on these findings (drives out,
// calls a distribution operator, messages a client), so every verdict must be
// explainable from the numbers shown next to it: no model, no hidden weights.
//
// Inputs are plain 12-slot calendar arrays (0 = January), the same shape the
// Studio job workspace stores readings in:
//   p50[i]    expected kWh for month i (the quote's own P50)
//   actual[i] measured kWh, or null/""/NaN when not entered
// Only months from `firstMonth` through `asOf` (the last COMPLETE month) count,
// so a system switched on in June is measured against June onward, never
// against a full year.

export const THRESH = { healthy: 0.95, watch: 0.85, critical: 0.75 };

// Which months a cause is plausible in (0-based). Summer overvoltage builds
// with irradiance; snow only matters in deep winter.
const SUMMER = [4, 5, 6, 7];      // May–Aug
const SPRING = [2, 3];            // Mar–Apr: bright enough to matter, rarely trips
const WINTER = [11, 0, 1];        // Dec–Feb

export const SEVERITY = { critical: 4, nodata: 3, warn: 2, watch: 1, ok: 0, pending: -1 };

function num(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * @param {object} a
 *   p50: number[12], actual: (number|string|null)[12],
 *   market: "MD"|"RO", asOf: 0..11, firstMonth?: 0..12 (12 = not live yet)
 * @returns assessment — see the return statement for the shape.
 */
export function assessSystem({ p50, actual, market = "MD", asOf, firstMonth }) {
  const exp = Array.from({ length: 12 }, (_, i) => Math.max(0, Number(p50?.[i]) || 0));
  const act = Array.from({ length: 12 }, (_, i) => num(actual?.[i]));

  // Without an explicit start, the first entered month is when it went live.
  const firstEntered = act.findIndex((v, i) => v != null && i <= asOf);
  const start = firstMonth != null ? firstMonth : (firstEntered >= 0 ? firstEntered : asOf + 1);

  const ratios = act.map((v, i) => (v != null && i >= start && i <= asOf && exp[i] > 0 ? v / exp[i] : null));
  const counted = ratios.map((r, i) => (r != null ? i : -1)).filter((i) => i >= 0);

  const ytdP50 = counted.reduce((s, i) => s + exp[i], 0);
  const ytdActual = counted.reduce((s, i) => s + act[i], 0);
  const ratioYtd = ytdP50 > 0 ? ytdActual / ytdP50 : null;
  const lastIdx = counted.length ? counted[counted.length - 1] : -1;
  const last = lastIdx >= 0 ? { i: lastIdx, p50: exp[lastIdx], actual: act[lastIdx], ratio: ratios[lastIdx] } : null;

  const base = { ratios, months: counted.length, ytdP50, ytdActual, ratioYtd, last, evidence: {} };

  // Too new to have a complete month yet: not a problem, just not live.
  if (start > asOf) return { ...base, status: "pending", cause: null, lostKwh: 0 };

  // The last complete month has no reading. Two or more missing months means
  // nobody has looked at this system in a while — that's the urgent kind.
  if (lastIdx < asOf) {
    const missing = asOf - Math.max(lastIdx, start - 1);
    return {
      ...base,
      status: missing >= 2 ? "critical" : "nodata",
      cause: "no_reading",
      evidence: { missingFrom: Math.max(lastIdx + 1, start), missingTo: asOf, missing },
      lostKwh: 0,
    };
  }

  const r = last.ratio;
  const status = r >= THRESH.healthy ? "ok" : r >= THRESH.watch ? "watch" : r >= THRESH.critical ? "warn" : "critical";
  const { cause, evidence } = status === "ok" ? { cause: null, evidence: {} } : diagnose(ratios, lastIdx, market);

  // Energy the client did not get: only months clearly below the promise, and
  // only on systems currently flagged. Ordinary weather swings on a healthy
  // system are not "lost", and counting them would inflate the number.
  const lostKwh = status === "warn" || status === "critical"
    ? counted.reduce((s, i) => s + (ratios[i] < THRESH.watch ? exp[i] - act[i] : 0), 0)
    : 0;

  return { ...base, status, cause, evidence, lostKwh };
}

function diagnose(ratios, i, market) {
  const r = ratios[i];
  const prev = i > 0 ? ratios[i - 1] : null;

  if (WINTER.includes(i)) return { cause: "snow", evidence: { month: i, ratio: r } };

  // A healthy month followed by a collapse: something broke, it didn't wear out.
  if (prev != null && prev >= 0.92 && r < 0.8) {
    return { cause: "sudden_drop", evidence: { month: i, ratio: r, prevMonth: i - 1, prevRatio: prev } };
  }

  // Three or more consecutive months, each worse than the last, adding up to a
  // real slide: dirt accumulating, not a fault.
  let run = 0;
  for (let k = i; k > 0 && ratios[k] != null && ratios[k - 1] != null && ratios[k] < ratios[k - 1]; k--) run++;
  if (run >= 2 && ratios[i - run] - r >= 0.08) {
    return { cause: "soiling", evidence: { from: i - run, to: i, fromRatio: ratios[i - run], toRatio: r } };
  }

  // Moldova's weak rural low-voltage lines: midday export pushes voltage past
  // the inverter's U> trip, so the loss tracks summer irradiance while spring
  // looks fine. Needs a clean spring baseline to tell it apart from a system
  // that has simply always been weak.
  if (market === "MD" && SUMMER.includes(i)) {
    const spring = SPRING.map((m) => ratios[m]).filter((v) => v != null);
    const summerLow = SUMMER.filter((m) => m <= i && ratios[m] != null && ratios[m] < 0.9);
    const springAvg = spring.length ? spring.reduce((a, b) => a + b, 0) / spring.length : null;
    if (springAvg != null && springAvg >= 0.92 && summerLow.length >= 2) {
      const vals = summerLow.map((m) => ratios[m]);
      return {
        cause: "overvoltage",
        evidence: { months: summerLow, min: Math.min(...vals), max: Math.max(...vals), springAvg },
      };
    }
  }

  return { cause: "low", evidence: { month: i, ratio: r } };
}

/** Sort key: worst first, then by how far below the promise. */
export function compareUrgency(a, b) {
  const s = (SEVERITY[b.status] ?? 0) - (SEVERITY[a.status] ?? 0);
  if (s) return s;
  return (a.last?.ratio ?? 1) - (b.last?.ratio ?? 1);
}

/** Median of the systems' year-to-date ratios — one bad system can't sink it. */
export function fleetRatio(assessments) {
  const xs = assessments.map((a) => a.ratioYtd).filter((v) => v != null).sort((x, y) => x - y);
  if (!xs.length) return null;
  const m = xs.length >> 1;
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}
