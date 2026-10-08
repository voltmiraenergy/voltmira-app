// lib/workflowText.js — every word of the planned workflow (lib/workflow.js)
// in four languages: the stage names, the one next action, why it is next,
// who holds the ball, the stuck verdict with its rule, the pipeline and
// money-waiting cards, the 30-day comparison, the rail on a quote and the
// add-to-portfolio card. Module-local, like lib/portfolioText.js, so this
// surface can grow without touching the shared dictionary.
//
// wt(key, lang, { n: 3 }) fills {n}. A missing language falls back to English;
// lib/workflowText.test.js fails if any key lacks one of the four, if the
// placeholders differ between languages, or if a dash or middle dot slips in.
// Installer copy speaks to the installer as "tu" in Romanian.
import { t } from "./i18n.js";
import { relTime, LOCALE } from "./relTime.js";
import { fmtDate } from "./tz.js";

const T = {
  // ---- stages, short (pipeline stops, list chips)
  st_lead: { en: "Lead", ro: "Lead", ru: "Заявка", uk: "Заявка" },
  st_visit: { en: "Site visit", ro: "Vizită", ru: "Выезд", uk: "Виїзд" },
  st_quote: { en: "Drafted", ro: "Ciornă", ru: "Черновик", uk: "Чернетка" },
  // Short nouns: a stop is about 60px wide, and Cyrillic is not hyphenated
  // there; the full names (sl_*) are in the tooltip and on the rail.
  st_sent: { en: "Sent", ro: "Trimisă", ru: "Отправка", uk: "Надіслано" },
  st_opened: { en: "Opened", ro: "Deschisă", ru: "Открыто", uk: "Відкрито" },
  st_signed: { en: "Signed", ro: "Semnată", ru: "Подписано", uk: "Підписано" },
  st_deposit: { en: "Deposit", ro: "Avans", ru: "Аванс", uk: "Аванс" },
  st_apply_md: { en: "Grid approval", ro: "Aviz racordare", ru: "Допуск", uk: "Дозвіл" },
  st_apply_ua: { en: "Grid notice", ro: "Notificare", ru: "Подача", uk: "Подання" },
  st_apply: { en: "Permit", ro: "Autorizație", ru: "Разрешение", uk: "Дозвіл" },
  st_installed: { en: "Installed", ro: "Montat", ru: "Монтаж", uk: "Монтаж" },
  st_connected: { en: "Connected", ro: "Racordat", ru: "Сеть", uk: "Мережа" },
  st_live: { en: "Live", ro: "Produce", ru: "Работает", uk: "Працює" },
  st_financed: { en: "Portfolio", ro: "Portofoliu", ru: "Портфель", uk: "Портфель" },
  st_lost: { en: "Lost", ro: "Pierdută", ru: "Проиграно", uk: "Програно" },

  // ---- stages, in full (the rail, tooltips)
  sl_lead: { en: "Lead came in", ro: "Lead primit", ru: "Заявка получена", uk: "Заявку отримано" },
  sl_visit: { en: "Site visit", ro: "Vizită tehnică", ru: "Выезд на объект", uk: "Виїзд на об’єкт" },
  sl_quote: { en: "Quote drafted", ro: "Oferta pregătită", ru: "Расчёт подготовлен", uk: "Розрахунок підготовлено" },
  sl_sent: { en: "Offer sent", ro: "Oferta trimisă", ru: "Оферта отправлена", uk: "Пропозицію надіслано" },
  sl_opened: { en: "Offer opened", ro: "Oferta deschisă de client", ru: "Клиент открыл оферту", uk: "Клієнт відкрив пропозицію" },
  sl_signed: { en: "Signed", ro: "Contract semnat", ru: "Договор подписан", uk: "Договір підписано" },
  sl_deposit: { en: "Deposit paid", ro: "Avans încasat", ru: "Аванс получен", uk: "Аванс отримано" },
  sl_apply_md: { en: "Permit and grid approval", ro: "Avizul de racordare", ru: "Разрешение на подключение", uk: "Дозвіл на приєднання" },
  sl_apply_ua: { en: "Notice to the supplier", ro: "Notificarea la furnizor", ru: "Уведомление поставщику", uk: "Повідомлення постачальнику" },
  sl_apply: { en: "Permit", ro: "Autorizație", ru: "Разрешение", uk: "Дозвіл" },
  sl_installed: { en: "System installed", ro: "Sistem montat", ru: "Система смонтирована", uk: "Систему змонтовано" },
  sl_connected: { en: "Grid connected, meter and contract", ro: "Racordat, contor și contract", ru: "Подключено к сети, счётчик и договор", uk: "Приєднано до мережі, лічильник і договір" },
  sl_live: { en: "Commissioned and monitored", ro: "Pus în funcțiune și monitorizat", ru: "Введено в эксплуатацию и под мониторингом", uk: "Введено в експлуатацію та під моніторингом" },
  sl_financed: { en: "In a lender portfolio", ro: "Într-un portofoliu pentru finanțare", ru: "В портфеле для кредитора", uk: "У портфелі для кредитора" },

  // ---- phases
  ph_sell: { en: "Sell", ro: "Vânzare", ru: "Продажа", uk: "Продаж" },
  ph_close: { en: "Close", ro: "Contract", ru: "Сделка", uk: "Угода" },
  ph_build: { en: "Build", ro: "Montaj", ru: "Строительство", uk: "Будівництво" },
  ph_run: { en: "Run", ro: "Exploatare", ru: "Эксплуатация", uk: "Експлуатація" },

  // ---- the one next action (button text)
  do_call_lead: { en: "Call the lead", ro: "Sună clientul", ru: "Позвонить клиенту", uk: "Зателефонувати клієнту" },
  do_visit: { en: "Site visit {when}", ro: "Vizita: {when}", ru: "Выезд: {when}", uk: "Виїзд: {when}" },
  do_quote: { en: "Make the quote", ro: "Fă oferta", ru: "Сделать расчёт", uk: "Зробити розрахунок" },
  do_send: { en: "Send the offer", ro: "Trimite oferta", ru: "Отправить оферту", uk: "Надіслати пропозицію" },
  do_resend: { en: "Resend the link", ro: "Retrimite linkul", ru: "Отправить ссылку ещё раз", uk: "Надіслати посилання ще раз" },
  do_call_hot: { en: "Call now", ro: "Sună acum", ru: "Позвонить сейчас", uk: "Зателефонувати зараз" },
  do_call: { en: "Call for a decision", ro: "Sună pentru un răspuns", ru: "Позвонить за ответом", uk: "Зателефонувати по відповідь" },
  do_followup: { en: "Follow up today", ro: "Revino azi", ru: "Связаться сегодня", uk: "Зв’язатися сьогодні" },
  do_invoice: { en: "Send the deposit invoice", ro: "Trimite factura de avans", ru: "Выставить счёт на аванс", uk: "Виставити рахунок на аванс" },
  do_deposit_paid: { en: "Mark the deposit paid", ro: "Marchează avansul încasat", ru: "Отметить аванс полученным", uk: "Позначити аванс отриманим" },
  do_apply_md: { en: "Apply to {op}", ro: "Depune cererea la {op}", ru: "Подать заявление в {op}", uk: "Подати заяву до {op}" },
  do_approval: { en: "Approval received", ro: "Avizul a venit", ru: "Разрешение получено", uk: "Дозвіл отримано" },
  do_chase_op: { en: "Call {op}", ro: "Sună la {op}", ru: "Позвонить в {op}", uk: "Зателефонувати до {op}" },
  do_permit: { en: "Mark the permit", ro: "Marchează autorizația", ru: "Отметить разрешение", uk: "Позначити дозвіл" },
  do_order: { en: "Order the equipment", ro: "Comandă echipamentul", ru: "Заказать оборудование", uk: "Замовити обладнання" },
  do_install: { en: "Mark it installed", ro: "Marchează montajul", ru: "Отметить монтаж", uk: "Позначити монтаж" },
  do_notice_ua: { en: "Hand in the notice", ro: "Depune notificarea", ru: "Подать уведомление", uk: "Подати повідомлення" },
  do_meter: { en: "Meter fitted", ro: "Contorul e montat", ru: "Счётчик установлен", uk: "Лічильник встановлено" },
  do_contract: { en: "Contract signed", ro: "Contractul e semnat", ru: "Договор подписан", uk: "Договір підписано" },
  do_connect: { en: "Mark it connected", ro: "Marchează racordarea", ru: "Отметить подключение", uk: "Позначити приєднання" },
  do_commission: { en: "Commission and hand over", ro: "Pune în funcțiune și predă", ru: "Ввести в эксплуатацию и сдать", uk: "Ввести в експлуатацію та здати" },
  do_monitor: { en: "Connect monitoring", ro: "Conectează monitorizarea", ru: "Подключить мониторинг", uk: "Підключити моніторинг" },
  do_package: { en: "Add to a portfolio", ro: "Adaugă în portofoliu", ru: "Добавить в портфель", uk: "Додати до портфеля" },
  do_none: { en: "Nothing to do", ro: "Nimic de făcut", ru: "Ничего делать не нужно", uk: "Нічого робити не треба" },
  do_alt_call: { en: "Call", ro: "Sună", ru: "Позвонить", uk: "Зателефонувати" },
  do_alt_quote: { en: "Make the quote", ro: "Fă oferta", ru: "Сделать расчёт", uk: "Зробити розрахунок" },
  do_alt_deposit: { en: "Deposit already paid", ro: "Avansul e deja încasat", ru: "Аванс уже получен", uk: "Аванс уже отримано" },

  // ---- why that is the next thing
  why_lead_new: { en: "New lead, nobody has called yet.", ro: "Lead nou, încă nu l-a sunat nimeni.", ru: "Новая заявка, ещё никто не звонил.", uk: "Нова заявка, ще ніхто не телефонував." },
  why_lead_open: { en: "Contacted, no visit booked and no quote yet.", ro: "Contactat, fără vizită programată și fără ofertă.", ru: "Связались, но выезда и расчёта ещё нет.", uk: "Зв’язалися, але виїзду й розрахунку ще немає." },
  why_visit: { en: "Site visit booked {when}.", ro: "Vizită programată {when}.", ru: "Выезд назначен {when}.", uk: "Виїзд призначено {when}." },
  why_visit_done: { en: "Visited {when}. Send the quote while it is fresh.", ro: "Vizita a fost {when}. Trimite oferta cât discuția e proaspătă.", ru: "Выезд был {when}. Отправьте расчёт, пока разговор свеж.", uk: "Виїзд був {when}. Надішліть розрахунок, поки розмова свіжа." },
  why_draft: { en: "Drafted, not sent to the client yet.", ro: "Pregătită, dar netrimisă clientului.", ru: "Подготовлено, но клиенту не отправлено.", uk: "Підготовлено, але клієнту не надіслано." },
  why_unopened: { en: "Sent, not opened yet.", ro: "Trimisă, încă nedeschisă.", ru: "Отправлено, ещё не открыто.", uk: "Надіслано, ще не відкрито." },
  why_opened: { en: "Opened {n}×, most recently {when}.", ro: "Deschisă de {n}×, ultima oară {when}.", ru: "Открыто {n}×, последний раз {when}.", uk: "Відкрито {n}×, останній раз {when}." },
  why_hot: { en: "Opened {n}× in the last 2 days. They are deciding.", ro: "Deschisă de {n}× în ultimele 2 zile. Se decide acum.", ru: "Открыто {n}× за последние 2 дня. Клиент решает.", uk: "Відкрито {n}× за останні 2 дні. Клієнт вирішує." },
  why_signed: { en: "Signed {when}, no deposit invoice yet.", ro: "Semnată {when}, fără factură de avans.", ru: "Подписано {when}, счёт на аванс не выставлен.", uk: "Підписано {when}, рахунок на аванс не виставлено." },
  why_invoiced: { en: "Deposit invoice {no} is out. Waiting for the payment.", ro: "Factura de avans {no} e trimisă. Aștepți plata.", ru: "Счёт на аванс {no} выставлен. Ждём оплату.", uk: "Рахунок на аванс {no} виставлено. Чекаємо на оплату." },
  why_apply_md: { en: "Deposit in. Next is the connection approval from {op}.", ro: "Avansul e încasat. Urmează avizul de racordare de la {op}.", ru: "Аванс получен. Далее разрешение на подключение от {op}.", uk: "Аванс отримано. Далі дозвіл на приєднання від {op}." },
  why_await_op: { en: "With {op} for {dur}. Next milestone: {stage}.", ro: "La {op} de {dur}. Următorul pas: {stage}.", ru: "У {op} уже {dur}. Следующий этап: {stage}.", uk: "У {op} вже {dur}. Наступний етап: {stage}." },
  why_await_op0: { en: "With {op} since today. Next milestone: {stage}.", ro: "La {op} de azi. Următorul pas: {stage}.", ru: "У {op} с сегодняшнего дня. Следующий этап: {stage}.", uk: "У {op} від сьогодні. Наступний етап: {stage}." },
  why_notice_ua: { en: "Installed. Hand the notice, the diagram and the certificates to the supplier.", ro: "Montat. Depune la furnizor notificarea, schema și certificatele.", ru: "Смонтировано. Подайте поставщику уведомление, схему и сертификаты.", uk: "Змонтовано. Подайте постачальнику повідомлення, схему та сертифікати." },
  why_permit: { en: "Deposit in. The permit is next.", ro: "Avansul e încasat. Urmează autorizația.", ru: "Аванс получен. Далее разрешение.", uk: "Аванс отримано. Далі дозвіл." },
  why_order: { en: "Ready to build: order the equipment.", ro: "Gata de montaj: comandă echipamentul.", ru: "Можно строить: закажите оборудование.", uk: "Можна будувати: замовте обладнання." },
  why_install: { en: "Equipment ordered. Mark the system installed once it is up.", ro: "Echipamentul e comandat. Marchează montajul când sistemul e gata.", ru: "Оборудование заказано. Отметьте монтаж, когда система будет стоять.", uk: "Обладнання замовлено. Позначте монтаж, коли систему встановлять." },
  why_connect: { en: "Installed. {op} fits the two-way meter, then the supplier contract is signed.", ro: "Montat. {op} montează contorul bidirecțional, apoi se semnează contractul cu furnizorul.", ru: "Смонтировано. {op} ставит двунаправленный счётчик, потом подписывается договор с поставщиком.", uk: "Змонтовано. {op} встановлює двонаправлений лічильник, потім підписується договір із постачальником." },
  why_commission: { en: "Connected. Commission it and hand it over to the client.", ro: "Racordat. Pune-l în funcțiune și predă-l clientului.", ru: "Подключено. Введите в эксплуатацию и сдайте клиенту.", uk: "Приєднано. Введіть в експлуатацію та здайте клієнту." },
  why_monitor: { en: "Commissioned {when}, no production reading yet: a fault would go unnoticed.", ro: "Pus în funcțiune {when}, nicio citire de producție încă: o defecțiune ar trece neobservată.", ru: "Введено в эксплуатацию {when}, данных о выработке нет: неисправность никто не заметит.", uk: "Введено в експлуатацію {when}, даних про генерацію немає: несправність ніхто не помітить." },
  why_package: { en: "Producing, not in a portfolio yet.", ro: "Produce, încă în afara unui portofoliu.", ru: "Работает, но ещё не в портфеле.", uk: "Працює, але ще не в портфелі." },
  why_package_ready: { en: "Producing, grid papers complete: it counts as financing-ready.", ro: "Produce, actele de racordare sunt complete: contează ca gata de finanțare.", ru: "Работает, документы на подключение в порядке: считается готовым к финансированию.", uk: "Працює, документи на приєднання повні: вважається готовим до фінансування." },
  why_gap: { en: "{stage} was never recorded, though later steps were.", ro: "{stage} nu a fost marcat, deși pașii de după da.", ru: "Этап «{stage}» не отмечен, хотя следующие отмечены.", uk: "Етап «{stage}» не позначено, хоча наступні позначено." },
  why_done: { en: "Producing and monitored.", ro: "Produce și e monitorizat.", ru: "Работает, под мониторингом.", uk: "Працює, під моніторингом." },
  why_done_pf: { en: "Producing, monitored and in a portfolio.", ro: "Produce, e monitorizat și e într-un portofoliu.", ru: "Работает, под мониторингом и в портфеле.", uk: "Працює, під моніторингом і в портфелі." },
  why_lost: { en: "Marked lost.", ro: "Marcată pierdută.", ru: "Отмечено как проигранное.", uk: "Позначено як програне." },

  // ---- who holds the ball
  wait_you: { en: "Your move", ro: "E rândul tău", ru: "Ваш ход", uk: "Ваш хід" },
  wait_client: { en: "Waiting on the client", ro: "Aștepți clientul", ru: "Ждём клиента", uk: "Чекаємо на клієнта" },
  wait_operator: { en: "Waiting on the operator", ro: "Aștepți operatorul", ru: "Ждём оператора", uk: "Чекаємо на оператора" },

  // ---- time in the stage
  days_in: { en: "{dur} in this stage", ro: "{dur} în etapa asta", ru: "{dur} на этом этапе", uk: "{dur} на цьому етапі" },
  days_in0: { en: "Reached today", ro: "Ajuns azi", ru: "Сегодня", uk: "Сьогодні" },
  stuck: { en: "Stuck: {dur} without a move, the rule here is {limit}.", ro: "Blocat: {dur} fără mișcare, regula aici e {limit}.", ru: "Застряло: {dur} без движения, правило здесь: {limit}.", uk: "Застрягло: {dur} без руху, правило тут: {limit}." },
  stuck_short: { en: "Stuck {dur}", ro: "Blocat de {dur}", ru: "Стоит {dur}", uk: "Стоїть {dur}" },

  // ---- the dashboard pipeline
  pp_title: { en: "Your jobs, stage by stage", ro: "Lucrările tale, etapă cu etapă", ru: "Ваши объекты по этапам", uk: "Ваші об’єкти за етапами" },
  pp_sub: { en: "Each job counts once, at the furthest step it has reached. Tap a stage to see its jobs and what each needs next.", ro: "Fiecare lucrare apare o dată, la cel mai avansat pas atins. Apasă pe o etapă ca să vezi lucrările și ce urmează la fiecare.", ru: "Каждый объект учтён один раз, на самом дальнем пройденном этапе. Нажмите на этап, чтобы увидеть объекты и следующий шаг по каждому.", uk: "Кожен об’єкт враховано один раз, на найдальшому пройденому етапі. Натисніть на етап, щоб побачити об’єкти й наступний крок для кожного." },
  pp_stuck_n: { en: "{n} stuck", ro: "{n} blocate", ru: "застряли: {n}", uk: "застрягли: {n}" },
  pp_none: { en: "none", ro: "niciuna", ru: "нет", uk: "немає" },
  pp_see_stuck: { en: "Stuck jobs: {n}", ro: "Lucrări blocate: {n}", ru: "Застрявшие объекты: {n}", uk: "Об’єкти, що застрягли: {n}" },
  pp_rules: { en: "Stuck means a wait longer than VoltMira's working rule for it, for example 3 days for an unopened offer or 7 for a deposit. The grid operator's waits use the grid file's own call reminders.", ro: "Blocat înseamnă o așteptare mai lungă decât regula de lucru VoltMira, de exemplu 3 zile pentru o ofertă nedeschisă sau 7 pentru avans. Pentru operatorul de rețea se folosesc mementourile din dosarul de racordare.", ru: "«Застряло» значит, что ожидание дольше рабочего правила VoltMira, например 3 дня для неоткрытой оферты или 7 для аванса. Для оператора сети действуют напоминания из дела о подключении.", uk: "«Застрягло» означає, що очікування довше за робоче правило VoltMira, наприклад 3 дні для невідкритої пропозиції або 7 для авансу. Для оператора мережі діють нагадування зі справи про приєднання." },
  pp_money: { en: "Money waiting", ro: "Bani care așteaptă", ru: "Деньги, которые ждут", uk: "Гроші, що чекають" },
  pp_unbilled: { en: "Signed, no deposit invoice", ro: "Semnate, fără factură de avans", ru: "Подписаны, без счёта на аванс", uk: "Підписані, без рахунку на аванс" },
  pp_unbilled_s: { en: "Send the invoice and the job can start.", ro: "Trimite factura și lucrarea poate începe.", ru: "Выставьте счёт, и можно начинать.", uk: "Виставте рахунок, і можна починати." },
  pp_unconnected: { en: "Installed, not connected", ro: "Montate, neracordate", ru: "Смонтированы, не подключены", uk: "Змонтовані, не приєднані" },
  pp_unconnected_s: { en: "The meter and the contract close the job.", ro: "Contorul și contractul închid lucrarea.", ru: "Счётчик и договор закрывают объект.", uk: "Лічильник і договір закривають об’єкт." },
  pp_unmonitored: { en: "Finished, not monitored", ro: "Gata, nemonitorizate", ru: "Готовы, без мониторинга", uk: "Готові, без моніторингу" },
  pp_unmonitored_s: { en: "With readings you can show the client what it produces against the quote.", ro: "Cu citiri îi arăți clientului cât produce față de ofertă.", ru: "С данными о выработке вы покажете клиенту, сколько система даёт против расчёта.", uk: "З даними про генерацію ви покажете клієнту, скільки система дає порівняно з розрахунком." },
  pp_jobs: { en: "{n} jobs", ro: "{n} lucrări", ru: "объектов: {n}", uk: "об’єктів: {n}" },
  pp_jobs_one: { en: "{n} job", ro: "{n} lucrare", ru: "объектов: {n}", uk: "об’єктів: {n}" },
  pp_value: { en: "{v} in contracts", ro: "{v} în contracte", ru: "{v} по договорам", uk: "{v} за договорами" },
  pp_money_none: { en: "Nothing waiting: every signed job is invoiced, connected and monitored.", ro: "Nimic nu așteaptă: fiecare lucrare semnată e facturată, racordată și monitorizată.", ru: "Ничего не ждёт: каждый подписанный объект с выставленным счётом, подключён и под мониторингом.", uk: "Нічого не чекає: кожен підписаний об’єкт із рахунком, приєднаний і під моніторингом." },
  pp_lender: { en: "Ready for a lender", ro: "Gata pentru o bancă", ru: "Готово для кредитора", uk: "Готово для кредитора" },
  pp_lender_line: { en: "{n} signed jobs worth {v} are not in a portfolio yet.", ro: "{n} lucrări semnate, în valoare de {v}, nu sunt încă într-un portofoliu.", ru: "Подписанных объектов вне портфеля: {n}, на {v}.", uk: "Підписаних об’єктів поза портфелем: {n}, на {v}." },
  pp_lender_line_one: { en: "{n} signed job worth {v} is not in a portfolio yet.", ro: "{n} lucrare semnată, în valoare de {v}, nu e încă într-un portofoliu.", ru: "Подписанных объектов вне портфеля: {n}, на {v}.", uk: "Підписаних об’єктів поза портфелем: {n}, на {v}." },
  pp_lender_ready_one: { en: "{n} has complete grid papers, so it counts as financing-ready.", ro: "{n} are actele de racordare complete, deci contează ca gata de finanțare.", ru: "С полным пакетом документов на подключение: {n}, он считается готовым к финансированию.", uk: "З повним пакетом документів на приєднання: {n}, він вважається готовим до фінансування." },
  pp_lender_ready: { en: "{n} have complete grid papers, so they count as financing-ready.", ro: "{n} au actele de racordare complete, deci contează ca gata de finanțare.", ru: "С полным пакетом документов на подключение: {n}, они считаются готовыми к финансированию.", uk: "З повним пакетом документів на приєднання: {n}, вони вважаються готовими до фінансування." },
  pp_lender_in: { en: "Already in a portfolio: {n}", ro: "Deja într-un portofoliu: {n}", ru: "Уже в портфеле: {n}", uk: "Уже в портфелі: {n}" },
  pp_lender_cta: { en: "Package them in a portfolio", ro: "Pune-le într-un portofoliu", ru: "Собрать в портфель", uk: "Зібрати в портфель" },
  pp_lender_see: { en: "See them", ro: "Vezi-le", ru: "Показать их", uk: "Показати їх" },
  pp_month: { en: "Your last 30 days", ro: "Ultimele tale 30 de zile", ru: "Ваши последние 30 дней", uk: "Ваші останні 30 днів" },
  pp_month_sub: { en: "Against the 30 days before. Only your own quotes, no outside benchmarks.", ro: "Față de cele 30 de zile dinainte. Doar ofertele tale, fără comparații din afară.", ru: "В сравнении с предыдущими 30 днями. Только ваши расчёты, без сторонних эталонов.", uk: "Порівняно з попередніми 30 днями. Лише ваші розрахунки, без сторонніх еталонів." },
  m_sent: { en: "Offers sent", ro: "Oferte trimise", ru: "Отправлено оферт", uk: "Надіслано пропозицій" },
  m_rate: { en: "Signed, of offers sent", ro: "Semnate din cele trimise", ru: "Подписано из отправленных", uk: "Підписано з надісланих" },
  m_rate_s: { en: "{open} still undecided", ro: "{open} încă fără răspuns", ru: "ещё без ответа: {open}", uk: "ще без відповіді: {open}" },
  m_ttq: { en: "Time to quote", ro: "Timp până la ofertă", ru: "Время до оферты", uk: "Час до пропозиції" },
  m_ttq_s: { en: "Median, first contact to offer sent", ro: "Mediana, de la primul contact la ofertă", ru: "Медиана, от первого контакта до оферты", uk: "Медіана, від першого контакту до пропозиції" },
  m_online: { en: "Signed on your proposal page", ro: "Semnate pe pagina ofertei", ru: "Подписано на странице оферты", uk: "Підписано на сторінці пропозиції" },
  m_online_s: { en: "{n} accepted online", ro: "{n} acceptate online", ru: "принято онлайн: {n}", uk: "прийнято онлайн: {n}" },
  m_prev: { en: "before: {v}", ro: "înainte: {v}", ru: "до этого: {v}", uk: "до того: {v}" },
  m_none: { en: "none yet", ro: "încă niciuna", ru: "пока нет", uk: "поки немає" },
  m_sameday: { en: "same day", ro: "aceeași zi", ru: "в тот же день", uk: "того ж дня" },

  // ---- the rail on a quote (components/WorkflowRail.jsx)
  rl_title: { en: "Where this job stands", ro: "Unde e lucrarea", ru: "Где сейчас объект", uk: "Де зараз об’єкт" },
  rl_step: { en: "Step {i} of {n}", ro: "Pasul {i} din {n}", ru: "Этап {i} из {n}", uk: "Етап {i} з {n}" },
  rl_next: { en: "Next", ro: "Urmează", ru: "Далее", uk: "Далі" },
  rl_ready: { en: "Financing-ready", ro: "Gata de finanțare", ru: "Готово к финансированию", uk: "Готово до фінансування" },
  rl_ready_h: { en: "Grid connection papers are complete.", ro: "Actele de racordare sunt complete.", ru: "Документы на подключение в порядке.", uk: "Документи на приєднання повні." },
  rl_in_pf: { en: "In portfolio: {name}", ro: "În portofoliul: {name}", ru: "В портфеле: {name}", uk: "У портфелі: {name}" },
  rl_loading: { en: "Loading", ro: "Se încarcă", ru: "Загрузка", uk: "Завантаження" },
  rl_error: { en: "Could not load where this job stands.", ro: "Nu s-a putut încărca stadiul lucrării.", ru: "Не удалось загрузить этап объекта.", uk: "Не вдалося завантажити етап об’єкта." },
  rl_retry: { en: "Try again", ro: "Încearcă din nou", ru: "Повторить", uk: "Спробувати ще" },
  rl_copied: { en: "Link copied", ro: "Link copiat", ru: "Ссылка скопирована", uk: "Посилання скопійовано" },
  rl_inv_full: { en: "Full amount", ro: "Suma întreagă", ru: "Вся сумма", uk: "Уся сума" },
  rl_inv_pick: { en: "Invoice for", ro: "Factură pentru", ru: "Счёт на", uk: "Рахунок на" },
  rl_failed: { en: "Not saved. Check the connection and try again.", ro: "Nesalvat. Verifică conexiunea și încearcă din nou.", ru: "Не сохранено. Проверьте соединение и повторите.", uk: "Не збережено. Перевірте з’єднання і спробуйте ще." },
  rl_done_all: { en: "Every step is done.", ro: "Toți pașii sunt gata.", ru: "Все этапы пройдены.", uk: "Усі етапи пройдено." },
  rl_optional: { en: "optional", ro: "opțional", ru: "необязательно", uk: "необов’язково" },
  rl_done_on: { en: "done {date}", ro: "gata {date}", ru: "выполнено {date}", uk: "виконано {date}" },

  // ---- add to a portfolio (components/AddToPortfolio.jsx)
  ap_title: { en: "Lender portfolio", ro: "Portofoliu pentru finanțare", ru: "Портфель для кредитора", uk: "Портфель для кредитора" },
  ap_sub: { en: "Group signed jobs of one market into one investment a bank or fund can review.", ro: "Grupează lucrările semnate dintr-o piață într-o singură investiție pe care o poate analiza o bancă sau un fond.", ru: "Объедините подписанные объекты одного рынка в одну инвестицию, которую может оценить банк или фонд.", uk: "Об’єднайте підписані об’єкти одного ринку в одну інвестицію, яку може оцінити банк або фонд." },
  ap_pick: { en: "Portfolio", ro: "Portofoliu", ru: "Портфель", uk: "Портфель" },
  ap_add: { en: "Add", ro: "Adaugă", ru: "Добавить", uk: "Додати" },
  ap_new: { en: "Or start a new one", ro: "Sau pornește unul nou", ru: "Или создайте новый", uk: "Або створіть новий" },
  ap_new_ph: { en: "Portfolio name", ro: "Numele portofoliului", ru: "Название портфеля", uk: "Назва портфеля" },
  ap_create: { en: "Create and add", ro: "Creează și adaugă", ru: "Создать и добавить", uk: "Створити й додати" },
  ap_in: { en: "In {name}", ro: "În {name}", ru: "В портфеле {name}", uk: "У портфелі {name}" },
  ap_open: { en: "Open the portfolio", ro: "Deschide portofoliul", ru: "Открыть портфель", uk: "Відкрити портфель" },
  ap_added: { en: "Added to {name}.", ro: "Adăugat în {name}.", ru: "Добавлено в {name}.", uk: "Додано до {name}." },
  ap_not_won: { en: "Portfolios hold signed jobs: mark this quote won first.", ro: "Portofoliile conțin lucrări semnate: marchează întâi oferta câștigată.", ru: "В портфель попадают подписанные объекты: сначала отметьте расчёт выигранным.", uk: "До портфеля потрапляють підписані об’єкти: спершу позначте розрахунок виграним." },
  ap_market: { en: "Portfolios model Moldova and Ukraine. This quote is in another market.", ro: "Portofoliile modelează Moldova și Ucraina. Oferta asta e pe altă piață.", ru: "Портфели рассчитаны на Молдову и Украину. Этот расчёт для другого рынка.", uk: "Портфелі розраховані на Молдову та Україну. Цей розрахунок для іншого ринку." },
  ap_needs_db: { en: "Portfolios need a database update: run supabase/add-portfolios.sql.", ro: "Portofoliile cer o actualizare a bazei de date: rulează supabase/add-portfolios.sql.", ru: "Для портфелей нужно обновить базу данных: выполните supabase/add-portfolios.sql.", uk: "Для портфелів потрібно оновити базу даних: виконайте supabase/add-portfolios.sql." },
  ap_none: { en: "No portfolio for {market} yet.", ro: "Încă niciun portofoliu pentru {market}.", ru: "Портфелей для рынка «{market}» пока нет.", uk: "Портфелів для ринку «{market}» поки немає." },
  ap_err: { en: "Could not add it. Try again.", ro: "Nu s-a putut adăuga. Încearcă din nou.", ru: "Не удалось добавить. Повторите.", uk: "Не вдалося додати. Спробуйте ще." },
  ap_count: { en: "{n} jobs", ro: "{n} lucrări", ru: "объектов: {n}", uk: "об’єктів: {n}" },
  ap_count_one: { en: "{n} job", ro: "{n} lucrare", ru: "объектов: {n}", uk: "об’єктів: {n}" },
  ap_market_md: { en: "Moldova", ro: "Moldova", ru: "Молдова", uk: "Молдова" },
  ap_market_ua: { en: "Ukraine", ro: "Ucraina", ru: "Украина", uk: "Україна" },

  // ---- the projects list
  pj_col: { en: "Stage and next step", ro: "Etapa și pasul următor", ru: "Этап и следующий шаг", uk: "Етап і наступний крок" },
  pj_all: { en: "All stages", ro: "Toate etapele", ru: "Все этапы", uk: "Усі етапи" },
  pj_stage: { en: "Stage", ro: "Etapa", ru: "Этап", uk: "Етап" },
  pj_stuck: { en: "Stuck", ro: "Blocate", ru: "Застряли", uk: "Застрягли" },
  pj_v_unbilled: { en: "No deposit invoice", ro: "Fără factură de avans", ru: "Без счёта на аванс", uk: "Без рахунку на аванс" },
  pj_v_unconnected: { en: "Not connected", ro: "Neracordate", ru: "Не подключены", uk: "Не приєднані" },
  pj_v_unmonitored: { en: "Not monitored", ro: "Nemonitorizate", ru: "Без мониторинга", uk: "Без моніторингу" },
  pj_v_ready: { en: "For a lender", ro: "Pentru bancă", ru: "Для кредитора", uk: "Для кредитора" },

  // ---- dashboard next moves that the workflow adds
  mv_kind_unmonitored: { en: "No monitoring", ro: "Fără monitorizare", ru: "Без мониторинга", uk: "Без моніторингу" },
  mv_hot_recent: { en: "Opened **{n}×** in the last 2 days, most recently **{when}**. Call now.", ro: "Deschisă de **{n}×** în ultimele 2 zile, ultima oară **{when}**. Sună acum.", ru: "Открыто **{n}×** за последние 2 дня, последний раз **{when}**. Позвоните сейчас.", uk: "Відкрито **{n}×** за останні 2 дні, останній раз **{when}**. Зателефонуйте зараз." },
  mv_unmonitored: { en: "Commissioned {when}, **no production readings yet**. Connect its inverter portal.", ro: "Pus în funcțiune {when}, **fără citiri de producție**. Conectează portalul invertorului.", ru: "Введено в эксплуатацию {when}, **данных о выработке нет**. Подключите портал инвертора.", uk: "Введено в експлуатацію {when}, **даних про генерацію немає**. Підключіть портал інвертора." },
  mv_won_invoice: { en: "Signed {when}. **No deposit invoice yet**: send it and the job can start.", ro: "Semnată {when}. **Fără factură de avans**: trimite-o și lucrarea poate începe.", ru: "Подписано {when}. **Счёт на аванс не выставлен**: выставьте его, и можно начинать.", uk: "Підписано {when}. **Рахунок на аванс не виставлено**: виставте його, і можна починати." },
  mv_act_invoice: { en: "Deposit invoice", ro: "Factură de avans", ru: "Счёт на аванс", uk: "Рахунок на аванс" },
  mv_act_monitor: { en: "Monitoring", ro: "Monitorizare", ru: "Мониторинг", uk: "Моніторинг" },

  // ---- fixing a stage in place (the rail's stage panel, the dashboard rows)
  do_mark_signed: { en: "Mark it signed", ro: "Marchează semnată", ru: "Отметить подписанным", uk: "Позначити підписаним" },
  do_undo: { en: "Undo", ro: "Anulează", ru: "Отменить", uk: "Скасувати" },
  why_chase: { en: "Call {op} to move it along.", ro: "Sună la {op} ca să miști dosarul.", ru: "Позвоните в {op}, чтобы сдвинуть дело.", uk: "Зателефонуйте до {op}, щоб зрушити справу." },
  rs_done: { en: "Done {date}.", ro: "Gata pe {date}.", ru: "Выполнено {date}.", uk: "Виконано {date}." },
  rs_done0: { en: "Done.", ro: "Gata.", ru: "Выполнено.", uk: "Виконано." },
  rs_gap: { en: "Not recorded, though later steps are. Record it here.", ro: "Nemarcat, deși pașii de după sunt. Marchează-l aici.", ru: "Не отмечено, хотя следующие этапы отмечены. Отметьте здесь.", uk: "Не позначено, хоча наступні етапи позначено. Позначте тут." },
  rs_todo: { en: "Still ahead. If it already happened, record it now.", ro: "Urmează. Dacă s-a făcut deja, marchează-l acum.", ru: "Впереди. Если уже сделано, отметьте сейчас.", uk: "Попереду. Якщо вже зроблено, позначте зараз." },
  rs_skipped: { en: "Skipped. This step is optional.", ro: "Sărit. Pasul ăsta e opțional.", ru: "Пропущено. Этот этап необязателен.", uk: "Пропущено. Цей етап необов’язковий." },
  rs_auto: { en: "Recorded on its own when it happens.", ro: "Se marchează singur când se întâmplă.", ru: "Отмечается автоматически, когда происходит.", uk: "Позначається автоматично, коли відбувається." },
  rs_undo_h: { en: "Ticked by mistake?", ro: "Bifat din greșeală?", ru: "Отмечено по ошибке?", uk: "Позначено помилково?" },
  rl_tap: { en: "Tap any step to record it or see when it was done.", ro: "Apasă pe orice pas ca să-l marchezi sau să vezi când s-a făcut.", ru: "Нажмите на любой этап, чтобы отметить его или увидеть дату.", uk: "Натисніть на будь-який етап, щоб позначити його або побачити дату." },
  rl_back: { en: "Back to the next step", ro: "Înapoi la pasul următor", ru: "Назад к следующему шагу", uk: "Назад до наступного кроку" },
  rl_saved: { en: "Recorded.", ro: "Marcat.", ru: "Отмечено.", uk: "Позначено." },
  rl_undone: { en: "Tick removed.", ro: "Bifa a fost scoasă.", ru: "Отметка снята.", uk: "Позначку знято." },

  // ---- the dashboard
  k_active: { en: "Jobs in progress", ro: "Lucrări în execuție", ru: "Объекты в работе", uk: "Об’єкти в роботі" },
  k_active_s: { en: "{n} signed, not producing yet", ro: "{n} semnate, încă nu produc", ru: "подписаны, ещё не работают: {n}", uk: "підписані, ще не працюють: {n}" },
  k_active_s_one: { en: "{n} signed, not producing yet", ro: "{n} semnată, încă nu produce", ru: "подписаны, ещё не работают: {n}", uk: "підписані, ще не працюють: {n}" },
  k_sent30: { en: "Offers sent, 30 days", ro: "Oferte trimise, 30 de zile", ru: "Оферт за 30 дней", uk: "Пропозицій за 30 днів" },
  k_unbilled: { en: "To invoice", ro: "De facturat", ru: "Выставить счета", uk: "Виставити рахунки" },
  k_unbilled_s: { en: "{n} signed without a deposit invoice", ro: "{n} semnate fără factură de avans", ru: "подписаны без счёта на аванс: {n}", uk: "підписані без рахунку на аванс: {n}" },
  k_unbilled_s_one: { en: "{n} signed without a deposit invoice", ro: "{n} semnată fără factură de avans", ru: "подписаны без счёта на аванс: {n}", uk: "підписані без рахунку на аванс: {n}" },
  k_unbilled_0: { en: "Every signed job is invoiced", ro: "Toate lucrările semnate sunt facturate", ru: "По всем подписанным объектам выставлены счета", uk: "За всіма підписаними об’єктами виставлено рахунки" },
  at_title: { en: "To do", ro: "De rezolvat", ru: "Что сделать", uk: "Що зробити" },
  at_sub: { en: "Most urgent first. Each row has its own button: press it and the step is recorded.", ro: "Cele mai urgente primele. Fiecare rând are butonul lui: îl apeși și pasul e marcat.", ru: "Сначала самое срочное. У каждой строки своя кнопка: нажмите, и шаг отмечен.", uk: "Спершу найтерміновіше. Кожен рядок має свою кнопку: натисніть, і крок позначено." },
  at_all: { en: "Show all {n}", ro: "Arată toate ({n})", ru: "Показать все ({n})", uk: "Показати всі ({n})" },
  at_less: { en: "Show fewer", ro: "Arată mai puține", ru: "Свернуть", uk: "Згорнути" },
  at_stuck: { en: "{n} stuck", ro: "{n} blocate", ru: "застряли: {n}", uk: "застрягли: {n}" },
  at_stuck_one: { en: "{n} stuck", ro: "{n} blocată", ru: "застряли: {n}", uk: "застрягли: {n}" },
  mv_kind_gap: { en: "Missing tick", ro: "Bifă lipsă", ru: "Нет отметки", uk: "Немає позначки" },
  mv_gap: { en: "**{stage}** was never recorded, though later steps were. Record it so the job reads right.", ro: "**{stage}** nu a fost marcat, deși pașii de după da. Marchează-l ca lucrarea să arate corect.", ru: "Этап «**{stage}**» не отмечен, хотя следующие отмечены. Отметьте его, чтобы объект отображался верно.", uk: "Етап «**{stage}**» не позначено, хоча наступні позначено. Позначте його, щоб об’єкт показувався правильно." },
  ph_title: { en: "Jobs by phase", ro: "Lucrările pe etape", ru: "Объекты по этапам", uk: "Об’єкти за етапами" },
  ph_sub: { en: "Tap a phase to see its jobs and do each one's next step.", ro: "Apasă pe o etapă ca să vezi lucrările și să faci pasul următor la fiecare.", ru: "Нажмите на этап, чтобы увидеть объекты и сделать следующий шаг по каждому.", uk: "Натисніть на етап, щоб побачити об’єкти й зробити наступний крок для кожного." },
  ph_empty: { en: "No jobs in this phase.", ro: "Nicio lucrare în etapa asta.", ru: "На этом этапе объектов нет.", uk: "На цьому етапі об’єктів немає." },
  ph_more: { en: "See all {n}", ro: "Vezi toate ({n})", ru: "Показать все ({n})", uk: "Показати всі ({n})" },
  ph_open: { en: "Open", ro: "Deschide", ru: "Открыть", uk: "Відкрити" },
  tab_numbers: { en: "Numbers", ro: "Cifre", ru: "Цифры", uk: "Цифри" },
};

