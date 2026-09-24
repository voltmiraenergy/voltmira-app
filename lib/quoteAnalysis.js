// lib/quoteAnalysis.js — the analysis layer shared by every surface that builds
// an offer: the real project editor (/projects/[id]) and Studio's preview.
//
// These used to live inside Studio's quote page, which meant the demo surface
// was smarter than the tool installers actually sell with. Pure functions, no
// React, no market assumptions beyond what the caller passes in — so the two
// surfaces can never drift apart on a number a client sees.
import { simulate, SOLAR_SEASON } from "@voltmira/engine";
import { exportRevenue } from "./prosumerPrice.js";

/**
 * Sweep battery capacity through the REAL engine and find the point where extra
 * capacity stops paying for itself.
 *
 * Every extra kWh either gets exported at the market's low buy-back price, or
 * stored and self-consumed at the full retail tariff. That trade-off is the
 * whole battery decision, and it is specific to one client's consumption — so
 * this computes it rather than applying a rule of thumb.
 *
 * `knee` = the first capacity where the marginal value of the next kWh has
 * fallen below 40% of the very first kWh's marginal value. Past it you are
 * buying capacity that mostly sits idle.
 *
 * @param {object} base  engine inputs WITHOUT batt/battKwh (market, kw, price,
 *                       cons, yieldOverride, feedOverride…)
 * @param {object} E     engine settings
 * @param {number} current  the capacity currently quoted, for the "you are here" dot
 */
export function batterySweep(base, E, current = 0, { step = 0.5, minMax = 10 } = {}) {
  // Always sweep past whatever is already quoted, or a 13 kWh pick reads off a
  // 10 kWh chart and its "value at the current pick" silently reports the value
  // at 10 instead.
  const max = Math.max(minMax, Math.ceil((Number(current) || 0) / step) * step);

  const pts = [];
  for (let b = 0; b <= max + 1e-9; b += step) {
    const s = simulate({ ...base, batt: b > 0, battKwh: b }, E, "expc");
    pts.push({ b: Math.round(b * 10) / 10, year1: s.year1 });
  }
  for (let i = 1; i < pts.length; i++) pts[i].marginal = (pts[i].year1 - pts[i - 1].year1) / step;
  pts[0].marginal = pts[1]?.marginal || 0;

  const base0 = pts[0].year1;
  const deltas = pts.map((p) => p.year1 - base0);
  const peak = deltas.reduce((best, v, i) => (v > deltas[best] ? i : best), 0);

  // Three genuinely different answers, and the old code could only give one:
  //  · the battery never pays (every capacity is worth less than none) → 0 kWh.
  //    Under RO's 1:1 net metering that is the normal answer, because exports
  //    are already credited at the retail price.
  //  · returns taper off → the knee, the last capacity still worth buying.
  //  · value peaks then falls → never recommend past the peak.
  // Falling through to "the largest capacity swept" told an installer to fit
  // 10 kWh on a system where storage LOST €25/yr.
  let knee = 0;
  const paysOff = deltas[peak] > 0;
  if (paysOff) {
    knee = pts[peak].b;
    const firstMarginal = pts[1]?.marginal || 0;
    for (let i = 1; i <= peak; i++) {
      if (firstMarginal > 0 && pts[i].marginal < firstMarginal * 0.4) { knee = pts[i].b; break; }
    }
  }
  const at = (b) => {
    const want = Math.min(max, Math.max(0, Math.round((Number(b) || 0) / step) * step));
    return pts.find((p) => Math.abs(p.b - want) < 1e-9)?.year1 ?? base0;
  };
  return { pts, deltas, knee, paysOff, base0, atCurrent: at(current), atKnee: at(knee), max, step };
}

/**
 * NPV / IRR / LCOE on a simulated band — the three numbers a commercial client
 * or a lender asks for, which payback alone doesn't answer.
 *
 * IRR is bisected only when the cashflow actually crosses zero somewhere in
 * [-50%, +150%]; otherwise it returns null rather than a fabricated rate.
 */
