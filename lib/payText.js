// lib/payText.js — the words of the client's payments in stages (lib/milestones.js): the "Încasări" tab, the
// payment plan, the client's pay page and the reminder emails. The installer's screens say "tu" in Romanian; the
// client's page and emails are formal ("dumneavoastră", "вы", "ви"). lib/payText.test.js holds every key to four
// languages, the same placeholders, and no dash, middle dot or check mark. pt(key, lang, { x }) fills {x}.

const T = {
  // ---- the stages
  tr_signed: { en: "At signing", ro: "La semnare", ru: "При подписании", uk: "Під час підписання" },
  tr_order: { en: "At equipment order", ro: "La comanda echipamentelor", ru: "При заказе оборудования", uk: "Під час замовлення обладнання" },
  tr_install: { en: "At installation", ro: "La instalare", ru: "При монтаже", uk: "Під час монтажу" },
  tr_grid: { en: "At grid connection", ro: "La racordare", ru: "При подключении к сети", uk: "Під час приєднання до мережі" },
  tr_commission: { en: "At commissioning", ro: "La punerea în funcțiune", ru: "При вводе в эксплуатацию", uk: "Під час введення в експлуатацію" },
  s_planned: { en: "Coming", ro: "Urmează", ru: "Впереди", uk: "Попереду" },
  s_open: { en: "Issued", ro: "Emisă", ru: "Выставлен", uk: "Виставлено" },
  s_due_soon: { en: "Due soon", ro: "Scadentă curând", ru: "Скоро срок", uk: "Скоро термін" },
  s_overdue: { en: "{n} days late", ro: "Întârziată {n} zile", ru: "Просрочен на {n} дн.", uk: "Прострочено на {n} дн." },
  s_late: { en: "Late", ro: "Întârziată", ru: "Просрочен", uk: "Прострочено" },
  s_paid: { en: "Received", ro: "Încasată", ru: "Получено", uk: "Отримано" },
  s_void: { en: "Cancelled", ro: "Anulată", ru: "Отменён", uk: "Скасовано" },
  s_part: { en: "{v} received", ro: "{v} încasat", ru: "Получено {v}", uk: "Отримано {v}" },
  s_proof: { en: "Proof sent", ro: "Dovadă primită", ru: "Есть подтверждение", uk: "Є підтвердження" },

  // ---- the "Încasări" tab (app/(app)/jobs/CashView.jsx)
  tab_cash: { en: "Payments", ro: "Încasări", ru: "Поступления", uk: "Надходження" },
  cash_sub: { en: "Each signed job is invoiced in stages, as its steps are reached. Your clients pay by bank transfer from a link.", ro: "Fiecare lucrare semnată se facturează pe etape, pe măsură ce ajungi la ele. Clienții plătesc prin transfer, dintr-un link.", ru: "Каждый подписанный объект выставляется по этапам, по мере их достижения. Клиенты платят переводом по ссылке.", uk: "Кожен підписаний об’єкт виставляється за етапами, щойно їх досягнуто. Клієнти платять переказом за посиланням." },
  t_overdue: { en: "Overdue", ro: "Întârziate", ru: "Просрочено", uk: "Прострочено" },
  t_week: { en: "Due within 7 days", ro: "De încasat în 7 zile", ru: "К получению за 7 дней", uk: "До отримання за 7 днів" },
  t_month: { en: "Next 30 days", ro: "Următoarele 30 de zile", ru: "Следующие 30 дней", uk: "Наступні 30 днів" },
  t_received: { en: "Received this month", ro: "Încasat luna aceasta", ru: "Получено в этом месяце", uk: "Отримано цього місяця" },
  t_n: { en: "{n} invoices", ro: "{n} facturi", ru: "счетов: {n}", uk: "рахунків: {n}" },
  t_n1: { en: "1 invoice", ro: "1 factură", ru: "1 счёт", uk: "1 рахунок" },
  t_payments1: { en: "1 payment", ro: "1 plată", ru: "1 платёж", uk: "1 платіж" },
  t_planned: { en: "and {v} in stages still to come", ro: "plus {v} la etapele care urmează", ru: "и {v} на будущих этапах", uk: "і {v} на наступних етапах" },
  t_payments: { en: "{n} payments", ro: "{n} plăți", ru: "платежей: {n}", uk: "платежів: {n}" },
  f_open: { en: "To collect", ro: "De încasat", ru: "К получению", uk: "До отримання" },
  f_all: { en: "All", ro: "Toate", ru: "Все", uk: "Усі" },
  c_invoice: { en: "Invoice", ro: "Factură", ru: "Счёт", uk: "Рахунок" },
  c_job: { en: "Job", ro: "Lucrare", ru: "Объект", uk: "Об’єкт" },
  c_stage: { en: "Stage", ro: "Etapă", ru: "Этап", uk: "Етап" },
  c_amount: { en: "Amount", ro: "Sumă", ru: "Сумма", uk: "Сума" },
  c_due: { en: "Due", ro: "Scadență", ru: "Срок", uk: "Термін" },
  c_status: { en: "Status", ro: "Stare", ru: "Статус", uk: "Статус" },
  cash_empty: { en: "Nothing to collect. When a client signs, the first stage is invoiced here.", ro: "Nimic de încasat. Când un client semnează, prima etapă se facturează aici.", ru: "Получать нечего. Когда клиент подпишет, первый этап будет выставлен здесь.", uk: "Отримувати нічого. Коли клієнт підпише, перший етап буде виставлено тут." },
  hist_h: { en: "Earlier months", ro: "Lunile anterioare", ru: "Предыдущие месяцы", uk: "Попередні місяці" },
  c_month: { en: "Month", ro: "Luna", ru: "Месяц", uk: "Місяць" },
  c_invoiced: { en: "Invoiced", ro: "Facturat", ru: "Выставлено", uk: "Виставлено" },
  c_received: { en: "Received", ro: "Încasat", ru: "Получено", uk: "Отримано" },
  a_copy: { en: "Copy the pay link", ro: "Copiază linkul de plată", ru: "Скопировать ссылку на оплату", uk: "Скопіювати посилання на оплату" },
  a_copied: { en: "Pay link copied", ro: "Linkul de plată a fost copiat", ru: "Ссылка на оплату скопирована", uk: "Посилання на оплату скопійовано" },
  a_open: { en: "Open the invoice", ro: "Deschide factura", ru: "Открыть счёт", uk: "Відкрити рахунок" },
  a_paid: { en: "Mark received", ro: "Marchează încasată", ru: "Отметить полученным", uk: "Позначити отриманим" },
  a_proof: { en: "See the proof", ro: "Vezi dovada", ru: "Посмотреть подтверждение", uk: "Переглянути підтвердження" },
  a_pause: { en: "Pause reminders", ro: "Oprește reminderele", ru: "Остановить напоминания", uk: "Зупинити нагадування" },
  a_resume: { en: "Resume reminders", ro: "Pornește reminderele", ru: "Возобновить напоминания", uk: "Відновити нагадування" },
  paused: { en: "Reminders paused", ro: "Remindere oprite", ru: "Напоминания остановлены", uk: "Нагадування зупинено" },
  more: { en: "More", ro: "Mai mult", ru: "Ещё", uk: "Ще" },
  mp_h: { en: "Payment received for {no}", ro: "Plată primită pentru {no}", ru: "Оплата получена по {no}", uk: "Оплату отримано за {no}" },
  mp_amount: { en: "Amount received", ro: "Suma primită", ru: "Полученная сумма", uk: "Отримана сума" },
  mp_date: { en: "Date", ro: "Data", ru: "Дата", uk: "Дата" },
  mp_save: { en: "Save the payment", ro: "Salvează încasarea", ru: "Сохранить платёж", uk: "Зберегти платіж" },
  cancel: { en: "Cancel", ro: "Renunță", ru: "Отмена", uk: "Скасувати" },
  e_save: { en: "Not saved. Try again.", ro: "Nesalvat. Încearcă din nou.", ru: "Не сохранено. Попробуйте снова.", uk: "Не збережено. Спробуйте ще раз." },
  e_amount: { en: "Write the amount received.", ro: "Scrie suma primită.", ru: "Укажите полученную сумму.", uk: "Вкажіть отриману суму." },
  e_needs_db: { en: "Needs the database update (add-milestones.sql).", ro: "Are nevoie de actualizarea bazei de date (add-milestones.sql).", ru: "Нужно обновление базы данных (add-milestones.sql).", uk: "Потрібне оновлення бази даних (add-milestones.sql)." },

  // ---- the payment plan (Settings and a job's billing page)
  sch_h: { en: "Payment plan", ro: "Plan de plată", ru: "План оплаты", uk: "План оплати" },
  sch_def_h: { en: "Default payment plan", ro: "Plan de plată implicit", ru: "План оплаты по умолчанию", uk: "План оплати за замовчуванням" },
  sch_def_p: { en: "For every job signed from now on: a share of the price at each step, invoiced when the step is reached. A job can have its own plan on its billing page.", ro: "Pentru fiecare lucrare semnată de acum: o parte din preț la fiecare etapă, facturată când se ajunge la ea. O lucrare își poate avea propriul plan pe pagina ei de facturare.", ru: "Для каждого объекта, подписанного с этого момента: часть цены на каждом этапе, счёт выставляется при его достижении. У объекта может быть свой план на странице выставления счетов.", uk: "Для кожного об’єкта, підписаного відтепер: частина ціни на кожному етапі, рахунок виставляється, коли етап досягнуто. Об’єкт може мати власний план на сторінці рахунків." },
  sch_job_p: { en: "The stages already invoiced stay as they are; the rest follow this plan.", ro: "Etapele deja facturate rămân cum sunt; restul urmează acest plan.", ru: "Уже выставленные этапы остаются как есть; остальные следуют этому плану.", uk: "Уже виставлені етапи залишаються як є; решта йде за цим планом." },
  sch_term: { en: "Days to pay", ro: "Zile de plată", ru: "Дней на оплату", uk: "Днів на оплату" },
  sch_add: { en: "Add a stage", ro: "Adaugă o etapă", ru: "Добавить этап", uk: "Додати етап" },
  sch_remove: { en: "Remove the stage", ro: "Șterge etapa", ru: "Удалить этап", uk: "Видалити етап" },
  sch_save: { en: "Save the plan", ro: "Salvează planul", ru: "Сохранить план", uk: "Зберегти план" },
  sch_sum: { en: "{n}% of {t}%", ro: "{n}% din {t}%", ru: "{n}% из {t}%", uk: "{n}% з {t}%" },
  sch_saved: { en: "Saved", ro: "Salvat", ru: "Сохранено", uk: "Збережено" },
  sch_when: { en: "When", ro: "Când", ru: "Когда", uk: "Коли" },
  e_sum: { en: "The shares must add up to {t}%.", ro: "Procentele trebuie să adune {t}%.", ru: "Доли должны давать в сумме {t}%.", uk: "Частки мають у сумі давати {t}%." },
  e_twice: { en: "Each step once.", ro: "Fiecare etapă o singură dată.", ru: "Каждый этап только один раз.", uk: "Кожен етап лише один раз." },
  e_term: { en: "Between 1 and 60 days.", ro: "Între 1 și 60 de zile.", ru: "От 1 до 60 дней.", uk: "Від 1 до 60 днів." },
  e_issued: { en: "That stage is already invoiced.", ro: "Etapa aceea e deja facturată.", ru: "Этот этап уже выставлен.", uk: "Цей етап уже виставлено." },
  e_owner: { en: "Only the owner can change this.", ro: "Doar proprietarul poate schimba asta.", ru: "Изменить может только владелец.", uk: "Змінити може лише власник." },

  // ---- the installer told when a client is 3 days late
  own_late: { en: "{client} is 3 days late paying {no} ({v})", ro: "{client} întârzie cu 3 zile plata {no} ({v})", ru: "{client} просрочил оплату {no} на 3 дня ({v})", uk: "{client} прострочив оплату {no} на 3 дні ({v})" },
  own_late_p: { en: "The client has had the reminders. Call them, or pause the reminders for this job on the Payments tab.", ro: "Clientul a primit reminderele. Sună-l sau oprește reminderele pentru această lucrare din fila Încasări.", ru: "Клиент получил напоминания. Позвоните ему или остановите напоминания по этому объекту во вкладке «Поступления».", uk: "Клієнт отримав нагадування. Зателефонуйте йому або зупиніть нагадування для цього об’єкта у вкладці «Надходження»." },
  own_proof: { en: "{client} sent proof of transfer for {no}", ro: "{client} a trimis dovada transferului pentru {no}", ru: "{client} прислал подтверждение перевода по {no}", uk: "{client} надіслав підтвердження переказу за {no}" },

  // ---- the client's pay page (app/pay/[token]) - formal
  pp_title: { en: "Invoice {no}", ro: "Factura {no}", ru: "Счёт {no}", uk: "Рахунок {no}" },
  pp_from: { en: "from {company}", ro: "de la {company}", ru: "от {company}", uk: "від {company}" },
  pp_stage: { en: "Stage {n} of {t}: {s}", ro: "Etapa {n} din {t}: {s}", ru: "Этап {n} из {t}: {s}", uk: "Етап {n} з {t}: {s}" },
  pp_for: { en: "For", ro: "Pentru", ru: "За", uk: "За" },
  pp_amount: { en: "To pay", ro: "De plată", ru: "К оплате", uk: "До сплати" },
  pp_due: { en: "Due by", ro: "Scadentă pe", ru: "Оплатить до", uk: "Сплатити до" },
  pp_share: { en: "{p}% of the job's {v}", ro: "{p}% din {v}, prețul lucrării", ru: "{p}% от стоимости объекта {v}", uk: "{p}% від вартості об’єкта {v}" },
  pp_paid: { en: "Paid on {d}. Thank you.", ro: "Achitată pe {d}. Vă mulțumim.", ru: "Оплачено {d}. Спасибо.", uk: "Сплачено {d}. Дякуємо." },
  pp_void: { en: "This invoice was cancelled: there is nothing to pay.", ro: "Această factură a fost anulată: nu este nimic de plată.", ru: "Этот счёт отменён: платить ничего не нужно.", uk: "Цей рахунок скасовано: сплачувати нічого не потрібно." },
  pp_how: { en: "Pay by bank transfer", ro: "Plata prin transfer bancar", ru: "Оплата банковским переводом", uk: "Оплата банківським переказом" },
  pp_to: { en: "Beneficiary", ro: "Beneficiar", ru: "Получатель", uk: "Отримувач" },
  pp_bank: { en: "Bank", ro: "Banca", ru: "Банк", uk: "Банк" },
  pp_ref: { en: "Payment reference", ro: "Destinația plății", ru: "Назначение платежа", uk: "Призначення платежу" },
  pp_ref_p: { en: "Write it exactly so the payment is recognised.", ro: "Scrieți-o exact, ca plata să fie recunoscută.", ru: "Укажите его точно, чтобы платёж распознали.", uk: "Вкажіть його точно, щоб платіж розпізнали." },
  pp_no_iban: { en: "Ask {company} for their bank details.", ro: "Cereți datele bancare de la {company}.", ru: "Запросите банковские реквизиты у {company}.", uk: "Запитайте банківські реквізити в {company}." },
  pp_copy: { en: "Copy", ro: "Copiați", ru: "Копировать", uk: "Копіювати" },
  pp_copied: { en: "Copied", ro: "Copiat", ru: "Скопировано", uk: "Скопійовано" },
  pp_proof_h: { en: "Already paid?", ro: "Ați plătit deja?", ru: "Уже оплатили?", uk: "Уже сплатили?" },
  pp_proof_p: { en: "Send the proof of transfer (a photo or a PDF) so {company} sees it at once.", ro: "Trimiteți dovada transferului (o fotografie sau un PDF), ca {company} să o vadă imediat.", ru: "Отправьте подтверждение перевода (фото или PDF), чтобы {company} сразу его увидели.", uk: "Надішліть підтвердження переказу (фото або PDF), щоб {company} одразу його побачили." },
  pp_upload: { en: "Send the proof", ro: "Trimiteți dovada", ru: "Отправить подтверждение", uk: "Надіслати підтвердження" },
  pp_uploading: { en: "Sending...", ro: "Se trimite...", ru: "Отправка...", uk: "Надсилання..." },
  pp_uploaded: { en: "Proof sent. Thank you.", ro: "Dovada a fost trimisă. Vă mulțumim.", ru: "Подтверждение отправлено. Спасибо.", uk: "Підтвердження надіслано. Дякуємо." },
  pp_print: { en: "Print the invoice", ro: "Tipăriți factura", ru: "Распечатать счёт", uk: "Надрукувати рахунок" },
  pp_questions: { en: "Questions about this invoice? Write to {company}.", ro: "Întrebări despre factură? Scrieți-le celor de la {company}.", ru: "Вопросы по счёту? Напишите {company}.", uk: "Питання щодо рахунку? Напишіть {company}." },
  pp_e_file: { en: "Send an image or a PDF of up to 8 MB.", ro: "Trimiteți o imagine sau un PDF de cel mult 8 MB.", ru: "Отправьте изображение или PDF до 8 МБ.", uk: "Надішліть зображення або PDF до 8 МБ." },
  pp_e_send: { en: "It could not be sent. Try again.", ro: "Nu s-a putut trimite. Încercați din nou.", ru: "Не удалось отправить. Попробуйте ещё раз.", uk: "Не вдалося надіслати. Спробуйте ще раз." },

  // ---- the client's reminder emails (lib/payReminders.js) - formal
  m_kicker: { en: "Invoice from {company}", ro: "Factură de la {company}", ru: "Счёт от {company}", uk: "Рахунок від {company}" },
  m_s_issued: { en: "Invoice {no} from {company}: {v}", ro: "Factura {no} de la {company}: {v}", ru: "Счёт {no} от {company}: {v}", uk: "Рахунок {no} від {company}: {v}" },
  m_s_before3: { en: "Invoice {no} is due on {d}", ro: "Factura {no} este scadentă pe {d}", ru: "Счёт {no} нужно оплатить до {d}", uk: "Рахунок {no} треба сплатити до {d}" },
  m_s_due: { en: "Invoice {no} is due today", ro: "Factura {no} este scadentă astăzi", ru: "Счёт {no} нужно оплатить сегодня", uk: "Рахунок {no} треба сплатити сьогодні" },
  m_s_late3: { en: "Invoice {no} is overdue", ro: "Factura {no} este restantă", ru: "Счёт {no} просрочен", uk: "Рахунок {no} прострочено" },
  m_s_late10: { en: "Invoice {no} is 10 days overdue", ro: "Factura {no} este restantă de 10 zile", ru: "Счёт {no} просрочен на 10 дней", uk: "Рахунок {no} прострочено на 10 днів" },
  m_l_issued: { en: "Your solar installation has reached a new stage. The invoice and the bank details are on the page below; you can also send the proof of transfer there.", ro: "Instalația dumneavoastră solară a ajuns la o nouă etapă. Factura și datele bancare sunt pe pagina de mai jos; tot acolo puteți trimite dovada transferului.", ru: "Ваша солнечная установка перешла на новый этап. Счёт и банковские реквизиты на странице ниже; там же можно отправить подтверждение перевода.", uk: "Ваша сонячна установка перейшла на новий етап. Рахунок і банківські реквізити на сторінці нижче; там само можна надіслати підтвердження переказу." },
  m_l_before3: { en: "A short reminder: the invoice is due in 3 days. If you have already paid, thank you, and please ignore this email.", ro: "O scurtă amintire: factura este scadentă peste 3 zile. Dacă ați plătit deja, vă mulțumim și ignorați acest e-mail.", ru: "Небольшое напоминание: срок оплаты через 3 дня. Если вы уже оплатили, спасибо, просто не обращайте внимания на это письмо.", uk: "Коротке нагадування: термін оплати через 3 дні. Якщо ви вже сплатили, дякуємо, просто не зважайте на цей лист." },
  m_l_due: { en: "The invoice is due today. If you have already paid, thank you, and please ignore this email.", ro: "Factura este scadentă astăzi. Dacă ați plătit deja, vă mulțumim și ignorați acest e-mail.", ru: "Сегодня срок оплаты счёта. Если вы уже оплатили, спасибо, просто не обращайте внимания на это письмо.", uk: "Сьогодні термін оплати рахунку. Якщо ви вже сплатили, дякуємо, просто не зважайте на цей лист." },
  m_l_late3: { en: "We have not yet received the payment for this invoice. If you have paid, please send the proof of transfer from the page below.", ro: "Nu am primit încă plata pentru această factură. Dacă ați plătit, vă rugăm să trimiteți dovada transferului de pe pagina de mai jos.", ru: "Мы ещё не получили оплату по этому счёту. Если вы оплатили, отправьте, пожалуйста, подтверждение перевода со страницы ниже.", uk: "Ми ще не отримали оплату за цим рахунком. Якщо ви сплатили, надішліть, будь ласка, підтвердження переказу зі сторінки нижче." },
  m_l_late10: { en: "The invoice is 10 days overdue. Please pay it, or reply to this email if something is not right.", ro: "Factura are 10 zile de întârziere. Vă rugăm să o achitați sau să răspundeți la acest e-mail dacă ceva nu este în regulă.", ru: "Счёт просрочен на 10 дней. Пожалуйста, оплатите его или ответьте на это письмо, если что-то не так.", uk: "Рахунок прострочено на 10 днів. Будь ласка, сплатіть його або дайте відповідь на цей лист, якщо щось не так." },
  m_cta: { en: "See the invoice and how to pay", ro: "Vedeți factura și cum plătiți", ru: "Посмотреть счёт и как оплатить", uk: "Переглянути рахунок і як сплатити" },
  m_foot: { en: "{company} issued this invoice through VoltMira. Reply to this email to write to them directly.", ro: "{company} a emis această factură prin VoltMira. Răspundeți la acest e-mail ca să le scrieți direct.", ru: "{company} выставили этот счёт через VoltMira. Ответьте на это письмо, чтобы написать им напрямую.", uk: "{company} виставили цей рахунок через VoltMira. Дайте відповідь на цей лист, щоб написати їм напряму." },
};

export const PT = T;

export function pt(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.ro) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };

/** An amount in its currency, written the local way, no decimals for whole amounts ("12.500 lei", "€1,250"). */
export function money(minor, currency, lang = "ro") {
  const v = Math.round(Number(minor) || 0) / 100;
  const loc = LOC[lang] || "ro-RO";
  if (currency === "MDL") return `${v.toLocaleString(loc, { maximumFractionDigits: Number.isInteger(v) ? 0 : 2 })} ${lang === "ru" || lang === "uk" ? "лей" : "lei"}`;
  return new Intl.NumberFormat(loc, { style: "currency", currency: currency || "EUR", maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
}

/** "2026-11-01" as a day in the language: "1 nov. 2026". */
export function dayName(key, lang = "ro") {
  if (!key) return "";
  return new Date(String(key).slice(0, 10) + "T12:00:00Z").toLocaleDateString(LOC[lang] || "ro-RO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