export const WT = T;

/** wt("pp_jobs", "uk", { n: 3 }). With n = 1, a key's "_one" form wins where
 *  there is one ("1 job"); Russian and Ukrainian say "объектов: 1" either way. */
export function wt(key, lang = "en", vars = null) {
  const e = (vars && Number(vars.n) === 1 && T[key + "_one"]) || T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** "3 days" / "3 zile" / "3 дня" / "3 дні" */
export function durText(n, lang = "en") {
  const loc = LOCALE[lang] || "en-GB";
  return new Intl.NumberFormat(loc, { style: "unit", unit: "day", unitDisplay: "long" }).format(Math.max(0, Math.round(Number(n) || 0)));
}

/** A stage's name; "apply" is Moldova's grid approval, Ukraine's notice, else a permit. */
export function stageName(id, lang = "en", market = "MD", long = false) {
  const k = id === "apply" ? (market === "UA" ? "apply_ua" : market === "MD" ? "apply_md" : "apply") : id;
  return wt((long ? "sl_" : "st_") + k, lang);
}

/** The label of a secondary action (call, make the quote, deposit already paid). */
function altLabel(a, lang, key) {
  if (!a) return "";
  if (key && T["do_" + key]) return wt("do_" + key, lang);
  if (a.type === "tel") return wt("do_alt_call", lang);
  if (a.type === "lead_quote") return wt("do_alt_quote", lang);
  if (a.type === "step" && a.step === "deposit") return wt("do_alt_deposit", lang);
  return "";
}

/** A fix or next action's button text: do_<key> with its operator filled in. */
export function actLabel(key, vars, lang = "en") {
  const v = { ...(vars || {}) };
  if ("op" in v || /op\}/.test((T["do_" + key] || {}).en || "")) v.op = v.op || t("gf_ua_generic", lang);
  return wt("do_" + key, lang, v);
}

