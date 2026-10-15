// lib/dealText.js — the words of the deal room, in four languages. Two sets:
// APP is what the installer reads in VoltMira (informal Romanian, "tu"); BANK
// is what the bank reads on its link (formal Romanian). dt() reads both.

const APP = {
  dr_h: { en: "Deal room for the bank", ro: "Camera de date pentru bancă", ru: "Комната данных для банка", uk: "Кімната даних для банку" },
  dr_p: {
    en: "A private, read-only link for one bank: the live credit summary, the grid appendix and the documents filed on the checklist. The bank needs no account. You can close the link at any time, and you see what was opened.",
    ro: "Un link privat, doar pentru citire, pentru o bancă: rezumatul de credit actualizat, anexa de racordare și documentele din listă. Banca nu are nevoie de cont. Poți închide linkul oricând și vezi ce s-a deschis.",
    ru: "Закрытая ссылка только для чтения для одного банка: актуальное кредитное резюме, приложение о подключении и документы из перечня. Банку не нужен аккаунт. Ссылку можно закрыть в любой момент, и вы видите, что открывали.",
    uk: "Закрите посилання лише для читання для одного банку: актуальне кредитне резюме, додаток про приєднання та документи з переліку. Банку не потрібен акаунт. Посилання можна закрити будь-коли, і ви бачите, що відкривали.",
  },
  dr_bank: { en: "Bank", ro: "Banca", ru: "Банк", uk: "Банк" },
  dr_bank_ph: { en: "e.g. MAIB", ro: "ex. MAIB", ru: "напр. MAIB", uk: "напр. MAIB" },
  dr_days: { en: "Open for", ro: "Valabil", ru: "Действует", uk: "Діє" },
  dr_days_v: { en: "{n} days", ro: "{n} zile", ru: "{n} дн.", uk: "{n} дн." },
  dr_lang: { en: "Language of the page", ro: "Limba paginii", ru: "Язык страницы", uk: "Мова сторінки" },
  dr_create: { en: "Create the link", ro: "Creează linkul", ru: "Создать ссылку", uk: "Створити посилання" },
  dr_none: { en: "No link yet.", ro: "Niciun link încă.", ru: "Ссылок пока нет.", uk: "Посилань поки немає." },
  dr_c_bank: { en: "Bank", ro: "Banca", ru: "Банк", uk: "Банк" },
  dr_c_until: { en: "Open until", ro: "Valabil până la", ru: "Действует до", uk: "Діє до" },
  dr_c_state: { en: "State", ro: "Stare", ru: "Состояние", uk: "Стан" },
  dr_c_visits: { en: "Visits", ro: "Vizite", ru: "Визиты", uk: "Візити" },
  dr_c_last: { en: "Last opened", ro: "Ultima deschidere", ru: "Последнее открытие", uk: "Останнє відкриття" },
  ls_active: { en: "Open", ro: "Deschis", ru: "Открыта", uk: "Відкрите" },
  ls_expired: { en: "Expired", ro: "Expirat", ru: "Истекла", uk: "Закінчилося" },
  ls_revoked: { en: "Closed", ro: "Închis", ru: "Закрыта", uk: "Закрите" },
  dr_copy: { en: "Copy the link", ro: "Copiază linkul", ru: "Копировать ссылку", uk: "Копіювати посилання" },
  dr_copied: { en: "Copied", ro: "Copiat", ru: "Скопировано", uk: "Скопійовано" },
  dr_view: { en: "Open as the bank", ro: "Deschide ca banca", ru: "Открыть как банк", uk: "Відкрити як банк" },
  dr_revoke: { en: "Close the link", ro: "Închide linkul", ru: "Закрыть ссылку", uk: "Закрити посилання" },
  dr_revoke_q: { en: "Close the link for {x}? The bank can no longer open it.", ro: "Închizi linkul pentru {x}? Banca nu îl mai poate deschide.", ru: "Закрыть ссылку для {x}? Банк больше не сможет её открыть.", uk: "Закрити посилання для {x}? Банк більше не зможе його відкрити." },
  dr_log_h: { en: "Who opened what", ro: "Cine a deschis ce", ru: "Кто что открывал", uk: "Хто що відкривав" },
  dr_log_none: { en: "Nothing opened yet.", ro: "Nimic deschis încă.", ru: "Пока ничего не открывали.", uk: "Поки нічого не відкривали." },
  dr_log_p: {
    en: "Each visitor is numbered per link; no address is stored, only a sign that tells one browser from another.",
    ro: "Fiecare vizitator e numerotat pe link; nu se păstrează nicio adresă, doar un semn care deosebește un browser de altul.",
    ru: "Посетители нумеруются по каждой ссылке; адреса не хранятся, только признак, отличающий один браузер от другого.",
    uk: "Відвідувачі нумеруються для кожного посилання; адреси не зберігаються, лише ознака, що відрізняє один браузер від іншого.",
  },
  dr_visitor: { en: "visitor {n}", ro: "vizitatorul {n}", ru: "посетитель {n}", uk: "відвідувач {n}" },
  lw_open: { en: "Opened the deal room", ro: "A deschis camera de date", ru: "Открыл комнату данных", uk: "Відкрив кімнату даних" },
  lw_summary: { en: "Read the credit summary", ro: "A citit rezumatul de credit", ru: "Прочитал кредитное резюме", uk: "Прочитав кредитне резюме" },
  lw_document: { en: "Downloaded {x}", ro: "A descărcat {x}", ru: "Скачал {x}", uk: "Завантажив {x}" },
  lw_pack: { en: "Downloaded the pack", ro: "A descărcat pachetul", ru: "Скачал пакет", uk: "Завантажив пакет" },
  lw_question: { en: "Asked about {x}", ro: "A întrebat despre {x}", ru: "Задал вопрос: {x}", uk: "Поставив питання: {x}" },
  dr_open_q: { en: "{n} questions wait for your answer: {x}.", ro: "{n} întrebări așteaptă răspunsul tău: {x}.", ru: "Вопросов без ответа: {n}. {x}.", uk: "Питань без відповіді: {n}. {x}." },
  dr_open_q_one: { en: "A question waits for your answer: {x}.", ro: "O întrebare așteaptă răspunsul tău: {x}.", ru: "Вопрос ждёт ответа: {x}.", uk: "Питання чекає на відповідь: {x}." },
  dr_needs_db: {
    en: "The deal room needs its database update (supabase/add-deal-room.sql).",
    ro: "Camera de date are nevoie de actualizarea bazei de date (supabase/add-deal-room.sql).",
    ru: "Комнате данных нужно обновление базы данных (supabase/add-deal-room.sql).",
    uk: "Кімнаті даних потрібне оновлення бази даних (supabase/add-deal-room.sql).",
  },
  dr_err: { en: "Could not save. Try again.", ro: "Nu s-a putut salva. Încearcă din nou.", ru: "Не удалось сохранить. Попробуйте ещё раз.", uk: "Не вдалося зберегти. Спробуйте ще раз." },
  dr_err_bank: { en: "Write the bank's name.", ro: "Scrie numele băncii.", ru: "Укажите название банка.", uk: "Вкажіть назву банку." },
  dr_err_save_first: { en: "Wait until the plant is saved, then create the link.", ro: "Așteaptă să se salveze centrala, apoi creează linkul.", ru: "Дождитесь сохранения станции, затем создайте ссылку.", uk: "Дочекайтеся збереження станції, потім створіть посилання." },

  dr_notify: { en: "Email me when the bank opens it or asks a question", ro: "Anunță-mă pe email când banca îl deschide sau pune o întrebare", ru: "Сообщать на почту, когда банк открывает ссылку или задаёт вопрос", uk: "Повідомляти на пошту, коли банк відкриває посилання чи ставить питання" },
  dr_alerts: { en: "Email alerts", ro: "Notificări pe email", ru: "Уведомления на почту", uk: "Сповіщення на пошту" },
  dr_alerts_on: { en: "On", ro: "Pornite", ru: "Вкл.", uk: "Увімк." },
  dr_alerts_off: { en: "Off", ro: "Oprite", ru: "Выкл.", uk: "Вимк." },
  dr_alerts_h: { en: "Turn the email alerts for {x} on or off", ro: "Pornește sau oprește notificările pe email pentru {x}", ru: "Включить или выключить уведомления для {x}", uk: "Увімкнути чи вимкнути сповіщення для {x}" },

  // ---- the alert emails (to the installer)
  em_q_subject: { en: "{bank} asked about {item}: {plant}", ro: "{bank} a întrebat despre {item}: {plant}", ru: "{bank} задал вопрос: {item}, {plant}", uk: "{bank} поставив питання: {item}, {plant}" },
  em_q_kicker: { en: "Question from the bank", ro: "Întrebare de la bancă", ru: "Вопрос от банка", uk: "Питання від банку" },
  em_q_h1: { en: "{bank} asked about {item}", ro: "{bank} a întrebat despre {item}", ru: "{bank} спрашивает: {item}", uk: "{bank} питає: {item}" },
  em_q_lead: { en: "On {plant}. Answer it on that checklist item, in words or with a document; the bank sees the answer on its link.", ro: "La {plant}. Răspunde la acel element din listă, în cuvinte sau cu un document; banca vede răspunsul pe linkul ei.", ru: "По станции {plant}. Ответьте в этом пункте перечня, текстом или документом; банк увидит ответ по своей ссылке.", uk: "Щодо станції {plant}. Дайте відповідь у цьому пункті переліку, текстом або документом; банк побачить відповідь за своїм посиланням." },
  em_q_by: { en: "Asked by {x}", ro: "Întreabă {x}", ru: "Спрашивает {x}", uk: "Питає {x}" },
  em_a_subject: { en: "{bank} opened the deal room: {plant}", ro: "{bank} a deschis camera de date: {plant}", ru: "{bank} открыл комнату данных: {plant}", uk: "{bank} відкрив кімнату даних: {plant}" },
  em_a_kicker: { en: "Deal room activity", ro: "Activitate în camera de date", ru: "Активность в комнате данных", uk: "Активність у кімнаті даних" },
  em_a_h1: { en: "{bank} is looking at {plant}", ro: "{bank} se uită la {plant}", ru: "{bank} изучает {plant}", uk: "{bank} переглядає {plant}" },
  em_a_lead: { en: "What the bank did since the last alert:", ro: "Ce a făcut banca de la ultima notificare:", ru: "Что банк сделал с прошлого уведомления:", uk: "Що банк зробив з останнього сповіщення:" },
  em_cta: { en: "Open the plant", ro: "Deschide centrala", ru: "Открыть станцию", uk: "Відкрити станцію" },
  em_a_foot: { en: "At most one alert per link every 6 hours; questions always arrive at once. The full log is in the plant's deal room, where you can turn these alerts off for each link.", ro: "Cel mult o notificare pe link la 6 ore; întrebările vin imediat. Jurnalul complet e în camera de date a centralei, unde poți opri notificările pentru fiecare link.", ru: "Не чаще одного уведомления по ссылке за 6 часов; вопросы приходят сразу. Полный журнал в комнате данных станции, там же уведомления отключаются для каждой ссылки.", uk: "Не частіше одного сповіщення за посиланням на 6 годин; питання надходять одразу. Повний журнал у кімнаті даних станції, там же сповіщення вимикаються для кожного посилання." },
  em_q_foot: { en: "You get this because alerts are on for this link. Turn them off in the plant's deal room.", ro: "Primești asta pentru că notificările sunt pornite pentru acest link. Le poți opri din camera de date a centralei.", ru: "Вы получили это, потому что уведомления для этой ссылки включены. Их можно выключить в комнате данных станции.", uk: "Ви отримали це, бо сповіщення для цього посилання увімкнені. Їх можна вимкнути в кімнаті даних станції." },

  // ---- the documents and questions of one checklist item
  if_docs: { en: "Documents", ro: "Documente", ru: "Документы", uk: "Документи" },
  if_docs_n: { en: "Documents ({n})", ro: "Documente ({n})", ru: "Документы ({n})", uk: "Документи ({n})" },
  if_q_n: { en: "Questions ({n})", ro: "Întrebări ({n})", ru: "Вопросы ({n})", uk: "Питання ({n})" },
  if_q_open: { en: "{n} without an answer", ro: "{n} fără răspuns", ru: "без ответа: {n}", uk: "без відповіді: {n}" },
  if_add: { en: "Add documents", ro: "Adaugă documente", ru: "Добавить документы", uk: "Додати документи" },
  if_uploading: { en: "Uploading {x}", ro: "Se încarcă {x}", ru: "Загрузка: {x}", uk: "Завантаження: {x}" },
  if_none: { en: "No document on this item yet.", ro: "Niciun document la acest element încă.", ru: "К этому пункту пока нет документов.", uk: "До цього пункту поки немає документів." },
  if_remove: { en: "Remove", ro: "Șterge", ru: "Удалить", uk: "Видалити" },
  if_remove_q: { en: "Remove {x}? The bank will no longer see it.", ro: "Ștergi {x}? Banca nu îl va mai vedea.", ru: "Удалить {x}? Банк его больше не увидит.", uk: "Видалити {x}? Банк його більше не побачить." },
  if_type: { en: "{x}: this type of file is not taken. Use PDF, an image, Word, Excel, CSV, ZIP or KML.", ro: "{x}: acest tip de fișier nu este acceptat. Folosește PDF, imagine, Word, Excel, CSV, ZIP sau KML.", ru: "{x}: такой тип файла не принимается. Используйте PDF, изображение, Word, Excel, CSV, ZIP или KML.", uk: "{x}: такий тип файлу не приймається. Використовуйте PDF, зображення, Word, Excel, CSV, ZIP або KML." },
  if_size: { en: "{x} is larger than 50 MB.", ro: "{x} are peste 50 MB.", ru: "{x} больше 50 МБ.", uk: "{x} більший за 50 МБ." },
  if_empty: { en: "{x} is empty.", ro: "{x} este gol.", ru: "{x} пустой.", uk: "{x} порожній." },
  if_asked: { en: "{who}, {date}", ro: "{who}, {date}", ru: "{who}, {date}", uk: "{who}, {date}" },
  if_answer_ph: { en: "Your answer", ro: "Răspunsul tău", ru: "Ваш ответ", uk: "Ваша відповідь" },
  if_answer: { en: "Send the answer", ro: "Trimite răspunsul", ru: "Отправить ответ", uk: "Надіслати відповідь" },
  if_answered: { en: "Answered on {date}", ro: "Răspuns trimis pe {date}", ru: "Ответ от {date}", uk: "Відповідь від {date}" },
  if_attach: { en: "With a document", ro: "Cu un document", ru: "С документом", uk: "З документом" },
  if_attach_none: { en: "No document", ro: "Fără document", ru: "Без документа", uk: "Без документа" },
  if_edit: { en: "Change the answer", ro: "Schimbă răspunsul", ru: "Изменить ответ", uk: "Змінити відповідь" },
};

