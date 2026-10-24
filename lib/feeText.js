// lib/feeText.js — the words of VoltMira's fee for signed jobs (lib/jobFees.js): the fee card on a job, the dialogs,
// the monthly statement, its reminders and the Settings page. The installer reads them, so Romanian says "tu";
// Russian and Ukrainian use the formal "вы/ви". lib/feeText.test.js holds every key to four languages, the same
// placeholders, and no dash, middle dot or check mark. ft(key, lang, { x }) fills {x}.

const T = {
  // ---- the fee card on a job (components/FeeCard.jsx)
  fee_h: { en: "VoltMira fee for this job", ro: "Taxa VoltMira pentru această lucrare", ru: "Плата VoltMira за этот объект", uk: "Плата VoltMira за цей об’єкт" },
  st_free: { en: "Free", ro: "Gratuit", ru: "Бесплатно", uk: "Безкоштовно" },
  st_due: { en: "To pay", ro: "De plată", ru: "К оплате", uk: "До сплати" },
  st_paid: { en: "Paid", ro: "Plătit", ru: "Оплачено", uk: "Сплачено" },
  st_void: { en: "Client gave up", ro: "Clientul a renunțat", ru: "Клиент отказался", uk: "Клієнт відмовився" },
  st_waived: { en: "Waived", ro: "Iertată", ru: "Списано", uk: "Списано" },
  st_locked: { en: "Locked", ro: "Blocată", ru: "Заблокировано", uk: "Заблоковано" },
  sub_kw: { en: "{kw} kW, {r} per kW", ro: "{kw} kW, {r} pe kW", ru: "{kw} кВт, {r} за кВт", uk: "{kw} кВт, {r} за кВт" },
  sub_cap: { en: "{kw} kW, capped at the most a job costs", ro: "{kw} kW, plafonat la maximul pe o lucrare", ru: "{kw} кВт, не больше максимума за объект", uk: "{kw} кВт, не більше максимуму за об’єкт" },
  sub_free: { en: "Signed job {n} of your first {t}", ro: "Lucrarea semnată {n} din primele {t}", ru: "Подписанный объект {n} из первых {t}", uk: "Підписаний об’єкт {n} з перших {t}" },
  how_signed: { en: "signed online", ro: "semnat online", ru: "подписано онлайн", uk: "підписано онлайн" },
  how_manual: { en: "marked signed", ro: "marcat semnat", ru: "отмечено подписанным", uk: "позначено підписаним" },
  signed_on: { en: "Signed {d}, {how}", ro: "Semnat {d}, {how}", ru: "Подписано {d}, {how}", uk: "Підписано {d}, {how}" },
  in_statement: { en: "Goes on the statement for {m}", ro: "Apare în extrasul pentru {m}", ru: "Попадает в выписку за {m}", uk: "Потрапляє у виписку за {m}" },
  on_statement: { en: "On statement {no}, to pay by {d}", ro: "Pe extrasul {no}, de plătit până pe {d}", ru: "В выписке {no}, оплатить до {d}", uk: "У виписці {no}, сплатити до {d}" },
  paid_on: { en: "Paid on {d}", ro: "Plătit pe {d}", ru: "Оплачено {d}", uk: "Сплачено {d}" },
  paid_credit: { en: "Paid from the credit of a cancelled job", ro: "Plătit din creditul unei lucrări anulate", ru: "Оплачено из кредита отменённого объекта", uk: "Сплачено з кредиту скасованого об’єкта" },
  waived_p: { en: "VoltMira waived this fee.", ro: "VoltMira a iertat această taxă.", ru: "VoltMira списала эту плату.", uk: "VoltMira списала цю плату." },
  void_p: { en: "The client gave up: you pay nothing for this job.", ro: "Clientul a renunțat: nu plătești nimic pentru această lucrare.", ru: "Клиент отказался: за этот объект вы ничего не платите.", uk: "Клієнт відмовився: за цей об’єкт ви нічого не платите." },
  before_h: { en: "When the client signs", ro: "Când clientul semnează", ru: "Когда клиент подпишет", uk: "Коли клієнт підпише" },
  before_free: { en: "Free: one of your first {t} signed jobs", ro: "Gratuit: una din primele {t} lucrări semnate", ru: "Бесплатно: один из первых {t} подписанных объектов", uk: "Безкоштовно: один з перших {t} підписаних об’єктів" },
  before_p: { en: "Nothing is owed until then, and nothing if the client gives up.", ro: "Până atunci nu datorezi nimic, iar dacă clientul renunță, nimic.", ru: "До тех пор вы ничего не должны, и ничего, если клиент откажется.", uk: "До того ви нічого не винні, і нічого, якщо клієнт відмовиться." },
  btn_cancel: { en: "Client gave up", ro: "Clientul a renunțat", ru: "Клиент отказался", uk: "Клієнт відмовився" },
  cancel_h: { en: "Did the client give up the job?", ro: "Clientul a renunțat la lucrare?", ru: "Клиент отказался от объекта?", uk: "Клієнт відмовився від об’єкта?" },
  cancel_p: { en: "The job is marked lost and you pay nothing for it. If the client signs again later, the fee comes back.", ro: "Lucrarea se marchează pierdută și nu plătești nimic pentru ea. Dacă clientul semnează din nou mai târziu, taxa revine.", ru: "Объект отмечается потерянным, и вы ничего за него не платите. Если клиент позже подпишет снова, плата вернётся.", uk: "Об’єкт позначається втраченим, і ви нічого за нього не платите. Якщо клієнт пізніше підпише знову, плата повернеться." },
  cancel_paid_p: { en: "The job is marked lost. Its fee is already paid, so the amount becomes credit for your next signed job.", ro: "Lucrarea se marchează pierdută. Taxa ei e deja plătită, așa că suma devine credit pentru următoarea lucrare semnată.", ru: "Объект отмечается потерянным. Плата за него уже внесена, поэтому сумма станет кредитом на следующий подписанный объект.", uk: "Об’єкт позначається втраченим. Плату за нього вже внесено, тож сума стане кредитом на наступний підписаний об’єкт." },
  cancel_yes: { en: "Yes, the client gave up", ro: "Da, clientul a renunțat", ru: "Да, клиент отказался", uk: "Так, клієнт відмовився" },
  not_now: { en: "Not yet", ro: "Nu încă", ru: "Пока нет", uk: "Поки ні" },
  how_link: { en: "How the fee works", ro: "Cum funcționează taxa", ru: "Как работает плата", uk: "Як працює плата" },
  statement_open: { en: "Open the statement", ro: "Deschide extrasul", ru: "Открыть выписку", uk: "Відкрити виписку" },
  sample_p: { en: "Example workspace: nothing is charged and nothing locks here.", ro: "Spațiu demonstrativ: aici nu se plătește și nu se blochează nimic.", ru: "Демонстрационное пространство: здесь ничего не оплачивается и не блокируется.", uk: "Демонстраційний простір: тут нічого не сплачується й не блокується." },
  off_p: { en: "Fees are not switched on yet: nothing is charged.", ro: "Taxele nu sunt încă pornite: nu se plătește nimic.", ru: "Плата ещё не включена: ничего не списывается.", uk: "Плату ще не ввімкнено: нічого не списується." },
  needs_idno: { en: "Add your company's IDNO in Settings to open this job's paperwork. The free jobs and the statements are counted on it.", ro: "Adaugă IDNO-ul companiei în Setări ca să deschizi documentele acestei lucrări. Lucrările gratuite și extrasele se socotesc pe el.", ru: "Добавьте IDNO компании в Настройках, чтобы открыть документы объекта. Бесплатные объекты и выписки учитываются по нему.", uk: "Додайте IDNO компанії в Налаштуваннях, щоб відкрити документи об’єкта. Безкоштовні об’єкти й виписки обліковуються за ним." },
  idno_go: { en: "Add the IDNO", ro: "Adaugă IDNO", ru: "Добавить IDNO", uk: "Додати IDNO" },
  locked_p: { en: "The statement for {m} is not paid, so this job's paperwork is locked. Pay it by bank transfer to open it again.", ro: "Extrasul pentru {m} nu e plătit, așa că documentele acestei lucrări sunt blocate. Plătește-l prin transfer ca să le redeschizi.", ru: "Выписка за {m} не оплачена, поэтому документы объекта заблокированы. Оплатите её переводом, чтобы открыть их снова.", uk: "Виписку за {m} не сплачено, тому документи об’єкта заблоковано. Сплатіть її переказом, щоб відкрити їх знову." },
  locked_short: { en: "This job's paperwork is locked until VoltMira's statement is paid.", ro: "Documentele acestei lucrări sunt blocate până se plătește extrasul VoltMira.", ru: "Документы объекта заблокированы до оплаты выписки VoltMira.", uk: "Документи об’єкта заблоковано до сплати виписки VoltMira." },
  e_save: { en: "Not saved. Try again.", ro: "Nesalvat. Încearcă din nou.", ru: "Не сохранено. Попробуйте снова.", uk: "Не збережено. Спробуйте ще раз." },
  e_needs_db: { en: "Needs the database update (add-job-fees.sql).", ro: "Are nevoie de actualizarea bazei de date (add-job-fees.sql).", ru: "Нужно обновление базы данных (add-job-fees.sql).", uk: "Потрібне оновлення бази даних (add-job-fees.sql)." },

  // ---- the paywall dialog, when a locked document sent the installer back
  gate_h: { en: "This job's paperwork is locked", ro: "Documentele lucrării sunt blocate", ru: "Документы объекта заблокированы", uk: "Документи об’єкта заблоковано" },
  gate_p: { en: "The statement this job is on was due on the 15th and is still not paid. Once the transfer arrives, the contract, the invoice, the grid file and the handover papers open again.", ro: "Extrasul pe care e această lucrare era scadent pe 15 și încă nu e plătit. Imediat ce sosește transferul, contractul, factura, dosarul de racordare și actele de predare se redeschid.", ru: "Выписка, в которой этот объект, должна была быть оплачена 15-го и до сих пор не оплачена. Как только поступит перевод, договор, счёт, документы на подключение и акты сдачи откроются снова.", uk: "Виписку, у якій цей об’єкт, треба було сплатити 15-го, і її досі не сплачено. Щойно надійде переказ, договір, рахунок, документи на приєднання й акти здачі відкриються знову." },
  close: { en: "Close", ro: "Închide", ru: "Закрыть", uk: "Закрити" },

  // ---- before an invoice for a quote not yet signed (the editor's invoice dialog)
  sign_h: { en: "Invoices are issued for signed jobs", ro: "Factura se emite pentru lucrări semnate", ru: "Счёт выставляется на подписанные объекты", uk: "Рахунок виставляється на підписані об’єкти" },
  sign_p: { en: "Mark the job signed to issue the invoice.", ro: "Marchează lucrarea semnată ca să emiți factura.", ru: "Отметьте объект подписанным, чтобы выставить счёт.", uk: "Позначте об’єкт підписаним, щоб виставити рахунок." },
  sign_fee: { en: "VoltMira fee for it: {v}", ro: "Taxa VoltMira pentru ea: {v}", ru: "Плата VoltMira за него: {v}", uk: "Плата VoltMira за нього: {v}" },
  sign_yes: { en: "Mark signed and open the invoice", ro: "Marchează semnat și deschide factura", ru: "Отметить подписанным и открыть счёт", uk: "Позначити підписаним і відкрити рахунок" },

  // ---- the monthly statement and its reminders (lib/feeReminders.js)
  st_h: { en: "Statement for {m}", ro: "Extrasul pentru {m}", ru: "Выписка за {m}", uk: "Виписка за {m}" },
  ref_h: { en: "Transfer reference", ro: "Destinația plății", ru: "Назначение платежа", uk: "Призначення платежу" },
  rem_kicker: { en: "VoltMira statement", ro: "Extras VoltMira", ru: "Выписка VoltMira", uk: "Виписка VoltMira" },
  rem_until: { en: "To pay by", ro: "De plătit până pe", ru: "Оплатить до", uk: "Сплатити до" },
  rem_cta: { en: "Open the statement", ro: "Deschide extrasul", ru: "Открыть выписку", uk: "Відкрити виписку" },
  rem_s_issued: { en: "VoltMira statement for {m}: {v} to pay", ro: "Extrasul VoltMira pentru {m}: {v} de plătit", ru: "Выписка VoltMira за {m}: {v} к оплате", uk: "Виписка VoltMira за {m}: {v} до сплати" },
  rem_s_week: { en: "7 days left to pay the statement for {m} ({v})", ro: "Mai ai 7 zile să plătești extrasul pentru {m} ({v})", ru: "Осталось 7 дней на оплату выписки за {m} ({v})", uk: "Залишилося 7 днів на сплату виписки за {m} ({v})" },
  rem_s_last_day: { en: "Last day to pay the statement for {m} ({v})", ro: "Ultima zi să plătești extrasul pentru {m} ({v})", ru: "Последний день оплаты выписки за {m} ({v})", uk: "Останній день сплати виписки за {m} ({v})" },
  rem_s_locked: { en: "The statement for {m} is unpaid: its jobs' paperwork is locked", ro: "Extrasul pentru {m} nu e plătit: documentele lucrărilor lui sunt blocate", ru: "Выписка за {m} не оплачена: документы её объектов заблокированы", uk: "Виписку за {m} не сплачено: документи її об’єктів заблоковано" },
  rem_l_issued: { en: "These are the fees for the jobs your clients signed last month. Pay by bank transfer with the reference below, within 14 days.", ro: "Acestea sunt taxele pentru lucrările semnate de clienți luna trecută. Plătește prin transfer, cu destinația de mai jos, în 14 zile.", ru: "Это плата за объекты, которые клиенты подписали в прошлом месяце. Оплатите переводом с назначением ниже в течение 14 дней.", uk: "Це плата за об’єкти, які клієнти підписали минулого місяця. Сплатіть переказом із призначенням нижче протягом 14 днів." },
  rem_l_week: { en: "A job a client gave up since is not counted: you pay only for the rest.", ro: "O lucrare la care clientul a renunțat între timp nu se socotește: plătești doar restul.", ru: "Объект, от которого клиент с тех пор отказался, не учитывается: вы платите только за остальные.", uk: "Об’єкт, від якого клієнт відтоді відмовився, не враховується: ви платите лише за решту." },
  rem_l_last_day: { en: "From tomorrow the contract, the invoice, the grid file and the handover papers of these jobs are locked until the statement is paid.", ro: "De mâine contractul, factura, dosarul de racordare și actele de predare ale acestor lucrări se blochează până se plătește extrasul.", ru: "С завтрашнего дня договор, счёт, документы на подключение и акты сдачи этих объектов блокируются до оплаты выписки.", uk: "З завтрашнього дня договір, рахунок, документи на приєднання й акти здачі цих об’єктів блокуються до сплати виписки." },
  rem_l_locked: { en: "Pay the statement to open them again. Everything else in VoltMira stays free and open.", ro: "Plătește extrasul ca să le redeschizi. Restul VoltMira rămâne gratuit și deschis.", ru: "Оплатите выписку, чтобы снова их открыть. Всё остальное в VoltMira остаётся бесплатным и открытым.", uk: "Сплатіть виписку, щоб знову їх відкрити. Усе інше у VoltMira залишається безкоштовним і відкритим." },

  // ---- Settings, "Pay per job" (app/(app)/settings/FeesPanel.jsx)
  fp_kicker: { en: "Pay per job", ro: "Plată per lucrare", ru: "Оплата за объект", uk: "Оплата за об’єкт" },
  fp_h: { en: "You pay only when the client signs", ro: "Plătești doar când clientul semnează", ru: "Вы платите, только когда клиент подписывает", uk: "Ви платите, лише коли клієнт підписує" },
  fp_p: { en: "VoltMira is free for installers. The fees for the jobs signed in a month come on one statement at the start of the next, paid by bank transfer.", ro: "VoltMira este gratuit pentru instalatori. Taxele pentru lucrările semnate într-o lună vin pe un singur extras la începutul lunii următoare, plătit prin transfer bancar.", ru: "VoltMira бесплатна для монтажников. Плата за объекты, подписанные за месяц, приходит одной выпиской в начале следующего, оплата банковским переводом.", uk: "VoltMira безкоштовна для монтажників. Плата за об’єкти, підписані за місяць, надходить однією випискою на початку наступного, оплата банківським переказом." },
  r_kw_c: { en: "per kW of each signed job", ro: "pe kW din fiecare lucrare semnată", ru: "за кВт каждого подписанного объекта", uk: "за кВт кожного підписаного об’єкта" },
  r_cap_c: { en: "the most a job costs, however large", ro: "maximum pe o lucrare, oricât de mare", ru: "максимум за объект, каким бы большим он ни был", uk: "максимум за об’єкт, хоч яким великим він буде" },
  r_free_v: { en: "{n} jobs", ro: "{n} lucrări", ru: "{n} объекта", uk: "{n} об’єкти" },
  r_free_c: { en: "your first signed jobs are free", ro: "primele lucrări semnate sunt gratuite", ru: "первые подписанные объекты бесплатны", uk: "перші підписані об’єкти безкоштовні" },
  r_cancel_c: { en: "if the client gives up, you pay nothing", ro: "dacă clientul renunță, nu plătești nimic", ru: "если клиент откажется, вы ничего не платите", uk: "якщо клієнт відмовиться, ви нічого не платите" },
  calc_h: { en: "What a job costs", ro: "Cât costă o lucrare", ru: "Сколько стоит объект", uk: "Скільки коштує об’єкт" },
  calc_kw: { en: "System size, kW", ro: "Puterea sistemului, kW", ru: "Мощность системы, кВт", uk: "Потужність системи, кВт" },
  calc_out: { en: "A {kw} kW job costs", ro: "O lucrare de {kw} kW costă", ru: "Объект на {kw} кВт стоит", uk: "Об’єкт на {kw} кВт коштує" },
  calc_capped: { en: "capped at the most a job costs", ro: "plafonat la maximul pe o lucrare", ru: "не больше максимума за объект", uk: "не більше максимуму за об’єкт" },
  month_h: { en: "This month, {m}", ro: "Luna aceasta, {m}", ru: "Этот месяц, {m}", uk: "Цей місяць, {m}" },
  t_signed: { en: "Signed jobs", ro: "Lucrări semnate", ru: "Подписанные объекты", uk: "Підписані об’єкти" },
  t_signed_sub: { en: "{kw} kW in all, {f} free, {c} cancelled", ro: "{kw} kW în total, {f} gratuite, {c} anulate", ru: "{kw} кВт всего, бесплатных {f}, отменённых {c}", uk: "{kw} кВт загалом, безкоштовних {f}, скасованих {c}" },
  t_fees: { en: "Job fees", ro: "Taxe pe lucrări", ru: "Плата за объекты", uk: "Плата за об’єкти" },
  t_fees_sub: { en: "{r} per kW, at most {c} a job", ro: "{r} pe kW, maximum {c} pe lucrare", ru: "{r} за кВт, не больше {c} за объект", uk: "{r} за кВт, не більше {c} за об’єкт" },
  t_due: { en: "To pay for {m}", ro: "De plată pentru {m}", ru: "К оплате за {m}", uk: "До сплати за {m}" },
  t_due_sub: { en: "The invoice comes at the start of next month, paid by bank transfer", ro: "Factura vine la începutul lunii viitoare, plata prin transfer bancar", ru: "Счёт придёт в начале следующего месяца, оплата банковским переводом", uk: "Рахунок надійде на початку наступного місяця, оплата банківським переказом" },
  t_credit_sub: { en: "{v} of credit from cancelled jobs pays the next fee", ro: "{v} credit din lucrări anulate plătește următoarea taxă", ru: "{v} кредита за отменённые объекты оплатят следующую плату", uk: "{v} кредиту за скасовані об’єкти сплатять наступну плату" },
  col_signed: { en: "Signed", ro: "Semnat", ru: "Подписано", uk: "Підписано" },
  col_job: { en: "Job", ro: "Lucrare", ru: "Объект", uk: "Об’єкт" },
  col_fee: { en: "Fee", ro: "Taxă", ru: "Плата", uk: "Плата" },
  col_month: { en: "Month", ro: "Luna", ru: "Месяц", uk: "Місяць" },
  col_jobs: { en: "Jobs", ro: "Lucrări", ru: "Объекты", uk: "Об’єкти" },
  col_status: { en: "Status", ro: "Stare", ru: "Статус", uk: "Статус" },
  jobs_empty: { en: "No job signed this month yet. When a client signs, the job and its fee show here.", ro: "Nicio lucrare semnată luna aceasta. Când un client semnează, lucrarea și taxa ei apar aici.", ru: "В этом месяце подписанных объектов пока нет. Когда клиент подпишет, объект и плата появятся здесь.", uk: "Цього місяця підписаних об’єктів ще немає. Коли клієнт підпише, об’єкт і плата з’являться тут." },
  prev_h: { en: "Earlier months", ro: "Lunile anterioare", ru: "Предыдущие месяцы", uk: "Попередні місяці" },
  prev_empty: { en: "No earlier month yet.", ro: "Încă nu există luni anterioare.", ru: "Предыдущих месяцев пока нет.", uk: "Попередніх місяців ще немає." },
  s_open: { en: "To pay by {d}", ro: "De plătit până pe {d}", ru: "Оплатить до {d}", uk: "Сплатити до {d}" },
  s_paid: { en: "Paid on {d}", ro: "Plătit pe {d}", ru: "Оплачено {d}", uk: "Сплачено {d}" },
  s_late: { en: "Overdue, paperwork locked", ro: "Întârziat, documente blocate", ru: "Просрочено, документы заблокированы", uk: "Прострочено, документи заблоковано" },
  s_settled: { en: "Paid", ro: "Plătit", ru: "Оплачено", uk: "Сплачено" },
  s_none: { en: "Nothing to pay", ro: "Nimic de plată", ru: "Ничего к оплате", uk: "Нічого до сплати" },
  s_coming: { en: "Statement on {d}", ro: "Extrasul vine pe {d}", ru: "Выписка придёт {d}", uk: "Виписка надійде {d}" },
  free_used: { en: "{u} of {n} free jobs used", ro: "{u} din {n} lucrări gratuite folosite", ru: "Использовано бесплатных объектов: {u} из {n}", uk: "Використано безкоштовних об’єктів: {u} з {n}" },
  pay_h: { en: "How you pay", ro: "Cum plătești", ru: "Как вы платите", uk: "Як ви платите" },
  pay_p: { en: "By bank transfer to VoltMira's account, with the reference on the statement, by the 15th. A job whose statement is still unpaid after that has its paperwork locked until the transfer arrives.", ro: "Prin transfer bancar în contul VoltMira, cu destinația de pe extras, până pe 15. O lucrare al cărei extras nu e plătit până atunci are documentele blocate până sosește transferul.", ru: "Банковским переводом на счёт VoltMira с назначением из выписки, до 15-го. Если выписка к этому времени не оплачена, документы её объектов блокируются до поступления перевода.", uk: "Банківським переказом на рахунок VoltMira з призначенням із виписки, до 15-го. Якщо виписку до того не сплачено, документи її об’єктів блокуються до надходження переказу." },
  fp_idno_h: { en: "Company tax id (IDNO)", ro: "Codul fiscal al companiei (IDNO)", ru: "Фискальный код компании (IDNO)", uk: "Фіскальний код компанії (IDNO)" },
  fp_idno_p: { en: "13 digits. The free jobs and VoltMira's statements are counted on it. It cannot be changed once a fee carries it.", ro: "13 cifre. Lucrările gratuite și extrasele VoltMira se socotesc pe el. Nu se mai poate schimba odată ce o taxă îl poartă.", ru: "13 цифр. По нему учитываются бесплатные объекты и выписки VoltMira. Его нельзя изменить, когда по нему уже есть плата.", uk: "13 цифр. За ним обліковуються безкоштовні об’єкти й виписки VoltMira. Його не можна змінити, коли за ним уже є плата." },
  fp_idno_save: { en: "Save the IDNO", ro: "Salvează IDNO", ru: "Сохранить IDNO", uk: "Зберегти IDNO" },
  fp_saved: { en: "Saved", ro: "Salvat", ru: "Сохранено", uk: "Збережено" },
  fp_e_bad_idno: { en: "The IDNO has 13 digits.", ro: "IDNO-ul are 13 cifre.", ru: "IDNO состоит из 13 цифр.", uk: "IDNO складається з 13 цифр." },
  fp_e_idno_locked: { en: "The IDNO is fixed: a fee already carries it. Write to VoltMira to change it.", ro: "IDNO-ul este fixat: o taxă îl poartă deja. Scrie-ne ca să-l schimbi.", ru: "IDNO закреплён: по нему уже есть плата. Напишите VoltMira, чтобы изменить.", uk: "IDNO закріплено: за ним уже є плата. Напишіть VoltMira, щоб змінити." },
  fp_e_owner_only: { en: "Only the owner can change this.", ro: "Doar proprietarul poate schimba asta.", ru: "Изменить может только владелец.", uk: "Змінити може лише власник." },
};

export const FT = T;

export function ft(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.ro) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

/** "2026-10" as the month's name in the language: "octombrie 2026", "October 2026". */
export function monthName(month, lang = "ro") {
  const [y, m] = String(month || "").split("-").map(Number);
  if (!y || !m) return "";
  // Russian and Ukrainian add a year mark ("2026 г."); without it the month reads as a heading
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(LOC[lang] || "ro-RO", { month: "long", year: "numeric", timeZone: "UTC" }).replace(/\s?(г|р)\.$/, "");
}

/** A day in the language, on the Chișinău clock: "2 oct. 2026". */
export function feeDay(iso, lang = "ro", long = false) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(LOC[lang] || "ro-RO", { day: "numeric", month: long ? "long" : "short", year: "numeric", timeZone: "Europe/Chisinau" });
}
