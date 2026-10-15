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
// complete: true when every term that matters is published (a grant-only
//   programme, or a loan whose rate is published). A published programme whose
//   loan rate is set per borrower is not complete: its rate is a placeholder,
//   and the readiness score does not count it as sourced terms.
//
// Moldovan presets checked on 2 October 2026 against the programme pages cited.
// Programmes the research found but left out: Casa Verde (CNED/FEERM) pays
// households up to 50% and 200,000 lei, but solar only after insulation and
// windows, so it does not fit a portfolio of plants; the GEFF Moldova grant for
// multi-apartment buildings needs 30% energy savings, which solar alone rarely
// shows.
import { DEFAULT_FINANCE } from "./projectFinance.js";
import { FX } from "@voltmira/engine";

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
    id: "md_eu4business",
    markets: ["MD"],
    status: "published",
    complete: false,
    // the programme: EUR, up to 72 months, a 10% or 15% EU grant on the
    // financing; the rate and the debt share are placeholders
    fin: { ...DEFAULT_FINANCE, gearingPct: 70, ratePct: 8, tenorYears: 6, debtCurrency: "EUR", principalCompensationPct: 10 },
    source: {
      label: "maib, EU4Business (read 2 October 2026)",
      url: "https://www.maib.md/en/persoane-juridice/resurse-internationale/eu4business",
    },
    alsoSee: { label: "EU4Business-EBRD Credit Line", url: "https://www.eu4business-ebrdcreditline.md/" },
    name: { en: "EU4Business-EBRD credit line (10% EU grant)", ro: "Linia de credit EU4Business-BERD (grant UE 10%)", ru: "Кредитная линия EU4Business-ЕБРР (грант ЕС 10%)", uk: "Кредитна лінія EU4Business-ЄБРР (грант ЄС 10%)" },
    note: {
      en: "Through maib: a loan in EUR of up to EUR 3 million for up to 72 months, covering up to 100% of the project cost without VAT, with an EU grant of 10% or 15% of the financing depending on the project's complexity and its fit with EU requirements. Renewable-energy projects are eligible. Here the grant is the lower 10%, set against the loan after year 1. The bank sets the rate per borrower, so 8% and the 70% debt share are placeholders.",
      ro: "Prin maib: un credit în EUR de până la 3 milioane EUR pe până la 72 de luni, care acoperă până la 100% din costul proiectului fără TVA, cu un grant UE de 10% sau 15% din finanțare, în funcție de complexitatea proiectului și de conformitatea cu cerințele UE. Proiectele de energie regenerabilă sunt eligibile. Aici grantul este cel mai mic, 10%, scăzut din credit după anul 1. Banca stabilește dobânda pentru fiecare client, deci 8% și ponderea datoriei de 70% sunt valori provizorii.",
      ru: "Через maib: кредит в EUR до 3 млн EUR на срок до 72 месяцев, до 100% стоимости проекта без НДС, с грантом ЕС 10% или 15% от суммы финансирования в зависимости от сложности проекта и соответствия требованиям ЕС. Проекты возобновляемой энергетики подходят. Здесь грант взят по нижней ставке 10% и засчитывается в погашение кредита после 1-го года. Ставку банк определяет для каждого заёмщика, поэтому 8% и доля долга 70% ориентировочные.",
      uk: "Через maib: кредит у EUR до 3 млн EUR на строк до 72 місяців, до 100% вартості проєкту без ПДВ, з грантом ЄС 10% або 15% від суми фінансування залежно від складності проєкту та відповідності вимогам ЄС. Проєкти відновлюваної енергетики підходять. Тут грант узято за нижньою ставкою 10% і зараховано в погашення кредиту після 1-го року. Ставку банк визначає для кожного позичальника, тому 8% і частка боргу 70% орієнтовні.",
    },
  },
  {
    id: "md_geff_homes",
    markets: ["MD"],
    status: "published",
    complete: false,
    fin: { ...DEFAULT_FINANCE, gearingPct: 70, ratePct: 10, tenorYears: 5, debtCurrency: "local", grantPct: 22.5 },
    source: {
      label: "GEFF Moldova, grant support (read 2 October 2026)",
      url: "https://ebrdgeff.com/moldova/grant-support/",
    },
    alsoSee: { label: "GEFF Moldova, financing partners", url: "https://ebrdgeff.com/moldova/financing/" },
    name: { en: "GEFF Moldova for homes (up to 22.5% grant)", ro: "GEFF Moldova pentru locuințe (grant până la 22,5%)", ru: "GEFF Молдова для жилья (грант до 22,5%)", uk: "GEFF Молдова для житла (грант до 22,5%)" },
    note: {
      en: "Residential GEFF Moldova (EBRD, with EU and Norway support): a homeowner who takes a green loan from a partner bank (maib or OTP Bank) can receive a grant of up to 22.5% of eligible costs, photovoltaic systems included, after verification. The 22.5% applies to homeowners only. The bank sets the loan's rate, term and currency: 10% for 5 years in lei are placeholders.",
      ro: "GEFF Moldova pentru sectorul rezidențial (BERD, cu sprijinul UE și al Norvegiei): proprietarul unei locuințe care ia un credit verde de la o bancă parteneră (maib sau OTP Bank) poate primi un grant de până la 22,5% din costurile eligibile, inclusiv pentru sisteme fotovoltaice, după verificare. Cei 22,5% se aplică doar proprietarilor de locuințe. Banca stabilește dobânda, durata și moneda creditului: 10% pe 5 ani în lei sunt valori provizorii.",
      ru: "GEFF Молдова для жилого сектора (ЕБРР при поддержке ЕС и Норвегии): владелец жилья, взявший зелёный кредит в банке-партнёре (maib или OTP Bank), может получить грант до 22,5% приемлемых затрат, включая фотоэлектрические системы, после проверки. 22,5% положены только владельцам жилья. Ставку, срок и валюту кредита определяет банк: 10% на 5 лет в леях ориентировочные.",
      uk: "GEFF Молдова для житлового сектору (ЄБРР за підтримки ЄС і Норвегії): власник житла, який узяв зелений кредит у банку-партнері (maib або OTP Bank), може отримати грант до 22,5% прийнятних витрат, включно з фотоелектричними системами, після перевірки. 22,5% надають лише власникам житла. Ставку, строк і валюту кредиту визначає банк: 10% на 5 років у леях орієнтовні.",
    },
  },
  {
    id: "md_oda_ee",
    markets: ["MD"],
    status: "published",
    complete: true,
    fin: { ...DEFAULT_FINANCE, gearingPct: 0, grantPct: 50, grantCapMdl: 1_500_000 },
    source: {
      label: "ODA, 9 August 2022",
      url: "https://www.oda.md/ro/media-page/presa/comunicate-de-presa/granturi-pentru-retehnologizare-si-eficienta-energetica",
    },
    alsoSee: { label: "ODA, 29 December 2025", url: "https://oda.md/ro/media-page/presa/comunicate-de-presa/guvernul-a-aprobat-semnarea-unui-acord-de-grant-pentru-eficienta-energetica-a-imm-urilor" },
    name: { en: "ODA energy-efficiency grant for SMEs (50%)", ro: "Grant ODA pentru eficiență energetică, IMM (50%)", ru: "Грант ODA на энергоэффективность для МСП (50%)", uk: "Грант ODA на енергоефективність для МСП (50%)" },
    note: {
      en: "ODA's energy-efficiency grant for small and medium firms: 50% of the eligible investment, at most 1.5 million lei, photovoltaic panels included, for equipment that cuts energy use by at least 15%. The firm must be at least 2 years old and at least 75% owned by citizens of Moldova. A round funded by Germany and Switzerland through GIZ, up to 1.5 million lei per firm, ran until 30 September 2026. Check with ODA whether a call is open now. No loan is included: add one for the rest if needed.",
      ro: "Grantul ODA pentru eficiență energetică al IMM-urilor: 50% din investiția eligibilă, cel mult 1,5 milioane lei, inclusiv panouri fotovoltaice, pentru echipamente care reduc consumul de energie cu cel puțin 15%. Firma trebuie să activeze de cel puțin 2 ani și să fie deținută în proporție de cel puțin 75% de cetățeni ai Republicii Moldova. O rundă finanțată de Germania și Elveția prin GIZ, de până la 1,5 milioane lei per firmă, s-a desfășurat până la 30 septembrie 2026. Verifică la ODA dacă există acum un apel deschis. Creditul nu e inclus: adaugă unul pentru rest, dacă e nevoie.",
      ru: "Грант ODA на энергоэффективность для малых и средних предприятий: 50% приемлемых инвестиций, не более 1,5 млн леев, включая фотоэлектрические панели, на оборудование, которое снижает потребление энергии минимум на 15%. Предприятию должно быть не меньше 2 лет, и не менее 75% должно принадлежать гражданам Молдовы. Раунд, финансируемый Германией и Швейцарией через GIZ, до 1,5 млн леев на предприятие, шёл до 30 сентября 2026 года. Уточните в ODA, открыт ли сейчас приём заявок. Кредит не включён: при необходимости добавьте его на остаток.",
      uk: "Грант ODA на енергоефективність для малих і середніх підприємств: 50% прийнятних інвестицій, не більше 1,5 млн леїв, включно з фотоелектричними панелями, на обладнання, яке знижує споживання енергії щонайменше на 15%. Підприємству має бути не менше 2 років, і щонайменше 75% має належати громадянам Молдови. Раунд, який фінансували Німеччина та Швейцарія через GIZ, до 1,5 млн леїв на підприємство, тривав до 30 вересня 2026 року. Уточніть в ODA, чи відкрито зараз прийом заявок. Кредит не включено: за потреби додайте його на решту.",
    },
  },
  {
    id: "ua_579",
    markets: ["UA"],
    status: "published",
    complete: true,
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
    complete: true,
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
 * A preset's finance object with its UAH or MDL grant cap converted to EUR at
 * the given rates (local currency per EUR), rounded to whole EUR.
 */
export function presetFinance(preset, uahPerEur, mdlPerEur) {
  const { grantCapUah, grantCapMdl, ...fin } = preset.fin;
  const uah = Number(uahPerEur) > 0 ? Number(uahPerEur) : FX.UAH;
  const mdl = Number(mdlPerEur) > 0 ? Number(mdlPerEur) : FX.MDL;
  if (grantCapUah) return { ...fin, grantCapEur: Math.round(grantCapUah / uah) };
  if (grantCapMdl) return { ...fin, grantCapEur: Math.round(grantCapMdl / mdl) };
  return { ...fin };
}

/** Terms that a lender can trace: the user says they come from a term sheet, or a complete published preset. */
export function termsSourced(finance) {
  const f = finance && typeof finance === "object" ? finance : {};
  if (f.termSheet === true) return true;
  const p = FINANCING_PRESETS.find((x) => x.id === f.preset);
  return !!(p && p.status === "published" && p.complete);
}
