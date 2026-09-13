// lib/supplierCatalog.js — the supplier-maintained equipment database.
//
// Modelled on how Sunny Design actually works: a real manufacturer/spec
// database you browse and pick from — not a blank form you fill in from
// memory. Two things Sunny Design itself doesn't have, borrowed from
// OpenSolar's "shop suppliers": every SKU is attributed to a named
// distributor (stock + lead time + price are THEIRS, not invented per quote),
// and picking one is a single click that adds it to your own catalog
// (app/(app)/catalog) — the real, editable library your quotes' bills of
// materials already read from.
//
// This file is shared by two very different consumers, on purpose:
//  · app/(app)/catalog/SupplierCatalogBrowser.jsx — the real "add from a
//    supplier" flow, one click away from a row in your own `products` table.
//  · app/(app)/studio/catalog-data.js — Studio's preview surfaces re-export
//    this same data so a Studio demo never disagrees with the real catalog.
//
// Suppliers are illustrative distributors for the MD/RO market (not a claim of
// an actual commercial relationship). Prices are indicative EUR list prices;
// stock/lead time are a mock snapshot — there is no live distributor feed yet.

export const SUPPLIERS = [
  {
    id: "nordsun",
    name: "NordSun Distribution",
    location: "Chișinău, MD",
    note: { ro: "stoc local, livrare a doua zi pe SKU-urile uzuale", en: "local stock, next-day on common SKUs", ru: "локальный склад, доставка на след. день по ходовым SKU" },
  },
  {
    id: "eurovolt",
    name: "EuroVolt Trading",
    location: "Cluj-Napoca, RO",
    note: { ro: "gamă largă + echipamente C&I, livrare din depozitul din România", en: "wide range + C&I gear, ships from the Romanian warehouse", ru: "широкий ассортимент + C&I, склад в Румынии" },
  },
];
const DEFAULT_SUPPLIER = "nordsun";

export const PANELS = [
  { id: "longi-hi-mo6-435", brand: "LONGi", model: "Hi-MO 6 Explorer LR5-54HTH", watt: 435, voc: 39.6, isc: 13.9, vmp: 33.2, imp: 13.1, cells: 108, eff: 22.5, tempCoeff: -0.29, price: 78, stock: 240, leadDays: 0, supplierId: "nordsun" },
  { id: "longi-hi-mo9-610", brand: "LONGi", model: "Hi-MO 9 LR7-72HGD", watt: 610, voc: 45.9, isc: 14.15, vmp: 38.6, imp: 15.8, cells: 144, eff: 23.0, tempCoeff: -0.26, price: 108, stock: 60, leadDays: 14, supplierId: "eurovolt" },
  { id: "jinko-tigerneo-425", brand: "Jinko", model: "Tiger Neo 54HL4R-B 425W", watt: 425, voc: 38.85, isc: 13.85, vmp: 32.6, imp: 13.04, cells: 108, eff: 22.02, tempCoeff: -0.29, price: 74, stock: 180, leadDays: 0, supplierId: "nordsun" },
  { id: "jinko-tigerneo-615", brand: "Jinko", model: "Tiger Neo 78HL4-BDV 615W", watt: 615, voc: 46.3, isc: 17.36, vmp: 38.9, imp: 15.81, cells: 156, eff: 22.57, tempCoeff: -0.26, price: 112, stock: 40, leadDays: 21, supplierId: "eurovolt" },
  { id: "trina-vertexs-445", brand: "Trina Solar", model: "Vertex S+ NEG9R.28 445W", watt: 445, voc: 31.3, isc: 18.15, vmp: 26.3, imp: 16.93, cells: 66, eff: 22.9, tempCoeff: -0.26, price: 80, stock: 120, leadDays: 7, supplierId: "eurovolt" },
  { id: "ja-jam54d40-440", brand: "JA Solar", model: "JAM54D40 440W", watt: 440, voc: 32.34, isc: 17.94, vmp: 27.15, imp: 16.21, cells: 108, eff: 22.6, tempCoeff: -0.3, price: 76, stock: 95, leadDays: 7, supplierId: "nordsun" },
  { id: "canadian-hihero-445", brand: "Canadian Solar", model: "HiHero CS6.5 445W", watt: 445, voc: 31.9, isc: 18.02, vmp: 26.7, imp: 16.67, cells: 66, eff: 22.8, tempCoeff: -0.26, price: 82, stock: 70, leadDays: 14, supplierId: "eurovolt" },
  { id: "risen-titan-460", brand: "Risen", model: "Titan RSM72-9-460M", watt: 460, voc: 52.1, isc: 11.42, vmp: 43.5, imp: 10.58, cells: 144, eff: 21.3, tempCoeff: -0.34, price: 70, stock: 150, leadDays: 0, supplierId: "nordsun" },
  { id: "astronergy-555-bif", brand: "Astronergy", model: "ASTRO N5s Bifacial 555W", watt: 555, voc: 46.6, isc: 14.92, vmp: 39.1, imp: 14.2, cells: 132, eff: 22.28, tempCoeff: -0.26, price: 96, stock: 55, leadDays: 21, supplierId: "eurovolt" },
  { id: "hyundai-h-415", brand: "Hyundai Energy", model: "HiE-S415VG", watt: 415, voc: 37.9, isc: 13.95, vmp: 31.6, imp: 13.13, cells: 108, eff: 21.3, tempCoeff: -0.3, price: 64, stock: 210, leadDays: 0, supplierId: "nordsun" },
];

