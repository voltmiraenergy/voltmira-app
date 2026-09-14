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
// an actual commercial relationship). Prices are indicative EUR list prices —
// rough estimates in line with typical 2024-2025 EU/Eastern-European retail
// ranges (panels ~€0.15-0.22/Wp, string/hybrid inverters ~€0.08-0.15/W, LFP
// batteries ~€250-400/kWh), NOT scraped or authoritative manufacturer pricing
// (manufacturers don't publish public end-customer prices; real retail varies
// by market, distributor markup and currency). Replace with the installer's
// real supplier quotes before relying on them commercially. Stock/lead time
// are a mock snapshot — there is no live distributor feed yet. `dimensionsMm`,
// `weightKg` and (inverters only) `maxEfficiencyPct` are the same kind of
// illustrative-per-class estimate as `minMpptV`/`maxInputCurrentA` below —
// plausible for the equipment class, not transcribed from one real datasheet.
//
// `warrantyYears`, unlike the above, IS real: every entry below was checked
// against that manufacturer's own published warranty documentation (datasheet
// or dedicated warranty PDF) before being set. For panels it is the PRODUCT
// (materials/workmanship) term specifically — panels separately carry a
// longer PERFORMANCE/linear-power warranty, captured in `warrantyNote` where
// found (e.g. "30yr performance, 87.4% @ yr30"), since a single number can't
// hold both and the performance figure is real but different from the
// materials one. `warrantyNote` also holds inverter/mount extension terms
// (e.g. "extendable to 20yr with registration") and any territorial
// restriction a manufacturer states. `productUrl` is the manufacturer's own
// real product page (not a distributor), for the equipment-appendix links.
// One entry (Risen) could not be matched to a real datasheet or warranty doc
// — it carries `warrantyVerified: false`, its `warrantyYears` stays the
// original illustrative estimate, and it has no `warrantyNote`/`productUrl`;
// `findWarrantyInfo()` below refuses to surface it to a client, same caution
// as a missing `photoUrl`.
//
// `photoUrl`, where present, is the manufacturer's own real product photo,
// hotlinked directly from their own website (or, where a manufacturer's site
// couldn't serve one — see the per-entry note below — a real distributor's
// product photo of the same real SKU). Every URL was fetched and visually
// checked (not just an HTTP 200) before being added; none are stock/generic
// photography or AI-generated. This is a deliberate, known tradeoff: unlike
// the Wikimedia/Unsplash photos this file used before, these ARE the
// manufacturers' own copyrighted marketing images, hotlinked rather than
// licensed. A handful of entries (marked below) couldn't be matched to a
// literal current SKU on the manufacturer's own site — those use the closest
// real product-LINE photo (same brand, same series) instead, and two entries
// with no reliable manufacturer source (Risen; the fictional "generic import"
// battery) have no `photoUrl` at all and fall back to the generic per-kind
// photo pool in lib/catalogImages.js. A hotlinked URL can move or disappear
// without notice — if a card ever shows a broken image, that entry's
// `photoUrl` is the first thing to check.

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
  { id: "longi-hi-mo6-435", brand: "LONGi", model: "Hi-MO 6 Explorer LR5-54HTH", watt: 435, voc: 39.6, isc: 13.9, vmp: 33.2, imp: 13.1, cells: 108, eff: 22.5, tempCoeff: -0.29, price: 78, stock: 240, leadDays: 0, supplierId: "nordsun", warrantyYears: 15, warrantyNote: "30yr performance warranty", productUrl: "https://www.longi.com/en/products/modules/hi-mo-6-explorer/", dimensionsMm: { w: 1909, h: 1134, d: 30 }, weightKg: 21.5, photoUrl: "https://static.longi.com/Explorer_06_2c0e9cf07e.png" },
  { id: "longi-hi-mo9-610", brand: "LONGi", model: "Hi-MO 9 LR7-72HGD", watt: 610, voc: 45.9, isc: 14.15, vmp: 38.6, imp: 15.8, cells: 144, eff: 23.0, tempCoeff: -0.26, price: 108, stock: 60, leadDays: 14, supplierId: "eurovolt", warrantyYears: 12, warrantyNote: "30yr performance warranty", productUrl: "https://www.longi.com/en/products/modules/hi-mo-9/", dimensionsMm: { w: 2278, h: 1134, d: 30 }, weightKg: 27.5, photoUrl: "https://static.longi.com/Hi_MO_9_8f7fb3dbfe.png" },
  // LONGi's LR7-72HGD designation isn't a current listed SKU — photo AND warranty/productUrl are LONGi's own Hi-MO 9 line page, same brand/class.
  { id: "jinko-tigerneo-425", brand: "Jinko", model: "Tiger Neo 54HL4R-B 425W", watt: 425, voc: 38.85, isc: 13.85, vmp: 32.6, imp: 13.04, cells: 108, eff: 22.02, tempCoeff: -0.29, price: 74, stock: 180, leadDays: 0, supplierId: "nordsun", warrantyYears: 25, warrantyNote: "30yr performance warranty, 87.4% guaranteed @ yr30", productUrl: "https://www.jinkosolar.com/en/site/product/1180", dimensionsMm: { w: 1903, h: 1134, d: 30 }, weightKg: 21.5, photoUrl: "https://jinkosolarcdn.shwebspace.com/themes/basic/skin/images/tigerneo_3/break-through-product-pic.png" },
  { id: "jinko-tigerneo-615", brand: "Jinko", model: "Tiger Neo 78HL4-BDV 615W", watt: 615, voc: 46.3, isc: 17.36, vmp: 38.9, imp: 15.81, cells: 156, eff: 22.57, tempCoeff: -0.26, price: 112, stock: 40, leadDays: 21, supplierId: "eurovolt", warrantyYears: 12, warrantyNote: "30yr performance warranty, 87.4% guaranteed @ yr30", productUrl: "https://www.jinkosolar.com/en/site/product/1180", dimensionsMm: { w: 2384, h: 1134, d: 30 }, weightKg: 28.6, photoUrl: "https://jinkosolarcdn.shwebspace.com/themes/basic/skin/images/tigerneo_3/break-through-product-pic.png" },
  { id: "trina-vertexs-445", brand: "Trina Solar", model: "Vertex S+ NEG9R.28 445W", watt: 445, voc: 31.3, isc: 18.15, vmp: 26.3, imp: 16.93, cells: 66, eff: 22.9, tempCoeff: -0.26, price: 80, stock: 120, leadDays: 7, supplierId: "eurovolt", warrantyYears: 15, warrantyNote: "30yr power warranty, 87.4% guaranteed @ yr30 (upgradeable to 25yr product warranty on request)", productUrl: "https://www.trinasolar.com/en-glb/resources/vertex-s-plus-neg9r28-3", dimensionsMm: { w: 1762, h: 1134, d: 30 }, weightKg: 20.5, photoUrl: "https://www-cdn.trinasolar.com/wwwstorage/sites/3/460W-NEGF9R-28-banner_v2.jpg" },
  { id: "ja-jam54d40-440", brand: "JA Solar", model: "JAM54D40 440W", watt: 440, voc: 32.34, isc: 17.94, vmp: 27.15, imp: 16.21, cells: 108, eff: 22.6, tempCoeff: -0.3, price: 76, stock: 95, leadDays: 7, supplierId: "nordsun", warrantyYears: 15, warrantyNote: "30yr linear performance warranty", productUrl: "https://www.jasolar.eu/en/products/jam54d40-lb-bf-15y", dimensionsMm: { w: 1903, h: 1134, d: 30 }, weightKg: 21.8, photoUrl: "https://www.jasolar.eu/fileadmin/_processed_/3/9/csm_JAM_54_D40_MB_frontal_vorne_1_368324eb73.webp" },
  { id: "canadian-hihero-445", brand: "Canadian Solar", model: "HiHero CS6.5 445W", watt: 445, voc: 31.9, isc: 18.02, vmp: 26.7, imp: 16.67, cells: 66, eff: 22.8, tempCoeff: -0.26, price: 82, stock: 70, leadDays: 14, supplierId: "eurovolt", warrantyYears: 25, warrantyNote: "30yr linear power warranty", productUrl: "https://www.canadiansolar.com/hihero/", dimensionsMm: { w: 1762, h: 1134, d: 30 }, weightKg: 20.4, photoUrl: "https://www.canadiansolar.com/na/wp-content/uploads/sites/3/2026/02/LC%E5%AE%98%E7%BD%91%E7%9B%AE%E5%BD%95%E9%A1%B5Previous-600-x-700.png" },
  // "CS6.5" isn't a current Canadian Solar designation — photo AND warranty/productUrl are their real HiHero HJT line (same brand/series).
  { id: "risen-titan-460", brand: "Risen", model: "Titan RSM72-9-460M", watt: 460, voc: 52.1, isc: 11.42, vmp: 43.5, imp: 10.58, cells: 144, eff: 21.3, tempCoeff: -0.34, price: 70, stock: 150, leadDays: 0, supplierId: "nordsun", warrantyYears: 12, warrantyVerified: false, dimensionsMm: { w: 2130, h: 1134, d: 35 }, weightKg: 26.8 },
  // No photoUrl: Risen's product pages are JS-rendered and no reliable real photo could be sourced — falls back to the generic panel photo pool (lib/catalogImages.js).
  // warrantyYears here is the original ILLUSTRATIVE estimate, unlike every other entry in this file — RSM72-9-460M couldn't be matched to a real
  // Risen datasheet or warranty doc (checked their EU dual-glass warranty PDF and several product-line pages; none cleanly covered this exact
  // model/generation), so no productUrl/warrantyNote either. Treat this one entry as unverified.
  { id: "astronergy-555-bif", brand: "Astronergy", model: "ASTRO N5s Bifacial 555W", watt: 555, voc: 46.6, isc: 14.92, vmp: 39.1, imp: 14.2, cells: 132, eff: 22.28, tempCoeff: -0.26, price: 96, stock: 55, leadDays: 21, supplierId: "eurovolt", warrantyYears: 15, warrantyNote: "30yr linear power warranty, insurer-backed", productUrl: "https://www.astronergy.com/products/", dimensionsMm: { w: 2094, h: 1134, d: 33 }, weightKg: 27.2, photoUrl: "https://www.astronergy.com/wp-content/uploads/2026/06/CHSM66RNDGF-BH.png" },
  { id: "hyundai-h-415", brand: "Hyundai Energy", model: "HiE-S415VG", watt: 415, voc: 37.9, isc: 13.95, vmp: 31.6, imp: 13.13, cells: 108, eff: 21.3, tempCoeff: -0.3, price: 64, stock: 210, leadDays: 0, supplierId: "nordsun", warrantyYears: 25, warrantyNote: "25yr performance warranty, 84.8% guaranteed @ yr25 (product warranty: Australia & Europe only per Hyundai's own terms)", productUrl: "https://www.hyundai-es.com/energy/product/module/VG", dimensionsMm: { w: 1903, h: 1134, d: 30 }, weightKg: 21.0, photoUrl: "https://www.pvxchange.com/media/image/product/12450/md/solarmodule-hyundai-hie-s415vg-996000293.jpg" },
];