const BANK = {
  b_kicker: { en: "Deal room", ro: "Cameră de date", ru: "Комната данных", uk: "Кімната даних" },
  b_shared: {
    en: "{co} shares this plant with {bank}. Read-only, open until {date}.",
    ro: "{co} pune această centrală la dispoziția {bank}. Doar pentru citire, disponibil până la {date}.",
    ru: "{co} предоставляет эту станцию для {bank}. Только для чтения, доступно до {date}.",
    uk: "{co} надає цю станцію для {bank}. Лише для читання, доступно до {date}.",
  },
  b_nav_docs: { en: "Documents and questions", ro: "Documente și întrebări", ru: "Документы и вопросы", uk: "Документи та питання" },
  b_nav_summary: { en: "Credit summary", ro: "Rezumatul de credit", ru: "Кредитное резюме", uk: "Кредитне резюме" },
  b_pack: { en: "Download the full pack (ZIP)", ro: "Descărcați pachetul complet (ZIP)", ru: "Скачать полный пакет (ZIP)", uk: "Завантажити повний пакет (ZIP)" },
  b_pack_p: {
    en: "The credit summary in Romanian and English, the Excel model with live formulas, the checklist and every document on file, one folder per item. Building it takes up to a minute.",
    ro: "Rezumatul de credit în română și engleză, modelul Excel cu formule active, lista și toate documentele depuse, câte un dosar pentru fiecare element. Generarea durează până la un minut.",
    ru: "Кредитное резюме на румынском и английском, Excel-модель с живыми формулами, перечень и все документы, по папке на пункт. Сборка занимает до минуты.",
    uk: "Кредитне резюме румунською та англійською, Excel-модель з живими формулами, перелік і всі документи, по теці на пункт. Збирання триває до хвилини.",
  },
  b_docs_h: { en: "Documents by checklist item", ro: "Documente pe elementele listei", ru: "Документы по пунктам перечня", uk: "Документи за пунктами переліку" },
  b_docs_p: {
    en: "Each item of the permit checklist with its status and the documents on file. Ask a question on the item it concerns; the answer appears here.",
    ro: "Fiecare element din lista autorizațiilor, cu stadiul și documentele depuse. Puneți o întrebare la elementul la care se referă; răspunsul apare aici.",
    ru: "Каждый пункт перечня разрешений со статусом и приложенными документами. Задайте вопрос к нужному пункту; ответ появится здесь.",
    uk: "Кожен пункт переліку дозволів зі статусом і доданими документами. Поставте питання до потрібного пункту; відповідь з'явиться тут.",
  },
  b_no_docs: { en: "No document on file.", ro: "Niciun document depus.", ru: "Документов нет.", uk: "Документів немає." },
  b_ask: { en: "Ask a question", ro: "Puneți o întrebare", ru: "Задать вопрос", uk: "Поставити питання" },
  b_ask_name: { en: "Your name (optional)", ro: "Numele dumneavoastră (opțional)", ru: "Ваше имя (необязательно)", uk: "Ваше ім'я (необов'язково)" },
  b_ask_body: { en: "Question", ro: "Întrebarea", ru: "Вопрос", uk: "Питання" },
  b_ask_send: { en: "Send the question", ro: "Trimiteți întrebarea", ru: "Отправить вопрос", uk: "Надіслати питання" },
  b_ask_cancel: { en: "Cancel", ro: "Renunțați", ru: "Отмена", uk: "Скасувати" },
  b_ask_sent: { en: "Sent. The answer will appear on this page.", ro: "Trimisă. Răspunsul va apărea pe această pagină.", ru: "Отправлено. Ответ появится на этой странице.", uk: "Надіслано. Відповідь з'явиться на цій сторінці." },
  b_ask_err: { en: "The question could not be sent. Please try again in a minute.", ro: "Întrebarea nu a putut fi trimisă. Vă rugăm să încercați din nou peste un minut.", ru: "Не удалось отправить вопрос. Попробуйте ещё раз через минуту.", uk: "Не вдалося надіслати питання. Спробуйте ще раз за хвилину." },
  b_answer: { en: "Answer", ro: "Răspuns", ru: "Ответ", uk: "Відповідь" },
  b_waiting: { en: "Waiting for an answer", ro: "În așteptarea răspunsului", ru: "Ожидает ответа", uk: "Очікує на відповідь" },
  b_asked: { en: "Question of {date}", ro: "Întrebarea din {date}", ru: "Вопрос от {date}", uk: "Питання від {date}" },
  b_answer_doc: { en: "Document: {x}", ro: "Document: {x}", ru: "Документ: {x}", uk: "Документ: {x}" },
  b_closed_h: { en: "This link is no longer open", ro: "Acest link nu mai este disponibil", ru: "Эта ссылка больше не действует", uk: "Це посилання більше не діє" },
  b_closed_p: {
    en: "The link has expired or was closed by the developer. Please ask them for a new one.",
    ro: "Linkul a expirat sau a fost închis de dezvoltator. Vă rugăm să îi solicitați unul nou.",
    ru: "Срок ссылки истёк, или девелопер её закрыл. Попросите новую.",
    uk: "Строк посилання минув, або девелопер його закрив. Попросіть нове.",
  },
  b_note: {
    en: "Prepared with VoltMira from the developer's data. It is not a credit decision.",
    ro: "Pregătit cu VoltMira din datele dezvoltatorului. Nu reprezintă o decizie de credit.",
    ru: "Подготовлено в VoltMira по данным девелопера. Не является кредитным решением.",
    uk: "Підготовлено у VoltMira за даними девелопера. Не є кредитним рішенням.",
  },
  b_lang: { en: "Language", ro: "Limba", ru: "Язык", uk: "Мова" },
  b_status: { en: "Status", ro: "Stadiu", ru: "Статус", uk: "Статус" },
};

export const DT = { ...APP, ...BANK };
export const DT_APP = APP;
export const DT_BANK = BANK;

export function dt(key, lang = "en", vars = null) {
  const e = (vars && Number(vars.n) === 1 && DT[key + "_one"]) || DT[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
