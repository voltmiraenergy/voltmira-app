// lib/offerTerms.js — the fine print of a client's offer (app/p/[code]/PrintSheet.jsx): what the price includes and
// leaves out (the installer's own lists, Settings, kept in the calculation settings so each offer freezes the ones it
// was sent with), the warranties of the equipment actually quoted (only what the supplier catalog verified, never a
// guess), whether a battery can be added later, the app the client watches production in, the payment stages and the
// loan example. Pure: no I/O.
import { findSupplierProduct } from "./supplierCatalog.js";
import { scheduleOf } from "./milestones.js";

const L4 = (en, ro, ru, uk) => ({ en, ro, ru, uk });
const pick = (o, lang) => o[lang] || o.ro || o.en;

/** The standard turnkey scope in Moldova: the starting lists an installer reviews in Settings. */
export const DEFAULT_INCLUDE = [
  L4("System design and the panel layout on the roof", "Proiectarea sistemului și amplasarea panourilor pe acoperiș", "Проект системы и раскладка панелей на крыше", "Проєкт системи й розкладка панелей на даху"),
  L4("The mounting structure, with every roof fixing sealed against water", "Structura de montaj, cu etanșarea fiecărui punct de prindere în acoperiș", "Монтажная конструкция с герметизацией каждого крепления в кровле", "Монтажна конструкція з герметизацією кожного кріплення в покрівлі"),
  L4("DC and AC cables, surge protection, fuses, breakers and the protection board", "Cablurile DC și AC, protecția la supratensiune, siguranțele, întrerupătoarele și tabloul de protecții", "Кабели DC и AC, защита от перенапряжения, предохранители, автоматы и щит защиты", "Кабелі DC і AC, захист від перенапруги, запобіжники, автомати й щит захисту"),
  L4("Delivery, installation, commissioning and showing you the monitoring app", "Transportul, montajul, punerea în funcțiune și instruirea pentru aplicația de monitorizare", "Доставка, монтаж, ввод в эксплуатацию и обучение работе с приложением", "Доставка, монтаж, введення в експлуатацію та навчання роботі з застосунком"),
  L4("The grid connection file and the paperwork with the operator (Premier Energy or RED Nord)", "Dosarul de racordare și actele cu operatorul de distribuție (Premier Energy sau RED Nord)", "Пакет документов на подключение и работа с оператором (Premier Energy или RED Nord)", "Пакет документів на приєднання та робота з оператором (Premier Energy або RED Nord)"),
];
export const DEFAULT_EXCLUDE = [
  L4("Strengthening the roof structure, if it is needed", "Consolidarea structurii acoperișului, dacă e necesară", "Усиление конструкции крыши, если нужно", "Посилення конструкції даху, якщо потрібно"),
  L4("Scaffolding, if the roof requires it", "Schela, dacă acoperișul o cere", "Строительные леса, если они нужны для крыши", "Риштування, якщо воно потрібне для даху"),
  L4("Trenches for underground cables", "Săpăturile pentru cabluri îngropate", "Траншеи для подземных кабелей", "Траншеї для підземних кабелів"),
  L4("Cutting trees or branches that shade the panels", "Tăierea copacilor sau a crengilor care umbresc panourile", "Спил деревьев или веток, затеняющих панели", "Зрізання дерев або гілок, що затінюють панелі"),
  L4("Local permits (town hall), if they are required", "Autorizațiile locale (primăria), dacă sunt cerute", "Местные разрешения (примэрия), если они требуются", "Місцеві дозволи (мерія), якщо вони потрібні"),
  L4("The operator's own fees for the connection and the meter, if any", "Taxele proprii ale operatorului pentru racordare și contor, dacă există", "Собственные сборы оператора за подключение и счётчик, если есть", "Власні збори оператора за приєднання й лічильник, якщо є"),
];

const cleanList = (v) => (Array.isArray(v) ? v : [])
  .map((s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 200)).filter(Boolean).slice(0, 15);

/** The installer's lists as saved (engine.offerTerms), cleaned; null when never saved. */
export function cleanOfferTerms(raw) {
  if (!raw || typeof raw !== "object") return null;
  return { include: cleanList(raw.include), exclude: cleanList(raw.exclude) };
}

/** The lists an offer shows: the installer's when saved, else the standard ones in the offer's language. */
export function termsFor(raw, lang = "ro") {
  const t = cleanOfferTerms(raw);
  if (t && (t.include.length || t.exclude.length)) return { ...t, standard: false };
  return { include: DEFAULT_INCLUDE.map((x) => pick(x, lang)), exclude: DEFAULT_EXCLUDE.map((x) => pick(x, lang)), standard: true };
}

/** The catalog's record for a quoted line, by its exact brand and model (null for a hand-typed product). */
export const productOf = (line) => (line?.brand && line?.model ? findSupplierProduct(line.brand, line.model) : null);

// "30yr performance warranty, 87.4% guaranteed @ yr30" -> { years: 30, pct: 87.4, pctYear: 30 }
export function performanceOf(note) {
  const m = /(\d{2})\s*yr\s*(?:linear\s*)?(?:performance|power)/i.exec(String(note || ""));
  if (!m) return null;
  const p = /(\d{2}(?:\.\d)?)\s*%\s*(?:guaranteed\s*)?@\s*yr\s*(\d{2})/i.exec(String(note || ""));
  return { years: Number(m[1]), pct: p ? Number(p[1]) : null, pctYear: p ? Number(p[2]) : null };
}

