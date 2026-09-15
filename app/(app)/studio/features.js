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
    slug: "survey",
    en: { name: "Site survey", nav: "Vizită", short: "Before the quote: real roof pitch, azimuth and shading feed an adjusted PVGIS yield, a 1~/3~ and string-voltage check flags an unbuildable design, and the site photos live on the job — so the payback number is honest for this roof, not a national average." },
    ro: { name: "Vizită tehnică", nav: "Vizită", short: "Înainte de ofertă: înclinarea reală a acoperișului, orientarea și umbrirea dau un randament PVGIS ajustat, o verificare 1~/3~ și tensiune șir semnalează un proiect nefezabil, iar pozele de la fața locului stau pe lucrare — ca amortizarea să fie onestă pentru acest acoperiș, nu o medie națională." },
    ru: { name: "Техобследование", nav: "Осмотр", short: "До расчёта: реальный уклон крыши, азимут и затенение дают скорректированную выработку PVGIS, проверка 1~/3~ и напряжения цепочки ловит нереализуемую схему, а фото объекта хранятся при заявке — чтобы окупаемость была честной для этой крыши." },
  },
  {
    slug: "catalog",
    en: { name: "Equipment catalog", nav: "Catalog", short: "Panels, inverters, batteries and mounting — every SKU with real specifications, stock and lead time, filterable by class. The quote, the annex and the install schedule all read from this one catalog, so a system is never quoted from a fictional part." },
    ro: { name: "Catalog echipamente", nav: "Catalog", short: "Panouri, invertoare, baterii și structuri — fiecare SKU cu specificații reale, stoc și termen de livrare, filtrabil pe clasă. Oferta, anexa și planificarea de montaj citesc din acest catalog, ca un sistem să nu fie ofertat pe un echipament fictiv." },
    ru: { name: "Каталог оборудования", nav: "Каталог", short: "Панели, инверторы, батареи и крепления — каждый SKU с реальными характеристиками, наличием и сроком поставки. Расчёт, приложение и график монтажа читают из этого каталога." },
  },
  {
    slug: "annex",
    en: { name: "Technical annex", nav: "Anexă", short: "Generates the single-line diagram and equipment schedule for an ANRE / Premier Energy / Moldelectrica connection request — modules, inverter, protections and cable sizes filled from the quote. An engineer reviews and stamps it." },
    ro: { name: "Anexă tehnică", nav: "Anexă", short: "Generează schema electrică monofilară și borderoul de echipamente pentru dosarul de racordare la ANRE / Premier Energy / Moldelectrica — module, invertor, protecții și secțiuni de cablu completate din ofertă. Un inginer o verifică și o ștampilează." },
    ru: { name: "Техническое приложение", nav: "Приложение", short: "Формирует однолинейную схему и спецификацию оборудования для заявки на подключение в ANRE / Premier Energy / Moldelectrica — модули, инвертор, защиты и сечения кабеля из расчёта. Инженер проверяет и заверяет." },
  },
  {
    slug: "payments",
    en: { name: "Payments & cashflow", nav: "Încasări", short: "Every job's money on one screen — deposit and balance with the amount and the date, an overdue flag, a monthly in / owed / committed cashflow view, and the fiscal invoice (factură fiscală, plus the SFS e-Factura XML for a company client) generated from the quote." },
    ro: { name: "Încasări & flux de numerar", nav: "Încasări", short: "Banii fiecărei lucrări pe un singur ecran — avans și rest cu suma și data, marcaj de întârziere, o vedere lunară încasat / de încasat / angajat, și factura fiscală (plus XML-ul e-Factura SFS pentru un client firmă) generată din ofertă." },
    ru: { name: "Оплаты и денежный поток", nav: "Оплаты", short: "Деньги каждого объекта на одном экране — аванс и остаток с суммой и датой, флаг просрочки, месячная сводка получено / к получению / законтрактовано и налоговая накладная (плюс XML e-Factura SFS для клиента-фирмы) из расчёта." },
  },
  {
    slug: "schedule",
    en: { name: "Install schedule", nav: "Montaj", short: "The week's installs on a calendar with the crew assigned and a materials-ready check against the catalog — and a phone view of the on-site checklist, photos and the client's signature that works with no signal and syncs when it's back." },
    ro: { name: "Planificare montaj", nav: "Montaj", short: "Montajele săptămânii pe un calendar cu echipa alocată și o verificare a materialelor față de catalog — plus o vedere de telefon a listei de la fața locului, poze și semnătura clientului, care merge fără semnal și se sincronizează când revine." },
    ru: { name: "График монтажа", nav: "Монтаж", short: "Монтажи недели в календаре с назначенной бригадой и проверкой готовности материалов по каталогу — плюс телефонный вид чек-листа на объекте, фото и подпись клиента, работающий без связи и синхронизирующийся при её появлении." },
  },
  {
    slug: "monitoring",
    en: { name: "Fleet monitoring", nav: "Monitorizare", short: "After handover: real production pulled from the inverter portal against the P50 estimate you promised, per-component warranty with reminders, and a service-ticket log — so the installed base is a referral engine, and VoltMira has the regional actual-vs-P50 data nobody else does." },
    ro: { name: "Monitorizare parc", nav: "Monitorizare", short: "După predare: producția reală luată din portalul invertorului față de estimarea P50 promisă, garanție pe componente cu memento-uri, și un jurnal de tichete de service — ca baza instalată să fie un motor de recomandări, iar VoltMira să aibă datele regionale real-vs-P50 pe care nu le are nimeni." },
    ru: { name: "Мониторинг парка", nav: "Мониторинг", short: "После сдачи: реальная выработка из портала инвертора против обещанного P50, гарантия по компонентам с напоминаниями и журнал сервисных заявок — чтобы установленная база работала на рекомендации, а у VoltMira были региональные данные факт-против-P50." },
  },
  {
    slug: "bankability",
    en: { name: "P50 / P90 export", nav: "P50 / P90", short: "The same engine maths, packaged as a P50 / P90 energy-yield assessment and bankability summary — uncertainty budget, 25-year schedule and debt-service coverage, the way a bank or an EBRD-adjacent lender expects it." },
    ro: { name: "Export P50 / P90", nav: "P50 / P90", short: "Aceeași matematică a motorului, împachetată ca o evaluare a producției P50 / P90 și un rezumat de bancabilitate — buget de incertitudine, grafic pe 25 de ani și acoperirea serviciului datoriei, așa cum se așteaptă o bancă sau un creditor tip EBRD." },
    ru: { name: "Экспорт P50 / P90", nav: "P50 / P90", short: "Та же математика движка в виде оценки выработки P50 / P90 и сводки банкабельности — бюджет неопределённости, 25-летний график и покрытие долга, как ждёт банк или кредитор уровня ЕБРР." },
  },
  {
    slug: "lead-widget",
    en: { name: "Public calculator widget", nav: "Widget", short: "The control panel for VoltMira's real embeddable widget — the live frame, the exact embed snippet for this workspace, and the sized leads it drops into Leads. Address + bill → real PVGIS + the engine → an honest estimate, in Romanian or Russian." },
    ro: { name: "Widget calculator public", nav: "Widget", short: "Panoul de control al widgetului real VoltMira — cadrul live, codul de încorporare exact pentru acest cont și lead-urile dimensionate pe care le trimite în Contacte. Adresă + factură → PVGIS real + motorul → o estimare onestă, în română sau rusă." },
    ru: { name: "Публичный калькулятор", nav: "Виджет", short: "Панель управления реальным виджетом VoltMira — живой фрейм, готовый код для вставки и лиды с размером, которые попадают в Заявки. Адрес + счёт → реальный PVGIS + движок → честная оценка, на румынском или русском." },
  },
];

export const PREVIEW_BASE = "/studio";

export function featureBySlug(slug) {
  return PREVIEW_FEATURES.find((f) => f.slug === slug) || null;
}