/**
 * A workflow (lib/workflow.js) in words.
 * @returns {{ stage: string, stageLong: string, next: string, alt: string, why: string, wait: string,
 *            days: string, stuck: string, stuckShort: string }}
 */
export function describe(w, lang = "en", now = Date.now()) {
  if (!w) return null;
  const loc = LOCALE[lang] || "en-GB";
  const when = (iso) => (iso ? relTime(iso, loc, now) : "");
  const date = (d) => (d ? fmtDate(String(d).length === 10 ? d + "T12:00:00Z" : d, loc, { day: "numeric", month: "long" }) : "");
  const vars = (key, v = {}) => {
    const o = { ...v };
    if ("op" in o) o.op = o.op || t("gf_ua_generic", lang);
    if ("at" in o) { o.when = when(o.at); delete o.at; }
    if ("date" in o) o.date = date(o.date);
    if ("days" in o) { o.dur = durText(o.days, lang); delete o.days; }
    if ("stage" in o) o.stage = key === "why_gap" ? stageName(o.stage, lang, w.market, true) : t("gf_stage_" + o.stage, lang);
    return o;
  };
  // a wait that started today has no "for 0 days"
  const whyKey = (b) => (b.key === "why_await_op" && !b.vars?.days ? "why_await_op0" : b.key);
  let why = (w.blockers || []).map((b) => wt(whyKey(b), lang, vars(b.key, b.vars))).join(" ");
  if (!why && w.kind === "project") why = w.lost ? wt("why_lost", lang) : w.next ? "" : wt(w.inPortfolio ? "why_done_pf" : "why_done", lang);
  return {
    stage: w.lost ? wt("st_lost", lang) : stageName(w.stage, lang, w.market),
    stageLong: w.lost ? wt("st_lost", lang) : stageName(w.stage, lang, w.market, true),
    next: w.next ? wt("do_" + w.next.key, lang, vars("do_" + w.next.key, w.next.vars)) : w.lost ? "" : wt("do_none", lang),
    alt: altLabel(w.next?.alt, lang, w.next?.altKey),
    why,
    wait: w.waitingOn ? wt("wait_" + w.waitingOn, lang) : "",
    // a finished job has nothing to wait for, so no "days in this stage"
    days: w.days == null || !w.next ? "" : w.days === 0 ? wt("days_in0", lang) : wt("days_in", lang, { dur: durText(w.days, lang) }),
    stuck: w.stuck ? wt("stuck", lang, { dur: durText(w.idle, lang), limit: durText(w.limit, lang) }) : "",
    stuckShort: w.stuck ? wt("stuck_short", lang, { dur: durText(w.idle, lang) }) : "",
  };
}