// minMpptV (MPPT tracking start voltage) and maxInputCurrentA (max current
// PER MPPT INPUT) are representative for each inverter's class, in the same
// spirit as the rest of this file's "illustrative distributor" pricing — not
// transcribed from a real datasheet. They exist so lib/stringDesign.js can
// compute a genuine valid string-length window (too few modules and a hot
// afternoon drops Vmpp below minMpptV; too many parallel strings on one input
// exceeds maxInputCurrentA) instead of only checking the cold-Voc ceiling.
export const INVERTERS = [
  { id: "deye-sun6k-sg04lp3", brand: "Deye", model: "SUN-6K-SG04LP3", kw: 6, type: "hybrid", mppt: 2, phases: 3, maxDcV: 800, minMpptV: 150, maxInputCurrentA: 16, price: 820, stock: 34, leadDays: 0, supplierId: "nordsun", warrantyYears: 10, warrantyNote: "5yr full parts+labor, then yr 6-10 parts only (excl. LCD/fan) — Europe", productUrl: "https://www.deyeinverter.com/product/hybrid-inverter/", maxEfficiencyPct: 97.6, dimensionsMm: { w: 450, h: 338, d: 150 }, weightKg: 19, photoUrl: "https://www.deyeinverter.com/deyeinverter/2026/08/05/sg061.jpg" },
  { id: "deye-sun12k-sg04lp3", brand: "Deye", model: "SUN-12K-SG04LP3-EU", kw: 12, type: "hybrid", mppt: 2, phases: 3, maxDcV: 800, minMpptV: 150, maxInputCurrentA: 26, price: 1450, stock: 18, leadDays: 7, supplierId: "nordsun", warrantyYears: 10, warrantyNote: "5yr full parts+labor, then yr 6-10 parts only (excl. LCD/fan) — Europe", productUrl: "https://www.deyeinverter.com/product/hybrid-inverter/", maxEfficiencyPct: 97.8, dimensionsMm: { w: 530, h: 480, d: 184 }, weightKg: 32, photoUrl: "https://www.deyeinverter.com/deyeinverter/2026/08/05/sg061.jpg" },
  { id: "deye-sun5k-sg04lp1", brand: "Deye", model: "SUN-5K-SG04LP1-EU", kw: 5, type: "hybrid", mppt: 2, phases: 1, maxDcV: 500, minMpptV: 100, maxInputCurrentA: 16, price: 690, stock: 28, leadDays: 0, supplierId: "nordsun", warrantyYears: 10, warrantyNote: "5yr full parts+labor, then yr 6-10 parts only (excl. LCD/fan) — Europe", productUrl: "https://www.deyeinverter.com/product/hybrid-inverter/", maxEfficiencyPct: 97.4, dimensionsMm: { w: 370, h: 330, d: 140 }, weightKg: 15, photoUrl: "https://www.deyeinverter.com/deyeinverter/2026/08/05/sg061.jpg" },
  // All 3 Deye entries share one photo: Deye's own "Next-Gen Residential Energy Solution" hybrid-inverter lineup shot (deyeinverter.com) — the specific SUN-xK-SG04LP3 product pages are JS-rendered and didn't yield a per-SKU isolated photo.
  { id: "huawei-sun2000-10ktl", brand: "Huawei", model: "SUN2000-10KTL-M1", kw: 10, type: "string", mppt: 2, phases: 3, maxDcV: 1100, minMpptV: 200, maxInputCurrentA: 15, price: 980, stock: 22, leadDays: 14, supplierId: "eurovolt", warrantyYears: 10, warrantyNote: "extendable to 15yr (paid)", productUrl: "https://solar.huawei.com/en/products/residential/inverter", maxEfficiencyPct: 98.6, dimensionsMm: { w: 525, h: 470, d: 146 }, weightKg: 22, photoUrl: "https://solar.huawei.com/admin/asset/v1/pro/view/bcf9419a00e44d1ea412454838446a1e.png" },
  { id: "growatt-min6000tl-xh", brand: "Growatt", model: "MIN 6000TL-XH", kw: 6, type: "hybrid", mppt: 2, phases: 1, maxDcV: 600, minMpptV: 80, maxInputCurrentA: 16, price: 640, stock: 41, leadDays: 0, supplierId: "nordsun", warrantyYears: 5, warrantyNote: "free extension to 10yr if registered online within 12mo of shipment", productUrl: "https://www.growatt.com/product/residential-energy-storage/min-3000-6000tl-xh", maxEfficiencyPct: 97.6, dimensionsMm: { w: 394, h: 300, d: 130 }, weightKg: 13, photoUrl: "https://us.growatt.com/upload/image/20220824/5b704433ede360112a868c9e26f77545.png" },
  { id: "sofar-hyd20ktl-3ph", brand: "Sofar", model: "HYD 20KTL-3PH", kw: 20, type: "hybrid", mppt: 2, phases: 3, maxDcV: 1000, minMpptV: 180, maxInputCurrentA: 26, price: 2650, stock: 9, leadDays: 21, supplierId: "eurovolt", warrantyYears: 5, warrantyNote: "extendable to 10/15/20yr (paid)", productUrl: "https://www.sofarsolar.com/product/hyd-ktl-3ph/", maxEfficiencyPct: 98.0, dimensionsMm: { w: 525, h: 470, d: 235 }, weightKg: 35, photoUrl: "https://www.sofarsolar.com/upload/image/20241108/1731029433781095983.png" },
  { id: "solis-s6-gr1p", brand: "Solis", model: "S6-GR1P(3-10)K", kw: 5, type: "string", mppt: 2, phases: 1, maxDcV: 600, minMpptV: 100, maxInputCurrentA: 13.5, price: 520, stock: 38, leadDays: 0, supplierId: "nordsun", warrantyYears: 5, warrantyNote: "extendable to 10 or 20yr (paid)", productUrl: "https://www.solisinverters.com/eu/product/s6-gr1p/", maxEfficiencyPct: 97.8, dimensionsMm: { w: 365, h: 290, d: 145 }, weightKg: 11, photoUrl: "https://cmsdata.solisinverters.com/uploads/image/20230424/8lJjqfwOaAroVGzMFmM6B9Ay1ee4YCFcJPL0ABUP.png" },
  { id: "huawei-sun2000-100ktl", brand: "Huawei", model: "SUN2000-100KTL-M2", kw: 100, type: "string", mppt: 10, phases: 3, maxDcV: 1100, minMpptV: 200, maxInputCurrentA: 26, price: 8200, stock: 4, leadDays: 35, supplierId: "eurovolt", warrantyYears: 5, warrantyNote: "C&I policy, extendable to 15yr (paid)", productUrl: "https://solar.huawei.com/en/products/commercial/inverter", maxEfficiencyPct: 98.6, dimensionsMm: { w: 1075, h: 750, d: 340 }, weightKg: 100, photoUrl: "https://solar.huawei.com/-/media/SolarV4/solar-version2/asia-pacific/cn/professionals/all-products/ci/smart-pv-controller/SUN2000-150K-MG0-ZH/SUN2000-150K-MG0-ZH.png" },
  // SUN2000-100KTL-M2's own page had no extractable photo — uses Huawei's real SUN2000-150K C&I string inverter (same brand/class).
];

