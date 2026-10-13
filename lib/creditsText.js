// lib/creditsText.js — the words of billing periods and credits in four
// languages: the monthly/yearly switch and the credits panel on Settings, Plan.
// Module-local like lib/cnedText.js; lib/creditsText.test.js holds it to the
// same rules (all four languages, the same placeholders, no dashes, middle
// dots or check marks). Installer copy says "tu" in Romanian.
//
// cr(key, lang, { x: "…" }) fills {x}.

const T = {
  per_month: { en: "Monthly", ro: "Lunar", ru: "Помесячно", uk: "Щомісяця" },
  per_year: { en: "Yearly", ro: "Anual", ru: "На год", uk: "На рік" },
  two_free: { en: "2 months free", ro: "2 luni gratis", ru: "2 месяца в подарок", uk: "2 місяці в подарунок" },
  period_l: { en: "Billing period", ro: "Perioada de plată", ru: "Период оплаты", uk: "Період оплати" },
  pro_month: { en: "Pro, €49 a month", ro: "Pro, 49 € pe lună", ru: "Pro, 49 € в месяц", uk: "Pro, 49 € на місяць" },
  team_month: { en: "Team, €119 a month", ro: "Echipă, 119 € pe lună", ru: "Команда, 119 € в месяц", uk: "Команда, 119 € на місяць" },
  pro_year: { en: "Pro, €490 a year", ro: "Pro, 490 € pe an", ru: "Pro, 490 € в год", uk: "Pro, 490 € на рік" },
  team_year: { en: "Team, €1,190 a year", ro: "Echipă, 1.190 € pe an", ru: "Команда, 1 190 € в год", uk: "Команда, 1 190 € на рік" },
  year_note: {
    en: "Pay for 10 months, use 12. Unlimited offers, tracking, and the first 10 monitored systems free.",
    ro: "Plătești 10 luni, folosești 12. Oferte nelimitate, urmărire și primele 10 sisteme monitorizate gratuit.",
    ru: "Платите за 10 месяцев, пользуетесь 12. Неограниченные КП, отслеживание и первые 10 систем мониторинга бесплатно.",
    uk: "Платите за 10 місяців, користуєтесь 12. Необмежені пропозиції, відстеження і перші 10 систем моніторингу безкоштовно.",
  },
  year_off: {
    en: "Yearly billing is not set up yet.",
    ro: "Plata anuală nu este încă pornită.",
    ru: "Годовая оплата ещё не подключена.",
    uk: "Річна оплата ще не підключена.",
  },

  // ---- the credits panel
  h: { en: "Credits", ro: "Credite", ru: "Кредиты", uk: "Кредити" },
  desc: {
    en: "The free plan sends 5 offers a month. A credit pays for one more offer, or for one filled grid-connection application. Credits last 12 months, and paid plans never need them.",
    ro: "Planul gratuit trimite 5 oferte pe lună. Un credit plătește o ofertă în plus sau o cerere de racordare completată. Creditele sunt valabile 12 luni, iar planurile plătite nu au nevoie de ele.",
    ru: "Бесплатный план отправляет 5 КП в месяц. Кредит оплачивает ещё одно КП или одно заполненное заявление на подключение. Кредиты действуют 12 месяцев, на платных планах они не нужны.",
    uk: "Безкоштовний план надсилає 5 пропозицій на місяць. Кредит оплачує ще одну пропозицію або одну заповнену заяву на підключення. Кредити діють 12 місяців, на платних планах вони не потрібні.",
  },
  balance: { en: "{n} credits left", ro: "Ți-au rămas {n} credite", ru: "Осталось кредитов: {n}", uk: "Залишилось кредитів: {n}" },
  balance_one: { en: "1 credit left", ro: "Ți-a rămas 1 credit", ru: "Остался 1 кредит", uk: "Залишився 1 кредит" },
  sent: { en: "{n} of {max} free offers used this month", ro: "{n} din {max} oferte gratuite folosite luna aceasta", ru: "Использовано бесплатных КП в этом месяце: {n} из {max}", uk: "Використано безкоштовних пропозицій цього місяця: {n} з {max}" },
  pack10: { en: "10 credits, €25", ro: "10 credite, 25 €", ru: "10 кредитов, 25 €", uk: "10 кредитів, 25 €" },
  pack50: { en: "50 credits, €99", ro: "50 de credite, 99 €", ru: "50 кредитов, 99 €", uk: "50 кредитів, 99 €" },
  per_credit: { en: "€2.50 each", ro: "2,50 € bucata", ru: "2,50 € за кредит", uk: "2,50 € за кредит" },
  per_credit_50: { en: "€1.98 each", ro: "1,98 € bucata", ru: "1,98 € за кредит", uk: "1,98 € за кредит" },
  cheaper: {
    en: "More than 10 offers a month costs less on a plan: Pro is unlimited.",
    ro: "Peste 10 oferte pe lună costă mai puțin pe un plan: Pro este nelimitat.",
    ru: "Если КП больше 10 в месяц, выгоднее план: Pro без ограничений.",
    uk: "Якщо пропозицій понад 10 на місяць, вигідніше план: Pro без обмежень.",
  },
  not_set: { en: "Credits are not set up for card payment yet.", ro: "Creditele nu sunt încă pornite pentru plata cu cardul.", ru: "Кредиты пока нельзя оплатить картой.", uk: "Кредити поки що не можна оплатити карткою." },
  off: {
    en: "Credits are not charged yet: every offer and grid file is free for now.",
    ro: "Creditele nu se taxează încă: toate ofertele și cererile de racordare sunt gratuite deocamdată.",
    ru: "Кредиты пока не списываются: все КП и заявления на подключение пока бесплатны.",
    uk: "Кредити поки що не списуються: усі пропозиції і заяви на підключення поки безкоштовні.",
  },
  paid_plan: {
    en: "Your plan includes unlimited offers and the grid file, so you do not need credits.",
    ro: "Planul tău include oferte nelimitate și cererea de racordare, deci nu ai nevoie de credite.",
    ru: "Ваш план включает неограниченные КП и заявление на подключение, кредиты не нужны.",
    uk: "Ваш план включає необмежені пропозиції і заяву на підключення, кредити не потрібні.",
  },
  history: { en: "Recent", ro: "Recent", ru: "Недавно", uk: "Нещодавно" },
  h_purchase: { en: "Bought {n}", ro: "Cumpărate {n}", ru: "Куплено: {n}", uk: "Придбано: {n}" },
  h_offer: { en: "One more offer", ro: "O ofertă în plus", ru: "Ещё одно КП", uk: "Ще одна пропозиція" },
  h_grid_file: { en: "Grid-connection application", ro: "Cerere de racordare", ru: "Заявление на подключение", uk: "Заява на підключення" },
  h_admin: { en: "Added by VoltMira", ro: "Adăugate de VoltMira", ru: "Добавлено VoltMira", uk: "Додано VoltMira" },

  // ---- the banners when something was refused
  need_offers: {
    en: "You have sent your 5 free offers this month. Buy credits to send another, or choose a plan for unlimited offers.",
    ro: "Ai trimis cele 5 oferte gratuite de luna aceasta. Cumpără credite ca să mai trimiți una sau alege un plan cu oferte nelimitate.",
    ru: "Вы отправили 5 бесплатных КП в этом месяце. Купите кредиты, чтобы отправить ещё одно, или выберите план без ограничений.",
    uk: "Ви надіслали 5 безкоштовних пропозицій цього місяця. Купіть кредити, щоб надіслати ще одну, або оберіть план без обмежень.",
  },
  need_grid: {
    en: "The grid-connection application costs one credit on the free plan. Buy credits, or choose a plan that includes it.",
    ro: "Cererea de racordare costă un credit pe planul gratuit. Cumpără credite sau alege un plan care o include.",
    ru: "Заявление на подключение стоит один кредит на бесплатном плане. Купите кредиты или выберите план, где оно включено.",
    uk: "Заява на підключення коштує один кредит на безкоштовному плані. Купіть кредити або оберіть план, де вона включена.",
  },
  bought: {
    en: "Thank you. Your credits appear here within a minute.",
    ro: "Mulțumim. Creditele apar aici într-un minut.",
    ru: "Спасибо. Кредиты появятся здесь в течение минуты.",
    uk: "Дякуємо. Кредити з’являться тут протягом хвилини.",
  },
};

export const CR = T;

export function cr(key, lang = "en", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
