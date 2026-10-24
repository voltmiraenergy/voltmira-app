// lib/feeText.js — the words of the fee per won project (lib/jobFees.js): the fee card on a job, the paywall, the
// payment, the invoices and the Settings page. The installer reads them, so Romanian says "tu"; Russian and Ukrainian
// use the formal "вы/ви". lib/feeText.test.js holds every key to four languages, the same placeholders, and no dash,
// middle dot or check mark. ft(key, lang, { x }) fills {x}.

const T = {
  // ---- the fee card on a won job
  fee_h: { en: "Fee for this job", ro: "Taxa pentru această lucrare", ru: "Плата за этот объект", uk: "Плата за цей об’єкт" },
  why: { en: "VoltMira is free. You pay only for the projects your clients sign.", ro: "VoltMira este gratuit. Plătești doar pentru proiectele semnate de clienți.", ru: "VoltMira бесплатна. Вы платите только за проекты, которые подписали клиенты.", uk: "VoltMira безкоштовна. Ви платите лише за проєкти, які підписали клієнти." },
  tier_0: { en: "System up to 10 kW", ro: "Sistem până la 10 kW", ru: "Система до 10 кВт", uk: "Система до 10 кВт" },
  tier_1: { en: "System of 10 to 30 kW", ro: "Sistem de 10 până la 30 kW", ru: "Система от 10 до 30 кВт", uk: "Система від 10 до 30 кВт" },
  tier_2: { en: "System of 30 to 100 kW", ro: "Sistem de 30 până la 100 kW", ru: "Система от 30 до 100 кВт", uk: "Система від 30 до 100 кВт" },
  tier_3: { en: "System above 100 kW", ro: "Sistem peste 100 kW", ru: "Система свыше 100 кВт", uk: "Система понад 100 кВт" },
  st_free: { en: "Free", ro: "Gratuit", ru: "Бесплатно", uk: "Безкоштовно" },
  st_due: { en: "To pay", ro: "De plătit", ru: "К оплате", uk: "До сплати" },
  st_paid: { en: "Paid", ro: "Plătit", ru: "Оплачено", uk: "Сплачено" },
  st_void: { en: "Job lost", ro: "Lucrare pierdută", ru: "Объект потерян", uk: "Об’єкт втрачено" },
  st_waived: { en: "Waived", ro: "Anulată", ru: "Списано", uk: "Списано" },
  free_n: { en: "One of your first 3 won projects: no fee.", ro: "Unul din primele tale 3 proiecte câștigate: fără taxă.", ru: "Один из ваших первых 3 выигранных проектов: без оплаты.", uk: "Один із ваших перших 3 виграних проєктів: без оплати." },
  paid_on: { en: "Paid on {d}.", ro: "Plătit pe {d}.", ru: "Оплачено {d}.", uk: "Сплачено {d}." },
  paid_credit: { en: "Paid from the credit of a cancelled job.", ro: "Plătit din creditul unei lucrări anulate.", ru: "Оплачено из кредита отменённого объекта.", uk: "Сплачено з кредиту скасованого об’єкта." },
  waived_p: { en: "VoltMira waived this fee.", ro: "VoltMira a anulat această taxă.", ru: "VoltMira списала эту плату.", uk: "VoltMira списала цю плату." },
  grace_left: { en: "{n} days left to pay. The paperwork stays open until then.", ro: "Mai ai {n} zile să plătești. Până atunci documentele rămân deschise.", ru: "Осталось дней на оплату: {n}. До тех пор документы открыты.", uk: "Залишилося днів на оплату: {n}. До того документи відкриті." },
  locked_p: { en: "This job's paperwork is locked until the fee is paid.", ro: "Documentele acestei lucrări sunt blocate până se plătește taxa.", ru: "Документы по этому объекту заблокированы до оплаты.", uk: "Документи цього об’єкта заблоковано до оплати." },
  void_p: { en: "The job was marked lost, so its paperwork is closed. Mark it won again to reopen it.", ro: "Lucrarea a fost marcată pierdută, deci documentele ei sunt închise. Marcheaz-o din nou câștigată ca să le redeschizi.", ru: "Объект отмечен как потерянный, документы закрыты. Отметьте его выигранным, чтобы открыть снова.", uk: "Об’єкт позначено втраченим, документи закрито. Позначте його виграним, щоб відкрити знову." },
  sample_p: { en: "Example workspace: nothing is charged and nothing locks here.", ro: "Spațiu demonstrativ: aici nu se plătește și nu se blochează nimic.", ru: "Демонстрационное пространство: здесь ничего не оплачивается и не блокируется.", uk: "Демонстраційний простір: тут нічого не сплачується й не блокується." },
  off_p: { en: "Fees are not switched on yet: nothing is charged.", ro: "Taxele nu sunt încă pornite: nu se plătește nimic.", ru: "Плата ещё не включена: ничего не списывается.", uk: "Плату ще не ввімкнено: нічого не списується." },
  needs_idno: { en: "Add your company's IDNO in Settings to open this job's paperwork. The free projects and the invoices are counted on it.", ro: "Adaugă IDNO-ul companiei în Setări ca să deschizi documentele acestei lucrări. Proiectele gratuite și facturile se socotesc pe el.", ru: "Добавьте IDNO компании в Настройках, чтобы открыть документы объекта. Бесплатные проекты и счета учитываются по нему.", uk: "Додайте IDNO компанії в Налаштуваннях, щоб відкрити документи об’єкта. Безкоштовні проєкти й рахунки обліковуються за ним." },
  idno_go: { en: "Add the IDNO", ro: "Adaugă IDNO", ru: "Добавить IDNO", uk: "Додати IDNO" },
  pay_card: { en: "Pay {v} by card", ro: "Plătește {v} cu cardul", ru: "Оплатить {v} картой", uk: "Сплатити {v} карткою" },
  pay_transfer: { en: "Pay by bank transfer", ro: "Plătește prin transfer", ru: "Оплатить переводом", uk: "Сплатити переказом" },
  paying: { en: "Opening the payment...", ro: "Se deschide plata...", ru: "Открываем оплату...", uk: "Відкриваємо оплату..." },
  test_mode: { en: "Test mode: no card is charged.", ro: "Mod de test: nu se debitează niciun card.", ru: "Тестовый режим: карта не списывается.", uk: "Тестовий режим: картка не списується." },
  paid_ok: { en: "Paid. The paperwork is open.", ro: "Plătit. Documentele sunt deschise.", ru: "Оплачено. Документы открыты.", uk: "Сплачено. Документи відкрито." },
  invoice_open: { en: "Open the invoice", ro: "Deschide factura", ru: "Открыть счёт", uk: "Відкрити рахунок" },
  transfer_p: { en: "An invoice with the reference {ref} is ready. The job opens as soon as the transfer arrives.", ro: "Factura cu referința {ref} este gata. Lucrarea se deschide imediat ce sosește transferul.", ru: "Счёт с назначением {ref} готов. Объект откроется, как только поступит перевод.", uk: "Рахунок із призначенням {ref} готовий. Об’єкт відкриється, щойно надійде переказ." },
  e_pay: { en: "The payment could not start. Try again.", ro: "Plata nu a putut porni. Încearcă din nou.", ru: "Не удалось начать оплату. Попробуйте снова.", uk: "Не вдалося почати оплату. Спробуйте ще раз." },
  e_not_configured: { en: "Card payment is not set up yet. Pay by bank transfer.", ro: "Plata cu cardul nu este încă configurată. Plătește prin transfer.", ru: "Оплата картой ещё не настроена. Оплатите переводом.", uk: "Оплату карткою ще не налаштовано. Сплатіть переказом." },
  e_needs_db: { en: "Needs the database update (add-job-fees.sql).", ro: "Are nevoie de actualizarea bazei de date (add-job-fees.sql).", ru: "Нужно обновление базы данных (add-job-fees.sql).", uk: "Потрібне оновлення бази даних (add-job-fees.sql)." },
  e_seller: { en: "VoltMira's invoice details are not set up yet. Try again later.", ro: "Datele de facturare VoltMira nu sunt încă configurate. Încearcă mai târziu.", ru: "Реквизиты VoltMira для счетов ещё не настроены. Попробуйте позже.", uk: "Реквізити VoltMira для рахунків ще не налаштовано. Спробуйте пізніше." },

  // ---- the paywall dialog
  gate_h: { en: "This job's paperwork is locked", ro: "Documentele lucrării sunt blocate", ru: "Документы объекта заблокированы", uk: "Документи об’єкта заблоковано" },
  gate_p: { en: "The client signed, and the 14 days to pay the fee for this job are over. Pay it to open the contract, the invoice, the grid file and the handover papers again.", ro: "Clientul a semnat, iar cele 14 zile pentru plata taxei acestei lucrări au trecut. Plătește ca să redeschizi contractul, factura, dosarul de racordare și actele de predare.", ru: "Клиент подписал, и 14 дней на оплату этого объекта истекли. Оплатите, чтобы снова открыть договор, счёт, документы на подключение и акты сдачи.", uk: "Клієнт підписав, і 14 днів на оплату цього об’єкта минули. Сплатіть, щоб знову відкрити договір, рахунок, документи на приєднання й акти здачі." },
  gate_fee: { en: "{v}, {t}", ro: "{v}, {t}", ru: "{v}, {t}", uk: "{v}, {t}" },
  close: { en: "Close", ro: "Închide", ru: "Закрыть", uk: "Закрити" },
  // ---- the reminders (lib/feeReminders.js): email subject, lead, and the Activity line
  rem_kicker: { en: "VoltMira fee", ro: "Taxa VoltMira", ru: "Плата VoltMira", uk: "Плата VoltMira" },
  rem_until: { en: "To pay by", ro: "De plătit până la", ru: "Оплатить до", uk: "Сплатити до" },
  rem_cta: { en: "Pay the fee", ro: "Plătește taxa", ru: "Оплатить", uk: "Сплатити" },
  rem_s_won: { en: "{client} signed: {v} to pay within 14 days", ro: "{client} a semnat: {v} de plătit în 14 zile", ru: "{client} подписал: {v} к оплате в течение 14 дней", uk: "{client} підписав: {v} до сплати протягом 14 днів" },
  rem_s_week: { en: "7 days left to pay {v} for {client}", ro: "Mai ai 7 zile să plătești {v} pentru {client}", ru: "Осталось 7 дней, чтобы оплатить {v} за {client}", uk: "Залишилося 7 днів, щоб сплатити {v} за {client}" },
  rem_s_last_day: { en: "Last day to pay {v} for {client}", ro: "Ultima zi să plătești {v} pentru {client}", ru: "Последний день оплаты {v} за {client}", uk: "Останній день сплати {v} за {client}" },
  rem_s_locked: { en: "The paperwork for {client} is locked until {v} is paid", ro: "Documentele pentru {client} sunt blocate până se plătesc {v}", ru: "Документы по {client} заблокированы до оплаты {v}", uk: "Документи щодо {client} заблоковано до сплати {v}" },
  rem_l_won: { en: "Your client signed online. VoltMira is free: you pay only for the projects you win. The paperwork stays open while you pay.", ro: "Clientul a semnat online. VoltMira este gratuit: plătești doar pentru proiectele câștigate. Documentele rămân deschise cât timp plătești.", ru: "Клиент подписал онлайн. VoltMira бесплатна: вы платите только за выигранные проекты. Документы открыты, пока вы оплачиваете.", uk: "Клієнт підписав онлайн. VoltMira безкоштовна: ви платите лише за виграні проєкти. Документи відкриті, поки ви сплачуєте." },
  rem_l_week: { en: "Pay by card, or by bank transfer against VoltMira's invoice.", ro: "Plătește cu cardul sau prin transfer, pe baza facturii VoltMira.", ru: "Оплатите картой или переводом по счёту VoltMira.", uk: "Сплатіть карткою або переказом за рахунком VoltMira." },
  rem_l_last_day: { en: "From tomorrow the contract, the invoice, the grid file and the handover papers of this job are locked until the fee is paid.", ro: "De mâine contractul, factura, dosarul de racordare și actele de predare ale acestei lucrări se blochează până se plătește taxa.", ru: "С завтрашнего дня договор, счёт, документы на подключение и акты сдачи по этому объекту блокируются до оплаты.", uk: "З завтрашнього дня договір, рахунок, документи на приєднання й акти здачі цього об’єкта блокуються до сплати." },
  rem_l_locked: { en: "Pay the fee to open them again. Everything else in VoltMira stays free and open.", ro: "Plătește taxa ca să le redeschizi. Restul VoltMira rămâne gratuit și deschis.", ru: "Оплатите, чтобы снова их открыть. Всё остальное в VoltMira остаётся бесплатным и открытым.", uk: "Сплатіть, щоб знову їх відкрити. Усе інше у VoltMira залишається безкоштовним і відкритим." },
  // ---- Settings, "Pay per job" (app/(app)/settings/FeesPanel.jsx)
  fp_h: { en: "VoltMira is free", ro: "VoltMira este gratuit", ru: "VoltMira бесплатна", uk: "VoltMira безкоштовна" },
  fp_p: { en: "You pay only when a client signs: a fixed fee per won project, by the system's size. The first {n} won projects are free, and each fee has 14 days to be paid, by card or by bank transfer with an invoice.", ro: "Plătești doar când un client semnează: o taxă fixă pe proiect câștigat, după mărimea sistemului. Primele {n} proiecte câștigate sunt gratuite, iar fiecare taxă are 14 zile de plată, cu cardul sau prin transfer, cu factură.", ru: "Вы платите, только когда клиент подписывает: фиксированная плата за выигранный проект по размеру системы. Первые {n} выигранных проекта бесплатны, на каждую плату есть 14 дней, картой или переводом по счёту.", uk: "Ви платите, лише коли клієнт підписує: фіксована плата за виграний проєкт за розміром системи. Перші {n} виграні проєкти безкоштовні, на кожну плату є 14 днів, карткою або переказом за рахунком." },
  fp_tiers: { en: "Fee per won project", ro: "Taxa pe proiect câștigat", ru: "Плата за выигранный проект", uk: "Плата за виграний проєкт" },
  fp_calc: { en: "Your system, kW", ro: "Sistemul tău, kW", ru: "Ваша система, кВт", uk: "Ваша система, кВт" },
  fp_calc_out: { en: "Fee for this size", ro: "Taxa pentru această mărime", ru: "Плата за этот размер", uk: "Плата за цей розмір" },
  fp_free_used: { en: "{u} of {n} free projects used", ro: "{u} din {n} proiecte gratuite folosite", ru: "Использовано бесплатных проектов: {u} из {n}", uk: "Використано безкоштовних проєктів: {u} з {n}" },
  fp_credit: { en: "Credit from cancelled jobs", ro: "Credit din lucrări anulate", ru: "Кредит за отменённые объекты", uk: "Кредит за скасовані об’єкти" },
  fp_due_total: { en: "To pay now", ro: "De plătit acum", ru: "К оплате сейчас", uk: "До сплати зараз" },
  fp_paid_total: { en: "Paid so far", ro: "Plătit până acum", ru: "Оплачено всего", uk: "Сплачено всього" },
  fp_jobs_h: { en: "Won projects", ro: "Proiecte câștigate", ru: "Выигранные проекты", uk: "Виграні проєкти" },
  fp_jobs_empty: { en: "No won project yet. When a client signs, the job and its fee show here.", ro: "Niciun proiect câștigat încă. Când un client semnează, lucrarea și taxa ei apar aici.", ru: "Выигранных проектов пока нет. Когда клиент подпишет, объект и плата появятся здесь.", uk: "Виграних проєктів ще немає. Коли клієнт підпише, об’єкт і плата з’являться тут." },
  fp_col_job: { en: "Job", ro: "Lucrare", ru: "Объект", uk: "Об’єкт" },
  fp_col_won: { en: "Won on", ro: "Câștigat pe", ru: "Выигран", uk: "Виграно" },
  fp_col_fee: { en: "Fee", ro: "Taxă", ru: "Плата", uk: "Плата" },
  fp_col_status: { en: "Status", ro: "Stare", ru: "Статус", uk: "Статус" },
  fp_inv_h: { en: "VoltMira's invoices", ro: "Facturile VoltMira", ru: "Счета VoltMira", uk: "Рахунки VoltMira" },
  fp_inv_empty: { en: "No invoice yet. One is issued when you pay a fee by transfer, or each month if you chose it.", ro: "Nicio factură încă. Se emite una când plătești o taxă prin transfer, sau lunar dacă ai ales asta.", ru: "Счетов пока нет. Счёт выставляется при оплате переводом или ежемесячно, если вы это выбрали.", uk: "Рахунків ще немає. Рахунок виставляється під час сплати переказом або щомісяця, якщо ви це обрали." },
  fp_inv_n: { en: "{n} job(s)", ro: "{n} lucrări", ru: "объектов: {n}", uk: "об’єктів: {n}" },
  fp_idno_h: { en: "Company tax id (IDNO)", ro: "Codul fiscal al companiei (IDNO)", ru: "Фискальный код компании (IDNO)", uk: "Фіскальний код компанії (IDNO)" },
  fp_idno_p: { en: "13 digits. The free projects and VoltMira's invoices are counted on it. It cannot be changed once a fee carries it.", ro: "13 cifre. Proiectele gratuite și facturile VoltMira se socotesc pe el. Nu se mai poate schimba odată ce o taxă îl poartă.", ru: "13 цифр. По нему учитываются бесплатные проекты и счета VoltMira. Его нельзя изменить, когда по нему уже есть плата.", uk: "13 цифр. За ним обліковуються безкоштовні проєкти й рахунки VoltMira. Його не можна змінити, коли за ним уже є плата." },
  fp_idno_save: { en: "Save the IDNO", ro: "Salvează IDNO", ru: "Сохранить IDNO", uk: "Зберегти IDNO" },
  fp_saved: { en: "Saved", ro: "Salvat", ru: "Сохранено", uk: "Збережено" },
  fp_monthly: { en: "One invoice a month", ro: "O factură pe lună", ru: "Один счёт в месяц", uk: "Один рахунок на місяць" },
  fp_monthly_p: { en: "On the 1st, every fee to pay goes on one invoice, payable within 14 days. Offered from 3 paid fees on.", ro: "Pe 1 ale lunii, toate taxele de plătit intră pe o singură factură, cu plata în 14 zile. Se oferă de la 3 taxe plătite.", ru: "1-го числа все платы к оплате попадают в один счёт с оплатой в течение 14 дней. Доступно после 3 оплаченных плат.", uk: "1-го числа всі плати до сплати потрапляють в один рахунок зі сплатою протягом 14 днів. Доступно після 3 сплачених плат." },
  fp_e_bad_idno: { en: "The IDNO has 13 digits.", ro: "IDNO-ul are 13 cifre.", ru: "IDNO состоит из 13 цифр.", uk: "IDNO складається з 13 цифр." },
  fp_e_idno_locked: { en: "The IDNO is fixed: a fee already carries it. Write to VoltMira to change it.", ro: "IDNO-ul este fixat: o taxă îl poartă deja. Scrie-ne ca să-l schimbi.", ru: "IDNO закреплён: по нему уже есть плата. Напишите VoltMira, чтобы изменить.", uk: "IDNO закріплено: за ним уже є плата. Напишіть VoltMira, щоб змінити." },
  fp_e_owner_only: { en: "Only the owner can change this.", ro: "Doar proprietarul poate schimba asta.", ru: "Изменить может только владелец.", uk: "Змінити може лише власник." },
  fp_e_monthly_early: { en: "One invoice a month is offered from 3 paid fees on.", ro: "O factură pe lună se oferă de la 3 taxe plătite.", ru: "Один счёт в месяц доступен после 3 оплаченных плат.", uk: "Один рахунок на місяць доступний після 3 сплачених плат." },
  fp_e_save: { en: "Not saved. Try again.", ro: "Nesalvat. Încearcă din nou.", ru: "Не сохранено. Попробуйте снова.", uk: "Не збережено. Спробуйте ще раз." },
};

export const FT = T;

export function ft(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.ro) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