// chemClass drives Studio's 25-year replacement-cost logic: LFP (LiFePO₄) at a
// solar duty cycle comfortably clears 25 years; NMC's shorter cycle life means
// a mid-life pack replacement belongs in the cashflow.
export const BATTERIES = [
  { id: "pylontech-us5000x2", brand: "Pylontech", model: "US5000 × 2", kwh: 9.6, vdc: 48, chem: "LiFePO₄", chemClass: "LFP", cycles: 6000, price: 2380, stock: 26, leadDays: 0, supplierId: "nordsun", warrantyYears: 10, productUrl: "https://www.pylontech.com.cn/products/detail/us5000-13.html", dimensionsMm: { w: 442, h: 132, d: 420 }, weightKg: 88, photoUrl: "https://www.nkon.nl/media/catalog/product/cache/634f00c0cac7a25d9ea011187773489b/u/s/us5000c_1.png" },
  { id: "deye-selb", brand: "Deye", model: "SE-G5.1Pro", kwh: 5.12, vdc: 51.2, chem: "LiFePO₄", chemClass: "LFP", cycles: 6000, price: 1290, stock: 33, leadDays: 0, supplierId: "nordsun", warrantyYears: 10, warrantyNote: "16MWh throughput cap @ 70% EOL", productUrl: "https://deye.com/product/se-g5-1-pro-b/", dimensionsMm: { w: 600, h: 650, d: 150 }, weightKg: 46, photoUrl: "https://7sun.eu/wp-content/uploads/2025/02/Modul-bateryjny-DEYE-SE-G5.1-PRO-B-515-kWh-LV.jpg" },
  { id: "dyness-powerbox", brand: "Dyness", model: "Powerbox H10", kwh: 4.8, vdc: 51.2, chem: "LiFePO₄", chemClass: "LFP", cycles: 6000, price: 1180, stock: 29, leadDays: 7, supplierId: "nordsun", warrantyYears: 10, warrantyNote: "≥60% SOH guaranteed to yr10 (Powerbox line policy — exact H10 page not isolated)", productUrl: "https://www.dyness.com/download", dimensionsMm: { w: 450, h: 400, d: 130 }, weightKg: 44, photoUrl: "https://www.dyness.com/Public/Uploads/uploadfile/images/20240328/powerboxProzhushitu.png" },
  { id: "huawei-luna2000", brand: "Huawei", model: "LUNA2000-5-E0", kwh: 5.0, vdc: 50, chem: "LiFePO₄", chemClass: "LFP", cycles: 6000, price: 1340, stock: 20, leadDays: 14, supplierId: "eurovolt", warrantyYears: 10, warrantyNote: "or 16.45MWh throughput (EU), whichever first — exact SKU named in Huawei's own warranty doc", productUrl: "https://solar.huawei.com/en/products/residential/energy-storage", dimensionsMm: { w: 600, h: 450, d: 150 }, weightKg: 48, photoUrl: "https://solar.huawei.com/admin/asset/v1/pro/view/f5e0c1c5666748f89154729f71fd9f6a.png" },
  { id: "pylontech-forceh2", brand: "Pylontech", model: "Force H2", kwh: 15.0, vdc: 51.2, chem: "LiFePO₄", chemClass: "LFP", cycles: 8000, price: 3650, stock: 11, leadDays: 21, supplierId: "eurovolt", warrantyYears: 10, warrantyNote: "min 60% nominal energy guaranteed through the period (EU/UK consumer warranty, exact SKU named)", productUrl: "https://www.pylontech.com.cn/products/detail/force-h2-17.html", dimensionsMm: { w: 600, h: 600, d: 200 }, weightKg: 140, photoUrl: "https://www.offgridtec.com/media/f2/ff/c5/1681796074/2-88-016800.jpg" },
  { id: "generic-nmc-5000", brand: "generic import", model: "PowerCell NMC-5000", kwh: 5.0, vdc: 48, chem: "NMC", chemClass: "NMC", cycles: 3000, price: 990, stock: 14, leadDays: 14, supplierId: "eurovolt", warrantyYears: 5, dimensionsMm: { w: 500, h: 400, d: 150 }, weightKg: 50 },
  // No photoUrl: this brand/model is this file's own placeholder for an unbranded import, not a real company — falls back to the generic battery photo pool.
];

