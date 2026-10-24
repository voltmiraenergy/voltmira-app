// lib/quoteFastText.js — the installer's words for Phase 1, "quote in 10 minutes": the Settings tab for the estimate
// page and the lead score, the score on Leads, the quote made from an estimate, the follow-up switch on an offer,
// what the client read, and the lead-to-quote time on the dashboard. Installer copy says "tu" in Romanian.
// lib/quoteFastText.test.js holds it to four languages, the same placeholders, and no dashes or middle dots.
// qft(key, lang, { x: "…" }) fills {x}.

const T = {
  // ---- Settings: the tab
  tab: { en: "Estimate page", ro: "Pagina de estimare", ru: "Страница расчёта", uk: "Сторінка розрахунку" },
  tab_h: { en: "Your page, the lead score, follow-ups", ro: "Pagina ta, scorul contactelor, reveniri", ru: "Ваша страница, оценка заявок, напоминания", uk: "Ваша сторінка, оцінка заявок, нагадування" },
  // the public page
  page_h: { en: "Your estimate page", ro: "Pagina ta de estimare", ru: "Ваша страница расчёта", uk: "Ваша сторінка розрахунку" },
  page_p: {
    en: "A free estimate in your colours at your own address. Put the link on your site and Facebook page, or embed it. Every request lands in Leads with a score.",
    ro: "O estimare gratuită în culorile tale, la adresa ta. Pune linkul pe site și pe pagina de Facebook sau încorporează-l. Fiecare cerere ajunge în Contacte, cu scor.",
    ru: "Бесплатный расчёт в ваших цветах по вашему адресу. Разместите ссылку на сайте и в Facebook или встройте её. Каждая заявка попадает в контакты с оценкой.",
    uk: "Безкоштовний розрахунок у ваших кольорах за вашою адресою. Розмістіть посилання на сайті й у Facebook або вбудуйте його. Кожна заявка потрапляє в контакти з оцінкою.",
  },
  slug: { en: "Page address", ro: "Adresa paginii", ru: "Адрес страницы", uk: "Адреса сторінки" },
  slug_hint: { en: "Letters, digits and hyphens, 3 to 40.", ro: "Litere, cifre și cratime, între 3 și 40.", ru: "Буквы, цифры и дефисы, от 3 до 40.", uk: "Літери, цифри й дефіси, від 3 до 40." },
  slug_use: { en: "Use {s}", ro: "Folosește {s}", ru: "Использовать {s}", uk: "Використати {s}" },
  color: { en: "Your colour", ro: "Culoarea ta", ru: "Ваш цвет", uk: "Ваш колір" },
  open: { en: "Open the page", ro: "Deschide pagina", ru: "Открыть страницу", uk: "Відкрити сторінку" },
  embed: { en: "To put it on your site", ro: "Ca s-o pui pe site", ru: "Чтобы встроить на сайт", uk: "Щоб вбудувати на сайт" },
  copy: { en: "Copy", ro: "Copiază", ru: "Копировать", uk: "Копіювати" },
  copied: { en: "Copied", ro: "Copiat", ru: "Скопировано", uk: "Скопійовано" },
  not_live: { en: "The page is not open to visitors yet. Your settings are kept for when it is.", ro: "Pagina nu e încă deschisă vizitatorilor. Setările tale rămân pentru atunci.", ru: "Страница пока закрыта для посетителей. Настройки сохранятся до её открытия.", uk: "Сторінка поки закрита для відвідувачів. Налаштування збережуться до її відкриття." },
  needs_db: { en: "Needs the database update (add-quote-fast.sql) before these can be saved.", ro: "Are nevoie de actualizarea bazei de date (add-quote-fast.sql) ca să poată fi salvate.", ru: "Чтобы сохранить, нужно обновление базы данных (add-quote-fast.sql).", uk: "Щоб зберегти, потрібне оновлення бази даних (add-quote-fast.sql)." },
  owner_only: { en: "Only the account owner can change these.", ro: "Doar proprietarul contului le poate schimba.", ru: "Изменять это может только владелец аккаунта.", uk: "Змінювати це може лише власник акаунта." },
  save: { en: "Save", ro: "Salvează", ru: "Сохранить", uk: "Зберегти" },
  saving: { en: "Saving...", ro: "Se salvează...", ru: "Сохраняем...", uk: "Зберігаємо..." },
  saved: { en: "Saved", ro: "Salvat", ru: "Сохранено", uk: "Збережено" },
  err_bad_slug: { en: "That address cannot be used. Try letters, digits and hyphens.", ro: "Adresa nu poate fi folosită. Încearcă litere, cifre și cratime.", ru: "Такой адрес нельзя использовать. Используйте буквы, цифры и дефисы.", uk: "Таку адресу не можна використати. Використовуйте літери, цифри й дефіси." },
  err_slug_taken: { en: "Another installer already has that address.", ro: "Alt instalator are deja adresa asta.", ru: "Этот адрес уже занят другим монтажником.", uk: "Цю адресу вже зайняв інший монтажник." },
  err_save_failed: { en: "Could not save. Try again.", ro: "Nu s-a putut salva. Încearcă din nou.", ru: "Не удалось сохранить. Попробуйте ещё раз.", uk: "Не вдалося зберегти. Спробуйте ще раз." },
  // the lead score
  score_h: { en: "Lead score", ro: "Scorul contactelor", ru: "Оценка заявок", uk: "Оцінка заявок" },
  score_p: {
    en: "Each lead gets 0 to 100 from what it tells you. Set how much each sign counts for you; the list is rescored at once.",
    ro: "Fiecare contact primește un scor de la 0 la 100 din ce îți spune. Alege cât contează fiecare semn; lista se recalculează imediat.",
    ru: "Каждая заявка получает от 0 до 100 по тому, что о ней известно. Задайте вес каждого признака; список пересчитается сразу.",
    uk: "Кожна заявка отримує від 0 до 100 за тим, що про неї відомо. Задайте вагу кожної ознаки; список перерахується одразу.",
  },
  sig_bill: { en: "Size of the electricity bill", ro: "Mărimea facturii la energie", ru: "Размер счёта за электричество", uk: "Розмір рахунку за електроенергію" },
  sig_timeline: { en: "When they want to install", ro: "Când vor montajul", ru: "Когда хотят установку", uk: "Коли хочуть монтаж" },
  sig_phone: { en: "A phone number to call", ro: "Un număr de telefon", ru: "Номер телефона", uk: "Номер телефону" },
  sig_located: { en: "Address found on the map", ro: "Adresa găsită pe hartă", ru: "Адрес найден на карте", uk: "Адресу знайдено на мапі" },
  sig_financing: { en: "Interest in paying in instalments", ro: "Interes pentru plata în rate", ru: "Интерес к рассрочке", uk: "Інтерес до розстрочки" },
  sig_district: { en: "A district you serve", ro: "Un raion în care lucrezi", ru: "Район, где вы работаете", uk: "Район, де ви працюєте" },
  defaults: { en: "Back to the standard weights", ro: "Înapoi la ponderile standard", ru: "Вернуть стандартные веса", uk: "Повернути стандартні ваги" },
  districts_h: { en: "Districts you serve", ro: "Raioanele în care lucrezi", ru: "Районы, где вы работаете", uk: "Райони, де ви працюєте" },
  districts_p: { en: "None ticked: every district counts the same.", ro: "Niciunul bifat: toate raioanele contează la fel.", ru: "Ничего не отмечено: все районы считаются одинаково.", uk: "Нічого не позначено: усі райони рахуються однаково." },
  // follow-ups
  nudge_h: { en: "Follow-up days", ro: "Zilele de revenire", ru: "Дни напоминаний", uk: "Дні нагадувань" },
  nudge_p: {
    en: "The days after the offer is sent on which an unsigned client gets a reminder. They go only while follow-ups are on in Notifications, and can be switched off on each offer.",
    ro: "Zilele de după trimiterea ofertei în care un client care nu a semnat primește o reamintire. Pleacă doar cât timp revenirile sunt pornite în Notificări și pot fi oprite pe fiecare ofertă.",
    ru: "Дни после отправки КП, когда клиент без подписи получает напоминание. Они уходят, только пока напоминания включены в уведомлениях, и отключаются для каждого КП.",
    uk: "Дні після надсилання пропозиції, коли клієнт без підпису отримує нагадування. Вони йдуть, лише поки нагадування увімкнені в сповіщеннях, і вимикаються для кожної пропозиції.",
  },
  nudge_n: { en: "Reminder {n}, day", ro: "Reamintirea {n}, ziua", ru: "Напоминание {n}, день", uk: "Нагадування {n}, день" },
  nudge_preview: {
    en: "A client who has not signed gets a reminder {d} days after the offer is sent.",
    ro: "Un client care nu a semnat primește o reamintire la {d} zile după trimiterea ofertei.",
    ru: "Клиент без подписи получает напоминание через {d} дней после отправки КП.",
    uk: "Клієнт без підпису отримує нагадування через {d} днів після надсилання пропозиції.",
  },
  nudge_sent: { en: "Sent", ro: "Trimisă", ru: "Отправлено", uk: "Надіслано" },
  nudge_day: { en: "Day {n}", ro: "Ziua {n}", ru: "День {n}", uk: "День {n}" },
  share: { en: "{p}% of the score", ro: "{p}% din scor", ru: "{p}% оценки", uk: "{p}% оцінки" },
  districts_n: { en: "{n} ticked", ro: "{n} bifate", ru: "отмечено: {n}", uk: "позначено: {n}" },
  districts_all: { en: "Every district counts the same", ro: "Toate raioanele contează la fel", ru: "Все районы считаются одинаково", uk: "Усі райони рахуються однаково" },

  // ---- Leads: the score
  badge: { en: "Score {n}", ro: "Scor {n}", ru: "Оценка {n}", uk: "Оцінка {n}" },
  badge_title: { en: "Lead score {n} of 100", ro: "Scorul contactului: {n} din 100", ru: "Оценка заявки: {n} из 100", uk: "Оцінка заявки: {n} зі 100" },
  sort: { en: "Order", ro: "Ordine", ru: "Порядок", uk: "Порядок" },
  sort_new: { en: "Newest first", ro: "Cele mai noi", ru: "Сначала новые", uk: "Спочатку нові" },
  sort_score: { en: "Highest score first", ro: "Scorul cel mai mare", ru: "Сначала высокая оценка", uk: "Спочатку висока оцінка" },
  min_70: { en: "Score 70 and up", ro: "Scor de la 70", ru: "Оценка от 70", uk: "Оцінка від 70" },
  all_scores: { en: "Every score", ro: "Orice scor", ru: "Любая оценка", uk: "Будь-яка оцінка" },
  est_line: { en: "Estimate shown: {kw} kW, {price}", ro: "Estimare arătată: {kw} kW, {price}", ru: "Показан расчёт: {kw} кВт, {price}", uk: "Показано розрахунок: {kw} кВт, {price}" },
  when_now: { en: "wants it now", ro: "vrea acum", ru: "хочет сейчас", uk: "хоче зараз" },
  when_soon: { en: "within 3 months", ro: "în 3 luni", ru: "в течение 3 месяцев", uk: "протягом 3 місяців" },
  when_later: { en: "later", ro: "mai târziu", ru: "позже", uk: "пізніше" },
  fin_yes: { en: "asks about instalments", ro: "întreabă de rate", ru: "спрашивает о рассрочке", uk: "питає про розстрочку" },
  from_estimate: { en: "Create quote from estimate", ro: "Creează oferta din estimare", ru: "Создать КП из расчёта", uk: "Створити пропозицію з розрахунку" },

  // ---- the quote's options made from an estimate (they reach the client's offer)
  opt_essential: { en: "Essential", ro: "Esențial", ru: "Базовый", uk: "Базовий" },
  opt_complete: { en: "Complete, with battery", ro: "Complet, cu baterie", ru: "Полный, с батареей", uk: "Повний, з батареєю" },

  // ---- the editor: follow-ups on this offer, what the client read
  nudges_this: { en: "Automatic reminders for this offer", ro: "Reamintiri automate pentru această ofertă", ru: "Автонапоминания по этому КП", uk: "Автонагадування щодо цієї пропозиції" },
  nudges_this_note: { en: "Off: this client gets no reminder, whatever the workspace setting.", ro: "Oprit: clientul acesta nu primește reamintiri, indiferent de setarea generală.", ru: "Выключено: этот клиент не получит напоминаний, независимо от общей настройки.", uk: "Вимкнено: цей клієнт не отримає нагадувань, незалежно від загального налаштування." },
  read_h: { en: "What the client read", ro: "Ce a citit clientul", ru: "Что читал клиент", uk: "Що читав клієнт" },
  sec_hero: { en: "Price and savings at the top", ro: "Prețul și economia de sus", ru: "Цена и экономия вверху", uk: "Ціна й економія вгорі" },
  sec_plain: { en: "In short", ro: "Pe scurt", ru: "Коротко", uk: "Коротко" },
  sec_opt: { en: "The options", ro: "Variantele", ru: "Варианты", uk: "Варіанти" },
  sec_buy: { en: "The equipment", ro: "Echipamentul", ru: "Оборудование", uk: "Обладнання" },
  sec_en: { en: "Energy month by month", ro: "Energia lună de lună", ru: "Энергия по месяцам", uk: "Енергія по місяцях" },
  sec_money: { en: "The money over the years", ro: "Banii de-a lungul anilor", ru: "Деньги по годам", uk: "Гроші за роками" },
  sec_fin: { en: "Financing", ro: "Finanțarea", ru: "Финансирование", uk: "Фінансування" },
  sec_acc: { en: "Accepting", ro: "Acceptarea", ru: "Принятие", uk: "Прийняття" },
  read_none: { en: "No reading time yet.", ro: "Încă nu e timp de citire.", ru: "Пока нет времени чтения.", uk: "Поки немає часу читання." },
  read_option: { en: "Looked at: {o}", ro: "S-a uitat la: {o}", ru: "Смотрел вариант: {o}", uk: "Дивився варіант: {o}" },

  // ---- the dashboard
  l2q_h: { en: "Lead to quote", ro: "De la contact la ofertă", ru: "От заявки до КП", uk: "Від заявки до пропозиції" },
  l2q_sub: { en: "median, last 90 days, {n} offers", ro: "mediană, ultimele 90 de zile, {n} oferte", ru: "медиана, 90 дней, КП: {n}", uk: "медіана, 90 днів, пропозицій: {n}" },
  l2q_none: { en: "No offer made from a lead yet", ro: "Încă nicio ofertă făcută dintr-un contact", ru: "Пока нет КП из заявок", uk: "Поки немає пропозицій із заявок" },
  hours: { en: "{n} h", ro: "{n} ore", ru: "{n} ч", uk: "{n} год" },
  days: { en: "{n} days", ro: "{n} zile", ru: "{n} дн.", uk: "{n} дн." },
};

export const QFT = T;

export function qft(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
