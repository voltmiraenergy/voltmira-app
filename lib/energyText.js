// lib/energyText.js — every word of the green-energy module in four
// languages: the support card on a quote (components/SupportCard.jsx) for now,
// the energy section and the report's market page later. Module-local, like
// lib/workflowText.js, so this surface grows without touching the shared
// dictionary. Installer copy speaks to the installer as "tu" in Romanian.
//
// et(key, lang, { x: "…" }) fills {x}; a key with an "_one" form is used for
// n = 1. lib/energyText.test.js fails if a key lacks a language, if the
// placeholders differ between languages, or if a dash, middle dot or check
// mark slips in.
import { SOURCES } from "./greenData.js";

const T = {
  // ---- the card
  sp_title: { en: "Support for this job", ro: "Sprijin pentru această lucrare", ru: "Поддержка для этого объекта", uk: "Підтримка для цього об’єкта" },
  sp_sub: {
    en: "What the client may get under the published programme rules. Only you see this: it is not in the client's offer.",
    ro: "Ce poate primi clientul după regulile publicate ale programelor. Doar tu vezi asta: nu apare în oferta clientului.",
    ru: "Что может получить клиент по опубликованным правилам программ. Это видите только вы: в оферте клиента этого нет.",
    uk: "Що може отримати клієнт за опублікованими правилами програм. Це бачите лише ви: у пропозиції клієнта цього немає.",
  },
  sp_kind: { en: "Who is the client?", ro: "Cine e clientul?", ru: "Кто клиент?", uk: "Хто клієнт?" },
  kind_household: { en: "Household", ro: "Gospodărie", ru: "Домохозяйство", uk: "Домогосподарство" },
  kind_sme: { en: "Small business", ro: "Firmă mică (IMM)", ru: "Малый бизнес", uk: "Малий бізнес" },
  kind_company: { en: "Company", ro: "Companie", ru: "Компания", uk: "Компанія" },
  sp_pick: {
    en: "Pick the client type to see which programmes fit.",
    ro: "Alege tipul clientului ca să vezi programele care se potrivesc.",
    ru: "Выберите тип клиента, чтобы увидеть подходящие программы.",
    uk: "Оберіть тип клієнта, щоб побачити програми, що підходять.",
  },
  sp_needs_db: {
    en: "The client type is used here but not saved yet: run supabase/run-pending-2026-10-02.sql.",
    ro: "Tipul clientului e folosit aici, dar nu e salvat încă: rulează supabase/run-pending-2026-10-02.sql.",
    ru: "Тип клиента используется здесь, но ещё не сохраняется: выполните supabase/run-pending-2026-10-02.sql.",
    uk: "Тип клієнта використовується тут, але ще не зберігається: виконайте supabase/run-pending-2026-10-02.sql.",
  },
  sp_save_failed: { en: "Not saved. Try again.", ro: "Nesalvat. Încearcă din nou.", ru: "Не сохранено. Повторите.", uk: "Не збережено. Спробуйте ще." },
  sp_batt_est: {
    en: "Battery price used: {x}, from its size at your price per kWh.",
    ro: "Prețul bateriei folosit: {x}, din capacitate și prețul tău pe kWh.",
    ru: "Цена батареи в расчёте: {x}, по ёмкости и вашей цене за кВт·ч.",
    uk: "Ціна батареї в розрахунку: {x}, за ємністю та вашою ціною за кВт·год.",
  },
  sp_foot: {
    en: "Estimates from the published rules, not a decision: each programme decides who qualifies. Check with it before promising an amount.",
    ro: "Estimări după regulile publicate, nu o decizie: fiecare program decide cine e eligibil. Verifică înainte să promiți o sumă.",
    ru: "Оценки по опубликованным правилам, а не решение: каждая программа сама решает, кто подходит. Уточните, прежде чем обещать сумму.",
    uk: "Оцінки за опублікованими правилами, а не рішення: кожна програма сама вирішує, хто підходить. Уточніть, перш ніж обіцяти суму.",
  },
  src: { en: "Source: {src}", ro: "Sursa: {src}", ru: "Источник: {src}", uk: "Джерело: {src}" },
  upto: { en: "up to {x}", ro: "până la {x}", ru: "до {x}", uk: "до {x}" },

  // ---- programme names
  pg_casa_verde: { en: "Casa Verde (CNED)", ro: "Casa Verde (CNED)", ru: "Casa Verde (CNED)", uk: "Casa Verde (CNED)" },
  pg_law112_vat: { en: "VAT refund on the battery", ro: "Rambursarea TVA la baterie", ru: "Возврат НДС за батарею", uk: "Повернення ПДВ за батарею" },
  pg_law112_customs: { en: "0% customs duty on batteries", ro: "Taxă vamală 0% la baterii", ru: "Пошлина 0% на батареи", uk: "Мито 0% на батареї" },
  pg_facem_373: { en: "FACEM, programme 373", ro: "FACEM, programul 373", ru: "FACEM, программа 373", uk: "FACEM, програма 373" },
  pg_bess_guarantee: { en: "State guarantee on the battery loan", ro: "Garanția statului la creditul pentru baterie", ru: "Госгарантия по кредиту на батарею", uk: "Державна гарантія за кредитом на батарею" },

  // ---- Casa Verde
  cv_line: {
    en: "{pct}% of the system's price, at most {cap}, for PV with a battery.",
    ro: "{pct}% din prețul sistemului, maximum {cap}, pentru panouri cu baterie.",
    ru: "{pct}% стоимости системы, не более {cap}, для панелей с батареей.",
    uk: "{pct}% вартості системи, не більше {cap}, для панелей з батареєю.",
  },
  cv_capped: {
    en: "Half the price would be {half}: the cap applies.",
    ro: "Jumătate din preț ar fi {half}: se aplică plafonul.",
    ru: "Половина цены составила бы {half}: действует предел.",
    uk: "Половина ціни становила б {half}: діє ліміт.",
  },
  cv_pays: { en: "The client pays {x}.", ro: "Clientul plătește {x}.", ru: "Клиент платит {x}.", uk: "Клієнт платить {x}." },
  cv_ins: {
    en: "The house is insulated, or will be in the same file",
    ro: "Casa e izolată termic sau va fi, în același dosar",
    ru: "Дом утеплён или будет утеплён в той же заявке",
    uk: "Будинок утеплено або буде утеплено в тій самій заявці",
  },
  cv_ins_unknown: {
    en: "Casa Verde pays for panels only after thermal insulation. Tick the box once you know.",
    ro: "Casa Verde plătește panourile doar după izolarea termică. Bifează când știi.",
    ru: "Casa Verde оплачивает панели только после утепления. Отметьте, когда будете знать.",
    uk: "Casa Verde оплачує панелі лише після утеплення. Позначте, коли знатимете.",
  },
  cv_ins_no: {
    en: "Without insulation first, Casa Verde does not pay for the panels.",
    ro: "Fără izolare mai întâi, Casa Verde nu plătește panourile.",
    ru: "Без утепления Casa Verde не оплачивает панели.",
    uk: "Без утеплення Casa Verde не оплачує панелі.",
  },
  ins_yes: { en: "Yes", ro: "Da", ru: "Да", uk: "Так" },
  ins_no: { en: "No", ro: "Nu", ru: "Нет", uk: "Ні" },
  ins_q: { en: "Is the house thermally insulated?", ro: "Casa e izolată termic?", ru: "Дом утеплён?", uk: "Будинок утеплено?" },
  hint_add_battery: {
    en: "Casa Verde pays for PV with a battery. Add a battery and this household could get {pct}% of the price, at most {cap}.",
    ro: "Casa Verde plătește panouri cu baterie. Adaugă o baterie și gospodăria ar putea primi {pct}% din preț, maximum {cap}.",
    ru: "Casa Verde оплачивает панели с батареей. Добавьте батарею, и домохозяйство сможет получить {pct}% стоимости, не более {cap}.",
    uk: "Casa Verde оплачує панелі з батареєю. Додайте батарею, і домогосподарство зможе отримати {pct}% вартості, не більше {cap}.",
  },
  hint_battery_programmes: {
    en: "The programmes for businesses here are for battery storage. Add a battery to see them.",
    ro: "Programele pentru firme de aici sunt pentru stocare. Adaugă o baterie ca să le vezi.",
    ru: "Программы для бизнеса здесь касаются накопителей. Добавьте батарею, чтобы их увидеть.",
    uk: "Програми для бізнесу тут стосуються накопичувачів. Додайте батарею, щоб їх побачити.",
  },

  // ---- Law 112
  vat_line: {
    en: "The {rate}% VAT inside the battery's price ({base}) can be refunded, offset against tax due or carried forward.",
    ro: "TVA de {rate}% din prețul bateriei ({base}) se poate rambursa, compensa cu alte obligații fiscale sau reporta.",
    ru: "НДС {rate}% в цене батареи ({base}) можно вернуть, зачесть в счёт налогов или перенести.",
    uk: "ПДВ {rate}% у ціні батареї ({base}) можна повернути, зарахувати в рахунок податків або перенести.",
  },
  vat_cond: { en: "If the client is a VAT payer.", ro: "Dacă clientul e plătitor de TVA.", ru: "Если клиент плательщик НДС.", uk: "Якщо клієнт платник ПДВ." },
  vat_zero: {
    en: "Your invoices carry no VAT (Settings), so there is no VAT on this battery to recover.",
    ro: "Facturile tale nu au TVA (Setări), deci nu e TVA de recuperat pe această baterie.",
    ru: "Ваши счета без НДС (Настройки), поэтому возвращать с этой батареи нечего.",
    uk: "Ваші рахунки без ПДВ (Налаштування), тому повертати з цієї батареї нічого.",
  },
  customs_line: {
    en: "The duty on battery storage dropped from {from}% to {to}%: an imported battery costs up to {from}% less at customs.",
    ro: "Taxa vamală pe stocare a scăzut de la {from}% la {to}%: o baterie importată costă cu până la {from}% mai puțin la vamă.",
    ru: "Пошлина на накопители снижена с {from}% до {to}%: ввоз батареи обходится до {from}% дешевле.",
    uk: "Мито на накопичувачі знижено з {from}% до {to}%: ввезення батареї коштує до {from}% менше.",
  },

  // ---- FACEM
  facem_line: {
    en: "Grants of up to {pct}% plus preferential loans for battery storage, for small businesses with net metering.",
    ro: "Granturi de până la {pct}% plus credite preferențiale pentru stocare, pentru IMM-urile cu net-metering.",
    ru: "Гранты до {pct}% и льготные кредиты на накопители для малого бизнеса с нетто-учётом.",
    uk: "Гранти до {pct}% і пільгові кредити на накопичувачі для малого бізнесу з нетто-обліком.",
  },
  facem_base: { en: "{pct}% of the battery's price ({base}).", ro: "{pct}% din prețul bateriei ({base}).", ru: "{pct}% цены батареи ({base}).", uk: "{pct}% ціни батареї ({base})." },

  // ---- the guarantee
  g_line: {
    en: "The state guarantees up to {pct}% of the loan, at most {cap} per beneficiary, for up to {months} months, at {fee}% a year.",
    ro: "Statul garantează până la {pct}% din credit, maximum {cap} pe beneficiar, pe până la {months} de luni, cu {fee}% pe an.",
    ru: "Государство гарантирует до {pct}% кредита, не более {cap} на получателя, на срок до {months} месяцев, {fee}% в год.",
    uk: "Держава гарантує до {pct}% кредиту, не більше {cap} на отримувача, на строк до {months} місяців, {fee}% на рік.",
  },
  g_loan: { en: "Loan for the job, lei", ro: "Creditul pentru lucrare, lei", ru: "Кредит на объект, лей", uk: "Кредит на об’єкт, лей" },
  g_type_loan: { en: "Type the loan to see the guarantee.", ro: "Scrie suma creditului ca să vezi garanția.", ru: "Введите сумму кредита, чтобы увидеть гарантию.", uk: "Введіть суму кредиту, щоб побачити гарантію." },
  g_capped: { en: "Stops at the {cap} cap; the loan itself can be larger.", ro: "Se oprește la plafonul de {cap}; creditul în sine poate fi mai mare.", ru: "Ограничено пределом {cap}; сам кредит может быть больше.", uk: "Обмежено лімітом {cap}; сам кредит може бути більшим." },
  g_until: { en: "Open until {date}.", ro: "Valabil până la {date}.", ru: "Действует до {date}.", uk: "Діє до {date}." },
  guaranteed: { en: "guaranteed", ro: "garantat", ru: "гарантия", uk: "гарантія" },

  // ---- the energy section (app/(app)/energy)
  nav: { en: "Green energy", ro: "Energie verde", ru: "Зелёная энергия", uk: "Зелена енергія" },
  pg_h1: { en: "Green energy in Moldova", ro: "Energia verde în Moldova", ru: "Зелёная энергия в Молдове", uk: "Зелена енергія в Молдові" },
  pg_sub: {
    en: "The market your clients and lenders decide in: where electricity comes from, how fast renewables grow, prices, balancing and the support on offer. Every number is the Ministry of Energy's, as presented at Moldova Business Week 2026.",
    ro: "Piața în care decid clienții și finanțatorii tăi: de unde vine electricitatea, cât de repede cresc regenerabilele, prețuri, echilibrare și sprijinul disponibil. Fiecare cifră este a Ministerului Energiei, așa cum a fost prezentată la Moldova Business Week 2026.",
    ru: "Рынок, на котором решают ваши клиенты и кредиторы: откуда электроэнергия, как быстро растут ВИЭ, цены, балансирование и доступная поддержка. Каждая цифра взята у Министерства энергетики, как она представлена на Moldova Business Week 2026.",
    uk: "Ринок, на якому вирішують ваші клієнти та кредитори: звідки електроенергія, як швидко зростають ВДЕ, ціни, балансування та доступна підтримка. Кожна цифра взята в Міністерства енергетики, як її представлено на Moldova Business Week 2026.",
  },
  sec_supply: { en: "Where the right bank's electricity comes from", ro: "De unde vine electricitatea malului drept", ru: "Откуда электроэнергия правого берега", uk: "Звідки електроенергія правого берега" },
  sec_supply_s: { en: "Share of consumption, %. Whole years to 2024, then month by month.", ro: "Pondere în consum, %. Ani întregi până în 2024, apoi lună cu lună.", ru: "Доля в потреблении, %. Полные годы до 2024, затем по месяцам.", uk: "Частка у споживанні, %. Повні роки до 2024, далі по місяцях." },
  shift_mark: { en: "From Jan 2025: MGRES at 0%", ro: "Din ian. 2025: MGRES la 0%", ru: "С янв. 2025: MGRES на 0%", uk: "З січ. 2025: MGRES на 0%" },
  view_chart: { en: "Chart", ro: "Grafic", ru: "График", uk: "Графік" },
  view_table: { en: "Table", ro: "Tabel", ru: "Таблица", uk: "Таблиця" },
  not_printed: { en: "not published", ro: "nepublicat", ru: "не опубликовано", uk: "не опубліковано" },
  day_split: {
    en: "One day, 27 September 2026: renewables {res}, imports {imp}, CHP {chp} of the right bank's consumption.",
    ro: "O zi, 27 septembrie 2026: regenerabile {res}, import {imp}, termocentrale {chp} din consumul malului drept.",
    ru: "Один день, 27 сентября 2026: ВИЭ {res}, импорт {imp}, ТЭЦ {chp} потребления правого берега.",
    uk: "Один день, 27 вересня 2026: ВДЕ {res}, імпорт {imp}, ТЕЦ {chp} споживання правого берега.",
  },
  sec_growth: { en: "Renewables' share of consumption", ro: "Ponderea regenerabilelor în consum", ru: "Доля ВИЭ в потреблении", uk: "Частка ВДЕ у споживанні" },
  sec_growth_s: { en: "Per year, %. 2026: the latest published value.", ro: "Pe an, %. 2026: ultima valoare publicată.", ru: "По годам, %. 2026: последнее опубликованное значение.", uk: "За роками, %. 2026: останнє опубліковане значення." },
  sec_targets: { en: "Installed now and the 2050 target", ro: "Instalat acum și ținta pentru 2050", ru: "Установлено сейчас и цель на 2050", uk: "Встановлено зараз і ціль на 2050" },
  t_wind: { en: "Wind", ro: "Eolian", ru: "Ветер", uk: "Вітер" },
  t_solar: { en: "Solar, plants and prosumers", ro: "Solar, parcuri și prosumatori", ru: "Солнце, станции и просьюмеры", uk: "Сонце, станції та просьюмери" },
  t_storage: { en: "Battery storage", ro: "Stocare în baterii", ru: "Накопители", uk: "Накопичувачі" },
  t_hydrogen: { en: "Hydrogen and green gases", ro: "Hidrogen și gaze verzi", ru: "Водород и зелёные газы", uk: "Водень і зелені гази" },
  t_hydro: { en: "Hydro", ro: "Hidro", ru: "ГЭС", uk: "ГЕС" },
  t_now: { en: "now {x}", ro: "acum {x}", ru: "сейчас {x}", uk: "зараз {x}" },
  t_target: { en: "2050: {x}", ro: "2050: {x}", ru: "2050: {x}", uk: "2050: {x}" },
  t_none_now: { en: "not reported yet", ro: "neraportat încă", ru: "пока не указано", uk: "поки не вказано" },
  t_solar_note: {
    en: "Solar counts utility plants and prosumers together. No 2050 target is published for hydro.",
    ro: "Solarul include parcurile și prosumatorii împreună. Pentru hidro nu este publicată o țintă pentru 2050.",
    ru: "Солнце учитывает станции и просьюмеров вместе. Для ГЭС цель на 2050 год не опубликована.",
    uk: "Сонце враховує станції та просьюмерів разом. Для ГЕС ціль на 2050 рік не опубліковано.",
  },
  sec_market: { en: "Prices and balancing", ro: "Prețuri și echilibrare", ru: "Цены и балансирование", uk: "Ціни та балансування" },
  dam_pending: {
    en: "Hourly day-ahead prices will be added once OPEM agrees to their reuse in VoltMira.",
    ro: "Prețurile orare de pe piața pentru ziua următoare vor fi adăugate după ce OPEM acceptă folosirea lor în VoltMira.",
    ru: "Почасовые цены рынка на сутки вперёд появятся, когда OPEM согласится на их использование в VoltMira.",
    uk: "Погодинні ціни ринку на добу наперед з’являться, коли OPEM погодиться на їх використання у VoltMira.",
  },
  sec_auction: { en: "Second renewables auction", ro: "A doua licitație pentru regenerabile", ru: "Второй аукцион ВИЭ", uk: "Другий аукціон ВДЕ" },
  au_line: {
    en: "{bids} bids offered {omw} of wind and {omwh} of storage for the {tmw} and {tmwh} tendered. {wins} won: {wmw} of wind and {wmwh} of storage, at a weighted average of {price}.",
    ro: "{bids} oferte au propus {omw} eolian și {omwh} stocare, pentru {tmw} și {tmwh} scoși la licitație. Au câștigat {wins}: {wmw} eolian și {wmwh} stocare, la un preț mediu ponderat de {price}.",
    ru: "{bids} заявок предложили {omw} ветра и {omwh} накопителей при объявленных {tmw} и {tmwh}. Выиграли {wins}: {wmw} ветра и {wmwh} накопителей по средневзвешенной цене {price}.",
    uk: "{bids} заявок запропонували {omw} вітру та {omwh} накопичувачів при оголошених {tmw} і {tmwh}. Виграли {wins}: {wmw} вітру та {wmwh} накопичувачів за середньозваженою ціною {price}.",
  },
  au_more: {
    en: "About {inv} of private investment and about {co2} t of CO2 avoided.",
    ro: "Circa {inv} investiții private și circa {co2} t CO2 evitate.",
    ru: "Около {inv} частных инвестиций и около {co2} т CO2 предотвращённых выбросов.",
    uk: "Близько {inv} приватних інвестицій і близько {co2} т CO2 відвернених викидів.",
  },
  sec_support: { en: "Support you can offer", ro: "Sprijin pe care îl poți oferi", ru: "Поддержка, которую вы можете предложить", uk: "Підтримка, яку ви можете запропонувати" },
  sec_support_s: {
    en: "Each quote in Moldova shows which of these fit its client, with amounts.",
    ro: "Fiecare ofertă din Moldova arată care dintre acestea se potrivesc clientului, cu sume.",
    ru: "Каждый расчёт в Молдове показывает, что из этого подходит клиенту, с суммами.",
    uk: "Кожен розрахунок у Молдові показує, що з цього підходить клієнту, із сумами.",
  },
  open_quotes: { en: "Open your quotes", ro: "Deschide ofertele", ru: "Открыть расчёты", uk: "Відкрити розрахунки" },
  sec_grid: { en: "Grid and permits", ro: "Rețea și autorizații", ru: "Сеть и разрешения", uk: "Мережа та дозволи" },
  ic_h: { en: "Interconnections with Romania and Ukraine", ro: "Interconexiuni cu România și Ucraina", ru: "Межсистемные линии с Румынией и Украиной", uk: "Міждержавні лінії з Румунією та Україною" },
  ic_note: {
    en: "Objectives of the NECP 2030 and the Energy Strategy 2050.",
    ro: "Obiective din PNEC 2030 și Strategia energetică 2050.",
    ru: "Цели НПЭК 2030 и Энергетической стратегии 2050.",
    uk: "Цілі НПЕК 2030 та Енергетичної стратегії 2050.",
  },
  ic_ro: { en: "Romania", ro: "România", ru: "Румыния", uk: "Румунія" },
  ic_ua: { en: "Ukraine", ro: "Ucraina", ru: "Украина", uk: "Україна" },
  raa_h: { en: "Renewable acceleration zones", ro: "Zone de accelerare pentru regenerabile", ru: "Зоны ускоренного развития ВИЭ", uk: "Зони прискореного розвитку ВДЕ" },
  raa_steps_h: { en: "How a zone is designated", ro: "Cum se desemnează o zonă", ru: "Как определяется зона", uk: "Як визначається зона" },
  raa_benefits_h: { en: "What a project in a zone gets", ro: "Ce primește un proiect din zonă", ru: "Что получает проект в зоне", uk: "Що отримує проєкт у зоні" },
  raa_s_degraded_land: { en: "Prioritise degraded land, buildings and infrastructure", ro: "Prioritizarea terenurilor degradate, construcțiilor și infrastructurii", ru: "Приоритет деградированным землям, зданиям и инфраструктуре", uk: "Пріоритет деградованим землям, будівлям та інфраструктурі" },
  raa_s_exclude_impact: { en: "Exclude areas with a potential negative impact", ro: "Excluderea zonelor cu impact negativ potențial", ru: "Исключение зон с возможным негативным влиянием", uk: "Виключення зон з можливим негативним впливом" },
  raa_s_grid_capacity: { en: "Assess the available network capacity", ro: "Evaluarea capacității disponibile a rețelei", ru: "Оценка доступной мощности сети", uk: "Оцінка доступної потужності мережі" },
  raa_s_sea: { en: "Strategic environmental assessment", ro: "Evaluarea strategică de mediu", ru: "Стратегическая экологическая оценка", uk: "Стратегічна екологічна оцінка" },
  raa_s_gd_approval: { en: "Government decision and the rules on mitigation measures", ro: "Hotărârea de Guvern și regulamentul privind măsurile de atenuare", ru: "Постановление Правительства и положение о мерах смягчения", uk: "Постанова Уряду та положення про заходи пом’якшення" },
  raa_b_public_utility: { en: "Public utility status", ro: "Statut de utilitate publică", ru: "Статус общественной полезности", uk: "Статус суспільної корисності" },
  raa_b_faster_permits: { en: "Faster authorization", ro: "Autorizare mai rapidă", ru: "Более быстрое разрешение", uk: "Швидший дозвіл" },
  raa_b_simpler_environmental: { en: "Simpler environmental authorization, if the zone's mitigation rules are met", ro: "Autorizare de mediu simplificată, dacă se respectă regulile de atenuare ale zonei", ru: "Упрощённое экологическое разрешение при соблюдении правил смягчения для зоны", uk: "Спрощений екологічний дозвіл за дотримання правил пом’якшення для зони" },
  raa_b_guaranteed_capacity: { en: "Network capacity for a guaranteed connection", ro: "Capacitate de rețea pentru racordare garantată", ru: "Мощность сети для гарантированного подключения", uk: "Потужність мережі для гарантованого приєднання" },
  raa_b_no_gov_approval_20mw: { en: "No Government approval needed for plants over 20 MW", ro: "Fără aprobarea Guvernului pentru centrale de peste 20 MW", ru: "Не нужно одобрение Правительства для станций свыше 20 МВт", uk: "Не потрібне схвалення Уряду для станцій понад 20 МВт" },
  raa_b_easement: { en: "An easement regime for the works", ro: "Regim de servitute pentru executarea lucrărilor", ru: "Режим сервитута для выполнения работ", uk: "Режим сервітуту для виконання робіт" },
  raa_none: {
    en: "No zone has been designated yet. Zones appear here once a Government decision designates them.",
    ro: "Încă nu a fost desemnată nicio zonă. Zonele apar aici după ce o hotărâre de Guvern le desemnează.",
    ru: "Пока ни одна зона не определена. Зоны появятся здесь после постановления Правительства.",
    uk: "Поки жодну зону не визначено. Зони з’являться тут після постанови Уряду.",
  },
  evo_h: { en: "EVO: one portal for permits", ro: "EVO: un singur portal pentru autorizații", ru: "EVO: единый портал разрешений", uk: "EVO: єдиний портал дозволів" },
  evo_single_access: { en: "One application: the permits, rulings and opinions needed are gathered in one process.", ro: "O singură cerere: autorizațiile, deciziile și avizele necesare sunt adunate într-un singur proces.", ru: "Одна заявка: нужные разрешения, решения и заключения собираются в одном процессе.", uk: "Одна заява: потрібні дозволи, рішення та висновки збираються в одному процесі." },
  evo_parallel: { en: "Procedures run in parallel when one does not depend on another.", ro: "Procedurile se desfășoară în paralel când nu depind una de alta.", ru: "Процедуры идут параллельно, если не зависят друг от друга.", uk: "Процедури йдуть паралельно, якщо не залежать одна від одної." },
  evo_transparency: { en: "Each stage shows who is responsible, the status, the total duration and the legal deadlines.", ro: "Fiecare etapă arată cine răspunde, stadiul, durata totală și termenele legale.", ru: "На каждом этапе видно ответственного, статус, общий срок и законные сроки.", uk: "На кожному етапі видно відповідального, статус, загальний строк і законні строки." },
  evo_interoperability: { en: "Issuing authorities and network operators must connect their systems to EVO.", ro: "Autoritățile emitente și operatorii de rețea trebuie să-și conecteze sistemele la EVO.", ru: "Выдающие органы и операторы сетей должны подключить свои системы к EVO.", uk: "Органи, що видають дозволи, та оператори мереж мають підключити свої системи до EVO." },

  // ---- the portfolio report: market context (components/portfolio/MarketContext.jsx)
  mk_title: { en: "Market context: Moldova", ro: "Contextul pieței: Moldova", ru: "Рыночный контекст: Молдова", uk: "Ринковий контекст: Молдова" },
  mk_intro: {
    en: "Where the right bank's electricity comes from, how fast renewables are growing, and what the state supports, from the official figures the Ministry of Energy presented at Moldova Business Week 2026.",
    ro: "De unde vine electricitatea malului drept, cât de repede cresc regenerabilele și ce sprijină statul, din datele oficiale prezentate de Ministerul Energiei la Moldova Business Week 2026.",
    ru: "Откуда поступает электроэнергия правого берега, как быстро растут ВИЭ и что поддерживает государство, по официальным данным Министерства энергетики на Moldova Business Week 2026.",
    uk: "Звідки надходить електроенергія правого берега, як швидко зростають ВДЕ і що підтримує держава, за офіційними даними Міністерства енергетики на Moldova Business Week 2026.",
  },
  mk_k_res: { en: "Renewables in consumption, 2026", ro: "Regenerabile în consum, 2026", ru: "ВИЭ в потреблении, 2026", uk: "ВДЕ у споживанні, 2026" },
  mk_k_res_s: { en: "{a} in 2024, {b} in 2018", ro: "{a} în 2024, {b} în 2018", ru: "{a} в 2024, {b} в 2018", uk: "{a} у 2024, {b} у 2018" },
  mk_k_cap: { en: "Renewable capacity, July 2026", ro: "Capacitate regenerabilă, iulie 2026", ru: "Мощность ВИЭ, июль 2026", uk: "Потужність ВДЕ, липень 2026" },
  mk_k_cap_s: { en: "solar {s}, wind {w}, prosumers {p}", ro: "solar {s}, eolian {w}, prosumatori {p}", ru: "солнце {s}, ветер {w}, просьюмеры {p}", uk: "сонце {s}, вітер {w}, просьюмери {p}" },
  mk_k_bess: { en: "Battery storage in the system", ro: "Stocare în baterii în sistem", ru: "Накопители в системе", uk: "Накопичувачі в системі" },
  mk_k_bess_s: { en: "installed by June 2026; about {need} needed", ro: "instalată până în iunie 2026; necesar circa {need}", ru: "установлено к июню 2026; нужно около {need}", uk: "встановлено до червня 2026; потрібно близько {need}" },
  mk_k_auction: { en: "Second renewables auction", ro: "A doua licitație pentru regenerabile", ru: "Второй аукцион ВИЭ", uk: "Другий аукціон ВДЕ" },
  mk_k_auction_s: { en: "{mw} wind and {mwh} storage awarded", ro: "atribuite {mw} eolian și {mwh} stocare", ru: "присуждено {mw} ветра и {mwh} накопителей", uk: "присуджено {mw} вітру та {mwh} накопичувачів" },
  mk_cap_gap: {
    en: "Published total: {total}; the published parts add up to {parts}.",
    ro: "Total publicat: {total}; componentele publicate însumează {parts}.",
    ru: "Опубликованный итог: {total}; опубликованные составляющие дают {parts}.",
    uk: "Опублікований підсумок: {total}; опубліковані складові дають {parts}.",
  },
  mk_mix_h: { en: "Where the right bank's electricity came from, % of consumption", ro: "De unde a venit electricitatea malului drept, % din consum", ru: "Откуда поступала электроэнергия правого берега, % потребления", uk: "Звідки надходила електроенергія правого берега, % споживання" },
  mk_c_period: { en: "Period", ro: "Perioada", ru: "Период", uk: "Період" },
  mk_c_right: { en: "Own sources, right bank", ro: "Surse proprii, malul drept", ru: "Собственные источники, правый берег", uk: "Власні джерела, правий берег" },
  mk_c_left: { en: "Left bank (MGRES)", ro: "Malul stâng (MGRES)", ru: "Левый берег (MGRES)", uk: "Лівий берег (MGRES)" },
  mk_c_ua: { en: "Import, Ukraine", ro: "Import, Ucraina", ru: "Импорт, Украина", uk: "Імпорт, Україна" },
  mk_c_ro: { en: "Import, Romania", ro: "Import, România", ru: "Импорт, Румыния", uk: "Імпорт, Румунія" },
  mk_year: { en: "{y}, full year", ro: "{y}, tot anul", ru: "{y}, весь год", uk: "{y}, увесь рік" },
  mk_mix_note: {
    en: "From January 2025 the left bank (MGRES) is at 0%, and imports from Romania are the largest share. Cells without a published value are left empty.",
    ro: "Din ianuarie 2025 malul stâng (MGRES) este la 0%, iar importul din România are cea mai mare pondere. Celulele fără valoare publicată rămân goale.",
    ru: "С января 2025 года левый берег (MGRES) на 0%, а наибольшая доля приходится на импорт из Румынии. Ячейки без опубликованного значения остаются пустыми.",
    uk: "З січня 2025 року лівий берег (MGRES) на 0%, а найбільша частка припадає на імпорт з Румунії. Клітинки без опублікованого значення залишаються порожніми.",
  },
  mk_res_h: { en: "Renewables' share of electricity consumption, %", ro: "Ponderea regenerabilelor în consumul de electricitate, %", ru: "Доля ВИЭ в потреблении электроэнергии, %", uk: "Частка ВДЕ у споживанні електроенергії, %" },
  mk_bal_h: { en: "Balancing capacity: requested and procured, MW", ro: "Capacitate de echilibrare: cerută și contractată, MW", ru: "Балансирующая мощность: запрошено и законтрактовано, МВт", uk: "Балансувальна потужність: запитано й законтрактовано, МВт" },
  mk_c_product: { en: "Product", ro: "Produs", ru: "Продукт", uk: "Продукт" },
  mk_c_req: { en: "Requested", ro: "Cerut", ru: "Запрошено", uk: "Запитано" },
  mk_c_got: { en: "Procured", ro: "Contractat", ru: "Законтрактовано", uk: "Законтрактовано" },
  mk_c_gap: { en: "Not covered", ro: "Neacoperit", ru: "Не покрыто", uk: "Не покрито" },
  mk_avg: { en: "average {x}", ro: "media {x}", ru: "в среднем {x}", uk: "у середньому {x}" },
  mk_bal_note: {
    en: "Long-term tender by the transmission operator (Moldelectrica), results announced on {date}. What it did not cover is capacity the operator still needs.",
    ro: "Licitație pe termen lung a operatorului de transport (Moldelectrica), rezultate anunțate pe {date}. Ce nu a acoperit este capacitate de care operatorul încă are nevoie.",
    ru: "Долгосрочный тендер оператора передающей системы (Moldelectrica), итоги объявлены {date}. Непокрытое остаётся мощностью, которая оператору всё ещё нужна.",
    uk: "Довгостроковий тендер оператора системи передачі (Moldelectrica), підсумки оголошено {date}. Непокрите залишається потужністю, яка оператору ще потрібна.",
  },
  mk_dam_h: { en: "Day-ahead market (OPEM), daily average price", ro: "Piața pentru ziua următoare (OPEM), prețul mediu al zilei", ru: "Рынок на сутки вперёд (OPEM), средняя цена за день", uk: "Ринок на добу наперед (OPEM), середня ціна за день" },
  mk_dam_vol: {
    en: "In August 2026 the day-ahead market traded {min} to {max} of daily consumption, {rec} on its record day.",
    ro: "În august 2026 piața pentru ziua următoare a tranzacționat între {min} și {max} din consumul zilnic, {rec} în ziua record.",
    ru: "В августе 2026 года на рынке на сутки вперёд продавалось от {min} до {max} суточного потребления, {rec} в рекордный день.",
    uk: "У серпні 2026 року на ринку на добу наперед продавалося від {min} до {max} добового споживання, {rec} у рекордний день.",
  },
  mk_obj_h: { en: "State objectives", ro: "Obiectivele statului", ru: "Цели государства", uk: "Цілі держави" },
  mk_obj_import: { en: "Energy import dependence", ro: "Dependența de importul de energie", ru: "Зависимость от импорта энергии", uk: "Залежність від імпорту енергії" },
  mk_obj_import_v: { en: "{a} in {y1}, target {b} by {y2}", ro: "{a} în {y1}, țintă {b} până în {y2}", ru: "{a} в {y1}, цель {b} к {y2}", uk: "{a} у {y1}, ціль {b} до {y2}" },
  mk_obj_2050: { en: "Installed by 2050", ro: "Instalat până în 2050", ru: "Установить к 2050", uk: "Встановити до 2050" },
  mk_obj_2050_v: { en: "wind {w}, solar {s}, storage {st} / {stmwh}", ro: "eolian {w}, solar {s}, stocare {st} / {stmwh}", ru: "ветер {w}, солнце {s}, накопители {st} / {stmwh}", uk: "вітер {w}, сонце {s}, накопичувачі {st} / {stmwh}" },
  mk_sup_h: { en: "State support a lender can count on", ro: "Sprijinul statului pe care se poate baza un finanțator", ru: "Господдержка, на которую может рассчитывать кредитор", uk: "Державна підтримка, на яку може розраховувати кредитор" },
  mk_sup_g: { en: "Loan guarantee for battery storage", ro: "Garanție de credit pentru stocarea în baterii", ru: "Гарантия по кредитам на накопители", uk: "Гарантія за кредитами на накопичувачі" },
  mk_sup_g_v: {
    en: "up to {pct}% of the loan, at most {cap} per beneficiary, up to {months} months, {fee}% a year; budget {budget}, about {lev} of guaranteed loans; open until {date}",
    ro: "până la {pct}% din credit, maximum {cap} pe beneficiar, până la {months} de luni, {fee}% pe an; buget {budget}, circa {lev} de credite garantate; valabil până la {date}",
    ru: "до {pct}% кредита, не более {cap} на получателя, до {months} месяцев, {fee}% в год; бюджет {budget}, около {lev} гарантированных кредитов; действует до {date}",
    uk: "до {pct}% кредиту, не більше {cap} на отримувача, до {months} місяців, {fee}% на рік; бюджет {budget}, близько {lev} гарантованих кредитів; діє до {date}",
  },
  mk_sup_law: { en: "Law No. 112 of 11 June 2026", ro: "Legea nr. 112 din 11 iunie 2026", ru: "Закон № 112 от 11 июня 2026", uk: "Закон № 112 від 11 червня 2026" },
  mk_sup_law_v: {
    en: "VAT on battery storage investments can be recovered (refund, offset or carry-forward); customs duty on batteries cut from {from}% to {to}%",
    ro: "TVA la investițiile în stocare se poate recupera (rambursare, compensare sau reportare); taxa vamală pe baterii redusă de la {from}% la {to}%",
    ru: "НДС по инвестициям в накопители можно вернуть (возврат, зачёт или перенос); пошлина на батареи снижена с {from}% до {to}%",
    uk: "ПДВ за інвестиціями в накопичувачі можна повернути (повернення, зарахування або перенесення); мито на батареї знижено з {from}% до {to}%",
  },
};

export const ET = T;

/** et("upto", "ro", { x: "12.000 lei" }) */
export function et(key, lang = "en", vars = null) {
  const e = (vars && Number(vars.n) === 1 && T[key + "_one"]) || T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** "Ministry of Energy, Presentation at Moldova Business Week 2026" in the reader's language. */
export function sourceLine(ids, lang = "en") {
  return ids.map((id) => {
    const s = SOURCES[id];
    return s ? `${s.publisher[lang] || s.publisher.en}, ${s.title[lang] || s.title.en}` : id;
  }).join("; ");
}
