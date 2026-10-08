// lib/greenData.js — the Moldovan green-energy facts VoltMira works with, each
// tied to where it comes from:
//
//   PROGRAMS    the support a solar or battery job can get (grants, the VAT
//               refund and 0% customs on batteries, the state loan guarantee).
//               lib/greenSupport.js applies them to one quote.
//   the rest    the national picture from the Ministry of Energy's
//               presentation at Moldova Business Week 2026: where the right
//               bank's electricity comes from, renewables' share and capacity,
//               the 2050 targets, the day-ahead market, balancing needs and the
//               second renewables auction.
//
// Rules this file keeps:
//   - Only numbers PRINTED in the presentation are here. Nothing is read off the height
//     of a bar; hourly prices will come from OPEM's own published results.
//   - The coverage table was transcribed from a photo of the presentation and checked
//     by the workspace owner on 3 October 2026 (2023: Romania 6%, Ukraine 0.2%).
//   - Legal amounts stay in the currency they were set in (lei). Converting a
//     cap to EUR and back at a moving rate would move the cap.
//   - Scope is wind, solar, hydro, storage, hydrogen and the import split.
//     Oil, biogas, biomass, municipal waste, nuclear and natural gas are left
//     out on purpose (lib/greenData.test.js fails if one slips in).

export const SOURCES = {
  mbw2026: {
    id: "mbw2026",
    kind: "presentation",
    publisher: { en: "Ministry of Energy of the Republic of Moldova", ro: "Ministerul Energiei al Republicii Moldova", ru: "Министерство энергетики Республики Молдова", uk: "Міністерство енергетики Республіки Молдова" },
    title: { en: "Moldova Business Week 2026", ro: "Moldova Business Week 2026", ru: "Moldova Business Week 2026", uk: "Moldova Business Week 2026" },
    url: null,
    // the presentation carries no date of its own; this is when they were transcribed
    transcribed: "2026-10-03",
  },
  moldpres_bess: {
    id: "moldpres_bess",
    kind: "news",
    publisher: { en: "Moldpres", ro: "Moldpres", ru: "Moldpres", uk: "Moldpres" },
    title: {
      en: "Moldova to develop a credit guarantee instrument for energy storage investments",
      ro: "Republica Moldova va dezvolta un nou instrument de garantare a creditelor pentru investițiile în sisteme de stocare a energiei",
      ru: "Молдова разработает инструмент гарантирования кредитов для инвестиций в накопители энергии",
      uk: "Молдова розробить інструмент гарантування кредитів для інвестицій у накопичувачі енергії",
    },
    url: "https://www.moldpres.md/rom/economie/republica-moldova-va-dezvolta-un-instrument-de-garantare-a-creditelor-pentru-investitiile-in-sisteme-de-stocare-a-energiei",
  },
};

/**
 * Support programmes for Moldovan solar and battery jobs, as the presentation states
 * them. `who`: household, sme (small business), company. `needs`: what the job
 * must have. Amounts in `cap` are in `currency`, never converted for storage.
 */
export const PROGRAMS = [
  {
    id: "casa_verde",
    kind: "grant",
    market: "MD",
    who: ["household"],
    // PV with battery storage, and only once the house is thermally insulated
    needs: { battery: true, insulation: true },
    sharePct: 50,
    cap: { amount: 200000, currency: "MDL", basis: "eligible_cost" },
    operator: "CNED",
    law: null,
    sources: ["mbw2026"],
  },
  {
    id: "law112_vat",
    kind: "tax",
    market: "MD",
    who: ["sme", "company"],
    // recovery up to the VAT paid: cash refund, offset against tax due, or carried forward
    needs: { battery: true, vatPayer: true },
    law: "law112",
    sources: ["mbw2026"],
  },
  {
    id: "law112_customs",
    kind: "customs",
    market: "MD",
    who: ["household", "sme", "company"],
    needs: { battery: true },
    dutyFromPct: 8,
    dutyToPct: 0,
    law: "law112",
    sources: ["mbw2026"],
  },
  {
    id: "facem_373",
    kind: "grant",
    market: "MD",
    who: ["sme"],
    // battery storage for net-metering beneficiaries; grants up to 30% plus preferential loans
    needs: { battery: true, netMetering: true },
    upToPct: 30,
    sources: ["mbw2026"],
  },
  {
    id: "bess_guarantee",
    kind: "guarantee",
    market: "MD",
    // the presentation calls it ENERGO GARANT; the official news names no brand yet
    who: ["sme", "company"],
    needs: { battery: true, loan: true },
    sharePct: 50,
    cap: { amount: 30000000, currency: "MDL", basis: "loan" },
    maxMonths: 120,
    feePctYear: 1,
    budget: { amount: 300000000, currency: "MDL", leverage: 5 },
    validUntil: "2028-12-31",
    supportsMwh: 1100,
    sources: ["mbw2026", "moldpres_bess"],
  },
];

