// lib/loanText.js — the words of green financing in four languages: the
// application a lender receives (lib/loanDocument.js), the statuses, the
// installer's views, the lender's portal and the admin's report. Installer
// copy speaks as "tu" in Romanian; what a lender reads is formal.
// lt(key, lang, { x }) fills {x}; lib/loanText.test.js checks the languages,
// the placeholders and the punctuation.

const T = {
  // ---- the application, as the lender receives it
  doc_title: { en: "Loan application for a solar system", ro: "Cerere de credit pentru un sistem solar", ru: "Заявка на кредит для солнечной системы", uk: "Заявка на кредит для сонячної системи" },
  doc_sub: { en: "Sent through VoltMira to {lender}, with the applicant's consent.", ro: "Trimisă prin VoltMira către {lender}, cu acordul solicitantului.", ru: "Отправлена через VoltMira в {lender} с согласия заявителя.", uk: "Надіслана через VoltMira до {lender} за згодою заявника." },
  doc_subject: { en: "Loan application: {name}, {amount}", ro: "Cerere de credit: {name}, {amount}", ru: "Заявка на кредит: {name}, {amount}", uk: "Заявка на кредит: {name}, {amount}" },
  doc_applicant: { en: "Applicant", ro: "Solicitant", ru: "Заявитель", uk: "Заявник" },
  doc_phone: { en: "Phone", ro: "Telefon", ru: "Телефон", uk: "Телефон" },
  doc_email: { en: "Email", ro: "E-mail", ru: "Эл. почта", uk: "Ел. пошта" },
  doc_locality: { en: "Locality", ro: "Localitatea", ru: "Населённый пункт", uk: "Населений пункт" },
  doc_product: { en: "Product", ro: "Produsul", ru: "Продукт", uk: "Продукт" },
  doc_amount: { en: "Amount requested", ro: "Suma solicitată", ru: "Запрошенная сумма", uk: "Запитана сума" },
  doc_term: { en: "Term", ro: "Termen", ru: "Срок", uk: "Строк" },
  doc_rate: { en: "Annual rate shown to the applicant", ro: "Rata anuală arătată solicitantului", ru: "Годовая ставка, показанная заявителю", uk: "Річна ставка, показана заявнику" },
  doc_monthly: { en: "Estimated monthly payment", ro: "Rata lunară estimată", ru: "Оценка ежемесячного платежа", uk: "Оцінка щомісячного платежу" },
  doc_support: { en: "Support deducted from the price", ro: "Sprijin scăzut din preț", ru: "Поддержка, вычтенная из цены", uk: "Підтримка, вирахувана з ціни" },
  doc_installer: { en: "Installer", ro: "Instalator", ru: "Монтажник", uk: "Монтажник" },
  doc_system: { en: "System", ro: "Sistemul", ru: "Система", uk: "Система" },
  doc_consent: { en: "Consent", ro: "Acordul", ru: "Согласие", uk: "Згода" },
  doc_consent_v: { en: "given on {at} (UTC), text version {v}", ro: "dat la {at} (UTC), versiunea textului {v}", ru: "дано {at} (UTC), версия текста {v}", uk: "надано {at} (UTC), версія тексту {v}" },
  doc_ref: { en: "VoltMira reference", ro: "Referința VoltMira", ru: "Номер VoltMira", uk: "Номер VoltMira" },
  doc_foot: {
    en: "Figures are the applicant's estimate from the offer; the lender decides the terms. Status updates: through the lender portal or the signed webhook.",
    ro: "Cifrele sunt estimarea din ofertă; creditorul decide condițiile. Actualizări de statut: prin portalul creditorului sau prin webhook-ul semnat.",
    ru: "Цифры являются оценкой из предложения; условия определяет кредитор. Обновления статуса: через портал кредитора или подписанный вебхук.",
    uk: "Цифри є оцінкою з пропозиції; умови визначає кредитор. Оновлення статусу: через портал кредитора або підписаний вебхук.",
  },
  months_n: { en: "{n} months", ro: "{n} luni", ru: "{n} мес.", uk: "{n} міс." },

  // ---- statuses
  st_submitted: { en: "Sent to the bank", ro: "Trimisă la bancă", ru: "Отправлена в банк", uk: "Надіслана до банку" },
  st_in_review: { en: "In review", ro: "În analiză", ru: "На рассмотрении", uk: "На розгляді" },
  st_approved: { en: "Approved", ro: "Aprobată", ru: "Одобрена", uk: "Схвалена" },
  st_rejected: { en: "Rejected", ro: "Respinsă", ru: "Отклонена", uk: "Відхилена" },
  st_funded: { en: "Funded", ro: "Finanțată", ru: "Профинансирована", uk: "Профінансована" },
  st_failed: { en: "Not delivered", ro: "Netrimisă", ru: "Не доставлена", uk: "Не доставлена" },

  // ---- the installer's views
  ln_h: { en: "Loan applications", ro: "Cereri de credit", ru: "Заявки на кредит", uk: "Заявки на кредит" },
  ln_sub: { en: "From your clients' offers, as the banks move them.", ro: "Din ofertele clienților tăi, pe măsură ce băncile le procesează.", ru: "Из предложений ваших клиентов, по мере обработки банками.", uk: "З пропозицій ваших клієнтів, у міру обробки банками." },
  ln_empty: { en: "No applications yet. A client applies from the financing calculator on their offer.", ro: "Încă nicio cerere. Clientul aplică din calculatorul de credit din oferta lui.", ru: "Заявок пока нет. Клиент подаёт заявку из кредитного калькулятора в своём предложении.", uk: "Заявок поки немає. Клієнт подає заявку з кредитного калькулятора у своїй пропозиції." },
  ln_line: { en: "{lender}: {amount} over {term}", ro: "{lender}: {amount} pe {term}", ru: "{lender}: {amount} на {term}", uk: "{lender}: {amount} на {term}" },
  ln_on_quote: { en: "Loan: {status}, {lender}", ro: "Credit: {status}, {lender}", ru: "Кредит: {status}, {lender}", uk: "Кредит: {status}, {lender}" },
  ln_mail_subject: { en: "{name} applied for a loan through your offer", ro: "{name} a cerut un credit prin oferta ta", ru: "{name} подал заявку на кредит через ваше предложение", uk: "{name} подав заявку на кредит через вашу пропозицію" },
  ln_mail_kicker: { en: "Loan application", ro: "Cerere de credit", ru: "Заявка на кредит", uk: "Заявка на кредит" },
  ln_mail_heading: { en: "{name} applied to {lender}", ro: "{name} a aplicat la {lender}", ru: "{name} подал заявку в {lender}", uk: "{name} подав заявку до {lender}" },
  ln_mail_lead: { en: "The bank has the application. You see its status on your dashboard as the bank moves it.", ro: "Banca are cererea. Îi vezi statutul pe panou pe măsură ce banca o procesează.", ru: "Заявка у банка. Её статус виден на панели по мере обработки.", uk: "Заявка в банку. Її статус видно на панелі в міру обробки." },
  ln_mail_status: { en: "Loan for {name}: {status}", ro: "Creditul pentru {name}: {status}", ru: "Кредит для {name}: {status}", uk: "Кредит для {name}: {status}" },
  ln_mail_cta: { en: "Open the quote", ro: "Deschide oferta", ru: "Открыть расчёт", uk: "Відкрити розрахунок" },

  // ---- the lender's portal (formal)
  lp_title: { en: "Applications sent to {lender}", ro: "Cereri trimise către {lender}", ru: "Заявки, отправленные в {lender}", uk: "Заявки, надіслані до {lender}" },
  lp_sub: { en: "Update each application's status here; the installer and VoltMira see it at once.", ro: "Actualizați aici statutul fiecărei cereri; instalatorul și VoltMira îl văd imediat.", ru: "Обновляйте здесь статус каждой заявки; монтажник и VoltMira увидят его сразу.", uk: "Оновлюйте тут статус кожної заявки; монтажник і VoltMira побачать його одразу." },
  lp_none: { en: "No applications yet.", ro: "Încă nicio cerere.", ru: "Заявок пока нет.", uk: "Заявок поки немає." },
  lp_set: { en: "New status", ro: "Statut nou", ru: "Новый статус", uk: "Новий статус" },
  lp_ref: { en: "Your reference (optional)", ro: "Referința dumneavoastră (opțional)", ru: "Ваш номер (необязательно)", uk: "Ваш номер (необов’язково)" },
  lp_note: { en: "Note (optional)", ro: "Notă (opțional)", ru: "Примечание (необязательно)", uk: "Примітка (необов’язково)" },
  lp_save: { en: "Save", ro: "Salvați", ru: "Сохранить", uk: "Зберегти" },
  lp_saved: { en: "Saved.", ro: "Salvat.", ru: "Сохранено.", uk: "Збережено." },
  lp_bad: { en: "That status cannot follow the current one.", ro: "Acest statut nu poate urma celui actual.", ru: "Этот статус не может следовать за текущим.", uk: "Цей статус не може йти після поточного." },
  lp_failed: { en: "Not saved. Try again.", ro: "Nesalvat. Încercați din nou.", ru: "Не сохранено. Попробуйте снова.", uk: "Не збережено. Спробуйте ще раз." },
  lp_final: { en: "Closed", ro: "Închisă", ru: "Закрыта", uk: "Закрита" },

  // ---- the admin's lenders and payout report
  al_title: { en: "Loans and commissions", ro: "Credite și comisioane", ru: "Кредиты и комиссии", uk: "Кредити та комісії" },
  al_sub: { en: "Partner lenders, their portal links, and what each owes VoltMira per month for funded loans.", ro: "Creditorii parteneri, linkurile portalului și cât datorează fiecare VoltMira pe lună pentru creditele finanțate.", ru: "Кредиторы-партнёры, ссылки на портал и сколько каждый должен VoltMira в месяц за выданные кредиты.", uk: "Кредитори-партнери, посилання на портал і скільки кожен винен VoltMira на місяць за видані кредити." },
  al_needs_db: { en: "Run supabase/add-financing.sql in Supabase first.", ro: "Rulează întâi supabase/add-financing.sql în Supabase.", ru: "Сначала выполните supabase/add-financing.sql в Supabase.", uk: "Спершу виконайте supabase/add-financing.sql у Supabase." },
  al_lenders: { en: "Lenders", ro: "Creditori", ru: "Кредиторы", uk: "Кредитори" },
  al_sample: { en: "sample", ro: "exemplu", ru: "пример", uk: "приклад" },
  al_channel: { en: "Channel", ro: "Canal", ru: "Канал", uk: "Канал" },
  al_terms: { en: "Commission", ro: "Comision", ru: "Комиссия", uk: "Комісія" },
  al_webhook: { en: "Webhook: POST {path}, signed with {env}", ro: "Webhook: POST {path}, semnat cu {env}", ru: "Вебхук: POST {path}, подпись {env}", uk: "Вебхук: POST {path}, підпис {env}" },
  al_secret_set: { en: "secret set", ro: "secret setat", ru: "секрет задан", uk: "секрет задано" },
  al_secret_missing: { en: "secret missing", ro: "secret lipsă", ru: "секрет не задан", uk: "секрет не задано" },
  al_portal: { en: "New portal link", ro: "Link nou de portal", ru: "Новая ссылка на портал", uk: "Нове посилання на портал" },
  al_portal_once: { en: "Copy it now: it is shown once. The previous link stops working.", ro: "Copiază-l acum: apare o singură dată. Linkul anterior nu mai funcționează.", ru: "Скопируйте сейчас: показывается один раз. Прежняя ссылка перестаёт работать.", uk: "Скопіюйте зараз: показується один раз. Попереднє посилання перестає працювати." },
  al_report: { en: "Commission owed, by month", ro: "Comision datorat, pe luni", ru: "Комиссия к оплате, по месяцам", uk: "Комісія до сплати, за місяцями" },
  al_period: { en: "Month", ro: "Luna", ru: "Месяц", uk: "Місяць" },
  al_lender: { en: "Lender", ro: "Creditor", ru: "Кредитор", uk: "Кредитор" },
  al_loans: { en: "Loans funded", ro: "Credite finanțate", ru: "Выдано кредитов", uk: "Видано кредитів" },
  al_volume: { en: "Volume", ro: "Volum", ru: "Объём", uk: "Обсяг" },
  al_owed: { en: "Owed", ro: "Datorat", ru: "К оплате", uk: "До сплати" },
  al_none: { en: "No funded loans yet.", ro: "Încă niciun credit finanțat.", ru: "Выданных кредитов пока нет.", uk: "Виданих кредитів поки немає." },
  al_csv: { en: "Download CSV", ro: "Descarcă CSV", ru: "Скачать CSV", uk: "Завантажити CSV" },
};

export const LT = T;

export function lt(key, lang = "en", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
