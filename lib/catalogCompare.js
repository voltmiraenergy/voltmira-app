// lib/catalogCompare.js — the ONE definition of "which specs matter for a
// panel/inverter/battery/mount", shared by the product detail modal and the
// 2-3-way compare table (app/(app)/catalog/ProductDetailModal.jsx and
// CompareModal.jsx). Kept in one place, and out of either "use client"
// component, so the two views can never quietly drift into showing different
// numbers for the same field — and so the row list is unit-testable.
//
// Every row is `{key, label, unit, get(p), higherIsBetter, fmt}`:
//   key             stable id (React key)
//   label(lang)      localized row label
//   get(p)          the raw numeric/string value off a catalog row
//   unit            suffix shown after a numeric value ("W", "V", "kWh"...)
//   higherIsBetter  null when there's no objective "better" (a model number,
//                   a chemistry name) — only set on rows bestIndex() should
//                   ever be asked to rank
//   fmt(v)          optional override for how the value renders (falls back
//                   to `${v}${unit}`, or "—" for null/undefined)

const t3 = (lang, ro, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ro);

const dims = (p) => p?.dimensionsMm ? `${p.dimensionsMm.w} × ${p.dimensionsMm.h} × ${p.dimensionsMm.d}` : null;

const COMMON_TAIL = (lang) => [
  { key: "warrantyYears", label: t3(lang, "Garanție", "Warranty", "Гарантия"), unit: t3(lang, " ani", " yr", " лет"), get: (p) => p.warrantyYears ?? null, higherIsBetter: true },
  { key: "dimensionsMm", label: t3(lang, "Dimensiuni (L × Î × A, mm)", "Dimensions (W × H × D, mm)", "Размеры (Ш × В × Г, мм)"), unit: "", get: dims, higherIsBetter: null },
  { key: "weightKg", label: t3(lang, "Greutate", "Weight", "Вес"), unit: " kg", get: (p) => p.weightKg ?? null, higherIsBetter: false },
];

