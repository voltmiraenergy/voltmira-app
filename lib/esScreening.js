// lib/esScreening.js — the environmental and social screening a development
// finance institution asks for before it looks at a project, as a checklist a
// developer fills in, plus the impact figures that can be computed.
//
// WHAT THIS IS. A screening aid: the questions follow the structure of the EBRD
// Performance Requirements (PR1 to PR10) and the IFC Performance Standards, in
// plain words, so a team knows what to prepare and a lender sees it was thought
// about. It is not an environmental and social impact assessment, not a
// certificate of compliance with any standard, and not legal advice. The
// answers are the developer's own; this file never fills one in.
//
// IMPACT FIGURES. Avoided CO2 is computed from the plant's output and the
// grid's emission factor. Jobs and gender figures are NEVER estimated here: a
// fund wants the project's own numbers, so they are inputs.
//
// EU TAXONOMY. Solar PV electricity generation and electricity storage are
// activities the Taxonomy lists for climate-change mitigation (activities 4.1
// and 4.10 of the Climate Delegated Act). Being listed is not being aligned:
// alignment also needs the "do no significant harm" criteria and minimum
// safeguards, which the checklist asks about.
//
// CBAM. The EU carbon border mechanism applies to the EU importers of certain
// goods (it now includes electricity), so it reaches a client of a solar plant
// only as an exporter of those goods, whose emissions per tonne fall when part
// of their power is solar. It is a reason to document the avoided emissions,
// not a project-level compliance step.

export const ES_STATUS = ["open", "yes", "no", "na"];

// Grid emission factors, t CO2 per MWh.
//   UA: 0.332, the 2023 average for final consumers (2nd voltage class), Green
//       Transition Office / DiXi Group, "GHG Emission Factors for Electricity
//       Generation and Consumption in Ukraine" (2024).
//   MD: 0.40, the factor the proposal PDF already uses; replace it with the
//       factor the lender requires.
export const GRID_EMISSION_FACTOR = {
  UA: { tPerMwh: 0.332, source: "Green Transition Office / DiXi Group (2024), 2023 average, final consumers" },
  MD: { tPerMwh: 0.4, source: "factor used on the VoltMira proposal PDF; replace with the lender's required factor" },
};

/** Tonnes of CO2 a year of output avoids, and over the horizon with the plant's degradation. */
export function co2Avoided({ year1Mwh, market, years = 25, degrPctYr = 0.5 }) {
  const f = (GRID_EMISSION_FACTOR[market] || GRID_EMISSION_FACTOR.MD).tPerMwh;
  const y1 = Math.max(0, Number(year1Mwh) || 0) * f;
  let life = 0;
  for (let y = 0; y < years; y++) life += y1 * Math.pow(1 - degrPctYr / 100, y);
  return { factor: f, tPerYear: y1, tLifetime: life };
}

