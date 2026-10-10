// lib/uaMarket.js — what a Ukrainian household proposal adds on top of the
// engine: the state "Energy Credit" for homes, and a blackout plan.
//
// ENERGY CREDIT (energy.kmu.gov.ua/for-houses, checked 2026-09-29). Loans up
// to 480,000 UAH for up to 10 years, through six banks (Ukrgasbank,
// Oschadbank, PrivatBank, Sense Bank, Globus Bank, Poltava-Bank). Interest:
// 0% for a one-year loan, 5% for two years, 7% for three; beyond that the
// bank's own rate. The state repays part of the principal once: 20% for a
// generator, 25% for a generator with a battery, up to 30% for a full solar
// set. Each bank sets its own scoring, so this is an estimate to show a
// client, never an offer.
//
// BLACKOUT PLAN. A grid-tied system switches off with the grid (anti-islanding
// protection), so without a battery a Ukrainian household has no power in an
// outage, sun or not. With one, the question is how long it carries the
// essential circuits. Pure; no I/O.
import { amortizedMonthlyPayment } from "@voltmira/engine";

export const ENERGY_CREDIT = {
  maxUah: 480000,
  maxYears: 10,
  // programme rate by loan length in whole years; longer loans use the bank's
  rateByYears: { 1: 0, 2: 5, 3: 7 },
  // the most the state repays, for a full solar set
  compensationPct: 30,
  banks: ["Ukrgasbank", "Oschadbank", "PrivatBank", "Sense Bank", "Globus Bank", "Poltava-Bank"],
};

/**
 * @param {object} a
 * @param {number} a.costEur        what the client pays for the system, EUR
 * @param {number} a.fxUah          UAH per 1 EUR (frozen with the proposal)
 * @param {number} [a.years]        loan length, 1–10 (default 3)
 * @param {number} [a.bankRatePct]  the bank's rate for loans over 3 years
 * @returns {{ years:number, ratePct:number, loanEur:number, monthlyEur:number,
 *             compensationEur:number, capped:boolean }}
 */
export function energyCredit({ costEur, fxUah, years = 3, bankRatePct = 16 }) {
  const n = Math.min(ENERGY_CREDIT.maxYears, Math.max(1, Math.round(Number(years) || 3)));
  const ratePct = ENERGY_CREDIT.rateByYears[n] ?? (Number(bankRatePct) || 0);
  const fx = Number(fxUah) > 0 ? Number(fxUah) : 51;
  const maxEur = ENERGY_CREDIT.maxUah / fx;
  const want = Math.max(0, Number(costEur) || 0);
  const loanEur = Math.min(want, maxEur);
  return {
    years: n,
    ratePct,
    loanEur,
    monthlyEur: amortizedMonthlyPayment(loanEur, ratePct, n),
    compensationEur: loanEur * (ENERGY_CREDIT.compensationPct / 100),
    capped: want > maxEur,
  };
}

// Loan terms offered in the editor, in years.
export const CREDIT_TERMS = [1, 2, 3, 5, 7, 10];
// The bank's own rate beyond the programme's three years, as an assumption.
export const BANK_RATE_PCT = 16;

/**
 * A quote's stored Ukraine plan (projects.ua_plan) with its defaults: a
 * 4-hour outage, 0.5 kW kept on (fridge, lights, router, boiler pump), no
 * generator, a 3-year loan.
 */
export function uaPlanDefaults(plan) {
  const v = plan && typeof plan === "object" ? plan : {};
  return {
    outageHours: Number(v.outageHours) > 0 ? Number(v.outageHours) : 4,
    essentialKw: Number(v.essentialKw) > 0 ? Number(v.essentialKw) : 0.5,
    generatorKw: Math.max(0, Number(v.generatorKw) || 0),
    creditYears: CREDIT_TERMS.includes(Number(v.creditYears)) ? Number(v.creditYears) : 3,
  };
}

// Usable energy a battery hands to the house after the inverter's losses.
const DISCHARGE_EFF = 0.9;
const SIZES = [5, 10, 15, 20, 30, 40];

/**
 * @param {object} a
 * @param {number} a.battKwh        usable battery capacity, kWh (0 = none)
 * @param {number} a.essentialKw    what stays on in an outage: fridge, lights, router, boiler pump
 * @param {number} a.outageHours    a typical outage in this area, hours
 * @returns {{ hours:number|null, covers:boolean|null, needKwh:number|null, suggestKwh:number|null }}
 *   hours: how long the battery alone carries the essential load;
 *   covers: whether that lasts a typical outage;
 *   needKwh / suggestKwh: the capacity it takes, and the next common size up.
 */
export function blackoutPlan({ battKwh = 0, essentialKw, outageHours }) {
  const load = Number(essentialKw), h = Number(outageHours), b = Math.max(0, Number(battKwh) || 0);
  if (!(load > 0)) return { hours: null, covers: null, needKwh: null, suggestKwh: null };
  const hours = b > 0 ? (b * DISCHARGE_EFF) / load : 0;
  if (!(h > 0)) return { hours, covers: null, needKwh: null, suggestKwh: null };
  const needKwh = (load * h) / DISCHARGE_EFF;
  const suggestKwh = SIZES.find((s) => s >= needKwh) ?? Math.ceil(needKwh / 5) * 5;
  return { hours, covers: hours >= h, needKwh, suggestKwh };
}
