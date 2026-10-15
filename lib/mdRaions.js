// lib/mdRaions.js — Moldova's first-level areas as VoltMira names them: the
// 32 raioane, the municipalities of Chișinău and Bălți, UTA Găgăuzia, and the
// two areas no Moldovan register covers (Bender and the left bank), each with
// its name in four languages, its resident population and its distribution
// operator. Every source spells these differently (CNED "Ștefan-Vodă", BNS
// "..Stefan Voda", the boundary file "Stefan Voda", addresses "Ștefan Vodă");
// raionId() folds them all to one id.
//
// Population: BNS, resident population at 1 January 2026, table POP010400
// (statbank.statistica.md). The operator follows lib/mdGrid.js: RED Nord in
// Bălți and its northern raioane, Premier Energy Distribution elsewhere.
// Pure; no I/O. Shapes for the map live in lib/data/mdRaionShapes.js.

export const POPULATION_SOURCE = { publisher: "BNS", table: "POP010400", date: "2026-01-01" };

/** [id, ro, ru, uk, population 1 Jan 2026, operator]. null population = no data published for it. */
const ROWS = [
  ["chisinau", "Chișinău", "Кишинёв", "Кишинів", 714488, "premier"],
  ["balti", "Bălți", "Бельцы", "Бєльці", 91307, "rednord"],
  ["anenii-noi", "Anenii Noi", "Анений-Ной", "Анені-Ной", 56391, "premier"],
  ["basarabeasca", "Basarabeasca", "Басарабяска", "Басарабяска", 14784, "premier"],
  ["briceni", "Briceni", "Бричаны", "Бричени", 44828, "rednord"],
  ["cahul", "Cahul", "Кагул", "Кагул", 70877, "premier"],
  ["calarasi", "Călărași", "Кэлэрашь", "Келераш", 43298, "premier"],
  ["cantemir", "Cantemir", "Кантемир", "Кантемир", 32240, "premier"],
  ["causeni", "Căușeni", "Кэушень", "Кеушень", 55985, "premier"],
  ["cimislia", "Cimișlia", "Чимишлия", "Чимішлія", 30446, "premier"],
  ["criuleni", "Criuleni", "Криуляны", "Криулени", 52612, "premier"],
  ["donduseni", "Dondușeni", "Дондюшаны", "Дондюшени", 27086, "rednord"],
  ["drochia", "Drochia", "Дрокия", "Дрокія", 52098, "rednord"],
  ["dubasari", "Dubăsari", "Дубэсарь", "Дубесари", 21408, "premier"],
  ["edinet", "Edineț", "Единец", "Єдинець", 49199, "rednord"],
  ["falesti", "Fălești", "Фэлешть", "Фелешти", 54548, "rednord"],
  ["floresti", "Florești", "Флорешть", "Флорешти", 52343, "rednord"],
  ["glodeni", "Glodeni", "Глодяны", "Глодени", 34656, "rednord"],
  ["hincesti", "Hîncești", "Хынчешть", "Хинчешти", 68929, "premier"],
  ["ialoveni", "Ialoveni", "Яловень", "Яловени", 74930, "premier"],
  ["leova", "Leova", "Леова", "Леова", 28622, "premier"],
  ["nisporeni", "Nisporeni", "Ниспорень", "Ниспорени", 35729, "premier"],
  ["ocnita", "Ocnița", "Окница", "Окниця", 30881, "rednord"],
  ["orhei", "Orhei", "Орхей", "Оргіїв", 77984, "premier"],
  ["rezina", "Rezina", "Резина", "Резина", 29436, "rednord"],
  ["riscani", "Rîșcani", "Рышканы", "Ришкани", 42291, "rednord"],
  ["singerei", "Sîngerei", "Сынжерей", "Синжерей", 55221, "rednord"],
  ["soldanesti", "Șoldănești", "Шолдэнешть", "Шолданешти", 24893, "premier"],
  ["soroca", "Soroca", "Сорока", "Сороки", 56740, "rednord"],
  ["stefan-voda", "Ștefan Vodă", "Штефан-Водэ", "Штефан-Воде", 41313, "premier"],
  ["straseni", "Strășeni", "Стрэшень", "Страшени", 60930, "premier"],
  ["taraclia", "Taraclia", "Тараклия", "Тараклія", 25070, "premier"],
  ["telenesti", "Telenești", "Теленешть", "Теленешти", 40289, "premier"],
  ["ungheni", "Ungheni", "Унгень", "Унгени", 73971, "rednord"],
  ["gagauzia", "UTA Găgăuzia", "АТО Гагаузия", "АТО Гагаузія", 99822, "premier"],
  ["bender", "Bender", "Бендеры", "Бендери", null, null],
  ["transnistria", "Stânga Nistrului", "Левобережье Днестра", "Лівобережжя Дністра", null, null],
];

