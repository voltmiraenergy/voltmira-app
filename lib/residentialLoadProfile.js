// lib/residentialLoadProfile.js — a REAL, published hourly residential
// consumption shape, for the peak-shaving simulation (lib/peakShaving.js).
//
// Source: DEER SA (Distribuție Energie Electrică România), licence zone
// Transilvania Sud — "Profil specific de consum (PSC) tip Clienți casnici
// zona urbană" (Standard Load Profile, urban residential customers),
// published under ANRE President Decision 122/04.02.2020, the methodology
// Romanian DSOs use to settle consumption for metering points without an
// interval (smart) meter. Built from real 15-minute interval-meter readings
// at 31 transformer stations (Brașov, Harghita, Sibiu), 1 Nov 2019 – 31 Oct
// 2020, feeding loads that are ≥95% residential. PDF (public, no login):
// https://www.distributie-energie.ro/wp-content/uploads/2023/12/profil-specific-de-consum-tip-Clienti-casnici-zona-urbana-TS-2020.pdf
//
// The four arrays below are that PDF's own Tabelul nr. 1, 96 real 15-minute
// weights per column, summed into 24 hourly weights (each column's 96
// fifteen-minute values already summed to exactly 1.0000000 in the source
// table; summing four consecutive quarters into an hour is arithmetic on
// real numbers, not a re-estimate). Each array below still sums to 1
// (±1e-9) — the fraction of one representative day's total consumption that
// falls in that hour, not an absolute kWh.
//
// This is a ROMANIAN reference shape. No equivalent published per-interval
// residential profile could be found for Moldova (ANRE Moldova, Premier
// Energy Distribution and Moldelectrica only publish 2-block day/night
// tariff windows, not a load shape) — same conclusion as this codebase's
// NCM snow-zone gap: not fabricated, and callers using it for an MD project
// must show it labeled as a Romanian reference, never as Moldova's own data
// (see hourlyLoadShape()'s own comment).

// Working day, cold season (October-March).
const ZL_SR = [0.031635, 0.029442, 0.028526, 0.028201, 0.028929, 0.031555, 0.035587, 0.040253, 0.044312, 0.046577, 0.047324, 0.046851, 0.046222, 0.045397, 0.044510, 0.044832, 0.046978, 0.051390, 0.054352, 0.054163, 0.050969, 0.045951, 0.040428, 0.035616];
// Non-working day, cold season.
const ZNL_SR = [0.033627, 0.031133, 0.029817, 0.029267, 0.029445, 0.030693, 0.033167, 0.037082, 0.041944, 0.045246, 0.046794, 0.047223, 0.047145, 0.046315, 0.045202, 0.044784, 0.046053, 0.050256, 0.053734, 0.054143, 0.051533, 0.047033, 0.041707, 0.036657];
// Working day, warm season (April-September).
const ZL_SC = [0.030722, 0.029239, 0.028497, 0.028684, 0.029870, 0.032112, 0.037219, 0.042812, 0.046280, 0.047830, 0.048331, 0.048590, 0.047874, 0.046560, 0.046286, 0.046179, 0.046273, 0.046371, 0.047797, 0.050603, 0.051815, 0.046610, 0.039551, 0.033895];
// Non-working day, warm season.
const ZNL_SC = [0.032604, 0.030729, 0.029784, 0.029526, 0.029358, 0.030389, 0.034905, 0.040985, 0.045387, 0.047906, 0.048603, 0.049199, 0.048364, 0.046481, 0.045138, 0.044669, 0.044681, 0.045294, 0.047171, 0.050918, 0.052829, 0.048293, 0.041266, 0.035521];

export const RO_URBAN_LOAD_SHAPE = { ZL_SR, ZNL_SR, ZL_SC, ZNL_SC };

export const RO_URBAN_LOAD_SHAPE_SOURCE = {
  org: "DEER SA (Transilvania Sud)",
  doc: "Profil specific de consum, tip „Clienți casnici zona urbană”",
  legal: "ANRE, Decizia președintelui nr. 122/04.02.2020",
  measured: "31 posturi de transformare, Brașov/Harghita/Sibiu, nov. 2019 – oct. 2020",
  url: "https://www.distributie-energie.ro/wp-content/uploads/2023/12/profil-specific-de-consum-tip-Clienti-casnici-zona-urbana-TS-2020.pdf",
};

/**
 * The 24 real hourly weights (sum to 1) for one representative day, picked
 * by calendar month (SR = Oct-Mar, SC = Apr-Sep, matching the source
 * document's own season split) and working/non-working day.
 * @param {number} month 0-11 (JS Date convention)
 * @param {boolean} [isWorkingDay=true]
 */
export function hourlyLoadShape(month, isWorkingDay = true) {
  const m = Number(month);
  const cold = Number.isFinite(m) ? (m <= 2 || m >= 9) : true; // Oct(9)-Mar(2)
  const key = cold ? (isWorkingDay ? "ZL_SR" : "ZNL_SR") : (isWorkingDay ? "ZL_SC" : "ZNL_SC");
  return RO_URBAN_LOAD_SHAPE[key];
}