export function financials(sim, grossCost, discPct, E) {
  const cost = Math.max(0, Number(grossCost) || 0);
  const nets = []; let prev = -cost;
  for (const c of sim.rows) { nets.push(c - prev); prev = c; }

  const d = (Number(discPct) || 0) / 100;
  const npvAt = (r) => nets.reduce((a, n, i) => a + n / Math.pow(1 + r, i + 1), -cost);
  const npv = npvAt(d);

  let irr = null;
  if (npvAt(-0.5) * npvAt(1.5) < 0) {
    let lo = -0.5, hi = 1.5;
    for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (npvAt(m) > 0) lo = m; else hi = m; }
    irr = (lo + hi) / 2;
  }

  // LCOE = discounted lifetime cost (capex + O&M) per discounted kWh produced.
  // Compare it to the retail tariff to see the margin the client is buying.
  const b = E.bands.expc, H = E.horizon || 25;
  let dcost = cost, dprod = 0;
  for (let y = 1; y <= H; y++) {
    const prod = sim.prod0 * Math.pow(1 - b.degr / 100, y - 1);
    const opex = cost * (E.opexPct / 100) * Math.pow(1 + b.infl / 100, y - 1);
    dcost += opex / Math.pow(1 + d, y);
    dprod += prod / Math.pow(1 + d, y);
  }
  return { npv, irr, lcoe: dprod > 0 ? dcost / dprod : 0 };
}

/**
 * The year's exported surplus spread over the months it actually occurs in, and
 * priced at each month's own published buy-back rate.
 *
 * Using SOLAR_SEASON is the same monthly shape the engine itself uses, so the
 * two can never disagree about when the surplus happens.
 */
export function surplusRevenue(prodKwh, selfRatio, mdlPerEur) {
  const seasonSum = SOLAR_SEASON.reduce((a, b) => a + b, 0);
  const exportedYear = Math.max(0, (Number(prodKwh) || 0) * (1 - (Number(selfRatio) || 0)));
  const monthly = SOLAR_SEASON.map((f) => (exportedYear * f) / seasonSum);
  return { ...exportRevenue(monthly, mdlPerEur), exportedYear };
}

/**
 * Bill of materials → the installer's equipment cost.
 *
 * Deliberately NOT the quote price: the quote is driven by system size (kW ×
 * rate), and the BOM is what the equipment costs the installer — the gap
 * between them is margin. Freezing the price to the BOM total is what made the
 * size slider look broken, which is why lib/quoteInput.js passes costOverride:0.
 */
export function bomTotal(bom) {
  return (Array.isArray(bom) ? bom : []).reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
}

/** Does this BOM actually price a battery? (mirrors lib/quoteInput.js) */
export function bomPricesBattery(bom) {
  return (Array.isArray(bom) ? bom : []).some((l) => l.kind === "battery" && (Number(l.qty) || 0) > 0);
}

/**
 * What to call a BOM line's category. Shared so the installer's editor, the
 * client's proposal page and the printed PDF all name the same component the
 * same way — a client comparing the web proposal against the PDF should never
 * see "Invertor" in one and "Inverter" in the other.
 */
export function kindLabel(kind, lang) {
  const t3 = (ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);
  return {
    panel: t3("Panouri", "Panels", "Панели"),
    inverter: t3("Invertor", "Inverter", "Инвертор"),
    battery: t3("Baterie", "Battery", "Батарея"),
    mounting: t3("Montaj", "Mounting", "Монтаж"),
    other: t3("Altele", "Other", "Прочее"),
  }[kind] || kind;
}

/**
 * A BOM line as a client-facing description: brand, model and spec, with no
 * prices. The bill of materials carries the installer's purchase cost, which
 * must never reach the document the client keeps.
 */
export function bomLineText(line) {
  return [
    [line.brand, line.model].filter(Boolean).join(" ").trim(),
    line.spec || "",
  ].filter(Boolean).join(" · ");
}
