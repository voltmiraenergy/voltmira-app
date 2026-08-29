// app/(app)/studio/features.js — plain data for the Studio section (no JSX, so a
// server component could import it too). Per-slug icons live in studio-kit.jsx.
//
// Every surface is a PREVIEW: it renders from local mock data and the shared
// @voltmira/engine. Nothing writes to Supabase, calls an external API, or touches
// the live product.
//
//   name  — full title (Studio landing rows)
//   nav   — short label (tab pills on a surface page)
//   short — 1–2 sentence description (Studio landing rows)

export const PREVIEW_FEATURES = [
  {
    slug: "site-layout",
    en: { name: "Site layout planner", nav: "Layout", short: "Enter the client's address, load the satellite view, trace the roof with four corners and fill it with panels. Panel count, DC size and estimated production update live off the engine." },
    ro: { name: "Planificator amplasament", nav: "Amplasament", short: "Introdu adresa clientului, încarcă vederea din satelit, trasează acoperișul cu patru colțuri și umple-l cu panouri. Numărul de panouri, puterea DC și producția estimată se calculează live." },
    ru: { name: "Планировщик участка", nav: "Раскладка", short: "Введите адрес клиента, загрузите спутниковый вид, обведите крышу четырьмя углами и заполните панелями. Число панелей, мощность DC и выработка обновляются вживую." },
  },
  {
    slug: "annex",
    en: { name: "Technical annex", nav: "Annex", short: "Generates the single-line diagram and equipment schedule for an ANRE / Premier Energy / Moldelectrica connection request — modules, inverter, protections and cable sizes filled from the quote. An engineer reviews and stamps it." },
    ro: { name: "Anexă tehnică", nav: "Anexă", short: "Generează schema electrică monofilară și borderoul de echipamente pentru dosarul de racordare la ANRE / Premier Energy / Moldelectrica — module, invertor, protecții și secțiuni de cablu completate din ofertă. Un inginer o verifică și o ștampilează." },
    ru: { name: "Техническое приложение", nav: "Приложение", short: "Формирует однолинейную схему и спецификацию оборудования для заявки на подключение в ANRE / Premier Energy / Moldelectrica — модули, инвертор, защиты и сечения кабеля из расчёта. Инженер проверяет и заверяет." },
  },
  {
    slug: "pricing",
    en: { name: "Distributor pricing", nav: "Pricing", short: "Current panel, inverter and battery prices from RO and MD distributors, with 30-day movement and the gap against your own catalog. A reason to open the app daily — and a revenue-share conversation." },
    ro: { name: "Prețuri distribuitori", nav: "Prețuri", short: "Prețuri curente la panouri, invertoare și baterii de la distribuitorii din RO și MD, cu variația pe 30 de zile și diferența față de catalogul tău. Un motiv să deschizi aplicația zilnic — și o discuție de revenue-share." },
    ru: { name: "Цены дистрибьюторов", nav: "Цены", short: "Актуальные цены на панели, инверторы и батареи от дистрибьюторов RO и MD, с динамикой за 30 дней и разницей с вашим каталогом. Повод открывать приложение каждый день." },
  },
  {
    slug: "bankability",
    en: { name: "P50 / P90 export", nav: "P50 / P90", short: "The same engine maths, packaged as a P50 / P90 energy-yield assessment and bankability summary — uncertainty budget, 25-year schedule and debt-service coverage, the way a bank or an EBRD-adjacent lender expects it." },
    ro: { name: "Export P50 / P90", nav: "P50 / P90", short: "Aceeași matematică a motorului, împachetată ca o evaluare a producției P50 / P90 și un rezumat de bancabilitate — buget de incertitudine, grafic pe 25 de ani și acoperirea serviciului datoriei, așa cum se așteaptă o bancă sau un creditor tip EBRD." },
    ru: { name: "Экспорт P50 / P90", nav: "P50 / P90", short: "Та же математика движка в виде оценки выработки P50 / P90 и сводки банкабельности — бюджет неопределённости, 25-летний график и покрытие долга, как ждёт банк или кредитор уровня ЕБРР." },
  },
];

export const PREVIEW_BASE = "/studio";

export function featureBySlug(slug) {
  return PREVIEW_FEATURES.find((f) => f.slug === slug) || null;
}
