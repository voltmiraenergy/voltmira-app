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
  retry_h: { en: "Try again in a minute", ro: "Încearcă din nou peste un minut", ru: "Попробуйте снова через минуту", uk: "Спробуйте знову за хвилину" },
  retry_p: { en: "The document could not be opened because the fee for this job could not be checked just now. Nothing is owed because of it; try again in a minute.", ro: "Documentul nu s-a putut deschide pentru că taxa acestei lucrări nu a putut fi verificată chiar acum. Nu datorezi nimic din cauza asta; încearcă din nou peste un minut.", ru: "Документ не открылся: плату за этот объект сейчас не удалось проверить. Из-за этого вы ничего не должны; попробуйте снова через минуту.", uk: "Документ не відкрився: плату за цей об’єкт зараз не вдалося перевірити. Через це ви нічого не винні; спробуйте знову за хвилину." },
  before_h: { en: "VoltMira fee when the client signs", ro: "Taxa VoltMira când clientul semnează", ru: "Плата VoltMira, когда клиент подпишет", uk: "Плата VoltMira, коли клієнт підпише" },
  before_free: { en: "Free: one of your first {t} signed jobs", ro: "Gratuit: una din primele {t} lucrări semnate", ru: "Бесплатно: один из первых {t} подписанных объектов", uk: "Безкоштовно: один з перших {t} підписаних об’єктів" },
  k_size: { en: "System size", ro: "Puterea sistemului", ru: "Мощность системы", uk: "Потужність системи" },
  k_est: { en: "Estimated fee", ro: "Taxa estimată", ru: "Ориентировочная плата", uk: "Орієнтовна плата" },
  k_max: { en: "Maximum possible fee", ro: "Taxa maximă posibilă", ru: "Максимально возможная плата", uk: "Максимально можлива плата" },
  only_won: { en: "Payment is required only if the project is won, and nothing if the client gives up.", ro: "Plătești doar dacă lucrarea este câștigată, iar dacă clientul renunță, nimic.", ru: "Оплата нужна, только если объект выигран, и ничего, если клиент откажется.", uk: "Оплата потрібна, лише якщо об’єкт виграно, і нічого, якщо клієнт відмовиться." },
  free_offer: { en: "This project is free: introductory offer, one of your first {t} won projects", ro: "Acest proiect este gratuit: ofertă de început, unul din primele {t} proiecte câștigate", ru: "Этот проект бесплатный: стартовое предложение, один из первых {t} выигранных проектов", uk: "Цей проєкт безкоштовний: стартова пропозиція, один із перших {t} виграних проєктів" },
  needs_kw: { en: "Set the system size (kW) on the quote to open this job's paperwork. The fee is worked out from it.", ro: "Completează puterea sistemului (kW) în ofertă ca să deschizi documentele lucrării. Taxa se calculează din ea.", ru: "Укажите мощность системы (кВт) в оферте, чтобы открыть документы объекта. Плата считается по ней.", uk: "Вкажіть потужність системи (кВт) у розрахунку, щоб відкрити документи об’єкта. Плата рахується за нею." },
  beta_p: { en: "Signed during the free beta: this job is never billed.", ro: "Semnată în perioada beta gratuită: lucrarea nu se facturează niciodată.", ru: "Подписан во время бесплатной беты: за этот объект счёт не выставляется.", uk: "Підписано під час безкоштовної бети: за цей об’єкт рахунок не виставляється." },
  st_beta: { en: "Beta, not billed", ro: "Beta, nefacturată", ru: "Бета, без оплаты", uk: "Бета, без оплати" },
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

  // ---- the paperwork is for signed jobs, and what cancelling means once it is made
  sign_docs_h: { en: "Documents are made for signed jobs.", ro: "Documentele se fac pentru lucrări semnate.", ru: "Документы оформляются для подписанных объектов.", uk: "Документи оформлюються для підписаних об’єктів." },
  sign_docs_p: { en: "Mark the job signed to open the contract, the invoice, the grid file and the handover papers.", ro: "Marchează lucrarea semnată ca să deschizi contractul, factura, dosarul de racordare și actele de predare.", ru: "Отметьте объект подписанным, чтобы открыть договор, счёт, документы на подключение и акты сдачи.", uk: "Позначте об’єкт підписаним, щоб відкрити договір, рахунок, документи на приєднання й акти здачі." },
  sign_go: { en: "Mark signed", ro: "Marchează semnat", ru: "Отметить подписанным", uk: "Позначити підписаним" },
  docs_note: { en: "Opening a document counts as paperwork made for this job: after that, the client giving up no longer cancels the fee.", ro: "Deschiderea unui document contează ca acte făcute pentru lucrare: după aceea, renunțarea clientului nu mai anulează taxa.", ru: "Открытие документа считается оформлением бумаг по объекту: после этого отказ клиента больше не отменяет плату.", uk: "Відкриття документа вважається оформленням паперів для об’єкта: після цього відмова клієнта більше не скасовує плату." },
  cancel_kept_h: { en: "Paperwork was already made for this job", ro: "Pentru această lucrare s-au făcut deja acte", ru: "По этому объекту уже оформлены документы", uk: "Для цього об’єкта вже оформлено документи" },
  cancel_kept_p: { en: "The job is marked lost, but its fee stays: a contract, an invoice or the grid file was made for it. If the client really gave up, tell VoltMira why and we will waive it.", ro: "Lucrarea se marchează pierdută, dar taxa rămâne: pentru ea s-a făcut un contract, o factură sau dosarul de racordare. Dacă clientul chiar a renunțat, spune-ne de ce și o iertăm.", ru: "Объект отмечается потерянным, но плата остаётся: для него уже оформлены договор, счёт или документы на подключение. Если клиент действительно отказался, напишите VoltMira причину, и мы её спишем.", uk: "Об’єкт позначається втраченим, але плата залишається: для нього вже оформлено договір, рахунок або документи на приєднання. Якщо клієнт справді відмовився, напишіть VoltMira причину, і ми її спишемо." },
  waiver_label: { en: "Why the client gave up", ro: "De ce a renunțat clientul", ru: "Почему клиент отказался", uk: "Чому клієнт відмовився" },
  waiver_send: { en: "Ask VoltMira to waive the fee", ro: "Cere VoltMira să ierte taxa", ru: "Попросить VoltMira списать плату", uk: "Попросити VoltMira списати плату" },
  waiver_sent: { en: "Sent. VoltMira will answer by email.", ro: "Trimis. VoltMira îți răspunde pe e-mail.", ru: "Отправлено. VoltMira ответит по e-mail.", uk: "Надіслано. VoltMira відповість e-mail." },
  waiver_pending: { en: "You asked VoltMira to waive this fee.", ro: "Ai cerut VoltMira să ierte această taxă.", ru: "Вы попросили VoltMira списать эту плату.", uk: "Ви попросили VoltMira списати цю плату." },
  e_reason: { en: "Write a few words about why.", ro: "Scrie în câteva cuvinte de ce.", ru: "Напишите в нескольких словах почему.", uk: "Напишіть кількома словами чому." },

  // ---- a demo workspace is for looking (lib/demoServer.js)
  demo_only: { en: "This is a demo workspace: nothing is sent to real people from it. Create your own account to send offers.", ro: "Acesta e un spațiu demo: din el nu se trimite nimic oamenilor reali. Creează-ți contul ca să trimiți oferte.", ru: "Это демо-пространство: из него ничего не отправляется реальным людям. Создайте свой аккаунт, чтобы отправлять предложения.", uk: "Це демо-простір: з нього нічого не надсилається реальним людям. Створіть свій обліковий запис, щоб надсилати пропозиції." },
  demo_offer_h: { en: "Demo example", ro: "Exemplu demo", ru: "Демо-пример", uk: "Демо-приклад" },
  demo_offer_p: { en: "This offer was made in VoltMira's demo. It is not a real offer and cannot be signed.", ro: "Această ofertă a fost făcută în demo-ul VoltMira. Nu e o ofertă reală și nu poate fi semnată.", ru: "Это предложение создано в демо VoltMira. Оно не настоящее и не может быть подписано.", uk: "Цю пропозицію створено в демо VoltMira. Вона не справжня і не може бути підписана." },

  // ---- an unpaid statement, step by step (lib/jobFees.js holdLevel)
  hold1_p: { en: "The statement for {m} is not paid: the paperwork of its jobs is locked.", ro: "Extrasul pentru {m} nu e plătit: documentele lucrărilor lui sunt blocate.", ru: "Выписка за {m} не оплачена: документы её объектов заблокированы.", uk: "Виписку за {m} не сплачено: документи її об’єктів заблоковано." },
  hold2_p: { en: "The statement for {m} is {n} days late: new offers cannot be sent until it is paid.", ro: "Extrasul pentru {m} are {n} zile întârziere: nu poți trimite oferte noi până nu e plătit.", ru: "Выписка за {m} просрочена на {n} дн.: новые предложения нельзя отправлять до оплаты.", uk: "Виписку за {m} прострочено на {n} дн.: нові пропозиції не можна надсилати до сплати." },
  hold3_p: { en: "The statement for {m} is {n} days late: the workspace is read-only until it is paid.", ro: "Extrasul pentru {m} are {n} zile întârziere: spațiul de lucru e doar pentru citire până se plătește.", ru: "Выписка за {m} просрочена на {n} дн.: пространство только для чтения до оплаты.", uk: "Виписку за {m} прострочено на {n} дн.: простір лише для читання до сплати." },
  hold_pay: { en: "See the statement", ro: "Vezi extrasul", ru: "Открыть выписку", uk: "Відкрити виписку" },
  e_hold_offers: { en: "New offers cannot be sent while a VoltMira statement is 30 days late. Pay it from Settings, Pay per job.", ro: "Nu poți trimite oferte noi cât timp un extras VoltMira are 30 de zile întârziere. Plătește-l din Setări, Plată per lucrare.", ru: "Новые предложения нельзя отправлять, пока выписка VoltMira просрочена на 30 дней. Оплатите её в Настройках, Оплата за объект.", uk: "Нові пропозиції не можна надсилати, поки виписку VoltMira прострочено на 30 днів. Сплатіть її в Налаштуваннях, Оплата за об’єкт." },
  e_hold_readonly: { en: "The workspace is read-only while a VoltMira statement is 60 days late. Pay it from Settings, Pay per job.", ro: "Spațiul de lucru e doar pentru citire cât timp un extras VoltMira are 60 de zile întârziere. Plătește-l din Setări, Plată per lucrare.", ru: "Пространство только для чтения, пока выписка VoltMira просрочена на 60 дней. Оплатите её в Настройках, Оплата за объект.", uk: "Простір лише для читання, поки виписку VoltMira прострочено на 60 днів. Сплатіть її в Налаштуваннях, Оплата за об’єкт." },
  rem_s_warn30: { en: "In 5 days, new offers stop until the statement for {m} is paid ({v})", ro: "Peste 5 zile nu mai poți trimite oferte până nu plătești extrasul pentru {m} ({v})", ru: "Через 5 дней отправка предложений остановится до оплаты выписки за {m} ({v})", uk: "Через 5 днів надсилання пропозицій зупиниться до сплати виписки за {m} ({v})" },
  rem_s_hold30: { en: "New offers are stopped: the statement for {m} is 30 days late ({v})", ro: "Ofertele noi sunt oprite: extrasul pentru {m} are 30 de zile întârziere ({v})", ru: "Новые предложения остановлены: выписка за {m} просрочена на 30 дней ({v})", uk: "Нові пропозиції зупинено: виписку за {m} прострочено на 30 днів ({v})" },
  rem_s_warn60: { en: "In 5 days the workspace becomes read-only until the statement for {m} is paid ({v})", ro: "Peste 5 zile spațiul de lucru devine doar pentru citire până plătești extrasul pentru {m} ({v})", ru: "Через 5 дней пространство станет только для чтения до оплаты выписки за {m} ({v})", uk: "Через 5 днів простір стане лише для читання до сплати виписки за {m} ({v})" },
  rem_s_hold60: { en: "The workspace is read-only: the statement for {m} is 60 days late ({v})", ro: "Spațiul de lucru e doar pentru citire: extrasul pentru {m} are 60 de zile întârziere ({v})", ru: "Пространство только для чтения: выписка за {m} просрочена на 60 дней ({v})", uk: "Простір лише для читання: виписку за {m} прострочено на 60 днів ({v})" },
  rem_l_warn30: { en: "Your quotes, clients and data stay as they are; only sending new offers stops until the transfer arrives.", ro: "Ofertele, clienții și datele rămân cum sunt; doar trimiterea ofertelor noi se oprește până sosește transferul.", ru: "Предложения, клиенты и данные остаются как есть; останавливается только отправка новых предложений до поступления перевода.", uk: "Пропозиції, клієнти й дані залишаються як є; зупиняється лише надсилання нових пропозицій до надходження переказу." },
  rem_l_hold30: { en: "Pay the statement by bank transfer with its reference; sending offers comes back as soon as it arrives.", ro: "Plătește extrasul prin transfer cu destinația lui; trimiterea ofertelor revine imediat ce sosește.", ru: "Оплатите выписку переводом с её назначением; отправка предложений вернётся сразу после поступления.", uk: "Сплатіть виписку переказом з її призначенням; надсилання пропозицій повернеться одразу після надходження." },
  rem_l_warn60: { en: "Nothing is deleted: you will still see everything, but no changes can be saved until the transfer arrives.", ro: "Nu se șterge nimic: vei vedea totul, dar nu se vor putea salva schimbări până sosește transferul.", ru: "Ничего не удаляется: вы будете всё видеть, но изменения нельзя будет сохранить до поступления перевода.", uk: "Нічого не видаляється: ви бачитимете все, але зміни не можна буде зберегти до надходження переказу." },
  rem_l_hold60: { en: "Pay the statement by bank transfer with its reference; the workspace opens again as soon as it arrives.", ro: "Plătește extrasul prin transfer cu destinația lui; spațiul de lucru se redeschide imediat ce sosește.", ru: "Оплатите выписку переводом с её назначением; пространство откроется сразу после поступления.", uk: "Сплатіть виписку переказом з її призначенням; простір відкриється одразу після надходження." },
  e_delete_fees: { en: "The account cannot be deleted while VoltMira fees are owed. Pay the statement first, or write to VoltMira.", ro: "Contul nu poate fi șters cât timp sunt taxe VoltMira de plătit. Plătește întâi extrasul sau scrie-ne.", ru: "Аккаунт нельзя удалить, пока есть неоплаченная плата VoltMira. Сначала оплатите выписку или напишите VoltMira.", uk: "Обліковий запис не можна видалити, поки є несплачена плата VoltMira. Спершу сплатіть виписку або напишіть VoltMira." },

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
  fp_h: { en: "VoltMira is free. Pay only when you win.", ro: "VoltMira este gratuit. Plătești doar când câștigi o lucrare.", ru: "VoltMira бесплатна. Вы платите, только когда выигрываете объект.", uk: "VoltMira безкоштовна. Ви платите, лише коли виграєте об’єкт." },
  fp_p: { en: "Quotes, projects and the CRM cost nothing. When a client signs, the job's fee goes on one statement at the start of the next month, paid by bank transfer.", ro: "Ofertele, proiectele și CRM-ul nu costă nimic. Când un client semnează, taxa lucrării intră pe un singur extras la începutul lunii următoare, plătit prin transfer bancar.", ru: "Оферты, проекты и CRM ничего не стоят. Когда клиент подписывает, плата за объект попадает в одну выписку в начале следующего месяца, оплата банковским переводом.", uk: "Розрахунки, проєкти й CRM нічого не коштують. Коли клієнт підписує, плата за об’єкт потрапляє в одну виписку на початку наступного місяця, оплата банківським переказом." },
  r_month_c: { en: "a month: no subscription, ever", ro: "pe lună: fără abonament", ru: "в месяц: без подписки", uk: "на місяць: без підписки" },
  inc_h: { en: "Included", ro: "Inclus", ru: "Включено", uk: "Включено" },
  inc_quotes: { en: "Unlimited quotes", ro: "Oferte nelimitate", ru: "Неограниченные оферты", uk: "Необмежені розрахунки" },
  inc_projects: { en: "Unlimited projects", ro: "Proiecte nelimitate", ru: "Неограниченные проекты", uk: "Необмежені проєкти" },
  inc_crm: { en: "Free CRM", ro: "CRM gratuit", ru: "Бесплатная CRM", uk: "Безкоштовна CRM" },
  inc_lost: { en: "Nothing for a lost job", ro: "Nimic pentru o lucrare pierdută", ru: "Ничего за потерянный объект", uk: "Нічого за втрачений об’єкт" },
  calc_max: { en: "at most {c} a job", ro: "maximum {c} pe lucrare", ru: "не больше {c} за объект", uk: "не більше {c} за об’єкт" },
  r_kw_c: { en: "per kW of each won job after that", ro: "pe kW din fiecare lucrare câștigată după aceea", ru: "за кВт каждого выигранного объекта после этого", uk: "за кВт кожного виграного об’єкта після цього" },
  r_cap_c: { en: "the most a job costs, however large", ro: "maximum pe o lucrare, oricât de mare", ru: "максимум за объект, каким бы большим он ни был", uk: "максимум за об’єкт, хоч яким великим він буде" },
  r_free_v: { en: "{n} jobs", ro: "{n} lucrări", ru: "{n} объекта", uk: "{n} об’єкти" },
  r_free_c: { en: "your first two won jobs are free", ro: "primele două lucrări câștigate sunt gratuite", ru: "первые два выигранных объекта бесплатны", uk: "перші два виграні об’єкти безкоштовні" },
  r_cancel_c: { en: "if the client gives up, you pay nothing", ro: "dacă clientul renunță, nu plătești nimic", ru: "если клиент откажется, вы ничего не платите", uk: "якщо клієнт відмовиться, ви нічого не платите" },
  calc_h: { en: "What a job costs", ro: "Cât costă o lucrare", ru: "Сколько стоит объект", uk: "Скільки коштує об’єкт" },
  calc_kw: { en: "System size, kW", ro: "Puterea sistemului, kW", ru: "Мощность системы, кВт", uk: "Потужність системи, кВт" },
  calc_out: { en: "Estimated VoltMira fee for {kw} kW", ro: "Taxa VoltMira estimată pentru {kw} kW", ru: "Ориентировочная плата VoltMira за {kw} кВт", uk: "Орієнтовна плата VoltMira за {kw} кВт" },
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
