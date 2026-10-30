// lib/clientUpdate.js — the monthly note an installer sends a client about their system (Viber, WhatsApp),
// written in the client's language and in the formal voice. Its point is the weather: when a month had less
// sun than usual at the address (lib/sunshine.js, NASA POWER), a lower production is said to be expected and
// fine; when the sun was normal, or the system made less than even that sky allowed, the client is told the
// installer will check it. Used by /service (app/(app)/service/ServiceView.jsx) and Studio's monitor. Pure.
import { THRESH } from "./fleetHealth.js";

export const MONTHS_LONG = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ro: ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"],
  ru: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  uk: ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"],
};
const LOC = { ro: "ro-RO", ru: "ru-RU", uk: "uk-UA", en: "en-IE" };
// below this share of a usual month's sun, a month counts as cloudy enough to explain a lower production
export const CLOUDY = 0.9;

function money(v, lang, market) {
  if (market === "UA") return { ro: "grivne", en: "UAH", ru: "грн", uk: "грн" }[lang];
  if (lang === "ru") { const f = new Intl.PluralRules("ru").select(v); return f === "one" ? "лей" : f === "few" ? "лея" : "леев"; }
  if (lang === "uk") { const f = new Intl.PluralRules("uk").select(v); return f === "one" ? "лей" : f === "few" ? "леї" : "леїв"; }
  return "lei";
}

/**
 * What the month says, before any words: the share of a usual month made, the sun against usual, and the verdict.
 * @param {{ kwh: number|null, expected: number, sun?: number|null }} m  expected is the quote's P50 for a usual month
 * @returns {{ kind: "nodata"|"ok"|"cloudy"|"low"|"low_cloudy"|"low_sunny", pc: number|null, sunLess: number|null }}
 */
export function monthVerdict({ kwh, expected, sun = null }) {
  if (kwh == null || !(expected > 0)) return { kind: "nodata", pc: null, sunLess: null };
  const pc = Math.round((kwh / expected) * 100);
  const s = sun != null && sun > 0 ? sun : null;
  const fair = kwh / (expected * (s ?? 1));   // against what this month's sky allowed
  const sunLess = s != null ? Math.round((1 - s) * 100) : null;
  if (fair < THRESH.watch) return { kind: s == null ? "low" : s < CLOUDY ? "low_cloudy" : "low_sunny", pc, sunLess };
  return { kind: s != null && s < CLOUDY ? "cloudy" : "ok", pc, sunLess };
}

/**
 * The message itself.
 * @param {object} a
 * @param {"ro"|"ru"|"uk"|"en"} a.lang
 * @param {number} a.kw
 * @param {boolean} [a.pending]  live, but no whole month yet
 * @param {number} a.month  0-based month the figures are for
 * @param {number|null} a.kwh  what it made that month (null: no reading)
 * @param {number} a.expected  the quote's estimate for a usual such month
 * @param {number|null} [a.sun]  that month's sun against the usual one at the address (1 = usual)
 * @param {{ month: number, ytd: number }|null} [a.saved]  savings in local money, when known
 * @param {string} [a.market]
 */