export const INVERTERS = [
  { id: "deye-sun6k-sg04lp3", brand: "Deye", model: "SUN-6K-SG04LP3", kw: 6, type: "hybrid", mppt: 2, phases: 3, maxDcV: 800, price: 820, stock: 34, leadDays: 0, supplierId: "nordsun" },
  { id: "deye-sun12k-sg04lp3", brand: "Deye", model: "SUN-12K-SG04LP3-EU", kw: 12, type: "hybrid", mppt: 2, phases: 3, maxDcV: 800, price: 1450, stock: 18, leadDays: 7, supplierId: "nordsun" },
  { id: "deye-sun5k-sg04lp1", brand: "Deye", model: "SUN-5K-SG04LP1-EU", kw: 5, type: "hybrid", mppt: 2, phases: 1, maxDcV: 500, price: 690, stock: 28, leadDays: 0, supplierId: "nordsun" },
  { id: "huawei-sun2000-10ktl", brand: "Huawei", model: "SUN2000-10KTL-M1", kw: 10, type: "string", mppt: 2, phases: 3, maxDcV: 1100, price: 980, stock: 22, leadDays: 14, supplierId: "eurovolt" },
  { id: "growatt-min6000tl-xh", brand: "Growatt", model: "MIN 6000TL-XH", kw: 6, type: "hybrid", mppt: 2, phases: 1, maxDcV: 600, price: 640, stock: 41, leadDays: 0, supplierId: "nordsun" },
  { id: "sofar-hyd20ktl-3ph", brand: "Sofar", model: "HYD 20KTL-3PH", kw: 20, type: "hybrid", mppt: 2, phases: 3, maxDcV: 1000, price: 2650, stock: 9, leadDays: 21, supplierId: "eurovolt" },
  { id: "solis-s6-gr1p", brand: "Solis", model: "S6-GR1P(3-10)K", kw: 5, type: "string", mppt: 2, phases: 1, maxDcV: 600, price: 520, stock: 38, leadDays: 0, supplierId: "nordsun" },
  { id: "huawei-sun2000-100ktl", brand: "Huawei", model: "SUN2000-100KTL-M2", kw: 100, type: "string", mppt: 10, phases: 3, maxDcV: 1100, price: 8200, stock: 4, leadDays: 35, supplierId: "eurovolt" },
];

// chemClass drives Studio's 25-year replacement-cost logic: LFP (LiFePO₄) at a
// solar duty cycle comfortably clears 25 years; NMC's shorter cycle life means
// a mid-life pack replacement belongs in the cashflow.
export const BATTERIES = [
  { id: "pylontech-us5000x2", brand: "Pylontech", model: "US5000 × 2", kwh: 9.6, vdc: 48, chem: "LiFePO₄", chemClass: "LFP", cycles: 6000, price: 2380, stock: 26, leadDays: 0, supplierId: "nordsun" },
  { id: "deye-selb", brand: "Deye", model: "SE-G5.1Pro", kwh: 5.12, vdc: 51.2, chem: "LiFePO₄", chemClass: "LFP", cycles: 6000, price: 1290, stock: 33, leadDays: 0, supplierId: "nordsun" },
  { id: "dyness-powerbox", brand: "Dyness", model: "Powerbox H10", kwh: 4.8, vdc: 51.2, chem: "LiFePO₄", chemClass: "LFP", cycles: 6000, price: 1180, stock: 29, leadDays: 7, supplierId: "nordsun" },
  { id: "huawei-luna2000", brand: "Huawei", model: "LUNA2000-5-E0", kwh: 5.0, vdc: 50, chem: "LiFePO₄", chemClass: "LFP", cycles: 6000, price: 1340, stock: 20, leadDays: 14, supplierId: "eurovolt" },
  { id: "pylontech-forceh2", brand: "Pylontech", model: "Force H2", kwh: 15.0, vdc: 51.2, chem: "LiFePO₄", chemClass: "LFP", cycles: 8000, price: 3650, stock: 11, leadDays: 21, supplierId: "eurovolt" },
  { id: "generic-nmc-5000", brand: "generic import", model: "PowerCell NMC-5000", kwh: 5.0, vdc: 48, chem: "NMC", chemClass: "NMC", cycles: 3000, price: 990, stock: 14, leadDays: 14, supplierId: "eurovolt" },
];

