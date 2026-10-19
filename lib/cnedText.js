// lib/cnedText.js — every word of the CNED surfaces in four languages: the
// map, "Your market", prosumers and production on /energy, the area card on a
// quote, the line a client may see, the qualified-installer badge, and the
// regional context in a portfolio report. Module-local like lib/energyText.js;
// lib/cnedText.test.js holds it to the same rules (all four languages, the
// same placeholders, no dashes, middle dots or check marks).
//
// ct(key, lang, { x: "…" }) fills {x}. Installer copy says "tu" in Romanian;
// client copy (pp_*) is formal.

const T = {
  local_note: {
    en: "Local preview: CNED's data shows on this machine only, until CNED confirms in writing that VoltMira may reuse it.",
    ro: "Previzualizare locală: datele CNED apar doar pe acest calculator, până când CNED confirmă în scris că VoltMira le poate folosi.",
    ru: "Локальный просмотр: данные CNED видны только на этом компьютере, пока CNED письменно не подтвердит, что VoltMira может их использовать.",
    uk: "Локальний перегляд: дані CNED видно лише на цьому комп’ютері, доки CNED письмово не підтвердить, що VoltMira може їх використовувати.",
  },
  src: { en: "Source: {src}", ro: "Sursa: {src}", ru: "Источник: {src}", uk: "Джерело: {src}" },
  src_cned: {
    en: "CNED, installed renewable capacity, data to {date}",
    ro: "CNED, capacități instalate E-SER, date la {date}",
    ru: "CNED, установленные мощности ВИЭ, данные на {date}",
    uk: "CNED, встановлені потужності ВДЕ, дані на {date}",
  },
  src_pop: { en: "population: BNS, 1 January 2026", ro: "populația: BNS, 1 ianuarie 2026", ru: "население: НБС, 1 января 2026 года", uk: "населення: НБС, 1 січня 2026 року" },
  src_shapes: {
    en: "boundaries: geoBoundaries (UNHCR, OCHA), CC BY 3.0 IGO",
    ro: "limite: geoBoundaries (UNHCR, OCHA), CC BY 3.0 IGO",
    ru: "границы: geoBoundaries (UNHCR, OCHA), CC BY 3.0 IGO",
    uk: "межі: geoBoundaries (UNHCR, OCHA), CC BY 3.0 IGO",
  },

  // ---- headline figures on /energy
  k_cap_l: { en: "Installed capacity", ro: "Capacitate instalată", ru: "Установленная мощность", uk: "Встановлена потужність" },
  k_cap_s: {
    en: "Solar parks {s}, wind {w}, prosumers {p}, hydro {h}, at {date}",
    ro: "Parcuri solare {s}, eolian {w}, prosumatori {p}, hidro {h}, la {date}",
    ru: "Солнечные парки {s}, ветер {w}, просьюмеры {p}, ГЭС {h}, на {date}",
    uk: "Сонячні парки {s}, вітер {w}, просьюмери {p}, ГЕС {h}, на {date}",
  },
  k_bess_l: { en: "Battery storage connected", ro: "Stocare în baterii racordată", ru: "Подключённые накопители", uk: "Підключені накопичувачі" },
  k_bess_s: {
    en: "{n} installations, {mw}, all commissioned in {y}",
    ro: "{n} instalații, {mw}, toate puse în funcțiune în {y}",
    ru: "Установок: {n}, {mw}, все введены в {y} году",
    uk: "Установок: {n}, {mw}, усі введені у {y} році",
  },
  k_inst_l: { en: "Installations", ro: "Instalații", ru: "Установки", uk: "Установки" },
  inst_n: { en: "{n} installations", ro: "{n} instalații", ru: "установок: {n}", uk: "установок: {n}" },
  inst_one: { en: "1 installation", ro: "1 instalație", ru: "1 установка", uk: "1 установка" },
  k_inst_s: {
    en: "{pv} solar parks, {w} wind, {h} hydro, {p} prosumers",
    ro: "{pv} parcuri solare, {w} eoliene, {h} hidro, {p} prosumatori",
    ru: "Солнечных парков: {pv}, ветровых: {w}, ГЭС: {h}, просьюмеров: {p}",
    uk: "Сонячних парків: {pv}, вітрових: {w}, ГЕС: {h}, просьюмерів: {p}",
  },
  k_total_note: {
    en: "The total includes {o} of biogas, which VoltMira does not cover.",
    ro: "Totalul include {o} biogaz, pe care VoltMira nu îl acoperă.",
    ru: "В итог входит {o} биогаза, который VoltMira не охватывает.",
    uk: "До підсумку входить {o} біогазу, який VoltMira не охоплює.",
  },

  // ---- the map
  map_h: { en: "Renewables by area", ro: "Energie regenerabilă pe raioane", ru: "ВИЭ по районам", uk: "ВДЕ за районами" },
  map_s: {
    en: "What is built in each raion and how fast prosumers grow. Pick an area for its figures.",
    ro: "Ce s-a construit în fiecare raion și cât de repede cresc prosumatorii. Alege un raion pentru detalii.",
    ru: "Что построено в каждом районе и как быстро растут просьюмеры. Выберите район, чтобы увидеть цифры.",
    uk: "Що збудовано в кожному районі і як швидко зростають просьюмери. Оберіть район, щоб побачити цифри.",
  },
  map_aria: { en: "Map of Moldova's raions", ro: "Harta raioanelor Moldovei", ru: "Карта районов Молдовы", uk: "Мапа районів Молдови" },
  metric_l: { en: "Colour by", ro: "Colorează după", ru: "Цвет по", uk: "Колір за" },
  m_plants: { en: "Plants, kW", ro: "Centrale, kW", ru: "Станции, кВт", uk: "Станції, кВт" },
  m_prosumers: { en: "Prosumers, kW", ro: "Prosumatori, kW", ru: "Просьюмеры, кВт", uk: "Просьюмери, кВт" },
  m_per10k: { en: "Prosumers per 10,000 residents", ro: "Prosumatori la 10.000 de locuitori", ru: "Просьюмеров на 10 000 жителей", uk: "Просьюмерів на 10 000 мешканців" },
  m_growth: { en: "Prosumer kW added in 12 months", ro: "kW de prosumatori adăugați în 12 luni", ru: "кВт просьюмеров за 12 месяцев", uk: "кВт просьюмерів за 12 місяців" },
  tech_l: { en: "Plants", ro: "Centrale", ru: "Станции", uk: "Станції" },
  tech_all: { en: "All", ro: "Toate", ru: "Все", uk: "Усі" },
  tech_pv: { en: "Solar", ro: "Solar", ru: "Солнце", uk: "Сонце" },
  tech_wind: { en: "Wind", ro: "Eolian", ru: "Ветер", uk: "Вітер" },
  tech_hydro: { en: "Hydro", ro: "Hidro", ru: "ГЭС", uk: "ГЕС" },
  dots: { en: "Show plants on the map", ro: "Arată centralele pe hartă", ru: "Показать станции на карте", uk: "Показати станції на мапі" },
  dots_note: {
    en: "Plant positions are rounded to about 1 km. {x} of plants have no published position and are not drawn.",
    ro: "Pozițiile centralelor sunt rotunjite la circa 1 km. {x} din centrale nu au o poziție publicată și nu apar pe hartă.",
    ru: "Положения станций округлены примерно до 1 км. Для {x} станций положение не опубликовано, они не показаны.",
    uk: "Розташування станцій округлено приблизно до 1 км. Для {x} станцій розташування не опубліковано, їх не показано.",
  },
  no_data: { en: "No data published for this area", ro: "Nu sunt date publicate pentru această zonă", ru: "Для этой зоны данные не опубликованы", uk: "Для цієї зони дані не опубліковано" },
  less: { en: "less", ro: "mai puțin", ru: "меньше", uk: "менше" },
  more: { en: "more", ro: "mai mult", ru: "больше", uk: "більше" },
  plant_tip: { en: "{t}: {kw}, {n} plants", ro: "{t}: {kw}, {n} centrale", ru: "{t}: {kw}, станций: {n}", uk: "{t}: {kw}, станцій: {n}" },

  // ---- the area panel
  p_pop: { en: "{n} residents", ro: "{n} locuitori", ru: "Жителей: {n}", uk: "Мешканців: {n}" },
  p_operator: { en: "Grid: {op}", ro: "Rețea: {op}", ru: "Сеть: {op}", uk: "Мережа: {op}" },
  p_plants: { en: "Plants", ro: "Centrale", ru: "Станции", uk: "Станції" },
  p_plants_v: { en: "{kw} in {n} plants", ro: "{kw} în {n} centrale", ru: "{kw}, станций: {n}", uk: "{kw}, станцій: {n}" },
  p_prosumers: { en: "Prosumers", ro: "Prosumatori", ru: "Просьюмеры", uk: "Просьюмери" },
  p_prosumers_v: { en: "{n}, with {kw}", ro: "{n}, cu {kw}", ru: "{n}, всего {kw}", uk: "{n}, разом {kw}" },
  p_per10k: { en: "Per 10,000 residents", ro: "La 10.000 de locuitori", ru: "На 10 000 жителей", uk: "На 10 000 мешканців" },
  p_rank: { en: "place {r} of {t}", ro: "locul {r} din {t}", ru: "{r} место из {t}", uk: "{r} місце з {t}" },
  p_growth: { en: "Last 12 months", ro: "Ultimele 12 luni", ru: "За 12 месяцев", uk: "За 12 місяців" },
  p_growth_v: { en: "+{n} prosumers, +{kw}", ro: "+{n} prosumatori, +{kw}", ru: "+{n} просьюмеров, +{kw}", uk: "+{n} просьюмерів, +{kw}" },
  p_who: { en: "Households and companies", ro: "Gospodării și firme", ru: "Домохозяйства и компании", uk: "Домогосподарства і компанії" },
  households_n: { en: "Households {n}", ro: "Gospodării {n}", ru: "Домохозяйства {n}", uk: "Домогосподарства {n}" },
  companies_n: { en: "Companies {n}", ro: "Firme {n}", ru: "Компании {n}", uk: "Компанії {n}" },
  p_scheme: { en: "Net metering and net billing", ro: "Contorizare netă și facturare netă", ru: "Нетто-учёт и нетто-биллинг", uk: "Нетто-облік і нетто-білінг" },
  cn_n: { en: "Net metering {n}", ro: "Contorizare netă {n}", ru: "Нетто-учёт {n}", uk: "Нетто-облік {n}" },
  fn_n: { en: "Net billing {n}", ro: "Facturare netă {n}", ru: "Нетто-биллинг {n}", uk: "Нетто-білінг {n}" },
  p_trend: { en: "Prosumer capacity, last 25 months", ro: "Capacitatea prosumatorilor, ultimele 25 de luni", ru: "Мощность просьюмеров за 25 месяцев", uk: "Потужність просьюмерів за 25 місяців" },
  p_bess: { en: "Battery storage: {kwh} in {n} installations", ro: "Stocare în baterii: {kwh} în {n} instalații", ru: "Накопители: {kwh}, установок: {n}", uk: "Накопичувачі: {kwh}, установок: {n}" },
  p_select: { en: "Area", ro: "Raion", ru: "Район", uk: "Район" },

  // ---- the table
  t_h: { en: "Every area", ro: "Toate raioanele", ru: "Все районы", uk: "Усі райони" },
  col_raion: { en: "Area", ro: "Raion", ru: "Район", uk: "Район" },
  col_plants: { en: "Plants, kW", ro: "Centrale, kW", ru: "Станции, кВт", uk: "Станції, кВт" },
  col_pros_n: { en: "Prosumers", ro: "Prosumatori", ru: "Просьюмеры", uk: "Просьюмери" },
  col_pros_kw: { en: "Prosumers, kW", ro: "Prosumatori, kW", ru: "Просьюмеры, кВт", uk: "Просьюмери, кВт" },
  col_per10k: { en: "Per 10,000", ro: "La 10.000", ru: "На 10 000", uk: "На 10 000" },
  col_growth: { en: "12 months, kW", ro: "12 luni, kW", ru: "12 мес., кВт", uk: "12 міс., кВт" },
  sort_by: { en: "Sort by {c}", ro: "Sortează după {c}", ru: "Сортировать по: {c}", uk: "Сортувати за: {c}" },

  // ---- your market
  mk_h: { en: "Your market", ro: "Piața ta", ru: "Ваш рынок", uk: "Ваш ринок" },
  mk_s: {
    en: "Pick the areas you work in: how many prosumers they have, how fast they grow, and which nearby areas grow fastest.",
    ro: "Alege raioanele în care lucrezi: câți prosumatori au, cât de repede cresc și care raioane vecine cresc cel mai repede.",
    ru: "Выберите районы, где вы работаете: сколько там просьюмеров, как быстро они растут и какие соседние районы растут быстрее всего.",
    uk: "Оберіть райони, де ви працюєте: скільки там просьюмерів, як швидко вони зростають і які сусідні райони зростають найшвидше.",
  },
  mk_add: { en: "Add an area", ro: "Adaugă un raion", ru: "Добавить район", uk: "Додати район" },
  mk_remove: { en: "Remove {x}", ro: "Elimină {x}", ru: "Убрать {x}", uk: "Прибрати {x}" },
  mk_empty: {
    en: "No area picked yet. Add the raioane you install in, or pick one on the map below.",
    ro: "Niciun raion ales încă. Adaugă raioanele în care montezi sau alege unul pe harta de mai jos.",
    ru: "Районы ещё не выбраны. Добавьте районы, где вы монтируете, или выберите на карте ниже.",
    uk: "Райони ще не обрано. Додайте райони, де ви монтуєте, або оберіть на мапі нижче.",
  },
  mk_kept: { en: "Kept in this browser.", ro: "Păstrat în acest browser.", ru: "Сохраняется в этом браузере.", uk: "Зберігається в цьому браузері." },
  mk_k_pros: { en: "Prosumers in your areas", ro: "Prosumatori în raioanele tale", ru: "Просьюмеры в ваших районах", uk: "Просьюмери у ваших районах" },
  mk_k_pros_s: { en: "{kw} in all", ro: "{kw} în total", ru: "Всего {kw}", uk: "Разом {kw}" },
  mk_k_new: { en: "Added in 12 months", ro: "Adăugați în 12 luni", ru: "Добавлено за 12 месяцев", uk: "Додано за 12 місяців" },
  mk_k_new_s: { en: "{kw}, {p} more capacity than a year ago", ro: "{kw}, cu {p} mai multă capacitate decât acum un an", ru: "{kw}, мощность выросла на {p} за год", uk: "{kw}, потужність зросла на {p} за рік" },
  mk_k_per10k: { en: "Per 10,000 residents", ro: "La 10.000 de locuitori", ru: "На 10 000 жителей", uk: "На 10 000 мешканців" },
  mk_k_per10k_s: { en: "Country: {x}", ro: "Național: {x}", ru: "По стране: {x}", uk: "По країні: {x}" },
  mk_k_house: { en: "Households", ro: "Gospodării", ru: "Домохозяйства", uk: "Домогосподарства" },
  mk_k_house_s: { en: "{p} of prosumers; companies {c}", ro: "{p} dintre prosumatori; firme {c}", ru: "{p} просьюмеров; компаний: {c}", uk: "{p} просьюмерів; компаній: {c}" },
  mk_rows_h: { en: "Your areas, fastest growing first", ro: "Raioanele tale, cele care cresc mai repede primele", ru: "Ваши районы, сначала самые быстрорастущие", uk: "Ваші райони, спершу ті, що зростають найшвидше" },
  mk_near_h: { en: "Nearby areas growing fastest", ro: "Raioane vecine care cresc cel mai repede", ru: "Соседние районы с самым быстрым ростом", uk: "Сусідні райони з найшвидшим зростанням" },
  mk_near_add: { en: "Add {x}", ro: "Adaugă {x}", ru: "Добавить {x}", uk: "Додати {x}" },
  mk_leads: { en: "Open leads", ro: "Deschide clienții potențiali", ru: "Открыть лиды", uk: "Відкрити ліди" },
  mk_on_map: { en: "Show on the map", ro: "Arată pe hartă", ru: "Показать на карте", uk: "Показати на мапі" },

  // ---- prosumers by scheme
  sch_h: { en: "Prosumers: from net metering to net billing", ro: "Prosumatori: de la contorizare netă la facturare netă", ru: "Просьюмеры: от нетто-учёта к нетто-биллингу", uk: "Просьюмери: від нетто-обліку до нетто-білінгу" },
  sch_s: { en: "Capacity at the end of each year, MW", ro: "Capacitatea la sfârșitul fiecărui an, MW", ru: "Мощность на конец каждого года, МВт", uk: "Потужність на кінець кожного року, МВт" },
  sch_note: {
    en: "Net metering has not grown since the end of {y} ({cn}): every prosumer added since then is on net billing.",
    ro: "Contorizarea netă nu a mai crescut de la sfârșitul lui {y} ({cn}): toți prosumatorii adăugați de atunci sunt pe facturare netă.",
    ru: "Нетто-учёт не растёт с конца {y} года ({cn}): все новые просьюмеры с тех пор на нетто-биллинге.",
    uk: "Нетто-облік не зростає з кінця {y} року ({cn}): усі нові просьюмери відтоді на нетто-білінгу.",
  },
  sch_who: {
    en: "Today: households {pf} ({pfn}), companies {pj} ({pjn}).",
    ro: "Acum: gospodării {pf} ({pfn}), firme {pj} ({pjn}).",
    ru: "Сейчас: домохозяйства {pf} ({pfn}), компании {pj} ({pjn}).",
    uk: "Зараз: домогосподарства {pf} ({pfn}), компанії {pj} ({pjn}).",
  },
  cn_l: { en: "Net metering", ro: "Contorizare netă", ru: "Нетто-учёт", uk: "Нетто-облік" },
  fn_l: { en: "Net billing", ro: "Facturare netă", ru: "Нетто-биллинг", uk: "Нетто-білінг" },

  // ---- production
  prod_h: { en: "Energy produced from renewables", ro: "Energia produsă din surse regenerabile", ru: "Выработка из ВИЭ", uk: "Вироблено з ВДЕ" },
  prod_s: { en: "Per year, GWh", ro: "Pe an, GWh", ru: "За год, млн кВт·ч", uk: "За рік, млн кВт·год" },
  gwh: { en: "GWh", ro: "GWh", ru: "млн кВт·ч", uk: "млн кВт·год" },
  prod_prosumers: { en: "Prosumers", ro: "Prosumatori", ru: "Просьюмеры", uk: "Просьюмери" },
  prod_total: {
    en: "{t} in {y}, including {o} from biogas, not drawn.",
    ro: "{t} în {y}, din care {o} din biogaz, nedesenat.",
    ru: "{t} в {y} году, из них {o} из биогаза, на графике нет.",
    uk: "{t} у {y} році, з них {o} з біогазу, на графіку немає.",
  },
  prod_note: { en: "Solar parks: {a} in {y0}, {b} in {y1}.", ro: "Parcurile solare: {a} în {y0}, {b} în {y1}.", ru: "Солнечные парки: {a} в {y0} году, {b} в {y1} году.", uk: "Сонячні парки: {a} у {y0} році, {b} у {y1} році." },

  // ---- battery storage
  bess_h: { en: "Battery storage on the grid", ro: "Baterii racordate la rețea", ru: "Накопители в сети", uk: "Накопичувачі в мережі" },
  bess_v: { en: "{kwh} of storage, {mw} of power, in {n} installations", ro: "{kwh} stocare, {mw} putere, în {n} instalații", ru: "{kwh} ёмкости, {mw} мощности, установок: {n}", uk: "{kwh} ємності, {mw} потужності, установок: {n}" },

  // ---- the area card on a quote (installer only)
  q_h: { en: "The job's area", ro: "Raionul lucrării", ru: "Район объекта", uk: "Район об’єкта" },
  q_none: { en: "Pick the address on the map to see its area.", ro: "Alege adresa pe hartă ca să vezi raionul.", ru: "Выберите адрес на карте, чтобы увидеть район.", uk: "Оберіть адресу на мапі, щоб побачити район." },
  q_outside: { en: "CNED publishes no data for this position.", ro: "CNED nu publică date pentru această poziție.", ru: "CNED не публикует данных для этого места.", uk: "CNED не публікує даних для цього місця." },
  q_loading: { en: "Loading the area", ro: "Se încarcă raionul", ru: "Загрузка района", uk: "Завантаження району" },
  q_line: { en: "{n} prosumers ({h} households), {kw} in all.", ro: "{n} prosumatori ({h} gospodării), {kw} în total.", ru: "Просьюмеров: {n} (домохозяйств: {h}), всего {kw}.", uk: "Просьюмерів: {n} (домогосподарств: {h}), разом {kw}." },
  q_growth: { en: "+{n} in the last 12 months.", ro: "+{n} în ultimele 12 luni.", ru: "+{n} за последние 12 месяцев.", uk: "+{n} за останні 12 місяців." },
  q_rank: {
    en: "{x} per 10,000 residents, place {r} of {t} in the country.",
    ro: "{x} la 10.000 de locuitori, locul {r} din {t} în țară.",
    ru: "{x} на 10 000 жителей, {r} место из {t} в стране.",
    uk: "{x} на 10 000 мешканців, {r} місце з {t} у країні.",
  },
  q_show: { en: "Show this line in the client's offer", ro: "Arată acest rând în oferta clientului", ru: "Показать эту строку в КП клиента", uk: "Показати цей рядок у пропозиції клієнта" },
  q_client_sees: { en: "The client reads:", ro: "Clientul citește:", ru: "Клиент прочитает:", uk: "Клієнт прочитає:" },
  q_after_send: {
    en: "Applies to offers generated or refreshed after you switch it on.",
    ro: "Se aplică ofertelor generate sau actualizate după ce îl pornești.",
    ru: "Действует для КП, созданных или обновлённых после включения.",
    uk: "Діє для пропозицій, створених або оновлених після ввімкнення.",
  },
  q_needs_db: {
    en: "Not saved: run supabase/add-show-raion.sql in Supabase first.",
    ro: "Nesalvat: rulează întâi supabase/add-show-raion.sql în Supabase.",
    ru: "Не сохранено: сначала выполните supabase/add-show-raion.sql в Supabase.",
    uk: "Не збережено: спершу виконайте supabase/add-show-raion.sql у Supabase.",
  },
  q_failed: { en: "Could not save. Try again.", ro: "Nu s-a salvat. Încearcă din nou.", ru: "Не удалось сохранить. Попробуйте ещё раз.", uk: "Не вдалося зберегти. Спробуйте ще раз." },
  q_open_map: { en: "See it on the map", ro: "Vezi pe hartă", ru: "Смотреть на карте", uk: "Дивитися на мапі" },

  // ---- what the client may read (formal)
  pp_line: {
    en: "Households in {raion} that already produce their own electricity: {h}.",
    ro: "Gospodării din {raion} care își produc deja energia electrică: {h}.",
    ru: "Домохозяйств в {raion}, которые уже производят свою электроэнергию: {h}.",
    uk: "Домогосподарств у {raion}, які вже виробляють власну електроенергію: {h}.",
  },
  pp_src: { en: "CNED register, data to {date}", ro: "Registrul CNED, date la {date}", ru: "Реестр CNED, данные на {date}", uk: "Реєстр CNED, дані на {date}" },

  // ---- the qualified-installer badge
  badge: { en: "CNED-qualified installer", ro: "Instalator calificat CNED", ru: "Монтажник, аттестованный CNED", uk: "Монтажник, атестований CNED" },
  badge_t: {
    en: "Listed in CNED's register of qualified renewable-system installers",
    ro: "Înscris în Registrul electronic al instalatorilor de sisteme SER al CNED",
    ru: "Внесён в реестр аттестованных монтажников систем ВИЭ CNED",
    uk: "Внесений до реєстру атестованих монтажників систем ВДЕ CNED",
  },

  // ---- the portfolio report
  rg_h: { en: "Regional context (CNED)", ro: "Context regional (CNED)", ru: "Региональный контекст (CNED)", uk: "Регіональний контекст (CNED)" },
  rg_intro: {
    en: "What is already connected in each asset's area, from CNED's register. A crowded area is a prompt to check the substation's free capacity, not a finding about the grid.",
    ro: "Ce este deja racordat în raionul fiecărui activ, din registrul CNED. Un raion aglomerat este un semnal să verificați capacitatea liberă a stației, nu o concluzie despre rețea.",
    ru: "Что уже подключено в районе каждого актива, по реестру CNED. Насыщенный район: повод проверить свободную мощность подстанции, а не вывод о сети.",
    uk: "Що вже підключено в районі кожного активу, за реєстром CNED. Насичений район: привід перевірити вільну потужність підстанції, а не висновок про мережу.",
  },
  rg_asset: { en: "Asset", ro: "Activ", ru: "Актив", uk: "Актив" },
  rg_raion: { en: "Area", ro: "Raion", ru: "Район", uk: "Район" },
  rg_pv: { en: "Solar plants", ro: "Centrale solare", ru: "Солнечные станции", uk: "Сонячні станції" },
  rg_wind: { en: "Wind", ro: "Eolian", ru: "Ветер", uk: "Вітер" },
  rg_pros: { en: "Prosumers", ro: "Prosumatori", ru: "Просьюмеры", uk: "Просьюмери" },
  rg_bess: { en: "Storage", ro: "Stocare", ru: "Накопители", uk: "Накопичувачі" },
  rg_flag: { en: "Note", ro: "Observație", ru: "Примечание", uk: "Примітка" },
  rg_crowded: {
    en: "Many solar plants already: check the substation's free capacity",
    ro: "Multe centrale solare deja: verificați capacitatea liberă a stației",
    ru: "Уже много солнечных станций: проверьте свободную мощность подстанции",
    uk: "Уже багато сонячних станцій: перевірте вільну потужність підстанції",
  },
  rg_uncovered: { en: "No CNED data for this area", ro: "Fără date CNED pentru această zonă", ru: "Нет данных CNED для этой зоны", uk: "Немає даних CNED для цієї зони" },

  // ---- credits
  cr_cned: {
    en: "Installed renewable capacity by area: CNED (Centrul Național pentru Energie Durabilă), shown in a local preview until CNED confirms its reuse.",
    ro: "Capacități regenerabile instalate pe raioane: CNED (Centrul Național pentru Energie Durabilă), afișate doar local până când CNED confirmă folosirea lor.",
    ru: "Установленные мощности ВИЭ по районам: CNED (Centrul Național pentru Energie Durabilă), показаны локально, пока CNED не подтвердит их использование.",
    uk: "Встановлені потужності ВДЕ за районами: CNED (Centrul Național pentru Energie Durabilă), показані локально, доки CNED не підтвердить їх використання.",
  },
  cr_bns: {
    en: "Population by area: National Bureau of Statistics (BNS), 1 January 2026.",
    ro: "Populația pe raioane: Biroul Național de Statistică (BNS), 1 ianuarie 2026.",
    ru: "Население по районам: Национальное бюро статистики (НБС), 1 января 2026 года.",
    uk: "Населення за районами: Національне бюро статистики (НБС), 1 січня 2026 року.",
  },
  cr_shapes: {
    en: "Area boundaries: geoBoundaries, from UNHCR and OCHA FISS, licensed CC BY 3.0 IGO.",
    ro: "Limitele raioanelor: geoBoundaries, după UNHCR și OCHA FISS, licență CC BY 3.0 IGO.",
    ru: "Границы районов: geoBoundaries, по данным UNHCR и OCHA FISS, лицензия CC BY 3.0 IGO.",
    uk: "Межі районів: geoBoundaries, за даними UNHCR і OCHA FISS, ліцензія CC BY 3.0 IGO.",
  },
  // ---- the map, redrawn (components/energy/CnedMap.jsx, CnedArea.jsx, CnedQuadrant.jsx)
  map_s2: {
    en: "What is built in each raion and how fast prosumers grow. Hover an area for its figure, click it for its profile, or play the years and months CNED keeps.",
    ro: "Ce s-a construit în fiecare raion și cât de repede cresc prosumatorii. Treci peste un raion pentru cifră, apasă pe el pentru profil sau pornește anii și lunile păstrate de CNED.",
    ru: "Что построено в каждом районе и как быстро растут просьюмеры. Наведите на район, чтобы увидеть цифру, нажмите, чтобы открыть профиль, или запустите годы и месяцы, которые хранит CNED.",
    uk: "Що збудовано в кожному районі і як швидко зростають просьюмери. Наведіть на район, щоб побачити цифру, натисніть, щоб відкрити профіль, або запустіть роки й місяці, які зберігає CNED.",
  },
  preview_badge: { en: "Local preview", ro: "Previzualizare locală", ru: "Локальный просмотр", uk: "Локальний перегляд" },
  data_date: { en: "CNED data to {date}", ro: "Date CNED la {date}", ru: "Данные CNED на {date}", uk: "Дані CNED на {date}" },
  ms_plants: { en: "Plants", ro: "Centrale", ru: "Станции", uk: "Станції" },
  ms_prosumers: { en: "Prosumers", ro: "Prosumatori", ru: "Просьюмеры", uk: "Просьюмери" },
  ms_per10k: { en: "Per 10,000 residents", ro: "La 10.000 de locuitori", ru: "На 10 000 жителей", uk: "На 10 000 мешканців" },
  ms_growth: { en: "Growth, 12 months", ro: "Creștere, 12 luni", ru: "Рост за 12 месяцев", uk: "Зростання за 12 місяців" },
  lg_plants: { en: "Plants connected", ro: "Centrale racordate", ru: "Подключённые станции", uk: "Підключені станції" },
  lg_prosumers: { en: "Prosumer capacity", ro: "Capacitatea prosumatorilor", ru: "Мощность просьюмеров", uk: "Потужність просьюмерів" },
  lg_growth: { en: "Prosumer capacity added in 12 months", ro: "Capacitate de prosumatori adăugată în 12 luni", ru: "Мощность просьюмеров, добавленная за 12 месяцев", uk: "Потужність просьюмерів, додана за 12 місяців" },
  labels_on: { en: "Figures", ro: "Cifre", ru: "Цифры", uk: "Цифри" },
  dots_short: { en: "Plants on the map", ro: "Centrale pe hartă", ru: "Станции на карте", uk: "Станції на мапі" },
  no_data_short: { en: "No data", ro: "Fără date", ru: "Нет данных", uk: "Немає даних" },
  zoom_in: { en: "Zoom in", ro: "Mărește", ru: "Приблизить", uk: "Наблизити" },
  zoom_out: { en: "Zoom out", ro: "Micșorează", ru: "Отдалить", uk: "Віддалити" },
  reset_view: { en: "The whole country", ro: "Toată țara", ru: "Вся страна", uk: "Уся країна" },
  full: { en: "Full screen", ro: "Ecran complet", ru: "Во весь экран", uk: "На весь екран" },
  full_exit: { en: "Leave full screen", ro: "Ieși din ecranul complet", ru: "Выйти из полноэкранного режима", uk: "Вийти з повноекранного режиму" },
  play: { en: "Play the years and months", ro: "Pornește anii și lunile", ru: "Запустить годы и месяцы", uk: "Запустити роки й місяці" },
  pause: { en: "Pause", ro: "Pauză", ru: "Пауза", uk: "Пауза" },
  tl_label: { en: "Date shown on the map", ro: "Data arătată pe hartă", ru: "Дата на карте", uk: "Дата на мапі" },
  tl_year: { en: "end of {y}", ro: "sfârșitul lui {y}", ru: "конец {y} года", uk: "кінець {y} року" },
  tl_to: { en: "to {date}", ro: "la {date}", ru: "на {date}", uk: "на {date}" },
  tl_plants_note: {
    en: "Plant circles show today's plants, so they appear at the latest date only.",
    ro: "Cercurile centralelor arată centralele de azi, așa că apar doar la ultima dată.",
    ru: "Круги станций показывают сегодняшние станции, поэтому видны только на последнюю дату.",
    uk: "Кола станцій показують сьогоднішні станції, тому їх видно лише на останню дату.",
  },
  tip_click: { en: "Click for the profile", ro: "Apasă pentru profil", ru: "Нажмите, чтобы открыть профиль", uk: "Натисніть, щоб відкрити профіль" },
  p_trend_n: { en: "{n} prosumers", ro: "{n} prosumatori", ru: "просьюмеров: {n}", uk: "просьюмерів: {n}" },
  p_vs_up: { en: "{p} above the country ({x})", ro: "cu {p} peste media țării ({x})", ru: "на {p} выше среднего по стране ({x})", uk: "на {p} вище за середнє по країні ({x})" },
  p_vs_down: { en: "{p} below the country ({x})", ro: "cu {p} sub media țării ({x})", ru: "на {p} ниже среднего по стране ({x})", uk: "на {p} нижче за середнє по країні ({x})" },
  p_growth_s: { en: "+{n} prosumers, {p} in a year", ro: "+{n} prosumatori, {p} într-un an", ru: "+{n} просьюмеров, {p} за год", uk: "+{n} просьюмерів, {p} за рік" },
  p_plants_n: { en: "{n} plants", ro: "{n} centrale", ru: "станций: {n}", uk: "станцій: {n}" },
  p_mix: { en: "Plants by technology", ro: "Centrale după tehnologie", ru: "Станции по технологиям", uk: "Станції за технологіями" },
  p_no_plants: { en: "No plants connected here yet.", ro: "Încă nicio centrală racordată aici.", ru: "Здесь пока нет подключённых станций.", uk: "Тут поки немає підключених станцій." },
  p_near: { en: "Nearest areas, prosumers per 10,000 residents", ro: "Raioanele cele mai apropiate, prosumatori la 10.000 de locuitori", ru: "Ближайшие районы, просьюмеров на 10 000 жителей", uk: "Найближчі райони, просьюмерів на 10 000 мешканців" },
  p_in_market: { en: "In your market", ro: "În piața ta", ru: "В вашем рынке", uk: "У вашому ринку" },
  p_add_market: { en: "Add to your market", ro: "Adaugă în piața ta", ru: "Добавить в ваш рынок", uk: "Додати до вашого ринку" },
  mk_start: { en: "Or start from the areas that grew most in 12 months:", ro: "Sau pornește de la raioanele care au crescut cel mai mult în 12 luni:", ru: "Или начните с районов, которые выросли больше всего за 12 месяцев:", uk: "Або почніть із районів, що найбільше зросли за 12 місяців:" },
  q4_h: { en: "Where the market is growing", ro: "Unde crește piața", ru: "Где растёт рынок", uk: "Де зростає ринок" },
  q4_s: {
    en: "Each raion by how many prosumers it has per 10,000 residents and by how much their capacity grew in 12 months. The dashed lines are the medians of the raioane.",
    ro: "Fiecare raion după câți prosumatori are la 10.000 de locuitori și cât a crescut capacitatea lor în 12 luni. Liniile punctate sunt medianele raioanelor.",
    ru: "Каждый район по числу просьюмеров на 10 000 жителей и по росту их мощности за 12 месяцев. Пунктирные линии: медианы районов.",
    uk: "Кожен район за кількістю просьюмерів на 10 000 мешканців і за зростанням їхньої потужності за 12 місяців. Пунктирні лінії: медіани районів.",
  },
  q4_aria: {
    en: "Chart of the raioane by prosumers per 10,000 residents and 12-month capacity growth",
    ro: "Graficul raioanelor după prosumatorii la 10.000 de locuitori și creșterea capacității în 12 luni",
    ru: "График районов по просьюмерам на 10 000 жителей и росту мощности за 12 месяцев",
    uk: "Графік районів за просьюмерами на 10 000 мешканців і зростанням потужності за 12 місяців",
  },
  q4_x: { en: "Prosumers per 10,000 residents", ro: "Prosumatori la 10.000 de locuitori", ru: "Просьюмеров на 10 000 жителей", uk: "Просьюмерів на 10 000 мешканців" },
  q4_y: { en: "Capacity growth in 12 months", ro: "Creșterea capacității în 12 luni", ru: "Рост мощности за 12 месяцев", uk: "Зростання потужності за 12 місяців" },
  q_early: { en: "Growing fast, few prosumers yet", ro: "Cresc repede, încă puțini prosumatori", ru: "Быстрый рост, пока мало просьюмеров", uk: "Швидке зростання, поки мало просьюмерів" },
  q_hot: { en: "Growing fast, many already", ro: "Cresc repede, deja mulți", ru: "Быстрый рост, уже много", uk: "Швидке зростання, вже багато" },
  q_quiet: { en: "Slower, few prosumers", ro: "Mai lent, puțini prosumatori", ru: "Медленнее, мало просьюмеров", uk: "Повільніше, мало просьюмерів" },
  q_mature: { en: "Slower, many already", ro: "Mai lent, deja mulți", ru: "Медленнее, уже много", uk: "Повільніше, вже багато" },
  q4_size: { en: "Circle size: population", ro: "Mărimea cercului: populația", ru: "Размер круга: население", uk: "Розмір кола: населення" },
  q4_list_h: { en: "Areas to watch", ro: "Raioane de urmărit", ru: "Районы, за которыми стоит следить", uk: "Райони, за якими варто стежити" },
  q4_tip: { en: "{x} per 10,000 residents, +{y}% in 12 months", ro: "{x} la 10.000 de locuitori, +{y}% în 12 luni", ru: "{x} на 10 000 жителей, +{y}% за 12 месяцев", uk: "{x} на 10 000 мешканців, +{y}% за 12 місяців" },
  q4_row: { en: "{x} per 10,000, +{kw} in 12 months", ro: "{x} la 10.000, +{kw} în 12 luni", ru: "{x} на 10 000, +{kw} за 12 месяцев", uk: "{x} на 10 000, +{kw} за 12 місяців" },
  q4_note: {
    en: "A reading of CNED's counts, not a forecast. The medians: {x} prosumers per 10,000 residents, +{y}% in 12 months.",
    ro: "O citire a datelor CNED, nu o prognoză. Medianele: {x} prosumatori la 10.000 de locuitori, +{y}% în 12 luni.",
    ru: "Прочтение данных CNED, а не прогноз. Медианы: {x} просьюмеров на 10 000 жителей, +{y}% за 12 месяцев.",
    uk: "Прочитання даних CNED, а не прогноз. Медіани: {x} просьюмерів на 10 000 мешканців, +{y}% за 12 місяців.",
  },
  q4_missing: {
    en: "Not drawn, with no prosumers in CNED's register: {x}.",
    ro: "Nu apar, fără prosumatori în registrul CNED: {x}.",
    ru: "Не показаны, в реестре CNED нет просьюмеров: {x}.",
    uk: "Не показано, у реєстрі CNED немає просьюмерів: {x}.",
  },
  t_search: { en: "Find an area", ro: "Caută un raion", ru: "Найти район", uk: "Знайти район" },
  t_none: { en: "No area matches.", ro: "Niciun raion nu se potrivește.", ru: "Подходящих районов нет.", uk: "Відповідних районів немає." },
  col_trend: { en: "25 months", ro: "25 de luni", ru: "25 месяцев", uk: "25 місяців" },
};

export const CT = T;

export function ct(key, lang = "en", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** "Premier Energy" or "RED Nord" for an area's operator id. */
export const OPERATOR_NAME = { premier: "Premier Energy", rednord: "RED Nord" };
