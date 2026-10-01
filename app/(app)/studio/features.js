// app/(app)/studio/features.js — plain data for the Studio section (no JSX, so a
// server component could import it too). Per-slug icons live in studio-kit.jsx.
//
// Every surface is a PREVIEW: it renders from local mock data and the shared
// @voltmira/engine. Nothing writes to Supabase, calls an external API, or touches
// the live product. The order below is the installer's own workflow, front to back.
//
//   name  — full title (Studio landing rows)
//   nav   — short label (tab pills on a surface page)
//   short — 1–2 sentence description (Studio landing rows)

export const PREVIEW_FEATURES = [
  {
    slug: "payments",
    en: { name: "Payments & cashflow", nav: "Payments", short: "Every job's money on one screen: deposit and balance with the amount and the date, an overdue flag, a monthly in / owed / committed cashflow view, and the fiscal invoice (factură fiscală, plus the SFS e-Factura XML for a company client) generated from the quote." },
    ro: { name: "Încasări & flux de numerar", nav: "Încasări", short: "Banii fiecărei lucrări pe un singur ecran: avans și rest cu suma și data, marcaj de întârziere, o vedere lunară încasat / de încasat / angajat, și factura fiscală (plus XML-ul e-Factura SFS pentru un client firmă) generată din ofertă." },
    ru: { name: "Оплаты и денежный поток", nav: "Оплаты", short: "Деньги каждого объекта на одном экране: аванс и остаток с суммой и датой, флаг просрочки, месячная сводка получено / к получению / законтрактовано и налоговая накладная (плюс XML e-Factura SFS для клиента-фирмы) из расчёта." },
    uk: { name: "Оплати й грошовий потік", nav: "Оплати", short: "Гроші кожного об’єкта на одному екрані: аванс і залишок із сумою та датою, позначка прострочення, місячне зведення отримано / до отримання / законтрактовано і податкова накладна (плюс XML e-Factura SFS для клієнта-юрособи) з розрахунку." },
  },
  {
    slug: "monitoring",
    en: { name: "Fleet monitoring", nav: "Monitoring", short: "Every system you've handed over, against the P50 its quote promised: what needs a visit and why, what each client saved this year, and a monthly update you can send them on WhatsApp or Viber." },
    ro: { name: "Monitorizarea parcului", nav: "Monitorizare", short: "Fiecare sistem predat, față de P50-ul promis în ofertă: ce are nevoie de o vizită și de ce, cât a economisit fiecare client anul acesta și un raport lunar pe care i-l trimiți pe WhatsApp sau Viber." },
    ru: { name: "Мониторинг систем", nav: "Мониторинг", short: "Каждая сданная система против P50 из её расчёта: что требует выезда и почему, сколько клиент сэкономил за год и ежемесячный отчёт, который можно отправить в WhatsApp или Viber." },
    uk: { name: "Моніторинг систем", nav: "Моніторинг", short: "Кожна здана система проти P50 з її розрахунку: що потребує виїзду і чому, скільки клієнт заощадив за рік і щомісячний звіт, який можна надіслати у WhatsApp чи Viber." },
  },
  {
    slug: "bankability",
    en: { name: "P50 / P90 export", nav: "P50 / P90", short: "The same engine maths, packaged as a P50 / P90 energy-yield assessment and bankability summary: uncertainty budget, 25-year schedule and debt-service coverage, the way a bank or an EBRD-adjacent lender expects it." },
    ro: { name: "Export P50 / P90", nav: "P50 / P90", short: "Aceeași matematică a motorului, împachetată ca o evaluare a producției P50 / P90 și un rezumat de bancabilitate: buget de incertitudine, grafic pe 25 de ani și acoperirea serviciului datoriei, așa cum se așteaptă o bancă sau un creditor tip EBRD." },
    ru: { name: "Экспорт P50 / P90", nav: "P50 / P90", short: "Та же математика движка в виде оценки выработки P50 / P90 и сводки банкабельности: бюджет неопределённости, 25-летний график и покрытие долга, как ждёт банк или кредитор уровня ЕБРР." },
    uk: { name: "Експорт P50 / P90", nav: "P50 / P90", short: "Та сама математика рушія у вигляді оцінки генерації P50 / P90 і зведення банківської придатності: бюджет невизначеності, 25-річний графік і покриття боргу, як чекає банк або кредитор рівня ЄБРР." },
  },
  {
    slug: "lead-widget",
    en: { name: "Public calculator widget", nav: "Widget", short: "The control panel for VoltMira's real embeddable widget: the live frame, the exact embed snippet for this workspace, and the sized leads it drops into Leads. Address + bill → real PVGIS + the engine → an honest estimate, in Romanian, Ukrainian or Russian." },
    ro: { name: "Widget calculator public", nav: "Widget", short: "Panoul de control al widgetului real VoltMira: cadrul live, codul de încorporare exact pentru acest cont și lead-urile dimensionate pe care le trimite în Contacte. Adresă + factură → PVGIS real + motorul → o estimare onestă, în română, ucraineană sau rusă." },
    ru: { name: "Публичный калькулятор", nav: "Виджет", short: "Панель управления реальным виджетом VoltMira: живой фрейм, готовый код для вставки и лиды с размером, которые попадают в Заявки. Адрес + счёт → реальный PVGIS + движок → честная оценка, на румынском, украинском или русском." },
    uk: { name: "Публічний калькулятор", nav: "Віджет", short: "Панель керування справжнім віджетом VoltMira: живий фрейм, готовий код для вставлення й ліди з розміром системи, які потрапляють у Заявки. Адреса + рахунок → реальний PVGIS + рушій → чесна оцінка румунською, українською або російською." },
  },
];

export const PREVIEW_BASE = "/studio";

export function featureBySlug(slug) {
  return PREVIEW_FEATURES.find((f) => f.slug === slug) || null;
}
