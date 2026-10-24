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
};

export const FT = T;

export function ft(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.ro) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