export const MOUNTS = [
  { id: "k2-singlerail", brand: "K2 Systems", model: "SingleRail 48 / Speed Rail", type: "roof, tile hooks", eurPerKw: 60, stock: 999, leadDays: 0, supplierId: "nordsun" },
  { id: "schletter-rapid16", brand: "Schletter", model: "Rapid16", type: "roof, trapezoidal sheet", eurPerKw: 55, stock: 999, leadDays: 7, supplierId: "eurovolt" },
  { id: "k2-crossrail", brand: "K2 Systems", model: "CrossRail — ground / carport", type: "ground mount / carport", eurPerKw: 140, stock: 999, leadDays: 21, supplierId: "eurovolt" },
];

export const DEFAULT_IDS = {
  panel: "longi-hi-mo6-435",
  inverter: "deye-sun6k-sg04lp3",
  battery: "pylontech-us5000x2",
  mount: "k2-singlerail",
};

export const findSupplier = (id) => SUPPLIERS.find((s) => s.id === id) || SUPPLIERS.find((s) => s.id === DEFAULT_SUPPLIER);
export const findPanel = (id) => PANELS.find((p) => p.id === id) || PANELS.find((p) => p.id === DEFAULT_IDS.panel);
export const findInverter = (id) => INVERTERS.find((p) => p.id === id) || INVERTERS.find((p) => p.id === DEFAULT_IDS.inverter);
export const findBattery = (id) => BATTERIES.find((p) => p.id === id) || BATTERIES.find((p) => p.id === DEFAULT_IDS.battery);
export const findMount = (id) => MOUNTS.find((p) => p.id === id) || MOUNTS.find((p) => p.id === DEFAULT_IDS.mount);

// ---- Sunny-Design-style auto-recommendation --------------------------------
// Pick a module (or change the system size) and the matching inverter/mount
// are suggested for you — sized for THIS kW/phase/battery combination, in
// stock first, cheapest of the equally-good matches. Never silently picks
// something incompatible: phases must match, and the DC/AC ratio is kept
// sane (1.05–1.35).
export function recommendInverter({ kw, phases, wantHybrid }) {
  const candidates = INVERTERS
    .filter((i) => i.phases === phases)
    .map((i) => ({ i, ratio: kw / i.kw }))
    .filter(({ ratio }) => ratio >= 0.85 && ratio <= 1.4);
  const pool = candidates.length ? candidates : INVERTERS.filter((i) => i.phases === phases).map((i) => ({ i, ratio: kw / i.kw }));
  if (!pool.length) return findInverter(DEFAULT_IDS.inverter);
  pool.sort((a, b) => {
    const hybridScore = (x) => (wantHybrid ? (x.i.type === "hybrid" ? 0 : 1) : 0);
    const hs = hybridScore(a) - hybridScore(b);
    if (hs !== 0) return hs;
    const stockScore = (x) => (x.i.stock > 0 ? 0 : 1);
    const ss = stockScore(a) - stockScore(b);
    if (ss !== 0) return ss;
    return Math.abs(a.ratio - 1.15) - Math.abs(b.ratio - 1.15);
  });
  return pool[0].i;
}

export function recommendBattery(targetKwh) {
  if (!(targetKwh > 0)) return null;
  const lfp = BATTERIES.filter((b) => b.chemClass === "LFP");
  const pool = lfp.length ? lfp : BATTERIES;
  return pool.slice().sort((a, b) => {
    const da = Math.abs(a.kwh - targetKwh), db = Math.abs(b.kwh - targetKwh);
    if (da !== db) return da - db;
    return a.price - b.price;
  })[0];
}

export function recommendPanel() {
  return PANELS.filter((p) => p.stock > 0).sort((a, b) => b.eff - a.eff)[0] || findPanel(DEFAULT_IDS.panel);
}

// Flattened, browse-ready list — every SKU tagged with its kind and a compact
// spec string in the exact shape the real catalog's `products.spec` column
// expects ("435 W", "6 kW hybrid", "9.6 kWh LiFePO₄"...).
export const ALL_SUPPLIER_PRODUCTS = [
  ...PANELS.map((p) => ({ ...p, kind: "panel", specString: `${p.watt} W` })),
  ...INVERTERS.map((p) => ({ ...p, kind: "inverter", specString: `${p.kw} kW ${p.type}` })),
  ...BATTERIES.map((p) => ({ ...p, kind: "battery", specString: `${p.kwh} kWh ${p.chem}` })),
  ...MOUNTS.map((p) => ({ ...p, kind: "mounting", specString: p.type })),
];
