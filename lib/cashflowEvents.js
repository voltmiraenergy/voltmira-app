// lib/cashflowEvents.js — why the pooled cash flow or its debt service moves
// in a given year, so the chart (components/CashflowChart.jsx) can mark it and
// say so in a line, before a lender has to ask: the interest-only years, a
// late start, the last loan payment, a plant's contracted price ending, a
// storage contract ending, tax depreciation ending, and a replacement paid.
// Pure; reads the model's own numbers, never a guess.
import { normalizeFinance, normalizeScenario } from "./projectFinance.js";
import { pt } from "./portfolioText.js";
import { eur, num as fnum } from "./portfolioFormat.js";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * @param {object} a
 * @param {object} a.agg        lib/portfolio.js aggregate()
 * @param {object} a.fin        the finance terms
 * @param {object} [a.scenario] the portfolio's scenario
 * @param {Array}  [a.assets]   model assets; plants carry `plant` (normalised)
 * @param {object} [a.E]        engine settings, for the inflation the costs rise by
 * @returns {Array<{ from: number, to: number, key: string, vars: object }>} by year
 */
export function cashflowEvents({ agg, fin, scenario, assets = [], E = null }) {
  const f = normalizeFinance(fin);
  const sc = normalizeScenario(scenario);
  const H = (agg?.cfads || []).length;
  if (!H) return [];
  const ds = agg.debtService || [];
  const out = [];
  const add = (from, to, key, vars = {}) => out.push({ from, to, key, vars });

  if (sc.delayMonths > 0) add(1, 1, "ev_delay", { n: Math.round(sc.delayMonths) });

  // interest-only years, as one run
  const io = ds.map((d, i) => (num(d) > 1e-9 && !agg.repays?.[i] ? i + 1 : null)).filter(Boolean);
  if (io.length) add(io[0], io[io.length - 1], "ev_grace");

  let last = 0;
  ds.forEach((d, i) => { if (num(d) > 1e-9) last = i + 1; });
  if (last > 0 && last < H) add(last, last, "ev_repaid");

  // a plant's contracted price, and a storage contract, ending inside the life
  const ends = new Map();
  for (const a of assets) {
    const pl = a?.kind === "plant" ? a.plant : null;
    const r = pl?.revenue;
    if (!r) continue;
    if (r.kind !== "merchant" && r.years > 0 && r.years < H && r.priceEurMwh > 0) {
      const from = r.priceEurMwh * Math.pow(1 + r.indexPct / 100, r.years - 1);
      const k = `c:${r.years + 1}:${from.toFixed(2)}:${r.afterEurMwh}`;
      const e = ends.get(k) || { year: r.years + 1, key: "ev_contract", vars: { from, to: r.afterEurMwh }, names: [] };
      e.names.push(a.name || pl.name);
      ends.set(k, e);
    }
    if (pl.bess && r.bessEurPerMwYr > 0 && r.bessYears > 0 && r.bessYears < H) {
      const k = `b:${r.bessYears + 1}`;
      const e = ends.get(k) || { year: r.bessYears + 1, key: "ev_bess", vars: {}, names: [] };
      e.names.push(a.name || pl.name);
      ends.set(k, e);
    }
  }
  for (const e of ends.values()) add(e.year, e.year, e.key, { ...e.vars, name: e.names.filter(Boolean).join(", ") });
  // after a contract, a price held flat against costs that rise: a slow slide, not a step
  const infl = Number(E?.bands?.expc?.infl ?? 2.5);
  const flatAfter = !(sc.tariffEscalationPct > 0) && infl > 0;
  const firstEnd = Math.min(...[...ends.values()].filter((e) => e.key === "ev_contract").map((e) => e.year));
  if (flatAfter && Number.isFinite(firstEnd) && firstEnd < H) add(firstEnd + 1, H, "ev_drift", { infl });

  if (f.taxPct > 0 && f.taxLifeYears < H) add(f.taxLifeYears + 1, f.taxLifeYears + 1, "ev_dep");

  (agg.sustaining || []).forEach((v, i) => { if (num(v) > 0.5) add(i + 1, i + 1, "ev_repl", { eur: num(v) }); });

  return out.sort((x, y) => x.from - y.from || x.key.localeCompare(y.key));
}

/** One event's line, in words: "Year 16: ...". `money` formats an amount in EUR. */
export function eventText(e, lang = "en", money = (v) => eur(v, lang)) {
  const when = e.from === e.to ? pt("ev_year", lang, { y: e.from }) : pt("ev_years", lang, { a: e.from, b: e.to });
  const v = { ...e.vars };
  if (v.from != null) v.from = fnum(v.from, lang, 2);
  if (v.to != null) v.to = fnum(v.to, lang, 2);
  if (v.eur != null) v.eur = money(v.eur);
  if (v.infl != null) v.infl = fnum(v.infl, lang, 1);
  return `${when}: ${pt(e.key, lang, v)}`;
}