export const RAIONS = ROWS.map(([id, ro, ru, uk, population, operator]) => ({
  id, name: { ro, en: ro, ru, uk }, population, operator,
  // the two areas no Moldovan register reports on
  covered: population != null,
}));
export const RAION = Object.fromEntries(RAIONS.map((r) => [r.id, r]));
export const COVERED = RAIONS.filter((r) => r.covered);

const ALIAS = {
  gagauzia: "gagauzia", "uta-gagauzia": "gagauzia", "u-t-a-gagauzia": "gagauzia", "ato-gagauzia": "gagauzia",
  "stanga-nistrului": "transnistria", tighina: "bender", "mun-chisinau": "chisinau", "mun-balti": "balti",
};

/** "Ștefan-Vodă", "..Stefan Voda", "SIngerei", "UTA Găgăuzia", "Mun. Chisinau" → one id, or null. */
export function raionId(name) {
  if (!name) return null;
  // "UTA Găgăuzia (Ciadîr-Lunga, Vulcănești, Comrat)": the towns in brackets are not part of the name
  const s = String(name).replace(/\(.*?\)/g, " ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[ţț]/g, "t").replace(/[şș]/g, "s").replace(/î/g, "i").replace(/â/g, "a")
    .replace(/^[.\s]+/, "").replace(/\b(mun|municipiul|raionul|r-nul|r)\.?\s+/g, "")
    .replace(/[^a-z]+/g, "-").replace(/^-+|-+$/g, "");
  if (RAION[s]) return s;
  if (ALIAS[s]) return ALIAS[s];
  const t = s.replace(/^(uta|u-t-a|ato)-/, "");
  return RAION[t] ? t : ALIAS[t] || null;
}

export const raionName = (id, lang = "ro") => RAION[id]?.name[lang] || RAION[id]?.name.ro || id;

// ---------------------------------------------------------------- where a point is

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(lon, lat, poly) {
  if (!inRing(lon, lat, poly[0])) return false;
  for (let k = 1; k < poly.length; k++) if (inRing(lon, lat, poly[k])) return false; // a hole
  return true;
}

/**
 * Which area a position falls in, from the shapes (GeoJSON features with
 * properties.id). Null outside Moldova. Passed in rather than imported so the
 * 100 kB of outlines load only where a map or a lookup needs them.
 */
export function raionAt(lat, lon, shapes) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !shapes) return null;
  for (const f of shapes.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    if (polys.some((p) => inPolygon(lon, lat, p))) return f.properties.id;
  }
  return null;
}

/** The covered areas whose centres lie nearest to one area's centre, nearest first. */
export function nearestRaions(id, centres, n = 5) {
  const c = centres[id];
  if (!c) return [];
  const km = (a, b) => {
    const dLat = (b[0] - a[0]) * 111.2, dLon = (b[1] - a[1]) * 111.2 * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
    return Math.hypot(dLat, dLon);
  };
  return COVERED.filter((r) => r.id !== id && centres[r.id])
    .map((r) => ({ id: r.id, km: km(c, centres[r.id]) }))
    .sort((a, b) => a.km - b.km).slice(0, n);
}
