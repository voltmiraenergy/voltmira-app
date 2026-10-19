// lib/feeText.js — every word of the pay-per-signed-job model in four
// languages: the Plan tab, a job's fee card, the invoice prompt, the sidebar
// and VoltMira's revenue page. Module-local like lib/cnedText.js;
// lib/feeText.test.js holds it to the same rules (all four languages, the same
// placeholders, no dashes, middle dots or check marks, no Russian letters in
// Ukrainian).
//
// ft(key, lang, { x: "…" }) fills {x}. Installer copy says "tu" in Romanian.

const T = {
  // ---- the model
  badge: { en: "Pay per signed job", ro: "Plată per lucrare semnată", ru: "Оплата за подписанный объект", uk: "Оплата за підписаний об’єкт" },
  preview: {
    en: "Local preview: this model shows on this computer only, and nobody is charged.",
    ro: "Previzualizare locală: modelul apare doar pe acest calculator și nu se facturează nimic.",
    ru: "Локальный просмотр: модель видна только на этом компьютере, никто ничего не платит.",
    uk: "Локальний перегляд: модель видно лише на цьому комп’ютері, ніхто нічого не платить.",
  },
  h: { en: "You pay only when a client signs", ro: "Plătești doar când clientul semnează", ru: "Вы платите, только когда клиент подписывает", uk: "Ви платите, лише коли клієнт підписує" },
  lead: {
    en: "VoltMira is free to use: unlimited offers, designs, grid files and documents, for your whole team. When a client signs a job, VoltMira charges a small fee on the system's size.",
    ro: "VoltMira se folosește gratuit: oferte, proiecte, dosare de racordare și documente fără limită, pentru toată echipa. Când un client semnează o lucrare, VoltMira ia o taxă mică după puterea sistemului.",
    ru: "VoltMira бесплатна: предложения, проекты, документы на подключение и прочие документы без ограничений, для всей команды. Когда клиент подписывает объект, VoltMira берёт небольшую плату по мощности системы.",
    uk: "VoltMira безкоштовна: пропозиції, проєкти, документи на приєднання та інші документи без обмежень, для всієї команди. Коли клієнт підписує об’єкт, VoltMira бере невелику плату за потужністю системи.",
  },
  r_kw: { en: "{lei} lei per kW of each signed job", ro: "{lei} lei pe kW din fiecare lucrare semnată", ru: "{lei} лей за кВт каждого подписанного объекта", uk: "{lei} лей за кВт кожного підписаного об’єкта" },
  r_cap: { en: "At most {lei} lei a job", ro: "Maximum {lei} lei pe lucrare", ru: "Не более {lei} лей за объект", uk: "Не більше {lei} лей за об’єкт" },
  r_free: { en: "Your first {n} signed jobs are free", ro: "Primele {n} lucrări semnate sunt gratuite", ru: "Первые подписанные объекты бесплатно: {n}", uk: "Перші підписані об’єкти безкоштовно: {n}" },
  r_cancel: { en: "If the client cancels, there is no fee", ro: "Dacă clientul renunță, nu plătești nimic", ru: "Если клиент отказывается, платы нет", uk: "Якщо клієнт відмовляється, плати немає" },
  r_monitor: {
    en: "Monitoring: {eur} EUR a system a month, the first {n} free",
    ro: "Monitorizare: {eur} EUR pe sistem pe lună, primele {n} gratuite",
    ru: "Мониторинг: {eur} EUR за систему в месяц, первые {n} бесплатно",
    uk: "Моніторинг: {eur} EUR за систему на місяць, перші {n} безкоштовно",
  },
  calc_l: { en: "A job of", ro: "O lucrare de", ru: "Объект мощностью", uk: "Об’єкт потужністю" },
  calc_v: { en: "costs {lei} lei", ro: "costă {lei} lei", ru: "стоит {lei} лей", uk: "коштує {lei} лей" },
  calc_cap: { en: "the most a job pays", ro: "maximul pe o lucrare", ru: "максимум за объект", uk: "максимум за об’єкт" },
  calc_free: { en: "Your next signed job is free ({n} of {t}).", ro: "Următoarea lucrare semnată e gratuită ({n} din {t}).", ru: "Следующий подписанный объект бесплатный ({n} из {t}).", uk: "Наступний підписаний об’єкт безкоштовний ({n} з {t})." },
  from_note: { en: "Jobs signed before {d} do not count.", ro: "Lucrările semnate înainte de {d} nu se iau în calcul.", ru: "Объекты, подписанные до {d}, не учитываются.", uk: "Об’єкти, підписані до {d}, не враховуються." },

  // ---- the month
  month_h: { en: "This month, {m}", ro: "Luna aceasta, {m}", ru: "Этот месяц, {m}", uk: "Цей місяць, {m}" },
  k_signed: { en: "Signed jobs", ro: "Lucrări semnate", ru: "Подписанные объекты", uk: "Підписані об’єкти" },
  k_signed_s: { en: "{kw} in all, {free} free, {c} cancelled", ro: "{kw} în total, {free} gratuite, {c} anulate", ru: "Всего {kw}, бесплатных: {free}, отменённых: {c}", uk: "Разом {kw}, безкоштовних: {free}, скасованих: {c}" },
  k_fees: { en: "Job fees", ro: "Taxe pe lucrări", ru: "Плата за объекты", uk: "Плата за об’єкти" },
  k_fees_s: { en: "{n} jobs at {lei} lei a kW", ro: "{n} lucrări, {lei} lei pe kW", ru: "Объектов: {n}, {lei} лей за кВт", uk: "Об’єктів: {n}, {lei} лей за кВт" },
  k_mon: { en: "Monitoring", ro: "Monitorizare", ru: "Мониторинг", uk: "Моніторинг" },
  k_mon_s: { en: "{b} of {n} systems billed", ro: "{b} din {n} sisteme facturate", ru: "К оплате {b} из {n} систем", uk: "До оплати {b} з {n} систем" },
  k_mon_free: { en: "{n} systems, within the free {f}", ro: "{n} sisteme, în cele {f} gratuite", ru: "Систем: {n}, в пределах {f} бесплатных", uk: "Систем: {n}, у межах {f} безкоштовних" },
  k_total: { en: "To pay for {m}", ro: "De plată pentru {m}", ru: "К оплате за {m}", uk: "До сплати за {m}" },
  k_total_s: {
    en: "Invoiced at the start of next month, paid by bank transfer",
    ro: "Factura vine la începutul lunii viitoare, plata prin transfer bancar",
    ru: "Счёт в начале следующего месяца, оплата банковским переводом",
    uk: "Рахунок на початку наступного місяця, оплата банківським переказом",
  },
  fx_note: { en: "Monitoring in lei at {r} lei for 1 EUR.", ro: "Monitorizarea în lei la {r} lei pentru 1 EUR.", ru: "Мониторинг в леях по курсу {r} лей за 1 EUR.", uk: "Моніторинг у леях за курсом {r} лей за 1 EUR." },
  t_date: { en: "Signed", ro: "Semnat", ru: "Подписан", uk: "Підписано" },
  t_job: { en: "Job", ro: "Lucrare", ru: "Объект", uk: "Об’єкт" },
  t_fee: { en: "Fee", ro: "Taxă", ru: "Плата", uk: "Плата" },
  t_none: { en: "No signed jobs this month yet.", ro: "Nicio lucrare semnată luna aceasta.", ru: "В этом месяце подписанных объектов пока нет.", uk: "Цього місяця підписаних об’єктів поки немає." },
  st_free: { en: "Free, {n} of {t}", ro: "Gratuit, {n} din {t}", ru: "Бесплатно, {n} из {t}", uk: "Безкоштовно, {n} з {t}" },
  total_word: { en: "Total", ro: "Total", ru: "Итого", uk: "Разом" },
  free_word: { en: "Free", ro: "Gratuit", ru: "Бесплатно", uk: "Безкоштовно" },
  free_n: { en: "{n} free", ro: "{n} gratuite", ru: "бесплатно: {n}", uk: "безкоштовно: {n}" },
  st_cancelled: { en: "Client cancelled", ro: "Clientul a renunțat", ru: "Клиент отказался", uk: "Клієнт відмовився" },
  st_no_size: { en: "No size on the quote", ro: "Oferta nu are putere", ru: "В предложении нет мощности", uk: "У пропозиції немає потужності" },
  how_online: { en: "signed online", ro: "semnat online", ru: "подписано онлайн", uk: "підписано онлайн" },
  how_marked: { en: "marked signed", ro: "marcat semnat", ru: "отмечено как подписанное", uk: "позначено як підписане" },
  how_status: { en: "date of the last change", ro: "data ultimei modificări", ru: "дата последнего изменения", uk: "дата останньої зміни" },
  hist_h: { en: "Previous months", ro: "Lunile anterioare", ru: "Предыдущие месяцы", uk: "Попередні місяці" },
  hist_month: { en: "Month", ro: "Luna", ru: "Месяц", uk: "Місяць" },
  hist_none: { en: "Nothing in earlier months.", ro: "Nimic în lunile anterioare.", ru: "В прошлые месяцы ничего нет.", uk: "У попередні місяці нічого немає." },
  loading: { en: "Loading", ro: "Se încarcă", ru: "Загрузка", uk: "Завантаження" },
  load_failed: { en: "The statement could not load. Try again in a moment.", ro: "Extrasul nu s-a încărcat. Încearcă din nou peste un moment.", ru: "Выписка не загрузилась. Попробуйте ещё раз чуть позже.", uk: "Виписка не завантажилась. Спробуйте ще раз трохи згодом." },

  // ---- a job's fee card
  jf_h: { en: "VoltMira fee for this job", ro: "Taxa VoltMira pentru această lucrare", ru: "Плата VoltMira за этот объект", uk: "Плата VoltMira за цей об’єкт" },
  jf_formula: { en: "{kw} kW at {rate} lei a kW", ro: "{kw} kW la {rate} lei pe kW", ru: "{kw} кВт по {rate} лей за кВт", uk: "{kw} кВт по {rate} лей за кВт" },
  jf_cap: { en: "{kw} kW, capped at the most a job pays", ro: "{kw} kW, plafonat la maximul pe o lucrare", ru: "{kw} кВт, ограничено максимумом за объект", uk: "{kw} кВт, обмежено максимумом за об’єкт" },
  jf_free: { en: "Signed job {n} of your first {t}, which are free", ro: "Lucrarea semnată {n} din primele {t}, care sunt gratuite", ru: "Подписанный объект {n} из первых {t}, они бесплатные", uk: "Підписаний об’єкт {n} з перших {t}, вони безкоштовні" },
  jf_month: { en: "On the statement for {m}", ro: "Apare în extrasul pentru {m}", ru: "В выписке за {m}", uk: "У виписці за {m}" },
  jf_signed: { en: "Signed {d}, {how}", ro: "Semnat {d}, {how}", ru: "Подписан {d}, {how}", uk: "Підписано {d}, {how}" },
  jf_cancel: { en: "Client cancelled", ro: "Clientul a renunțat", ru: "Клиент отказался", uk: "Клієнт відмовився" },
  jf_cancel_q: {
    en: "Mark this job cancelled? The fee is removed and the job moves to lost.",
    ro: "Marchezi lucrarea anulată? Taxa se anulează și lucrarea trece la pierdute.",
    ru: "Отметить объект отменённым? Плата снимается, объект переходит в проигранные.",
    uk: "Позначити об’єкт скасованим? Плата знімається, об’єкт переходить у програні.",
  },
  jf_cancel_yes: { en: "Yes, the client cancelled", ro: "Da, clientul a renunțat", ru: "Да, клиент отказался", uk: "Так, клієнт відмовився" },
  jf_keep: { en: "No", ro: "Nu", ru: "Нет", uk: "Ні" },
  jf_cancelled: { en: "The client cancelled: no fee for this job.", ro: "Clientul a renunțat: nu plătești nimic pentru această lucrare.", ru: "Клиент отказался: за этот объект платы нет.", uk: "Клієнт відмовився: за цей об’єкт плати немає." },
  jf_before: { en: "Signed before the fee started: no fee.", ro: "Semnată înainte de introducerea taxei: nu se plătește.", ru: "Подписан до введения платы: платы нет.", uk: "Підписано до запровадження плати: плати немає." },
  jf_next: { en: "When the client signs: {lei} lei", ro: "Când clientul semnează: {lei} lei", ru: "Когда клиент подпишет: {lei} лей", uk: "Коли клієнт підпише: {lei} лей" },
  jf_next_free: { en: "When the client signs: free, job {n} of your first {t}", ro: "Când clientul semnează: gratuit, lucrarea {n} din primele {t}", ru: "Когда клиент подпишет: бесплатно, объект {n} из первых {t}", uk: "Коли клієнт підпише: безкоштовно, об’єкт {n} з перших {t}" },
  jf_no_size: { en: "Add the system's size to see the fee.", ro: "Adaugă puterea sistemului ca să vezi taxa.", ru: "Укажите мощность системы, чтобы увидеть плату.", uk: "Вкажіть потужність системи, щоб побачити плату." },
  jf_how: { en: "How the fee works", ro: "Cum funcționează taxa", ru: "Как работает плата", uk: "Як працює плата" },
  jf_failed: { en: "Could not save. Try again.", ro: "Nu s-a salvat. Încearcă din nou.", ru: "Не сохранилось. Попробуйте ещё раз.", uk: "Не збереглося. Спробуйте ще раз." },

  // ---- the invoice prompt
  ig_h: { en: "Invoices are for signed jobs", ro: "Factura se emite pentru lucrări semnate", ru: "Счёт выставляется по подписанным объектам", uk: "Рахунок виставляється за підписаними об’єктами" },
  ig_p: { en: "Mark this job signed to issue its invoice.", ro: "Marchează lucrarea semnată ca să emiți factura.", ru: "Отметьте объект подписанным, чтобы выставить счёт.", uk: "Позначте об’єкт підписаним, щоб виставити рахунок." },
  ig_fee: { en: "VoltMira's fee for it: {lei} lei.", ro: "Taxa VoltMira pentru ea: {lei} lei.", ru: "Плата VoltMira за него: {lei} лей.", uk: "Плата VoltMira за нього: {lei} лей." },
  ig_free: { en: "It is free: job {n} of your first {t}.", ro: "E gratuită: lucrarea {n} din primele {t}.", ru: "Он бесплатный: объект {n} из первых {t}.", uk: "Він безкоштовний: об’єкт {n} з перших {t}." },
  ig_yes: { en: "Mark signed and open the invoice", ro: "Marchează semnat și deschide factura", ru: "Отметить подписанным и открыть счёт", uk: "Позначити підписаним і відкрити рахунок" },
  ig_no: { en: "Not yet", ro: "Nu încă", ru: "Пока нет", uk: "Поки ні" },
  not_signed: { en: "This job is not signed yet. Mark it signed to issue its invoice.", ro: "Lucrarea nu este semnată încă. Marcheaz-o semnată ca să emiți factura.", ru: "Объект ещё не подписан. Отметьте его подписанным, чтобы выставить счёт.", uk: "Об’єкт ще не підписано. Позначте його підписаним, щоб виставити рахунок." },

  // ---- the sidebar
  sb_month: { en: "This month: {lei} lei", ro: "Luna aceasta: {lei} lei", ru: "В этом месяце: {lei} лей", uk: "Цього місяця: {lei} лей" },
  sb_free: { en: "Free jobs left: {n}", ro: "Lucrări gratuite rămase: {n}", ru: "Осталось бесплатных объектов: {n}", uk: "Залишилось безкоштовних об’єктів: {n}" },

  // ---- VoltMira's revenue page
  rv_title: { en: "Revenue", ro: "Venituri", ru: "Доходы", uk: "Доходи" },
  rv_sub: {
    en: "What VoltMira earns each month: the fee on every signed job, monitoring, and the banks' commission on funded loans.",
    ro: "Cât câștigă VoltMira în fiecare lună: taxa pe fiecare lucrare semnată, monitorizarea și comisionul băncilor pe creditele acordate.",
    ru: "Сколько VoltMira зарабатывает каждый месяц: плата за каждый подписанный объект, мониторинг и комиссия банков за выданные кредиты.",
    uk: "Скільки VoltMira заробляє щомісяця: плата за кожен підписаний об’єкт, моніторинг і комісія банків за видані кредити.",
  },
  rv_off: {
    en: "The pay-per-signed-job model is off. Set NEXT_PUBLIC_SUCCESS_FEES=on in .env.local to preview it.",
    ro: "Modelul cu plată per lucrare semnată e oprit. Pune NEXT_PUBLIC_SUCCESS_FEES=on în .env.local ca să-l vezi.",
    ru: "Модель с оплатой за подписанный объект выключена. Добавьте NEXT_PUBLIC_SUCCESS_FEES=on в .env.local, чтобы её увидеть.",
    uk: "Модель з оплатою за підписаний об’єкт вимкнена. Додайте NEXT_PUBLIC_SUCCESS_FEES=on у .env.local, щоб її побачити.",
  },
  rv_how_h: { en: "Who pays what", ro: "Cine ce plătește", ru: "Кто за что платит", uk: "Хто за що платить" },
  rv_how_inst: { en: "Installers", ro: "Instalatorii", ru: "Монтажники", uk: "Монтажники" },
  rv_how_inst_v: {
    en: "{lei} lei per kW of each signed job, at most {cap} lei, the first {n} jobs free, nothing if the client cancels",
    ro: "{lei} lei pe kW din fiecare lucrare semnată, maximum {cap} lei, primele {n} lucrări gratuite, nimic dacă clientul renunță",
    ru: "{lei} лей за кВт каждого подписанного объекта, не более {cap} лей, первые {n} объекта бесплатно, ничего при отказе клиента",
    uk: "{lei} лей за кВт кожного підписаного об’єкта, не більше {cap} лей, перші {n} об’єкти безкоштовно, нічого при відмові клієнта",
  },
  rv_how_mon_v: { en: "{eur} EUR a system a month after the first {n}", ro: "{eur} EUR pe sistem pe lună după primele {n}", ru: "{eur} EUR за систему в месяц после первых {n}", uk: "{eur} EUR за систему на місяць після перших {n}" },
  rv_how_bank: { en: "Banks", ro: "Băncile", ru: "Банки", uk: "Банки" },
  rv_how_bank_v: {
    en: "a commission on each loan funded from an offer, as agreed with each bank; never added to the client's price",
    ro: "un comision pe fiecare credit acordat dintr-o ofertă, cum s-a convenit cu fiecare bancă; niciodată adăugat la prețul clientului",
    ru: "комиссия за каждый кредит, выданный по предложению, как договорено с банком; никогда не добавляется к цене клиента",
    uk: "комісія за кожен кредит, виданий за пропозицією, як домовлено з банком; ніколи не додається до ціни клієнта",
  },
  rv_month: { en: "Month", ro: "Luna", ru: "Месяц", uk: "Місяць" },
  rv_k_fees_s: { en: "{n} signed jobs, {kw}", ro: "{n} lucrări semnate, {kw}", ru: "Подписано объектов: {n}, {kw}", uk: "Підписано об’єктів: {n}, {kw}" },
  rv_k_mon_s: { en: "{n} systems billed", ro: "{n} sisteme facturate", ru: "Систем к оплате: {n}", uk: "Систем до оплати: {n}" },
  rv_k_mon_past: { en: "Counted for the current month only", ro: "Se calculează doar pentru luna curentă", ru: "Считается только за текущий месяц", uk: "Рахується лише за поточний місяць" },
  rv_k_bank: { en: "Bank commissions", ro: "Comisioane de la bănci", ru: "Комиссии банков", uk: "Комісії банків" },
  rv_k_bank_s: { en: "{n} funded loans", ro: "{n} credite acordate", ru: "Выдано кредитов: {n}", uk: "Видано кредитів: {n}" },
  rv_k_bank_none: { en: "No partner bank yet", ro: "Încă nicio bancă parteneră", ru: "Пока нет банка-партнёра", uk: "Поки немає банку-партнера" },
  rv_k_total: { en: "Total for {m}", ro: "Total pentru {m}", ru: "Итого за {m}", uk: "Разом за {m}" },
  rv_k_total_s: { en: "{n} installers on the statement", ro: "{n} instalatori în extras", ru: "Монтажников в выписке: {n}", uk: "Монтажників у виписці: {n}" },
  rv_t_h: { en: "Statements by installer", ro: "Extrase pe instalatori", ru: "Выписки по монтажникам", uk: "Виписки за монтажниками" },
  rv_t_note: {
    en: "At the start of the next month, send each installer an invoice for their total.",
    ro: "La începutul lunii următoare, trimite fiecărui instalator factura pentru totalul lui.",
    ru: "В начале следующего месяца отправьте каждому монтажнику счёт на его итог.",
    uk: "На початку наступного місяця надішліть кожному монтажнику рахунок на його підсумок.",
  },
  rv_c_inst: { en: "Installer", ro: "Instalator", ru: "Монтажник", uk: "Монтажник" },
  rv_internal: { en: "your team", ro: "echipa ta", ru: "ваша команда", uk: "ваша команда" },
  rv_c_jobs: { en: "Signed", ro: "Semnate", ru: "Подписано", uk: "Підписано" },
  rv_c_free: { en: "Free", ro: "Gratuite", ru: "Бесплатно", uk: "Безкоштовно" },
  rv_c_canc: { en: "Cancelled", ro: "Anulate", ru: "Отменено", uk: "Скасовано" },
  rv_c_fees: { en: "Fees, lei", ro: "Taxe, lei", ru: "Плата, лей", uk: "Плата, лей" },
  rv_c_mon: { en: "Monitoring, lei", ro: "Monitorizare, lei", ru: "Мониторинг, лей", uk: "Моніторинг, лей" },
  rv_c_total: { en: "Total, lei", ro: "Total, lei", ru: "Итого, лей", uk: "Разом, лей" },
  rv_csv: { en: "Download CSV", ro: "Descarcă CSV", ru: "Скачать CSV", uk: "Завантажити CSV" },
  rv_none: { en: "No signed jobs or monitored systems in {m}.", ro: "Nicio lucrare semnată și niciun sistem monitorizat în {m}.", ru: "За {m} нет подписанных объектов и систем на мониторинге.", uk: "За {m} немає підписаних об’єктів і систем на моніторингу." },
  rv_banks_h: { en: "Banks", ro: "Bănci", ru: "Банки", uk: "Банки" },
  rv_c_bank: { en: "Bank", ro: "Banca", ru: "Банк", uk: "Банк" },
  rv_c_loans: { en: "Funded loans", ro: "Credite acordate", ru: "Выданные кредиты", uk: "Видані кредити" },
  rv_c_amount: { en: "Commission", ro: "Comision", ru: "Комиссия", uk: "Комісія" },
  rv_banks_none: { en: "No commission booked for {m}.", ro: "Niciun comision înregistrat pentru {m}.", ru: "За {m} комиссий нет.", uk: "За {m} комісій немає." },
  rv_banks_db: {
    en: "The financing tables are not set up yet (supabase/add-financing.sql).",
    ro: "Tabelele pentru credite nu sunt create încă (supabase/add-financing.sql).",
    ru: "Таблицы для кредитов ещё не созданы (supabase/add-financing.sql).",
    uk: "Таблиці для кредитів ще не створено (supabase/add-financing.sql).",
  },
  rv_lenders: { en: "Partner banks", ro: "Bănci partenere", ru: "Банки-партнёры", uk: "Банки-партнери" },

  // ---- the simulator on the revenue page
  sim_h: { en: "What the model earns", ro: "Cât aduce modelul", ru: "Сколько приносит модель", uk: "Скільки приносить модель" },
  sim_s: {
    en: "Change the numbers to see a month and a year. Homes are {hk} kW at about {hp} lei, companies {ck} kW at about {cp} lei, the average jobs in CNED's register.",
    ro: "Schimbă cifrele ca să vezi o lună și un an. Casele au {hk} kW la circa {hp} lei, firmele {ck} kW la circa {cp} lei, lucrările medii din registrul CNED.",
    ru: "Меняйте цифры, чтобы увидеть месяц и год. Дома: {hk} кВт примерно за {hp} лей, компании: {ck} кВт примерно за {cp} лей, средние объекты в реестре CNED.",
    uk: "Змінюйте цифри, щоб побачити місяць і рік. Будинки: {hk} кВт приблизно за {hp} лей, компанії: {ck} кВт приблизно за {cp} лей, середні об’єкти в реєстрі CNED.",
  },
  sim_inst: { en: "Installers using VoltMira", ro: "Instalatori care folosesc VoltMira", ru: "Монтажники в VoltMira", uk: "Монтажники у VoltMira" },
  sim_jobs: { en: "Signed jobs per installer a month", ro: "Lucrări semnate pe instalator pe lună", ru: "Подписанных объектов на монтажника в месяц", uk: "Підписаних об’єктів на монтажника на місяць" },
  sim_comp: { en: "Company jobs, %", ro: "Lucrări pentru firme, %", ru: "Объекты для компаний, %", uk: "Об’єкти для компаній, %" },
  sim_loan: { en: "Clients taking a loan, %", ro: "Clienți care iau credit, %", ru: "Клиенты с кредитом, %", uk: "Клієнти з кредитом, %" },
  sim_bank: { en: "Bank commission, % of the loan", ro: "Comisionul băncii, % din credit", ru: "Комиссия банка, % от кредита", uk: "Комісія банку, % від кредиту" },
  sim_sys: { en: "Monitored systems", ro: "Sisteme monitorizate", ru: "Систем на мониторинге", uk: "Систем на моніторингу" },
  sim_month: { en: "A month", ro: "O lună", ru: "Месяц", uk: "Місяць" },
  sim_year: { en: "A year", ro: "Un an", ru: "Год", uk: "Рік" },
  sim_note: {
    en: "Free jobs are left out (each installer's first 2 only happen once). Monitoring at {r} lei for 1 EUR.",
    ro: "Lucrările gratuite nu sunt incluse (primele 2 ale fiecărui instalator sunt o singură dată). Monitorizarea la {r} lei pentru 1 EUR.",
    ru: "Бесплатные объекты не учтены (первые 2 у каждого монтажника бывают один раз). Мониторинг по курсу {r} лей за 1 EUR.",
    uk: "Безкоштовні об’єкти не враховано (перші 2 у кожного монтажника бувають один раз). Моніторинг за курсом {r} лей за 1 EUR.",
  },
};

export const FT = T;

export function ft(key, lang = "en", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
