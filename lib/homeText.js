// lib/homeText.js — the homeowner's words (docs/MARKETPLACE.md): their account
// at /home, the sign-in emails, the account card on a signed offer, and the
// public funnel at /solar. The homeowner is addressed formally in Romanian,
// like the offer. Shape { key: { en, ro, ru, uk } }; tested in homeText.test.js.
const T = {
  // ---- sign-in
  hl_title: { en: "Your solar system", ro: "Sistemul dumneavoastră solar", ru: "Ваша солнечная система", uk: "Ваша сонячна система" },
  hl_sub: { en: "Enter the email your installer has for you. We send a sign-in link, no password needed.", ro: "Introduceți adresa de e-mail pe care o are instalatorul. Vă trimitem un link de conectare, fără parolă.", ru: "Введите e-mail, который есть у вашего установщика. Мы отправим ссылку для входа, без пароля.", uk: "Введіть e-mail, який має ваш монтажник. Ми надішлемо посилання для входу, без пароля." },
  hl_email: { en: "Email", ro: "E-mail", ru: "E-mail", uk: "E-mail" },
  hl_send: { en: "Send me the link", ro: "Trimiteți-mi linkul", ru: "Отправить ссылку", uk: "Надіслати посилання" },
  hl_sending: { en: "Sending...", ro: "Se trimite...", ru: "Отправка...", uk: "Надсилання..." },
  hl_sent: { en: "If this address belongs to a system, the link is on its way. It works for one hour.", ro: "Dacă adresa aparține unui sistem, linkul este pe drum. Este valabil o oră.", ru: "Если этот адрес связан с системой, ссылка уже отправлена. Она действует один час.", uk: "Якщо ця адреса пов’язана із системою, посилання вже надіслано. Воно діє одну годину." },
  hl_bad_link: { en: "That sign-in link has expired or was already used. Ask for a new one below.", ro: "Linkul de conectare a expirat sau a fost deja folosit. Cereți unul nou mai jos.", ru: "Ссылка для входа истекла или уже использована. Запросите новую ниже.", uk: "Посилання для входу закінчилося або вже використане. Запросіть нове нижче." },
  hl_installer: { en: "This email belongs to an installer account. Sign in at voltmira.com/login.", ro: "Această adresă aparține unui cont de instalator. Conectați-vă la voltmira.com/login.", ru: "Этот e-mail принадлежит аккаунту установщика. Войдите на voltmira.com/login.", uk: "Цей e-mail належить акаунту монтажника. Увійдіть на voltmira.com/login." },
  hl_error: { en: "Something went wrong. Try again in a minute.", ro: "Ceva nu a mers. Încercați din nou peste un minut.", ru: "Что-то пошло не так. Попробуйте через минуту.", uk: "Щось пішло не так. Спробуйте за хвилину." },
  // the email
  he_subject: { en: "Your solar system's page", ro: "Pagina sistemului dumneavoastră solar", ru: "Страница вашей солнечной системы", uk: "Сторінка вашої сонячної системи" },
  he_kicker: { en: "Your account", ro: "Contul dumneavoastră", ru: "Ваш аккаунт", uk: "Ваш акаунт" },
  he_heading: { en: "Your system, its production and your documents, in one place", ro: "Sistemul, producția și documentele dumneavoastră, într-un singur loc", ru: "Ваша система, её выработка и документы в одном месте", uk: "Ваша система, її вироблення й документи в одному місці" },
  he_lead: { en: "{co} installed or is installing your solar system. This link signs you in; it works for one hour and only once.", ro: "{co} vă instalează sistemul solar. Linkul vă conectează; este valabil o oră și o singură dată.", ru: "{co} устанавливает вашу солнечную систему. Ссылка выполняет вход; она действует один час и один раз.", uk: "{co} встановлює вашу сонячну систему. Посилання виконує вхід; воно діє одну годину й один раз." },
  he_cta: { en: "Open my page", ro: "Deschideți pagina mea", ru: "Открыть мою страницу", uk: "Відкрити мою сторінку" },
  he_foot: { en: "If you did not ask for this, ignore this email.", ro: "Dacă nu ați cerut acest mesaj, ignorați-l.", ru: "Если вы не запрашивали это письмо, просто проигнорируйте его.", uk: "Якщо ви не запитували цей лист, просто проігноруйте його." },

  // ---- the account card on a signed offer
  hc_h: { en: "Your account", ro: "Contul dumneavoastră", ru: "Ваш аккаунт", uk: "Ваш акаунт" },
  hc_p: { en: "Production, invoices, documents, warranties and maintenance requests, on a page of your own.", ro: "Producția, facturile, documentele, garanțiile și cererile de mentenanță, pe o pagină a dumneavoastră.", ru: "Выработка, счета, документы, гарантии и заявки на обслуживание на вашей собственной странице.", uk: "Вироблення, рахунки, документи, гарантії та заявки на обслуговування на вашій власній сторінці." },
  hc_hint: { en: "Use the email your installer has for you; otherwise ask them for an invitation.", ro: "Folosiți adresa pe care o are instalatorul; altfel cereți-i o invitație.", ru: "Используйте e-mail, который есть у установщика; иначе попросите у него приглашение.", uk: "Використайте e-mail, який має монтажник; інакше попросіть у нього запрошення." },
  hc_open: { en: "Open my account", ro: "Deschideți contul", ru: "Открыть аккаунт", uk: "Відкрити акаунт" },

  // ---- /home
  hm_title: { en: "Your solar system", ro: "Sistemul dumneavoastră solar", ru: "Ваша солнечная система", uk: "Ваша сонячна система" },
  hm_by: { en: "Installed by {co}", ro: "Instalat de {co}", ru: "Установщик: {co}", uk: "Монтажник: {co}" },
  hm_sys: { en: "{kw} kW", ro: "{kw} kW", ru: "{kw} кВт", uk: "{kw} кВт" },
  hm_batt: { en: "battery {n} kWh", ro: "baterie {n} kWh", ru: "батарея {n} kWh", uk: "батарея {n} kWh" },
  hm_signout: { en: "Sign out", ro: "Deconectare", ru: "Выйти", uk: "Вийти" },
  hm_pick: { en: "Your systems", ro: "Sistemele dumneavoastră", ru: "Ваши системы", uk: "Ваші системи" },
  hm_none: { en: "No system is linked to this account yet. Ask your installer to invite you.", ro: "Niciun sistem nu este încă legat de acest cont. Cereți instalatorului o invitație.", ru: "К этому аккаунту пока не привязана ни одна система. Попросите установщика пригласить вас.", uk: "До цього акаунта поки не прив’язано жодної системи. Попросіть монтажника запросити вас." },
  hm_needs_db: { en: "This page is not switched on yet. Your installer can still be reached directly.", ro: "Pagina nu este încă activată. Instalatorul poate fi contactat direct.", ru: "Страница ещё не включена. С установщиком можно связаться напрямую.", uk: "Сторінку ще не ввімкнено. З монтажником можна зв’язатися напряму." },
  hm_offer: { en: "Open the signed offer", ro: "Deschideți oferta semnată", ru: "Открыть подписанное предложение", uk: "Відкрити підписану пропозицію" },

  hm_bill_h: { en: "Invoices and payments", ro: "Facturi și plăți", ru: "Счета и платежи", uk: "Рахунки й платежі" },
  hm_bill_inv: { en: "Invoice {no}", ro: "Factura {no}", ru: "Счёт {no}", uk: "Рахунок {no}" },
  hm_bill_total: { en: "Total", ro: "Total", ru: "Итого", uk: "Разом" },
  hm_bill_paid: { en: "Paid", ro: "Achitat", ru: "Оплачено", uk: "Сплачено" },
  hm_bill_due: { en: "Still to pay", ro: "Rest de plată", ru: "Осталось оплатить", uk: "Залишилося сплатити" },
  hm_bill_settled: { en: "Paid in full", ro: "Achitat integral", ru: "Оплачено полностью", uk: "Сплачено повністю" },
  hm_bill_none: { en: "No invoice yet.", ro: "Încă nicio factură.", ru: "Счетов пока нет.", uk: "Рахунків поки немає." },
  hm_bill_fiscal: { en: "e-Factura fiscal no. {n}", ro: "Nr. fiscal e-Factura {n}", ru: "Фискальный № e-Factura {n}", uk: "Фіскальний № e-Factura {n}" },

  hm_docs_h: { en: "Documents", ro: "Documente", ru: "Документы", uk: "Документи" },
  hm_doc_offer: { en: "Signed offer", ro: "Oferta semnată", ru: "Подписанное предложение", uk: "Підписана пропозиція" },
  hm_doc_pdf: { en: "Offer as PDF", ro: "Oferta în PDF", ru: "Предложение в PDF", uk: "Пропозиція в PDF" },
  hm_doc_sig: { en: "Signature: {level}", ro: "Semnătura: {level}", ru: "Подпись: {level}", uk: "Підпис: {level}" },
  hm_doc_grid: { en: "Grid connection file at {op}: {status}, reference {ref}", ro: "Dosarul de racordare la {op}: {status}, referința {ref}", ru: "Дело о подключении в {op}: {status}, номер {ref}", uk: "Справа про приєднання в {op}: {status}, номер {ref}" },

  hm_fin_h: { en: "Financing", ro: "Finanțare", ru: "Финансирование", uk: "Фінансування" },
  hm_fin_line: { en: "{lender}: {status}, {monthly} a month for {months} months", ro: "{lender}: {status}, {monthly} pe lună, {months} luni", ru: "{lender}: {status}, {monthly} в месяц, {months} мес.", uk: "{lender}: {status}, {monthly} на місяць, {months} міс." },
  hm_fin_none: { en: "No loan application from this offer.", ro: "Nicio cerere de credit din această ofertă.", ru: "Заявок на кредит по этому предложению нет.", uk: "Заявок на кредит за цією пропозицією немає." },

  hm_war_h: { en: "Warranties", ro: "Garanții", ru: "Гарантии", uk: "Гарантії" },
  hm_war_install: { en: "Installation work, {n} years", ro: "Lucrările de montaj, {n} ani", ru: "Монтажные работы, {n} лет", uk: "Монтажні роботи, {n} років" },
  hm_war_item: { en: "{item}, {n} years", ro: "{item}, {n} ani", ru: "{item}, {n} лет", uk: "{item}, {n} років" },
  hm_war_until: { en: "until {d}", ro: "până la {d}", ru: "до {d}", uk: "до {d}" },
  hm_war_from: { en: "counted from commissioning", ro: "de la punerea în funcțiune", ru: "с ввода в эксплуатацию", uk: "з введення в експлуатацію" },
  hm_war_none: { en: "Your installer has not recorded warranty terms yet.", ro: "Instalatorul nu a trecut încă termenii de garanție.", ru: "Установщик ещё не указал условия гарантии.", uk: "Монтажник ще не вказав умови гарантії." },
  hm_war_maker: { en: "Manufacturer's warranty, as published", ro: "Garanția producătorului, cum este publicată", ru: "Гарантия производителя, как опубликовано", uk: "Гарантія виробника, як опубліковано" },

  hm_mt_h: { en: "Maintenance", ro: "Mentenanță", ru: "Обслуживание", uk: "Обслуговування" },
  hm_mt_p: { en: "Something wrong, or due for a check? Tell your installer here; you will hear back at each step.", ro: "Ceva nu funcționează sau e timpul unei verificări? Spuneți-i aici instalatorului; veți fi anunțat la fiecare pas.", ru: "Что-то не так или пора проверить систему? Напишите установщику здесь; вы будете получать уведомления на каждом шаге.", uk: "Щось не так або час перевірити систему? Напишіть монтажникові тут; ви отримуватимете сповіщення на кожному кроці." },
  hm_mt_kind: { en: "What it is about", ro: "Despre ce este", ru: "О чём речь", uk: "Про що йдеться" },
  hm_mt_k_fault: { en: "A fault or an error on the inverter", ro: "O defecțiune sau o eroare la invertor", ru: "Неисправность или ошибка инвертора", uk: "Несправність або помилка інвертора" },
  hm_mt_k_underproduction: { en: "It produces less than expected", ro: "Produce mai puțin decât era de așteptat", ru: "Вырабатывает меньше ожидаемого", uk: "Виробляє менше, ніж очікувалося" },
  hm_mt_k_cleaning: { en: "Panel cleaning or a routine check", ro: "Curățarea panourilor sau o verificare de rutină", ru: "Чистка панелей или плановая проверка", uk: "Чищення панелей або планова перевірка" },
  hm_mt_k_damage: { en: "Damage (storm, hail, roof)", ro: "O deteriorare (furtună, grindină, acoperiș)", ru: "Повреждение (буря, град, крыша)", uk: "Пошкодження (буря, град, дах)" },
  hm_mt_k_other: { en: "Something else", ro: "Altceva", ru: "Другое", uk: "Інше" },
  hm_mt_k_no_data: { en: "No production data", ro: "Lipsesc datele de producție", ru: "Нет данных о выработке", uk: "Немає даних про вироблення" },
  hm_mt_title: { en: "In a few words", ro: "În câteva cuvinte", ru: "В нескольких словах", uk: "Кількома словами" },
  hm_mt_detail: { en: "Details (optional)", ro: "Detalii (opțional)", ru: "Подробности (необязательно)", uk: "Подробиці (необов’язково)" },
  hm_mt_send: { en: "Send to the installer", ro: "Trimiteți instalatorului", ru: "Отправить установщику", uk: "Надіслати монтажникові" },
  hm_mt_sent: { en: "Sent. {co} has been told.", ro: "Trimis. {co} a fost anunțat.", ru: "Отправлено. {co} уведомлены.", uk: "Надіслано. {co} повідомлено." },
  hm_mt_none: { en: "No requests so far.", ro: "Nicio cerere până acum.", ru: "Заявок пока нет.", uk: "Заявок поки немає." },
  hm_mt_st_open: { en: "Received", ro: "Primită", ru: "Получена", uk: "Отримано" },
  hm_mt_st_scheduled: { en: "Visit on {d}", ro: "Vizită pe {d}", ru: "Визит {d}", uk: "Візит {d}" },
  hm_mt_st_resolved: { en: "Resolved", ro: "Rezolvată", ru: "Решена", uk: "Вирішено" },
  hm_mt_st_closed: { en: "Closed", ro: "Închisă", ru: "Закрыта", uk: "Закрито" },
  hm_mt_reopen: { en: "Not solved, reopen", ro: "Nu s-a rezolvat, redeschideți", ru: "Не решено, открыть снова", uk: "Не вирішено, відкрити знову" },
  hm_mt_by_mon: { en: "opened by monitoring", ro: "deschisă de monitorizare", ru: "открыта мониторингом", uk: "відкрито моніторингом" },

  hm_rv_h: { en: "Rate your installer", ro: "Evaluați instalatorul", ru: "Оцените установщика", uk: "Оцініть монтажника" },
  hm_rv_p: { en: "Only owners of a working system can rate, so the ratings others read are real. It shows with your first name and locality.", ro: "Doar proprietarii unui sistem pus în funcțiune pot evalua, ca evaluările să fie reale. Apare cu prenumele și localitatea dumneavoastră.", ru: "Оценивать могут только владельцы работающей системы, поэтому оценки настоящие. Отзыв показывается с вашим именем и населённым пунктом.", uk: "Оцінювати можуть лише власники працюючої системи, тому оцінки справжні. Відгук показується з вашим ім’ям і населеним пунктом." },
  hm_rv_stars: { en: "{n} of 5", ro: "{n} din 5", ru: "{n} из 5", uk: "{n} з 5" },
  hm_rv_body: { en: "A few words (optional)", ro: "Câteva cuvinte (opțional)", ru: "Несколько слов (необязательно)", uk: "Кілька слів (необов’язково)" },
  hm_rv_send: { en: "Publish the rating", ro: "Publicați evaluarea", ru: "Опубликовать оценку", uk: "Опублікувати оцінку" },
  hm_rv_done: { en: "Thank you. Your rating: {n} of 5.", ro: "Vă mulțumim. Evaluarea dumneavoastră: {n} din 5.", ru: "Спасибо. Ваша оценка: {n} из 5.", uk: "Дякуємо. Ваша оцінка: {n} з 5." },
  hm_rv_wait: { en: "You can rate the installation once the system is commissioned.", ro: "Puteți evalua instalarea după punerea în funcțiune a sistemului.", ru: "Оценить монтаж можно после ввода системы в эксплуатацию.", uk: "Оцінити монтаж можна після введення системи в експлуатацію." },
  hm_failed: { en: "Not sent. Try again.", ro: "Nu s-a trimis. Încercați din nou.", ru: "Не отправлено. Попробуйте снова.", uk: "Не надіслано. Спробуйте знову." },

  // ---- maintenance emails to the homeowner
  tk_kicker: { en: "Maintenance", ro: "Mentenanță", ru: "Обслуживание", uk: "Обслуговування" },
  tk_open: { en: "Your request has been received: {title}", ro: "Solicitarea dumneavoastră a fost primită: {title}", ru: "Ваша заявка получена: {title}", uk: "Вашу заявку отримано: {title}" },
  tk_open_l: { en: "{co} will contact you to arrange what is needed.", ro: "{co} vă contactează pentru a stabili ce este nevoie.", ru: "{co} свяжется с вами, чтобы договориться о дальнейшем.", uk: "{co} зв’яжеться з вами, щоб домовитися про подальше." },
  tk_open_mon: { en: "Monitoring noticed something on your system: {title}", ro: "Monitorizarea a observat ceva la sistemul dumneavoastră: {title}", ru: "Мониторинг заметил проблему в вашей системе: {title}", uk: "Моніторинг помітив проблему у вашій системі: {title}" },
  tk_open_mon_l: { en: "{co} has been told and will look into it. You do not need to do anything for now.", ro: "{co} a fost anunțat și verifică. Deocamdată nu trebuie să faceți nimic.", ru: "{co} уведомлены и проверят. Пока вам ничего делать не нужно.", uk: "{co} повідомлено, вони перевірять. Поки вам нічого робити не потрібно." },
  tk_scheduled: { en: "A visit is booked for {d}", ro: "O vizită este programată pe {d}", ru: "Визит назначен на {d}", uk: "Візит призначено на {d}" },
  tk_scheduled_l: { en: "About: {title}. The calendar file is attached.", ro: "Despre: {title}. Fișierul de calendar este atașat.", ru: "По вопросу: {title}. Файл календаря во вложении.", uk: "Щодо: {title}. Файл календаря додано." },
  tk_resolved: { en: "Resolved: {title}", ro: "Rezolvat: {title}", ru: "Решено: {title}", uk: "Вирішено: {title}" },
  tk_resolved_l: { en: "What was done: {outcome}. If it is not right, you can reopen it from your page.", ro: "Ce s-a făcut: {outcome}. Dacă nu este în regulă, o puteți redeschide de pe pagina dumneavoastră.", ru: "Что сделано: {outcome}. Если что-то не так, вы можете открыть заявку снова на своей странице.", uk: "Що зроблено: {outcome}. Якщо щось не так, ви можете відкрити заявку знову на своїй сторінці." },
  tk_closed: { en: "Closed: {title}", ro: "Închis: {title}", ru: "Закрыто: {title}", uk: "Закрито: {title}" },
  tk_closed_l: { en: "Thank you. Your page keeps the history.", ro: "Vă mulțumim. Pagina dumneavoastră păstrează istoricul.", ru: "Спасибо. Ваша страница хранит историю.", uk: "Дякуємо. Ваша сторінка зберігає історію." },
  tk_cta: { en: "Open my page", ro: "Deschideți pagina mea", ru: "Открыть мою страницу", uk: "Відкрити мою сторінку" },
};

export const HT = T;

export function ht(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