const ROWS_BY_KIND = {
  panel: (lang) => [
    { key: "watt", label: t3(lang, "Putere (Pmax)", "Rated power (Pmax)", "Мощность (Pmax)"), unit: " W", get: (p) => p.watt, higherIsBetter: true },
    { key: "eff", label: t3(lang, "Eficiență", "Efficiency", "КПД"), unit: "%", get: (p) => p.eff, higherIsBetter: true },
    { key: "voc", label: "Voc", unit: " V", get: (p) => p.voc, higherIsBetter: null },
    { key: "vmp", label: "Vmp", unit: " V", get: (p) => p.vmp, higherIsBetter: null },
    { key: "isc", label: "Isc", unit: " A", get: (p) => p.isc, higherIsBetter: null },
    { key: "imp", label: "Imp", unit: " A", get: (p) => p.imp, higherIsBetter: null },
    { key: "cells", label: t3(lang, "Celule", "Cells", "Ячеек"), unit: "", get: (p) => p.cells, higherIsBetter: null },
    { key: "tempCoeff", label: t3(lang, "Coeficient de temperatură", "Temperature coefficient", "Температурный коэффициент"), unit: "%/°C", get: (p) => p.tempCoeff, higherIsBetter: false },
    ...COMMON_TAIL(lang),
  ],
  inverter: (lang) => [
    { key: "kw", label: t3(lang, "Putere AC", "AC power", "Мощность AC"), unit: " kW", get: (p) => p.kw, higherIsBetter: true },
    { key: "type", label: t3(lang, "Tip", "Type", "Тип"), unit: "", get: (p) => p.type, higherIsBetter: null },
    { key: "maxEfficiencyPct", label: t3(lang, "Eficiență maximă", "Max efficiency", "Макс. КПД"), unit: "%", get: (p) => p.maxEfficiencyPct ?? null, higherIsBetter: true },
    { key: "mppt", label: t3(lang, "Intrări MPPT", "MPPT inputs", "Входы MPPT"), unit: "", get: (p) => p.mppt, higherIsBetter: true },
    { key: "phases", label: t3(lang, "Faze", "Phases", "Фазы"), unit: "", get: (p) => p.phases, higherIsBetter: null },
    { key: "maxDcV", label: t3(lang, "Tensiune DC max.", "Max DC voltage", "Макс. напряжение DC"), unit: " V", get: (p) => p.maxDcV, higherIsBetter: null },
    { key: "minMpptV", label: t3(lang, "Tensiune minimă MPPT", "MPPT minimum voltage", "Мин. напряжение MPPT"), unit: " V", get: (p) => p.minMpptV ?? null, higherIsBetter: null },
    { key: "maxInputCurrentA", label: t3(lang, "Curent max. / intrare MPPT", "Max current / MPPT input", "Макс. ток / вход MPPT"), unit: " A", get: (p) => p.maxInputCurrentA ?? null, higherIsBetter: null },
    ...COMMON_TAIL(lang),
  ],
  battery: (lang) => [
    { key: "kwh", label: t3(lang, "Capacitate", "Capacity", "Ёмкость"), unit: " kWh", get: (p) => p.kwh, higherIsBetter: true },
    { key: "chem", label: t3(lang, "Chimie", "Chemistry", "Химия"), unit: "", get: (p) => p.chem, higherIsBetter: null },
    { key: "vdc", label: "Vdc", unit: " V", get: (p) => p.vdc, higherIsBetter: null },
    { key: "cycles", label: t3(lang, "Durată de viață (cicluri)", "Cycle life", "Ресурс (циклы)"), unit: "", get: (p) => p.cycles, higherIsBetter: true },
    ...COMMON_TAIL(lang),
  ],
  mounting: (lang) => [
    { key: "type", label: t3(lang, "Tip", "Type", "Тип"), unit: "", get: (p) => p.type, higherIsBetter: null },
    { key: "eurPerKw", label: t3(lang, "Preț / kWp instalat", "Price / installed kWp", "Цена / установленный кВп"), unit: " €", get: (p) => p.eurPerKw, higherIsBetter: false },
    { key: "warrantyYears", label: t3(lang, "Garanție", "Warranty", "Гарантия"), unit: t3(lang, " ani", " yr", " лет"), get: (p) => p.warrantyYears ?? null, higherIsBetter: true },
  ],
};

/** The ordered spec rows for one kind, already localized. Falls back to the
 * panel row set for an unrecognized kind rather than returning nothing. */
export function compareRows(kind, lang) {
  const build = ROWS_BY_KIND[kind] || ROWS_BY_KIND.panel;
  return build(lang);
}

/** "n/a"-safe display string for one row's value on one product. */
export function formatRowValue(row, product) {
  const v = row.get(product);
  if (v == null || v === "") return "—";
  if (row.fmt) return row.fmt(v);
  return `${v}${row.unit || ""}`;
}

/**
 * Index of the objectively best value among a row of numbers — the highest
 * for higherIsBetter:true, the lowest for false, and -1 (nothing highlighted)
 * for null/undefined rows (no objective ranking) or when values tie or are
 * missing. Never a subjective "recommended" call — purely min/max on a
 * numeric spec, exactly the kind of honest comparison this codebase already
 * favors (see lib/inverterOptions.js's "energy capture", not a profitability
 * score).
 * @param {(number|null|undefined)[]} values
 * @param {boolean|null} higherIsBetter
 */
export function bestIndex(values, higherIsBetter) {
  if (higherIsBetter == null || !Array.isArray(values)) return -1;
  const nums = values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  const present = nums.filter((v) => v != null);
  if (present.length < 2) return -1; // nothing to compare against
  const best = higherIsBetter ? Math.max(...present) : Math.min(...present);
  const idx = nums.findIndex((v) => v === best);
  // a genuine tie for best means no single column "wins"
  if (nums.filter((v) => v === best).length > 1) return -1;
  return idx;
}
