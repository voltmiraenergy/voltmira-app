// lib/plantSample.js — the sample projects the portfolios page can load: a
// hybrid plant in the south of Moldova (wind, solar, battery storage), and a
// portfolio of commercial rooftop plants across the country. Pure; the server
// action (lib/plantActions.js) adds the public wind and sun data for each site
// before saving.
//
// SAMPLE DATA. Every cost, price, term and permit status below is an
// illustration chosen to be plausible for 2026, not a quote, an offer or a
// fact about a real project. Each plant carries sample: true, the pages show a
// "sample" badge, and the report says so on its cover. What is real: the wind
// and sun at each point (NASA POWER, PVGIS) and the second auction's
// published weighted average price (62.04 EUR/MWh), used as the sample's
// contract price.
import { AUCTION_2 } from "./greenData.js";

const id = (k) => `sample_${k}_${Math.random().toString(36).slice(2, 8)}`;

const NAMES = {
  hybrid: {
    portfolio: { en: "Sample: southern hybrid park (wind, solar, storage)", ro: "Exemplu: parc hibrid în sud (vânt, soare, stocare)", ru: "Пример: гибридный парк на юге (ветер, солнце, накопители)", uk: "Приклад: гібридний парк на півдні (вітер, сонце, накопичувачі)" },
    plant: { en: "Southern hybrid park", ro: "Parcul hibrid Sud", ru: "Гибридный парк Юг", uk: "Гібридний парк Південь" },
    locality: { en: "Cahul (sample site)", ro: "Cahul (amplasament exemplu)", ru: "Кагул (пример площадки)", uk: "Кагул (приклад майданчика)" },
  },
  rooftops: {
    portfolio: { en: "Sample: commercial rooftops", ro: "Exemplu: acoperișuri comerciale", ru: "Пример: коммерческие крыши", uk: "Приклад: комерційні дахи" },
  },
};

// Rooftop sites: town centres from lib/addressFallback.js, the app's own list
const ROOFS = [
  { k: "balti", mwp: 1.2, lat: 47.7615, lon: 27.9289, name: { en: "Warehouse roof, Bălți", ro: "Acoperiș depozit, Bălți", ru: "Крыша склада, Бельцы", uk: "Дах складу, Бєльці" } },
  { k: "ungheni", mwp: 0.8, lat: 47.2086, lon: 27.7978, name: { en: "Factory roof, Ungheni", ro: "Acoperiș fabrică, Ungheni", ru: "Крыша фабрики, Унгены", uk: "Дах фабрики, Унгени" } },
  { k: "orhei", mwp: 0.6, lat: 47.3833, lon: 28.8228, name: { en: "Cold store roof, Orhei", ro: "Acoperiș frigider, Orhei", ru: "Крыша холодильника, Оргеев", uk: "Дах холодильника, Оргіїв" } },
  { k: "cahul", mwp: 1.0, lat: 45.9075, lon: 28.1958, name: { en: "Logistics centre roof, Cahul", ro: "Acoperiș centru logistic, Cahul", ru: "Крыша логистического центра, Кагул", uk: "Дах логістичного центру, Кагул" } },
  { k: "chisinau", mwp: 1.5, lat: 47.0245, lon: 28.8322, name: { en: "Shopping centre roof, Chișinău", ro: "Acoperiș centru comercial, Chișinău", ru: "Крыша торгового центра, Кишинёв", uk: "Дах торгового центру, Кишинів" } },
];

const ROLES = {
  developer: { en: "developer", ro: "Dezvoltator", ru: "Девелопер", uk: "Девелопер" },
  env: { en: "env", ro: "Consultant de mediu", ru: "Экологический консультант", uk: "Екологічний консультант" },
  wind: { en: "wind", ro: "Consultant pentru vânt", ru: "Консультант по ветру", uk: "Консультант з вітру" },
  host: { en: "host", ro: "Compania gazdă", ru: "Компания-владелец крыши", uk: "Компанія-власник даху" },
  installer: { en: "installer", ro: "Instalator", ru: "Монтажная компания", uk: "Монтажна компанія" },
};