// an inverter's or a mount's extension: "free extension to 10yr ...", "extendable to 10/15/20yr (paid)"
export function extensionOf(note) {
  const s = String(note || "");
  const m = /exten\w*\s+to\s+([\d/]+)\s*yr/i.exec(s);
  if (!m) return null;
  const years = m[1].split("/").map(Number).filter((n) => n > 0);
  return { years: Math.max(...years), paid: /paid/i.test(s), free: /free/i.test(s) };
}

const W = {
  panel: L4("Panels, product", "Panouri, produs", "Панели, изделие", "Панелі, виріб"),
  perf: L4("Panels, power", "Panouri, putere", "Панели, мощность", "Панелі, потужність"),
  inverter: L4("Inverter", "Invertor", "Инвертор", "Інвертор"),
  battery: L4("Battery", "Baterie", "Батарея", "Батарея"),
  mounting: L4("Mounting structure", "Structura de montaj", "Монтажная конструкция", "Монтажна конструкція"),
  install: L4("Installation work", "Lucrările de montaj", "Монтажные работы", "Монтажні роботи"),
};
const Y = L4("{n} years", "{n} ani", "{n} лет", "{n} років");
const PERF = L4("{n} years, at least {p}% of the power in year {y}", "{n} ani, cel puțin {p}% din putere în anul {y}", "{n} лет, не менее {p}% мощности на {y}-й год", "{n} років, щонайменше {p}% потужності на {y}-й рік");
const EXT_FREE = L4("extendable free of charge to {n} years", "extensibilă gratuit la {n} ani", "бесплатно продлевается до {n} лет", "безкоштовно продовжується до {n} років");
const EXT_PAID = L4("extendable for a fee to {n} years", "extensibilă contra cost la {n} ani", "продлевается за плату до {n} лет", "продовжується за плату до {n} років");
const EXT = L4("extendable to {n} years", "extensibilă la {n} ani", "продлевается до {n} лет", "продовжується до {n} років");
const fill = (s, v) => Object.entries(v).reduce((t, [k, x]) => t.split("{" + k + "}").join(String(x)), s);

/**
 * The warranties of what is quoted, one row each: [what, how long, the maker]. Only lines the catalog verified
 * (findSupplierProduct, warrantyVerified), and the installer's own workmanship warranty from Settings.
 */
export function warrantyRows(bom, { installYears = 0, company = "", lang = "ro" } = {}) {
  const rows = [];
  const seen = new Set();
  for (const line of Array.isArray(bom) ? bom : []) {
    const kind = line?.kind;
    if (!W[kind] || seen.has(kind) || !(Number(line.qty) > 0)) continue;
    const p = productOf(line);
    if (!p || !(p.warrantyYears > 0) || p.warrantyVerified === false) continue;
    seen.add(kind);
    const maker = [p.brand, p.model].join(" ");
    let years = fill(pick(Y, lang), { n: p.warrantyYears });
    const ext = kind !== "panel" ? extensionOf(p.warrantyNote) : null;
    if (ext && ext.years > p.warrantyYears) years += ", " + fill(pick(ext.free ? EXT_FREE : ext.paid ? EXT_PAID : EXT, lang), { n: ext.years });
    rows.push([pick(W[kind], lang), years, maker]);
    if (kind === "panel") {
      const perf = performanceOf(p.warrantyNote);
      if (perf) rows.push([pick(W.perf, lang), perf.pct ? fill(pick(PERF, lang), { n: perf.years, y: perf.pctYear, p: String(perf.pct).replace(".", lang === "en" ? "." : ",") }) : fill(pick(Y, lang), { n: perf.years }), maker]);
    }
  }
  if (Number(installYears) > 0) rows.push([pick(W.install, lang), fill(pick(Y, lang), { n: Number(installYears) }), company]);
  return rows;
}

// the maker's own monitoring app, for the inverter brands whose app name is certain
const APPS = { huawei: "FusionSolar", deye: "SOLARMAN", growatt: "ShinePhone", sungrow: "iSolarCloud", goodwe: "SEMS Portal", sma: "Sunny Portal", solaredge: "mySolarEdge", solis: "SolisCloud", fronius: "Solar.web" };
/** The inverter line of the quote and what it tells the client: battery later, and where to watch production. */
export function inverterFacts(bom) {
  const line = (Array.isArray(bom) ? bom : []).find((l) => l?.kind === "inverter" && Number(l.qty) > 0);
  if (!line) return null;
  const p = productOf(line);
  const type = p?.type || (/hybrid|hibrid/i.test(String(line.spec || "")) ? "hybrid" : null);
  return {
    brand: line.brand || p?.brand || "",
    hybrid: type === "hybrid" ? true : type === "string" ? false : null,
    app: APPS[String(line.brand || p?.brand || "").toLowerCase().replace(/\s+/g, "")] || null,
    phases: p?.phases || null,
  };
}

/** The payment stages: the job's own, else the workspace's, else the default 50 / 40 / 10. */
export const paymentStages = (...schedules) => scheduleOf(...schedules).steps;
