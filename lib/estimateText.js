// lib/estimateText.js — the words of the installer's public estimate page (/estimate/[slug]), in the visitor's
// language. A homeowner reads them, so Romanian is formal ("dumneavoastră") and Russian and Ukrainian use
// "вы/ви". lib/estimateText.test.js holds them to four languages, the same placeholders, and no dashes, middle
// dots or check marks. et(key, lang, { x: "…" }) fills {x}.

const T = {
  title: { en: "How much could you save with solar?", ro: "Cât puteți economisi cu panouri solare?", ru: "Сколько вы можете сэкономить с солнечными панелями?", uk: "Скільки ви можете заощадити із сонячними панелями?" },
  sub: {
    en: "Enter your address and your monthly bill. The estimate uses real sun data for your roof.",
    ro: "Introduceți adresa și factura lunară. Calculul folosește date reale despre soare pentru acoperișul dumneavoastră.",
    ru: "Укажите адрес и месячный счёт. Расчёт использует реальные данные о солнце для вашей крыши.",
    uk: "Вкажіть адресу й місячний рахунок. Розрахунок використовує реальні дані про сонце для вашого даху.",
  },
  addr: { en: "Address", ro: "Adresa", ru: "Адрес", uk: "Адреса" },
  addr_ph: { en: "Street, number, town", ro: "Strada, numărul, localitatea", ru: "Улица, номер, населённый пункт", uk: "Вулиця, номер, населений пункт" },
  by: { en: "I know my", ro: "Știu", ru: "Я знаю", uk: "Я знаю" },
  by_bill: { en: "monthly bill", ro: "factura lunară", ru: "счёт в месяц", uk: "рахунок на місяць" },
  by_kwh: { en: "monthly use", ro: "consumul lunar", ru: "расход в месяц", uk: "споживання на місяць" },
  bill_label: { en: "Monthly bill, {cur}", ro: "Factura lunară, {cur}", ru: "Счёт в месяц, {cur}", uk: "Рахунок на місяць, {cur}" },
  kwh_label: { en: "Monthly use, {unit}", ro: "Consumul lunar, {unit}", ru: "Расход в месяц, {unit}", uk: "Споживання на місяць, {unit}" },
  calc: { en: "Calculate", ro: "Calculează", ru: "Рассчитать", uk: "Розрахувати" },
  calculating: { en: "Calculating...", ro: "Se calculează...", ru: "Считаем...", uk: "Рахуємо..." },
  res_for: { en: "For {place}", ro: "Pentru {place}", ru: "Для: {place}", uk: "Для: {place}" },
  res_kw: { en: "Recommended system", ro: "Sistem recomandat", ru: "Рекомендуемая система", uk: "Рекомендована система" },
  res_prod: { en: "Production per year", ro: "Producție pe an", ru: "Выработка за год", uk: "Виробіток за рік" },
  res_price: { en: "Indicative price", ro: "Preț orientativ", ru: "Ориентировочная цена", uk: "Орієнтовна ціна" },
  res_save: { en: "Saving per month", ro: "Economie pe lună", ru: "Экономия в месяц", uk: "Економія на місяць" },
  res_payback: { en: "Pays for itself in", ro: "Se amortizează în", ru: "Окупается за", uk: "Окупається за" },
  res_monthly: { en: "Estimated monthly payment", ro: "Rată lunară estimată", ru: "Примерный платёж в месяц", uk: "Орієнтовний платіж на місяць" },
  res_monthly_note: { en: "over {y} years at {r}% a year", ro: "pe {y} ani, la {r}% pe an", ru: "на {y} лет под {r}% годовых", uk: "на {y} років під {r}% річних" },
  res_note: {
    en: "An estimate from public sun and tariff data. {co} gives the exact offer after looking at your roof.",
    ro: "O estimare din date publice despre soare și tarife. {co} vă face oferta exactă după ce vede acoperișul.",
    ru: "Оценка по открытым данным о солнце и тарифах. Точное предложение {co} сделает, посмотрев на крышу.",
    uk: "Оцінка за відкритими даними про сонце й тарифи. Точну пропозицію {co} зробить, оглянувши дах.",
  },
  recalc: { en: "Change the address or the bill", ro: "Altă adresă sau factură", ru: "Другой адрес или счёт", uk: "Інша адреса чи рахунок" },
  cta_h: { en: "Get the full proposal from {co}", ro: "Primiți oferta completă de la {co}", ru: "Получите полное предложение от {co}", uk: "Отримайте повну пропозицію від {co}" },
  name: { en: "Your name", ro: "Numele dumneavoastră", ru: "Ваше имя", uk: "Ваше ім’я" },
  phone: { en: "Phone", ro: "Telefon", ru: "Телефон", uk: "Телефон" },
  phone_ph: { en: "069 123 456", ro: "069 123 456", ru: "069 123 456", uk: "069 123 456" },
  email: { en: "Email (optional)", ro: "E-mail (opțional)", ru: "E-mail (необязательно)", uk: "E-mail (необов’язково)" },
  when_q: { en: "When would you like it installed?", ro: "Când doriți montajul?", ru: "Когда хотите установку?", uk: "Коли бажаєте монтаж?" },
  when_now: { en: "As soon as possible", ro: "Cât mai curând", ru: "Как можно скорее", uk: "Якнайшвидше" },
  when_soon: { en: "In the next 3 months", ro: "În următoarele 3 luni", ru: "В ближайшие 3 месяца", uk: "У найближчі 3 місяці" },
  when_later: { en: "Later, just looking", ro: "Mai târziu, mă informez", ru: "Позже, пока узнаю", uk: "Пізніше, поки дізнаюся" },
  fin: { en: "I am interested in paying in instalments", ro: "Mă interesează plata în rate", ru: "Интересует оплата в рассрочку", uk: "Цікавить оплата в розстрочку" },
  msg: { en: "Anything to add (optional)", ro: "Altceva de adăugat (opțional)", ru: "Что-то ещё (необязательно)", uk: "Щось іще (необов’язково)" },
  consent: {
    en: "I agree that {co} may contact me about this proposal and keep my details for it.",
    ro: "Sunt de acord ca {co} să mă contacteze despre această ofertă și să-mi păstreze datele în acest scop.",
    ru: "Я согласен, чтобы {co} связался со мной по этому предложению и хранил мои данные для этого.",
    uk: "Я погоджуюся, щоб {co} зв’язався зі мною щодо цієї пропозиції та зберігав мої дані для цього.",
  },
  privacy: { en: "Privacy policy", ro: "Politica de confidențialitate", ru: "Политика конфиденциальности", uk: "Політика конфіденційності" },
  send: { en: "Send the request", ro: "Trimiteți cererea", ru: "Отправить заявку", uk: "Надіслати заявку" },
  sending: { en: "Sending...", ro: "Se trimite...", ru: "Отправляем...", uk: "Надсилаємо..." },
  thanks_h: { en: "Thank you!", ro: "Mulțumim!", ru: "Спасибо!", uk: "Дякуємо!" },
  thanks: { en: "{co} has your request and will be in touch soon.", ro: "{co} a primit cererea și vă contactează în curând.", ru: "{co} получил вашу заявку и скоро свяжется с вами.", uk: "{co} отримав вашу заявку й незабаром зв’яжеться з вами." },
  err_address: { en: "Enter the address.", ro: "Introduceți adresa.", ru: "Укажите адрес.", uk: "Вкажіть адресу." },
  err_not_found: { en: "We could not find that address. Add the town.", ro: "Nu am găsit adresa. Adăugați localitatea.", ru: "Не удалось найти адрес. Добавьте населённый пункт.", uk: "Не вдалося знайти адресу. Додайте населений пункт." },
  err_rate: { en: "Too many tries. Please wait a minute.", ro: "Prea multe încercări. Așteptați un minut.", ru: "Слишком много попыток. Подождите минуту.", uk: "Забагато спроб. Зачекайте хвилину." },
  err_upstream: { en: "The sun data service is busy. Please try again.", ro: "Serviciul de date solare e ocupat. Încercați din nou.", ru: "Сервис данных о солнце занят. Попробуйте ещё раз.", uk: "Сервіс даних про сонце зайнятий. Спробуйте ще раз." },
  err_name: { en: "Write your name.", ro: "Scrieți numele.", ru: "Напишите имя.", uk: "Напишіть ім’я." },
  err_phone: { en: "Write a phone number from {country}, for example {example}.", ro: "Scrieți un număr de telefon din {country}, de exemplu {example}.", ru: "Укажите номер телефона ({country}), например {example}.", uk: "Вкажіть номер телефону ({country}), наприклад {example}." },
  err_email: { en: "That email does not look right.", ro: "Adresa de e-mail nu pare corectă.", ru: "Адрес e-mail выглядит неверно.", uk: "Адреса e-mail виглядає неправильно." },
  err_consent: { en: "Tick the agreement so we can send your request.", ro: "Bifați acordul ca să putem trimite cererea.", ru: "Отметьте согласие, чтобы мы могли отправить заявку.", uk: "Позначте згоду, щоб ми могли надіслати заявку." },
  err_captcha: { en: "Please confirm you are not a robot.", ro: "Confirmați că nu sunteți robot.", ru: "Подтвердите, что вы не робот.", uk: "Підтвердьте, що ви не робот." },
  err: { en: "The request could not be sent. Please try again.", ro: "Cererea nu s-a putut trimite. Încercați din nou.", ru: "Не удалось отправить заявку. Попробуйте ещё раз.", uk: "Не вдалося надіслати заявку. Спробуйте ще раз." },
  country_MD: { en: "Moldova", ro: "Moldova", ru: "Молдова", uk: "Молдова" },
  country_RO: { en: "Romania", ro: "România", ru: "Румыния", uk: "Румунія" },
  country_UA: { en: "Ukraine", ro: "Ucraina", ru: "Украина", uk: "Україна" },
  powered: { en: "Calculated with VoltMira", ro: "Calculat cu VoltMira", ru: "Рассчитано в VoltMira", uk: "Розраховано у VoltMira" },
};

export const ET = T;

export function et(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.ro) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** A local phone written the usual way, per market, for the hint. */
export const PHONE_EXAMPLE = { MD: "069 123 456", RO: "0721 234 567", UA: "050 123 4567" };