export const LAWS = {
  law112: { number: "112", date: "2026-06-11", title: {
    en: "Law No. 112 of 11 June 2026 amending acts on support for renewables and energy storage",
    ro: "Legea nr. 112 din 11 iunie 2026 privind modificarea unor acte normative referitoare la sprijinul pentru sursele regenerabile și stocarea energiei",
    ru: "Закон № 112 от 11 июня 2026 года о внесении изменений в некоторые акты о поддержке ВИЭ и накопления энергии",
    uk: "Закон № 112 від 11 червня 2026 року про внесення змін до деяких актів щодо підтримки ВДЕ та накопичення енергії",
  } },
};

// ---------------------------------------------------------------- the national picture

/**
 * Coverage of the right bank's electricity consumption, %, by source (presentation
 * "Electricity supply"). null = not printed. From 2025 the left-bank plant
 * (MGRES) no longer supplies the right bank: 0, as published.
 * Keys: right = internal sources on the right bank, left = left bank (MGRES),
 * ua = import from Ukraine, ro = import from Romania.
 */
export const COVERAGE = {
  source: "mbw2026",
  unit: "%",
  yearly: [
    { period: "2019", right: 19, left: 68, ua: 12, ro: null },
    { period: "2020", right: 13, left: 74, ua: 13, ro: null },
    { period: "2021", right: 24, left: 65, ua: 12, ro: null },
    { period: "2022", right: 18, left: 60, ua: 11, ro: 11 },
    { period: "2023", right: 16, left: 78, ua: 0.2, ro: 6 },
    { period: "2024", right: 19, left: 68, ua: 1, ro: 12 },
  ],
  monthly: [
    { period: "2025-01", right: 38, left: 0, ua: 5, ro: 57 },
    { period: "2025-02", right: 39, left: 0, ua: 3, ro: 59 },
    { period: "2025-03", right: 35, left: 0, ua: 3, ro: 62 },
    { period: "2025-04", right: 31, left: 0, ua: 14, ro: 55 },
    { period: "2025-05", right: 27, left: 0, ua: 2, ro: 71 },
    { period: "2025-06", right: 29, left: 0, ua: 8, ro: 63 },
    { period: "2025-07", right: 23, left: 0, ua: 32, ro: 44 },
    { period: "2025-08", right: 21, left: 0, ua: 37, ro: 41 },
    { period: "2025-09", right: 19, left: 0, ua: 47, ro: 34 },
    { period: "2025-10", right: 24, left: 0, ua: 7, ro: 68 },
    { period: "2025-11", right: 32, left: 0, ua: 1, ro: 67 },
    { period: "2025-12", right: 34, left: 0, ua: 0, ro: 66 },
    { period: "2026-01", right: 44, left: 0, ua: 0, ro: 56 },
    { period: "2026-02", right: 45, left: 0, ua: 0, ro: 55 },
    { period: "2026-03", right: 48, left: 0, ua: 6, ro: 46 },
    { period: "2026-04", right: 41, left: 0, ua: 2, ro: 57 },
    { period: "2026-05", right: 43, left: 0, ua: 4, ro: 53 },
    { period: "2026-06", right: 38, left: 0, ua: 14, ro: 47 },
  ],
};

/** One day's supply, right bank, 27 September 2026, % of the day's consumption. */
export const DAY_SUPPLY = { source: "mbw2026", date: "2026-09-27", chpPct: 2, resPct: 30, importPct: 68 };

/** Renewables' share of total electricity consumption, %. 2026 as shown (no period is published). */
export const RES_SHARE = {
  source: "mbw2026",
  byYear: { 2018: 2.6, 2019: 3.0, 2020: 3.1, 2021: 3.6, 2022: 5.5, 2023: 10.5, 2024: 16.6, 2025: 24.5, 2026: 30.8 },
};

/**
 * Installed renewable capacity at the end of July 2026, MW. The published total
 * is 1,119.18 MW; the parts it prints (these four plus 8.39 MW of biogas,
 * which is out of scope) add up to 1,089.75 MW. Both are kept as printed and
 * the gap is shown, never filled in.
 */
export const CAPACITY_JUL_2026 = {
  source: "mbw2026",
  date: "2026-07-31",
  statedTotalMw: 1119.18,
  excludedPrintedMw: 8.39,
  mw: { solar: 583.26, wind: 256.22, solar_prosumers: 225.08, hydro: 16.8 },
};