export function clientUpdate({ lang = "ro", kw, pending = false, month, kwh, expected, sun = null, saved = null, market = "MD" }) {
  const L = MONTHS_LONG[lang] ? lang : "ro";
  const loc = LOC[L];
  const n = (v) => Math.round(v).toLocaleString(loc);
  const kwTx = (+kw || 0).toLocaleString(loc, { maximumFractionDigits: 1 });
  const M = MONTHS_LONG[L][month] || "";
  const cur = (v) => money(Math.round(v), L, market);

  if (pending) {
    return {
      ro: `Bună ziua! Sistemul dvs. solar de ${kwTx} kW funcționează. Primul raport lunar vi-l trimitem după prima lună întreagă de producție.`,
      ru: `Здравствуйте! Ваша солнечная станция ${kwTx} кВт работает. Первый ежемесячный отчёт пришлём после первого полного месяца выработки.`,
      uk: `Добрий день! Ваша сонячна станція ${kwTx} кВт працює. Перший щомісячний звіт надішлемо після першого повного місяця генерації.`,
      en: `Hello! Your ${kwTx} kW solar system is up and running. We will send your first monthly report after its first full month of production.`,
    }[L];
  }
  const v = monthVerdict({ kwh, expected, sun });
  if (v.kind === "nodata") {
    return {
      ro: `Bună ziua! Nu am primit datele de producție pentru ${M} de la sistemul dvs. solar de ${kwTx} kW. Ne puteți trimite o captură de ecran din aplicația invertorului? Durează un minut și ne ajută să verificăm că totul funcționează corect.`,
      ru: `Здравствуйте! Мы не получили данные о выработке вашей солнечной станции ${kwTx} кВт за ${M}. Пришлите, пожалуйста, скриншот из приложения инвертора: это займёт минуту и поможет нам убедиться, что всё работает правильно.`,
      uk: `Добрий день! Ми не отримали даних про генерацію вашої сонячної станції ${kwTx} кВт за ${M}. Надішліть, будь ласка, скриншот із застосунку інвертора: це займе хвилину й допоможе нам переконатися, що все працює правильно.`,
      en: `Hello! We have not received the production figures for ${M} from your ${kwTx} kW solar system. Could you send us a screenshot from the inverter app? It takes a minute and lets us check everything is working properly.`,
    }[L];
  }

  const head = {
    ro: `Bună ziua! Raportul lunar al sistemului dvs. solar de ${kwTx} kW.\n\nÎn ${M} a produs ${n(kwh)} kWh, adică ${v.pc}% din estimarea noastră pentru o lună obișnuită.`,
    ru: `Здравствуйте! Ежемесячный отчёт по вашей солнечной станции ${kwTx} кВт.\n\nЗа ${M} она выработала ${n(kwh)} кВт·ч, это ${v.pc}% от нашего расчёта для обычного месяца.`,
    uk: `Добрий день! Щомісячний звіт щодо вашої сонячної станції ${kwTx} кВт.\n\nЗа ${M} вона згенерувала ${n(kwh)} кВт·год, це ${v.pc}% від нашого розрахунку для звичайного місяця.`,
    en: `Hello! Here is the monthly report for your ${kwTx} kW solar system.\n\nIn ${M} it produced ${n(kwh)} kWh, ${v.pc}% of our estimate for a usual month.`,
  }[L];
  const d = v.sunLess;
  const why = {
    ok: {
      ro: " Sistemul funcționează normal.", ru: " Система работает нормально.", uk: " Система працює нормально.", en: " The system is working normally.",
    },
    cloudy: {
      ro: ` Luna a avut cu ${d}% mai puțin soare decât de obicei la adresa dvs. (date din satelit), așa că o producție mai mică este de așteptat. Sistemul funcționează corect.`,
      ru: ` В этом месяце у вас было на ${d}% меньше солнца, чем обычно (спутниковые данные), поэтому меньшая выработка ожидаема. Система работает правильно.`,
      uk: ` Цього місяця у вас було на ${d}% менше сонця, ніж зазвичай (супутникові дані), тому менша генерація очікувана. Система працює правильно.`,
      en: ` The month had ${d}% less sun than usual at your address (satellite data), so a lower production is expected. The system is working properly.`,
    },
    low: {
      ro: " Este mai puțin decât ar trebui, așa că vă contactăm în zilele următoare pentru o verificare.",
      ru: " Это меньше, чем должно быть, поэтому в ближайшие дни мы свяжемся с вами, чтобы проверить систему.",
      uk: " Це менше, ніж має бути, тому найближчими днями ми зв’яжемося з вами, щоб перевірити систему.",
      en: " That is less than it should be, so we will be in touch in the next few days to check the system.",
    },
    low_cloudy: {
      ro: ` Luna a avut cu ${d}% mai puțin soare decât de obicei, dar sistemul a produs mai puțin chiar și decât permitea vremea, așa că vă contactăm în zilele următoare pentru o verificare.`,
      ru: ` Солнца было на ${d}% меньше обычного, но система выработала меньше, чем позволяла даже такая погода, поэтому в ближайшие дни мы свяжемся с вами, чтобы проверить её.`,
      uk: ` Сонця було на ${d}% менше звичайного, але система згенерувала менше, ніж дозволяла навіть така погода, тому найближчими днями ми зв’яжемося з вами, щоб її перевірити.`,
      en: ` The month had ${d}% less sun than usual, but the system made less than even that weather allowed, so we will be in touch in the next few days to check it.`,
    },
    low_sunny: {
      ro: " Soarele a fost la nivelul obișnuit, deci producția ar fi trebuit să fie mai mare. Vă contactăm în zilele următoare pentru o verificare.",
      ru: " Солнца было как обычно, значит, выработка должна была быть выше. В ближайшие дни мы свяжемся с вами, чтобы проверить систему.",
      uk: " Сонця було як зазвичай, отже генерація мала бути вищою. Найближчими днями ми зв’яжемося з вами, щоб перевірити систему.",
      en: " The sun was at its usual level, so production should have been higher. We will be in touch in the next few days to check the system.",
    },
  }[v.kind][L];
  const save = saved && saved.ytd > 0 ? {
    ro: `\n\nEconomie estimată: ~${n(saved.month)} ${cur(saved.month)} în ${M} și ~${n(saved.ytd)} ${cur(saved.ytd)} de la începutul anului.`,
    ru: `\n\nПримерная экономия: ~${n(saved.month)} ${cur(saved.month)} за ${M} и ~${n(saved.ytd)} ${cur(saved.ytd)} с начала года.`,
    uk: `\n\nОрієнтовна економія: ~${n(saved.month)} ${cur(saved.month)} за ${M} і ~${n(saved.ytd)} ${cur(saved.ytd)} з початку року.`,
    en: `\n\nEstimated savings: ~${n(saved.month)} ${cur(saved.month)} in ${M} and ~${n(saved.ytd)} ${cur(saved.ytd)} so far this year.`,
  }[L] : "";
  const end = { ro: "\n\nDacă aveți întrebări, scrieți-ne oricând.", ru: "\n\nЕсли есть вопросы, пишите в любое время.", uk: "\n\nЯкщо є запитання, пишіть будь-коли.", en: "\n\nAny questions, just message us." }[L];
  return head + why + save + end;
}
