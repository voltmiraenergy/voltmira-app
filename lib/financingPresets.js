// lib/financingPresets.js — starting points for the finance assumptions of a
// portfolio. Every number here is an EDITABLE ASSUMPTION, never a quote: bank
// terms and state programmes change, and a business-loan scheme's terms differ
// by borrower and by equipment. Each preset says where its figures come from
// and when, or says plainly that it is a placeholder to replace with a term
// sheet. The UI shows that note beside the preset and never hides it.
//
// status:
//   "placeholder"  a round number to start from; replace with the bank's terms
//   "published"    taken from a published programme description (see `source`),
//                  to be confirmed with the bank before use
import { DEFAULT_FINANCE } from "./projectFinance.js";

export const FINANCING_PRESETS = [
  {
    id: "commercial_eur",
    markets: ["MD", "UA"],
    status: "placeholder",
    fin: { ...DEFAULT_FINANCE, gearingPct: 70, ratePct: 8, tenorYears: 10, debtCurrency: "EUR" },
    name: { en: "Bank loan in EUR", ro: "Credit bancar în EUR", ru: "Банковский кредит в EUR", uk: "Банківський кредит в EUR" },
    note: {
      en: "A round-number starting point: 70% debt, 8%, 10 years. Replace it with the bank's term sheet.",
      ro: "Un punct de pornire rotund: 70% datorie, 8%, 10 ani. Înlocuiește-l cu oferta băncii.",
      ru: "Круглые цифры для старта: 70% долга, 8%, 10 лет. Замените их условиями банка.",
      uk: "Круглі цифри для старту: 70% боргу, 8%, 10 років. Замініть їх умовами банку.",
    },
  },
  {
    id: "commercial_local_md",
    markets: ["MD"],
    status: "placeholder",
    fin: { ...DEFAULT_FINANCE, gearingPct: 65, ratePct: 12, tenorYears: 7, debtCurrency: "local" },
    name: { en: "Bank loan in lei", ro: "Credit bancar în lei", ru: "Банковский кредит в леях", uk: "Банківський кредит в леях" },
    note: {
      en: "A loan in lei hedges the revenue against a falling leu, at a higher rate. 65%, 12%, 7 years are placeholders.",
      ro: "Un credit în lei acoperă venitul împotriva scăderii leului, la o dobândă mai mare. 65%, 12%, 7 ani sunt valori provizorii.",
      ru: "Кредит в леях хеджирует выручку от падения лея, но дороже. 65%, 12%, 7 лет: ориентировочные значения.",
      uk: "Кредит у леях хеджує виручку від падіння лея, але дорожчий. 65%, 12%, 7 років: орієнтовні значення.",
    },
  },
  {
    id: "commercial_local_ua",
    markets: ["UA"],
    status: "placeholder",
    fin: { ...DEFAULT_FINANCE, gearingPct: 60, ratePct: 16, tenorYears: 5, debtCurrency: "local" },
    name: { en: "Bank loan in hryvnia", ro: "Credit bancar în grivne", ru: "Банковский кредит в гривнах", uk: "Банківський кредит у гривнях" },
    note: {
      en: "A hryvnia loan hedges the revenue but costs more. 60%, 16%, 5 years are placeholders.",
      ro: "Un credit în grivne acoperă venitul, dar costă mai mult. 60%, 16%, 5 ani sunt valori provizorii.",
      ru: "Кредит в гривнах хеджирует выручку, но дороже. 60%, 16%, 5 лет: ориентировочные значения.",
      uk: "Кредит у гривнях хеджує виручку, але дорожчий. 60%, 16%, 5 років: орієнтовні значення.",
    },
  },
  {
    id: "ua_579",
    markets: ["UA"],
    status: "published",
    fin: { ...DEFAULT_FINANCE, gearingPct: 70, ratePct: 9, rateSteps: [0, 5, 7], tenorYears: 3, debtCurrency: "local" },
    source: {
      label: "Економічна правда, 17.03.2026",
      url: "https://epravda.com.ua/energetika/yak-otrimati-pilgoviy-kredit-na-generatori-ta-sonyachni-paneli-u-2026-roczi-819303/",
    },
    name: { en: "State-subsidised loan (5-7-9 family)", ro: "Credit subvenționat de stat (familia 5-7-9)", ru: "Госкредит с субсидией (семейство 5-7-9)", uk: "Державний пільговий кредит (родина 5-7-9)" },
    note: {
      en: "Rate 0% in year 1, 5% in year 2, 7% in year 3, then the bank's rate; up to 3 years; loan cap 10 million UAH (as published on 17 March 2026). That source lists generators and gas units for the business tier; other sources include solar and a longer term. Confirm what your equipment and borrower qualify for with the bank.",
      ro: "Dobândă 0% în anul 1, 5% în anul 2, 7% în anul 3, apoi dobânda băncii; până la 3 ani; plafon 10 milioane UAH (publicat la 17 martie 2026). Sursa listează generatoare și unități pe gaz pentru segmentul de afaceri; alte surse includ solarul și un termen mai lung. Confirmă cu banca ce se aplică echipamentului și beneficiarului tău.",
      ru: "Ставка 0% в 1-й год, 5% во 2-й, 7% в 3-й, затем ставка банка; срок до 3 лет; лимит кредита 10 млн грн (по публикации от 17 марта 2026). Этот источник называет для бизнеса генераторы и газовые установки; другие источники включают солнечные станции и более долгий срок. Уточните в банке, что подходит вашему оборудованию и заёмщику.",
      uk: "Ставка 0% у 1-й рік, 5% у 2-й, 7% у 3-й, далі ставка банку; строк до 3 років; ліміт кредиту 10 млн грн (за публікацією від 17 березня 2026). Це джерело називає для бізнесу генератори та газові установки; інші джерела включають сонячні станції та довший строк. Уточніть у банку, що підходить вашому обладнанню та позичальнику.",
    },
  },
  {
    id: "ua_greendim",
    markets: ["UA"],
    status: "published",
    // 70% of the cost, up to 2 million UAH (the low end of the 2-4 million range)
    fin: { ...DEFAULT_FINANCE, gearingPct: 0, grantPct: 70, grantCapUah: 2_000_000 },
    source: {
      label: "ZAXID.NET, 2026",
      url: "https://zaxid.net/v_ukrayini_pochali_priymati_zayavki_na_kompensatsiyu_vitrat_na_generatori_i_sonyachni_paneli_n1630770",
    },
    name: { en: "GreenDIM grant (housing associations)", ro: "Grant GreenDIM (asociații de locatari)", ru: "Грант ГрінДІМ (ОСББ)", uk: "Грант ГрінДІМ (ОСББ)" },
    note: {
      en: "For housing associations (OSBB): 70% of the cost of solar plus storage, 2 to 4 million UAH depending on the building's area (rules changed on 18 February 2026). The cap here is the low end, 2 million UAH. The association's board decision is required.",
      ro: "Pentru asociații de proprietari (OSBB): 70% din costul solarului cu stocare, 2-4 milioane UAH în funcție de suprafața clădirii (regulile s-au schimbat la 18 februarie 2026). Plafonul de aici e limita de jos, 2 milioane UAH. E nevoie de decizia consiliului asociației.",
      ru: "Для ОСББ: 70% стоимости солнечной станции с накопителем, от 2 до 4 млн грн в зависимости от площади дома (правила изменились 18 февраля 2026). Лимит здесь нижняя граница, 2 млн грн. Нужно решение правления ОСББ.",
      uk: "Для ОСББ: 70% вартості сонячної станції з накопичувачем, від 2 до 4 млн грн залежно від площі будинку (правила змінилися 18 лютого 2026). Ліміт тут нижня межа, 2 млн грн. Потрібне рішення правління ОСББ.",
    },
  },
];

/** Presets for a market, placeholders first. */
export function presetsFor(market) {
  return FINANCING_PRESETS.filter((p) => p.markets.includes(market));
}

/**
 * A preset's finance object with its UAH grant cap converted to EUR at the
 * given rate (UAH per EUR).
 */
export function presetFinance(preset, uahPerEur) {
  const { grantCapUah, ...fin } = preset.fin;
  const rate = Number(uahPerEur) > 0 ? Number(uahPerEur) : 51;
  return grantCapUah ? { ...fin, grantCapEur: Math.round(grantCapUah / rate) } : { ...fin };
}