// Each item: id, the standard it comes from, which markets it applies to, and
// the question in four languages.
export const ES_ITEMS = [
  { id: "mgmt_responsibility", std: "PR1 / PS1", markets: ["MD", "UA"],
    q: { en: "Someone is named as responsible for environmental, social and safety matters on this project.", ro: "Cineva este numit responsabil de mediu, aspecte sociale și siguranță în acest proiect.", ru: "На проекте назначен ответственный за вопросы экологии, социальные вопросы и безопасность.", uk: "На проєкті призначено відповідального за питання екології, соціальні питання та безпеку." } },
  { id: "mgmt_eia_screen", std: "PR1 / PS1", markets: ["MD", "UA"],
    q: { en: "The project was checked against the national environmental impact assessment rules, and any required permit or screening decision is identified.", ro: "Proiectul a fost verificat față de regulile naționale de evaluare a impactului asupra mediului, iar autorizațiile sau deciziile de screening necesare sunt identificate.", ru: "Проект проверен на соответствие национальным правилам оценки воздействия на окружающую среду, нужные разрешения или решения о скрининге определены.", uk: "Проєкт перевірено на відповідність національним правилам оцінки впливу на довкілля, потрібні дозволи або рішення зі скринінгу визначено." } },
  { id: "labour_contracts", std: "PR2 / PS2", markets: ["MD", "UA"],
    q: { en: "Workers and contractors have written contracts, legal working hours and no child or forced labour.", ro: "Lucrătorii și contractorii au contracte scrise, program legal de lucru și nu există muncă a copiilor sau forțată.", ru: "У работников и подрядчиков есть письменные договоры, законный режим работы, нет детского и принудительного труда.", uk: "Працівники та підрядники мають письмові договори, законний режим роботи, немає дитячої та примусової праці." } },
  { id: "labour_grievance", std: "PR2 / PS2", markets: ["MD", "UA"],
    q: { en: "Workers have a way to raise complaints without penalty.", ro: "Lucrătorii au o cale de a depune plângeri fără represalii.", ru: "У работников есть способ подать жалобу без последствий для себя.", uk: "Працівники мають спосіб подати скаргу без наслідків для себе." } },
  { id: "pollution_waste", std: "PR3 / PS3", markets: ["MD", "UA"],
    q: { en: "There is a plan for construction waste and for taking back panels and batteries at the end of their life.", ro: "Există un plan pentru deșeurile de construcție și pentru preluarea panourilor și bateriilor la sfârșitul vieții.", ru: "Есть план по строительным отходам и по приёму панелей и батарей в конце срока службы.", uk: "Є план щодо будівельних відходів і приймання панелей та батарей наприкінці строку служби." } },
  { id: "pollution_site", std: "PR3 / PS3", markets: ["MD", "UA"],
    q: { en: "Dust, noise, soil and water during construction are controlled, and fuel or oil on site is contained.", ro: "Praful, zgomotul, solul și apa în timpul construcției sunt controlate, iar combustibilul sau uleiul de pe șantier sunt ținute sub control.", ru: "Пыль, шум, почва и вода при строительстве контролируются, топливо и масла на площадке хранятся безопасно.", uk: "Пил, шум, ґрунт і вода під час будівництва контролюються, паливо та масла на майданчику зберігаються безпечно." } },
  { id: "safety_plan", std: "PR4 / PS4", markets: ["MD", "UA"],
    q: { en: "A health and safety plan covers electrical work, work at height and, if there is a battery, fire risk.", ro: "Un plan de sănătate și securitate acoperă lucrul cu electricitatea, lucrul la înălțime și, dacă există baterie, riscul de incendiu.", ru: "План охраны труда охватывает электромонтаж, работу на высоте и, если есть батарея, пожарный риск.", uk: "План охорони праці охоплює електромонтаж, роботу на висоті та, якщо є батарея, пожежний ризик." } },
  { id: "safety_ordnance", std: "PR4 / PS4", markets: ["UA"],
    q: { en: "The site has been surveyed or cleared for explosive ordnance, or is in an area that does not need it.", ro: "Terenul a fost cercetat sau deminat pentru muniții neexplodate, sau se află într-o zonă care nu are nevoie de asta.", ru: "Площадка обследована или разминирована на предмет взрывоопасных предметов либо находится в районе, где это не требуется.", uk: "Майданчик обстежено або розміновано щодо вибухонебезпечних предметів, або він у районі, де це не потрібно." } },
  { id: "land_title", std: "PR5 / PS5", markets: ["MD", "UA"],
    q: { en: "Land ownership or a lease covering the whole project life is documented, and nobody is displaced or loses a livelihood.", ro: "Proprietatea sau un contract de arendă pe toată durata proiectului este documentat, iar nimeni nu este strămutat și nu își pierde mijloacele de trai.", ru: "Право собственности или аренда на весь срок проекта подтверждены документами, никто не переселяется и не теряет источник дохода.", uk: "Право власності або оренду на весь строк проєкту підтверджено документами, ніхто не переселяється й не втрачає джерело доходу." } },
  { id: "biodiversity", std: "PR6 / PS6", markets: ["MD", "UA"],
    q: { en: "The site is not in a protected area or critical habitat, and no significant tree clearing or habitat loss is needed.", ro: "Terenul nu este într-o arie protejată sau habitat critic și nu e nevoie de defrișări sau pierderi de habitat semnificative.", ru: "Площадка не находится в охраняемой зоне или критической среде обитания, значительная вырубка деревьев не нужна.", uk: "Майданчик не в заповідній зоні чи критичному середовищі існування, значна вирубка дерев не потрібна." } },
  { id: "heritage", std: "PR8 / PS8", markets: ["MD", "UA"],
    q: { en: "There is no known cultural heritage or archaeology on the site, and a procedure exists if something is found.", ro: "Nu se cunoaște patrimoniu cultural sau arheologie pe teren și există o procedură dacă se descoperă ceva.", ru: "На площадке нет известного культурного наследия или археологии, и есть порядок действий при находке.", uk: "На майданчику немає відомої культурної спадщини чи археології, і є порядок дій у разі знахідки." } },
  { id: "stakeholders", std: "PR10 / PS1", markets: ["MD", "UA"],
    q: { en: "Neighbours and local authorities were told about the project, and there is a channel for their questions and complaints.", ro: "Vecinii și autoritățile locale au fost informați despre proiect și există un canal pentru întrebările și plângerile lor.", ru: "Соседи и местные власти проинформированы о проекте, есть канал для их вопросов и жалоб.", uk: "Сусідів і місцеву владу поінформовано про проєкт, є канал для їхніх питань і скарг." } },
  { id: "tax_activity", std: "EU Taxonomy 4.1 / 4.10", markets: ["MD", "UA"],
    q: { en: "The activity is solar PV generation (4.1) and, if present, electricity storage (4.10), both listed for climate-change mitigation.", ro: "Activitatea este generare fotovoltaică (4.1) și, dacă există, stocare de energie (4.10), ambele listate pentru atenuarea schimbărilor climatice.", ru: "Деятельность: солнечная генерация (4.1) и, если есть, накопление электроэнергии (4.10), обе включены в перечень по смягчению изменения климата.", uk: "Діяльність: сонячна генерація (4.1) та, якщо є, накопичення електроенергії (4.10), обидві включені до переліку зі пом’якшення зміни клімату." } },
  { id: "tax_dnsh", std: "EU Taxonomy DNSH", markets: ["MD", "UA"],
    q: { en: "Flood, hail, wind and snow risks at the site were assessed and the design copes with them (climate adaptation).", ro: "Riscurile de inundație, grindină, vânt și zăpadă la locul proiectului au fost evaluate, iar proiectul le face față (adaptare la schimbările climatice).", ru: "Риски наводнения, града, ветра и снега на площадке оценены, проект их выдерживает (адаптация к изменению климата).", uk: "Ризики повені, граду, вітру та снігу на майданчику оцінено, проєкт їх витримує (адаптація до зміни клімату)." } },
  { id: "tax_safeguards", std: "EU Taxonomy", markets: ["MD", "UA"],
    q: { en: "Minimum safeguards are met: no corruption or tax-evasion findings against the sponsor, and respect for labour and human rights.", ro: "Garanțiile minime sunt respectate: nicio constatare de corupție sau evaziune fiscală împotriva sponsorului și respectarea drepturilor muncii și omului.", ru: "Минимальные гарантии соблюдены: нет выводов о коррупции или уклонении от налогов в отношении спонсора, соблюдаются трудовые права и права человека.", uk: "Мінімальні гарантії дотримано: немає висновків про корупцію чи ухилення від податків щодо спонсора, дотримано трудових прав і прав людини." } },
];

/** The checklist items that apply to a market. */
export function itemsFor(market) {
  return ES_ITEMS.filter((i) => i.markets.includes(market));
}

/**
 * How much of the screening is answered (anything but "open"), and how many are
 * flagged "no"; with the count of each answer for the readiness score.
 */
export function esProgress(answers, markets) {
  const set = new Set(markets && markets.length ? markets : ["MD"]);
  const items = ES_ITEMS.filter((i) => i.markets.some((m) => set.has(m)));
  const a = answers && typeof answers === "object" ? answers : {};
  const count = (s) => items.filter((i) => a[i.id]?.status === s).length;
  const answered = items.filter((i) => ES_STATUS.includes(a[i.id]?.status) && a[i.id].status !== "open").length;
  const flagged = count("no");
  return {
    total: items.length, answered, flagged, pct: items.length ? (answered / items.length) * 100 : 0,
    yes: count("yes"), na: count("na"), no: flagged, open: items.length - answered,
  };
}
