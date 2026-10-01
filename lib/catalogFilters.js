// lib/catalogFilters.js — pure filtering logic for the supplier-catalog
// browser (app/(app)/catalog/SupplierCatalogBrowser.jsx). Kept out of the
// "use client" component so the filter combinations are unit-testable without
// a browser, matching this codebase's convention (lib/designCheck.js,
// lib/inverterOptions.js, ...).
//
// Every function here reads ALL_SUPPLIER_PRODUCTS-shaped rows (each already
// tagged with `kind` and `specString` — see lib/supplierCatalog.js) and never
// mutates them.

/**
 * The one "how big is this" number a shopper actually compares across a kind:
 * Wp for a panel, kW for an inverter, kWh for a battery. Mounts have no
 * common size axis (they're priced per installed kW, not a standalone rating)
 * so this returns null for them — callers must treat null as "not filterable
 * by size", not as zero.
 */
export function sizeOf(p) {
  if (!p) return null;
  if (p.kind === "panel") return Number(p.watt) || null;
  if (p.kind === "inverter") return Number(p.kw) || null;
  if (p.kind === "battery") return Number(p.kwh) || null;
  return null;
}

/** Every kind prices itself slightly differently — panels/inverters/batteries
 * carry a flat `price`, mounts carry `eurPerKw` — this is the one place that
 * decides which field is "the price" so nothing else has to know the split. */
export function priceOf(p) {
  if (!p) return 0;
  const v = p.price ?? p.eurPerKw;
  return Number(v) || 0;
}

/** Sorted, deduplicated brand list across whatever rows are passed in —
 * callers pass the kind-filtered set so the brand list only ever offers
 * brands that actually exist for the category currently being browsed. */
export function brandsFor(rows) {
  const set = new Set((Array.isArray(rows) ? rows : []).map((p) => p.brand).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Inclusive [min,max] size bounds for the range sliders. Rows with no size
 * (mounts, or a malformed entry) are ignored rather than collapsing the range
 * to 0. Returns null when nothing in `rows` has a size at all. */
export function sizeRangeFor(rows) {
  const sizes = (Array.isArray(rows) ? rows : []).map(sizeOf).filter((n) => n != null);
  if (!sizes.length) return null;
  return { min: Math.min(...sizes), max: Math.max(...sizes) };
}

/** Same as sizeRangeFor but for price — every kind always has a price, so
 * this only returns null for an empty row set. */
export function priceRangeFor(rows) {
  const prices = (Array.isArray(rows) ? rows : []).map(priceOf);
  if (!prices.length) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * The single filter pass the browser applies, in one place so the UI and its
 * tests exercise the exact same logic. Every filter is optional/permissive by
 * default — omitting a field (or passing "all"/null/undefined) means "don't
 * filter on this", not "match nothing".
 *
 * @param {object[]} rows            ALL_SUPPLIER_PRODUCTS (or a subset)
 * @param {object} opts
 * @param {string}  [opts.kind]      "all" or a specific kind
 * @param {string}  [opts.supplier]  "all" or a supplierId
 * @param {string}  [opts.q]         free-text match against brand+model
 * @param {string[]} [opts.brands]   only these brands (empty/omitted = all)
 * @param {number}  [opts.minSize]   inclusive lower bound on sizeOf() — rows
 *   with no size (e.g. mounts) always pass a size filter, since "no size"
 *   isn't the same claim as "size 0"
 * @param {number}  [opts.maxSize]   inclusive upper bound, same rule
 * @param {number}  [opts.minPrice]  inclusive lower bound on priceOf()
 * @param {number}  [opts.maxPrice]  inclusive upper bound on priceOf()
 * @param {boolean} [opts.inStockOnly]
 */
export function filterProducts(rows, opts = {}) {
  const {
    kind = "all", supplier = "all", q = "", brands = [],
    minSize = null, maxSize = null, minPrice = null, maxPrice = null,
    inStockOnly = false,
  } = opts;
  const needle = String(q || "").trim().toLowerCase();
  const brandSet = brands && brands.length ? new Set(brands) : null;

  return (Array.isArray(rows) ? rows : [])
    .filter((p) => kind === "all" || p.kind === kind)
    .filter((p) => supplier === "all" || p.supplierId === supplier)
    .filter((p) => !needle || (p.brand + " " + p.model).toLowerCase().includes(needle))
    .filter((p) => !brandSet || brandSet.has(p.brand))
    .filter((p) => {
      const s = sizeOf(p);
      if (s == null) return true; // no size axis (mounts) — never excluded by a size filter
      if (minSize != null && s < minSize) return false;
      if (maxSize != null && s > maxSize) return false;
      return true;
    })
    .filter((p) => {
      const pr = priceOf(p);
      if (minPrice != null && pr < minPrice) return false;
      if (maxPrice != null && pr > maxPrice) return false;
      return true;
    })
    .filter((p) => !inStockOnly || (Number(p.stock) || 0) > 0);
}
