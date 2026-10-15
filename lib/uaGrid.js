// lib/uaGrid.js — Ukraine's grid-connection file for a household on the green
// tariff: which regional distribution company (oblenergo) a roof belongs to,
// the stages the file goes through, and when a stage has waited long enough
// to call. The Moldovan file (lib/mdGrid.js) has the same shape; GridFile.jsx
// and the dashboard pick one by the quote's market.
//
// How it runs for a household (2026): the system is installed first, then a
// notice with the equipment certificates and a single-line diagram goes to
// the universal-service supplier; the distribution company fits a two-way
// meter; the green-tariff sale contract is signed; payments follow monthly
// (by the 15th of the next month). `chaseAfter` is a working rule of thumb for
// when to call, not a legal deadline.
// Pure; no I/O.

// One distribution company per oblast (Kyiv city and Kyiv oblast are two).
// Proper names, the same in every interface language.
export const UA_OPERATORS = {
  dtek_kyiv: { id: "dtek_kyiv", name: "ДТЕК Київські електромережі", short: "ДТЕК Київські електромережі" },
  dtek_kyiv_reg: { id: "dtek_kyiv_reg", name: "ДТЕК Київські регіональні електромережі", short: "ДТЕК Київські регіональні" },
  dtek_odesa: { id: "dtek_odesa", name: "ДТЕК Одеські електромережі", short: "ДТЕК Одеські електромережі" },
  dtek_dnipro: { id: "dtek_dnipro", name: "ДТЕК Дніпровські електромережі", short: "ДТЕК Дніпровські електромережі" },
  dtek_donetsk: { id: "dtek_donetsk", name: "ДТЕК Донецькі електромережі", short: "ДТЕК Донецькі електромережі" },
  lviv: { id: "lviv", name: "Львівобленерго", short: "Львівобленерго" },
  kharkiv: { id: "kharkiv", name: "Харківобленерго", short: "Харківобленерго" },
  vinnytsia: { id: "vinnytsia", name: "Вінницяобленерго", short: "Вінницяобленерго" },
  volyn: { id: "volyn", name: "Волиньобленерго", short: "Волиньобленерго" },
  zhytomyr: { id: "zhytomyr", name: "Житомиробленерго", short: "Житомиробленерго" },
  zakarpattia: { id: "zakarpattia", name: "Закарпаттяобленерго", short: "Закарпаттяобленерго" },
  zaporizhzhia: { id: "zaporizhzhia", name: "Запоріжжяобленерго", short: "Запоріжжяобленерго" },
  prykarpattia: { id: "prykarpattia", name: "Прикарпаттяобленерго", short: "Прикарпаттяобленерго" },
  kirovohrad: { id: "kirovohrad", name: "Кіровоградобленерго", short: "Кіровоградобленерго" },
  mykolaiv: { id: "mykolaiv", name: "Миколаївобленерго", short: "Миколаївобленерго" },
  poltava: { id: "poltava", name: "Полтаваобленерго", short: "Полтаваобленерго" },
  rivne: { id: "rivne", name: "Рівнеобленерго", short: "Рівнеобленерго" },
  sumy: { id: "sumy", name: "Сумиобленерго", short: "Сумиобленерго" },
  ternopil: { id: "ternopil", name: "Тернопільобленерго", short: "Тернопільобленерго" },
  kherson: { id: "kherson", name: "Херсонобленерго", short: "Херсонобленерго" },
  khmelnytskyi: { id: "khmelnytskyi", name: "Хмельницькобленерго", short: "Хмельницькобленерго" },
  cherkasy: { id: "cherkasy", name: "Черкасиобленерго", short: "Черкасиобленерго" },
  chernivtsi: { id: "chernivtsi", name: "Чернівціобленерго", short: "Чернівціобленерго" },
  chernihiv: { id: "chernihiv", name: "Чернігівобленерго", short: "Чернігівобленерго" },
};

// Words an address uses for each area, in Ukrainian and in transliteration.
// Checked in order, so Kyiv oblast comes before the city it contains.
const AREAS = [
  ["dtek_kyiv_reg", ["київська обл", "київської обл", "kyiv oblast", "kyiv region", "бровар", "бориспіл", "ірпін", "буча", "вишгород", "обухів", "фастів", "біла церква"]],
  ["dtek_kyiv", ["київ", "kyiv", "kiev"]],
  ["dtek_odesa", ["одес", "odes"]],
  ["dtek_dnipro", ["дніпр", "dnipr", "кривий ріг", "kryvyi rih", "кам’янськ", "нікопол"]],
  ["dtek_donetsk", ["донецьк", "donetsk", "краматорськ", "kramatorsk", "слов’янськ", "sloviansk"]],
  ["lviv", ["львів", "lviv"]],
  ["kharkiv", ["харків", "kharkiv"]],
  ["vinnytsia", ["вінниц", "vinnyts"]],
  ["volyn", ["луцьк", "волин", "lutsk", "volyn"]],
  ["zhytomyr", ["житомир", "zhytomyr"]],
  ["zakarpattia", ["ужгород", "закарпат", "мукачев", "uzhhorod", "zakarpat", "mukachev"]],
  ["zaporizhzhia", ["запоріж", "zaporiz"]],
  ["prykarpattia", ["івано-франків", "ivano-frankiv", "прикарпат", "калуш"]],
  ["kirovohrad", ["кропивницьк", "кіровоград", "kropyvnyts"]],
  ["mykolaiv", ["миколаїв", "mykolaiv"]],
  ["poltava", ["полтав", "poltava", "кременчук", "kremenchuk"]],
  ["rivne", ["рівне", "рівненськ", "rivne"]],
  ["sumy", ["суми", "сумськ", "sumy"]],
  ["ternopil", ["тернопіл", "ternopil"]],
  ["kherson", ["херсон", "kherson"]],
  ["khmelnytskyi", ["хмельницьк", "khmelnyts"]],
  ["cherkasy", ["черкас", "cherkas"]],
  ["chernivtsi", ["чернівц", "chernivts"]],
  ["chernihiv", ["чернігів", "chernihiv"]],
];

/** The oblenergo an address most likely belongs to, or null when it names no area. */
export function suggestUaOperator(address) {
  const a = String(address || "").toLowerCase().replace(/['ʼ`]/g, "’");
  for (const [id, words] of AREAS) if (words.some((w) => a.includes(w))) return id;
  return null;
}

/** The stages of a household's green-tariff file, in order. */
export const UA_GRID_STAGES = [
  { id: "ua_installed", chaseAfter: null }, // system installed, certificates collected
  { id: "ua_notice", chaseAfter: null },    // notice + documents handed to the supplier
  { id: "ua_meter", chaseAfter: 14 },       // the distribution company fitted a two-way meter
  { id: "ua_contract", chaseAfter: 14 },    // green-tariff sale contract signed
  { id: "ua_paid", chaseAfter: 45 },        // first green-tariff payment received
];