/** A permit checklist part-way through development, as a sample project would be. */
function samplePermits(kind, lang) {
  const R = (k) => ROLES[k][lang] || ROLES[k].en;
  const d = (s, by, extra = {}) => ({ status: s, by: by ? R(by) : "", ...extra });
  if (kind === "rooftop") {
    return {
      land: d("done", "host"), urbanism: d("na", ""), eia: d("na", ""), grid: d("in_progress", "installer", { submitted: "2026-09-15" }),
      yield: d("done", "installer"), design: d("done", "installer"), building: d("na", ""), licence: d("na", ""),
      contract: d("in_progress", "developer"), epc: d("in_progress", "installer"), om: d("todo", ""), insurance: d("todo", ""),
    };
  }
  return {
    land: d("done", "developer"), urbanism: d("done", "developer"), eia: d("in_progress", "env", { submitted: "2026-08-20" }),
    grid: d("in_progress", "developer", { submitted: "2026-07-10" }), yield: d("in_progress", "wind", { due: "2026-12-15" }),
    design: d("todo", ""), building: d("todo", ""), licence: d("todo", ""), contract: d("done", "developer"),
    epc: d("in_progress", "developer"), om: d("todo", ""), insurance: d("todo", ""),
  };
}

/**
 * @param {"hybrid"|"rooftops"} kind
 * @param {string} lang
 * @returns {{ name: string, plants: object[], finance: object }}
 */
export function samplePortfolio(kind, lang = "en") {
  const L = (o) => o[lang] || o.en;
  if (kind === "rooftops") {
    return {
      name: L(NAMES.rooftops.portfolio),
      plants: ROOFS.map((r) => ({
        id: id(r.k), sample: true, name: L(r.name), locality: L(r.name).split(", ").pop(), lat: r.lat, lon: r.lon, operator: r.lat > 47.5 ? "RED Nord" : "Premier Energy",
        solar: { mwp: r.mwp, yieldKwhKwp: 0, degrPctYr: 0.5 },
        // the host buys the output under a 12-year PPA, then at an assumed lower price
        revenue: { kind: "ppa", priceEurMwh: 95, years: 12, indexPct: 2, afterEurMwh: 55, currency: "EUR" },
        costs: { solarEurPerKw: 600, gridEur: 30000, devPct: 3, opexSolarEurPerKwYr: 12, insurancePct: 0.3 },
        permits: samplePermits("rooftop", lang),
      })),
      finance: { gearingPct: 70, ratePct: 7, tenorYears: 10, discPct: 8, debtCurrency: "EUR", preset: null },
    };
  }
  return {
    name: L(NAMES.hybrid.portfolio),
    plants: [{
      id: id("hybrid"), sample: true, name: L(NAMES.hybrid.plant), locality: L(NAMES.hybrid.locality),
      lat: 45.95, lon: 28.33, operator: "Moldelectrica",
      // eight turbines of 5 MW, 150 m hub; a generic low-wind curve (rated at 10 m/s)
      wind: { mw: 40, turbines: 8, hubM: 150, shear: 0.2, lossesPct: 15, turbine: { cutIn: 3, rated: 10, cutOut: 25 } },
      solar: { mwp: 20, yieldKwhKwp: 0, degrPctYr: 0.5 },
      bess: { mw: 10, mwh: 20 },
      revenue: { kind: "auction", priceEurMwh: AUCTION_2.priceEurMwh, years: 15, indexPct: 0, afterEurMwh: 50, currency: "EUR", bessEurPerMwYr: 0 },
      costs: {
        windEurPerKw: 1200, solarEurPerKw: 500, bessEurPerKwh: 250, gridEur: 2000000, devPct: 3,
        opexWindEurPerKwYr: 35, opexSolarEurPerKwYr: 10, opexBessEurPerKwhYr: 5, landEurYr: 60000, insurancePct: 0.35,
      },
      permits: samplePermits("utility", lang),
    }],
    // sample terms, like every value here: 18 months to build, a year of
    // interest only after commissioning, six months of service in reserve
    finance: { gearingPct: 65, ratePct: 6.5, tenorYears: 15, discPct: 8, debtCurrency: "EUR", preset: null, constructionMonths: 18, graceYears: 1, dsraMonths: 6 },
  };
}

/** An empty plant for a new utility project, sized at nothing until the user fills it in. */
export function blankPlant(name = "") {
  return {
    id: `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, locality: "", lat: null, lon: null, operator: "",
    wind: null, solar: null, bess: null,
    revenue: { kind: "auction", priceEurMwh: 0, years: 15, indexPct: 0, afterEurMwh: 0, currency: "EUR", bessEurPerMwYr: 0 },
    costs: {}, permits: {},
  };
}