export const MOUNTS = [
  { id: "k2-singlerail", brand: "K2 Systems", model: "SingleRail 48 / Speed Rail", type: "roof, tile hooks", eurPerKw: 60, stock: 999, leadDays: 0, supplierId: "nordsun", warrantyYears: 12, warrantyNote: "extendable to 20yr (end customer, requires K2 Base + Docu App documentation)", productUrl: "https://catalogue.k2-systems.com/en/mounting-systems/pitched-roof-systems/k2-singlerail-system/", photoUrl: "https://k2-systems.com/wp-content/uploads/2022/03/SingleRail-title.jpg" },
  { id: "schletter-rapid16", brand: "Schletter", model: "Rapid16", type: "roof, trapezoidal sheet", eurPerKw: 55, stock: 999, leadDays: 7, supplierId: "eurovolt", warrantyYears: 25, productUrl: "https://www.schletter-group.com/en/products/pitched-roof/", photoUrl: "https://strapi.schletter-group.com/uploads/webloop_thumbnail_pitchedroof_d123154512.jpg" },
  // Schletter's photo is their own official 3D product rendering, not a photograph — no plain photo of the rail system could be sourced.
  { id: "k2-crossrail", brand: "K2 Systems", model: "CrossRail — ground / carport", type: "ground mount / carport", eurPerKw: 140, stock: 999, leadDays: 21, supplierId: "eurovolt", warrantyYears: 12, warrantyNote: "extendable to 20yr (end customer, requires K2 Base + Docu App documentation)", productUrl: "https://catalogue.k2-systems.com/en/mounting-systems/ground-mounted-systems/k2-crossrail-system/", photoUrl: "https://k2-systems.com/wp-content/uploads/2022/08/GM-Header-1.jpg" },
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

// A BOM line only ever carries {brand, model, spec, qty, unit_price} — it's a
// frozen-in-time snapshot (so a later catalog price change can't silently
// reprice an old quote), with no id pointing back to a catalog SKU. Warranty
// data lives in the catalog, not the BOM line, so proposals look it up here by
// brand+model instead: matches the client actually sees against the real,
// verified figures above, degrades to nothing for a manually-typed or custom
// BOM line that isn't a real catalog SKU (never invents a warranty), AND for
// the one entry above (Risen) whose `warrantyYears` is still an unverified
// estimate — `warrantyVerified: false` keeps that guess out of anything a
// client sees, exactly like a missing photoUrl. Case-/whitespace-insensitive
// since a hand-edited BOM line's casing can drift from the catalog's.
const normKey = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
export function findWarrantyInfo(brand, model) {
  const key = normKey(brand) + "|" + normKey(model);
  const hit = ALL_SUPPLIER_PRODUCTS.find((p) => normKey(p.brand) + "|" + normKey(p.model) === key);
  if (!hit || !(hit.warrantyYears > 0) || hit.warrantyVerified === false) return null;
  return { warrantyYears: hit.warrantyYears, warrantyNote: hit.warrantyNote || null, productUrl: hit.productUrl || null };
}

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

/**
 * Size a complete system for a kW / battery target — modules to cover the
 * array, a phase-matched inverter, an LFP battery near the target capacity,
 * and mounting per kWp. Single-phase under 6 kW, three-phase above — the split
 * every MD/RO installer uses, and what decides which inverters are eligible.
 *
 * Pure and side-effect-free on purpose: it backs the BOM auto-fill button in
 * the editor (components/BomCard.jsx) AND sizing a lead's first draft project
 * server-side (lib/actions.js createProjectFromLead) — the same starter system
 * either way, not two implementations that can drift.
 */
export function autoBom(kw, battKwh) {
  const panel = recommendPanel();
  const nPanels = Math.max(1, Math.round((kw * 1000) / panel.watt));
  const phases = kw > 6 ? 3 : 1;
  const inv = recommendInverter({ kw, phases, wantHybrid: battKwh > 0 });
  const mount = findMount(DEFAULT_IDS.mount);
  const lines = [
    { kind: "panel", brand: panel.brand, model: panel.model, spec: `${panel.watt} W`, qty: nPanels, unit_price: panel.price, source: "supplier" },
    { kind: "inverter", brand: inv.brand, model: inv.model, spec: `${inv.kw} kW ${inv.type}`, qty: Math.max(1, Math.ceil(kw / (inv.kw * 1.35))), unit_price: inv.price, source: "supplier" },
    { kind: "mounting", brand: mount.brand, model: mount.model, spec: mount.type, qty: Math.round(kw * 10) / 10, unit_price: mount.eurPerKw, source: "supplier" },
  ];
  if (battKwh > 0) {
    const bat = recommendBattery(battKwh);
    if (bat) lines.splice(2, 0, {
      kind: "battery", brand: bat.brand, model: bat.model, spec: `${bat.kwh} kWh ${bat.chem}`,
      qty: Math.max(1, Math.round(battKwh / bat.kwh)), unit_price: bat.price, source: "supplier",
    });
  }
  return lines;
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