/** Installed capacity the 2050 strategy aims for, MW (storage also in MWh). */
export const TARGETS_2050 = {
  source: "mbw2026",
  mw: { wind: 2600, solar: 1200, storage: 600, hydrogen: 30 },
  storageMwh: 1200,
};

/** NECP 2030 and Energy Strategy 2050 objectives. */
export const OBJECTIVES = {
  source: "mbw2026",
  importDependencePct: { from: 77, fromYear: 2023, to: 40, toYear: 2050 },
  electricityShareFinalPct: { from: 12, fromYear: 2023, to: 65, toYear: 2050 },
  lowEmissionProductionPct: 85,
  carbonFreeLocal2030Pct: 30,
  // listed among the published objectives; their build status is not stated there
  interconnections: [
    { id: "isaccea_vulcanesti_chisinau", country: "RO", kv: 400, ends: ["Isaccea", "Vulcănești", "Chișinău"] },
    { id: "balti_suceava", country: "RO", kv: 400, ends: ["Bălți", "Suceava"] },
    { id: "straseni_gutinas", country: "RO", kv: 400, ends: ["Strășeni", "Gutinaș"] },
    { id: "vulcanesti_smardan", country: "RO", kv: 400, ends: ["Vulcănești", "Smârdan"] },
    { id: "comrat_smardan", country: "RO", kv: 400, ends: ["Comrat", "Smârdan"] },
    { id: "vulcanesti_artiz", country: "UA", kv: 400, ends: ["Vulcănești", "Artiz"] },
    { id: "balti_dnestrovsk", country: "UA", kv: 330, ends: ["Bălți", "Dnestrovsk"] },
  ],
};

/** Battery storage in the system. */
export const BESS_STATUS = { source: "mbw2026", installedMwh: 210, installedAsOf: "2026-06", neededMwh: 1200 };

/** The day-ahead market (OPEM), as printed. Hourly prices come from OPEM later. */
export const DAY_AHEAD = {
  source: "mbw2026",
  operator: "OPEM",
  presentedEurMdl: 20, // the presentation's own conversion note, used only for its own figures
  averagePriceEurMwh: [
    { date: "2026-06-12", value: 250 },
    { date: "2026-09-29", value: 140 },
  ],
  august2026ShareOfConsumptionPct: { min: 10, max: 35, recordDay: 40 },
};

/** Balancing: system needs (MW) and the long-term capacity tender. */
export const BALANCING = {
  source: "mbw2026",
  needsMw: { fcr: { up: 5, down: -5 }, frr: { up: 240, down: -100 }, afrr: { up: 65, down: -35 }, mfrr: { up: 175, down: -65 } },
  dates: { anreDecision: "2025-05-30", tenderLaunched: "2025-09-30", results: "2026-05-14" },
  tender: [
    { product: "fcr", mechanism: "automatic", response: "seconds", requestMw: 6, resultMw: 4, symmetric: true },
    { product: "afrr", mechanism: "automatic", response: "minutes", requestMw: 35, resultMw: 23, symmetric: true },
    { product: "mfrr_12h", mechanism: "manual", response: "tso", requestMw: 80, resultMw: 17, symmetric: false },
    // printed as "up to ±40, average 25"
    { product: "mfrr_2h", mechanism: "manual", response: "tso", requestMw: 40, resultMw: 40, resultAvgMw: 25, symmetric: true },
  ],
};

/** The second renewables auction (wind with storage). */
export const AUCTION_2 = {
  source: "mbw2026",
  bids: 16,
  offeredMw: 423.85,
  offeredMwh: 305.29,
  tenderedMw: 170,
  tenderedMwh: 44,
  winningBids: 7,
  awardedWindMw: 170,
  awardedBessMwh: 162.5,
  priceEurMwh: 62.04,
  priceMdlKwh: 1.2467,
  investmentEurM: 250,
  // no period is published for this figure
  co2ReductionT: 1400000,
};

/** Renewable acceleration zones: how one is designated, and what it brings. None is designated yet. */
export const RAA = {
  source: "mbw2026",
  steps: ["degraded_land", "exclude_impact", "grid_capacity", "sea", "gd_approval"],
  benefits: ["public_utility", "faster_permits", "simpler_environmental", "guaranteed_capacity", "no_gov_approval_20mw", "easement"],
  zones: [],
};

/** The EVO single-window permit portal, as announced. */
export const EVO = { source: "mbw2026", principles: ["single_access", "parallel", "transparency", "interoperability"] };

/** Series that must never appear in this module. */
export const EXCLUDED = ["oil", "biogas", "biomass", "municipal_waste", "nuclear", "natural_gas"];
