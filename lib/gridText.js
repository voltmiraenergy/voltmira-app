// lib/gridText.js — the words Phase 2 added to the grid connection (docs/features/phase2.md): the documents'
// age and the exception on the grid card, the client's language and text message, the overview at /grid and the
// admin's rules at /admin/grid. The installer is spoken to as "tu" in Romanian; the text messages go to the
// homeowner, so they say "dumneavoastră" (ru/uk "вы/ви"). lib/gridText.test.js holds every key to four languages,
// the same placeholders, no dash, middle dot or check mark, and each text message to one that fits 160 characters.
// gt(key, lang, { x }) fills {x}.

const T = {
  // ---- the grid card: documents that must be recent
  gs_issued: { en: "Issued on", ro: "Eliberat la", ru: "Выдан", uk: "Видано" },
  gs_age_missing: { en: "Write the date {doc} was issued: the operator takes it up to {max} days old.", ro: "Scrie data eliberării pentru {doc}: operatorul îl primește dacă are cel mult {max} zile.", ru: "Укажите дату выдачи документа «{doc}»: оператор принимает его не старше {max} дней.", uk: "Вкажіть дату видачі документа «{doc}»: оператор приймає його не старшим за {max} днів." },
  gs_age_expired: { en: "{doc} is {age} days old; the operator takes it up to {max} days. Get a new one.", ro: "{doc} are {age} zile; operatorul îl primește dacă are cel mult {max} zile. Cere unul nou.", ru: "Документу «{doc}» {age} дн.; оператор принимает его не старше {max} дней. Получите новый.", uk: "Документу «{doc}» {age} дн.; оператор приймає його не старшим за {max} днів. Отримайте новий." },
  gs_age_future: { en: "The date {doc} was issued is in the future.", ro: "Data eliberării pentru {doc} este în viitor.", ru: "Дата выдачи документа «{doc}» в будущем.", uk: "Дата видачі документа «{doc}» у майбутньому." },
  gs_age_note: { en: "Up to {max} days old", ro: "Cel mult {max} zile vechime", ru: "Не старше {max} дней", uk: "Не старше {max} днів" },

  // ---- the grid card: sending with an exception
  gs_ov_h: { en: "Send anyway, with a reason", ro: "Trimite oricum, cu motiv", ru: "Отправить всё равно, с причиной", uk: "Надіслати все одно, з причиною" },
  gs_ov_p: { en: "Not complete: {list}. Your reason stays with the file, in its history and in the audit log.", ro: "Incomplet: {list}. Motivul tău rămâne la dosar, în istoric și în jurnalul de audit.", ru: "Не готово: {list}. Ваша причина сохраняется в деле, в его истории и в журнале аудита.", uk: "Не готово: {list}. Ваша причина зберігається у справі, в її історії та в журналі аудиту." },
  gs_ov_reason: { en: "Why it goes anyway", ro: "De ce pleacă oricum", ru: "Почему отправляется всё равно", uk: "Чому надсилається все одно" },
  gs_ov_send: { en: "Send to {op} with an exception", ro: "Trimite la {op} cu excepție", ru: "Отправить в {op} с исключением", uk: "Надіслати до {op} з винятком" },
  gs_ov_only: { en: "The file is not complete. The owner or a manager can send it with a written reason.", ro: "Dosarul nu este complet. Proprietarul sau un manager îl poate trimite cu un motiv scris.", ru: "Дело не готово. Владелец или менеджер может отправить его с письменной причиной.", uk: "Справа не готова. Власник або менеджер може надіслати її з письмовою причиною." },
  gs_ov_hist: { en: "Sent with an exception: {r}", ro: "Trimis cu excepție: {r}", ru: "Отправлено с исключением: {r}", uk: "Надіслано з винятком: {r}" },
  gs_ov_age: { en: "{doc} too old or undated", ro: "{doc} prea vechi sau fără dată", ru: "«{doc}» устарел или без даты", uk: "«{doc}» застарів або без дати" },
  gs_ov_power: { en: "the power check", ro: "verificarea puterii", ru: "проверка мощности", uk: "перевірка потужності" },
  gs_e_override_not_allowed: { en: "Only the owner or a manager can send a file with an exception.", ro: "Doar proprietarul sau un manager poate trimite un dosar cu excepție.", ru: "Только владелец или менеджер может отправить дело с исключением.", uk: "Лише власник або менеджер може надіслати справу з винятком." },
  gs_e_override_reason: { en: "Write why it goes anyway, in at least 10 characters.", ro: "Scrie de ce pleacă oricum, în cel puțin 10 caractere.", ru: "Напишите, почему дело отправляется, не менее 10 символов.", uk: "Напишіть, чому справа надсилається, щонайменше 10 символів." },
  gs_overdue: { en: "{d} days in this step; usually up to {e}.", ro: "{d} zile în acest pas; de obicei până la {e}.", ru: "{d} дн. на этом шаге; обычно до {e}.", uk: "{d} дн. на цьому кроці; зазвичай до {e}." },

  // ---- the grid card: the client's language and the text message
  gs_lang: { en: "The client's language, for their messages", ro: "Limba clientului, pentru mesajele lui", ru: "Язык клиента для его сообщений", uk: "Мова клієнта для його повідомлень" },
  gs_lang_auto: { en: "As the workspace ({l})", ro: "Ca spațiul de lucru ({l})", ru: "Как в рабочем пространстве ({l})", uk: "Як у робочому просторі ({l})" },
  gs_sms_h: { en: "Text message for the client", ro: "Mesaj SMS pentru client", ru: "SMS для клиента", uk: "SMS для клієнта" },
  gs_sms_p: { en: "Ready for an SMS service. Until one is connected, copy it and send it from your phone.", ro: "Gata pentru un serviciu SMS. Până se conectează unul, copiază-l și trimite-l de pe telefon.", ru: "Готово для SMS-сервиса. Пока он не подключён, скопируйте и отправьте с телефона.", uk: "Готово для SMS-сервісу. Поки його не підключено, скопіюйте й надішліть з телефону." },
  gs_copy: { en: "Copy", ro: "Copiază", ru: "Копировать", uk: "Копіювати" },
  gs_copied: { en: "Copied", ro: "Copiat", ru: "Скопировано", uk: "Скопійовано" },
  lang_ro: { en: "Romanian", ro: "română", ru: "румынский", uk: "румунська" },
  lang_ru: { en: "Russian", ro: "rusă", ru: "русский", uk: "російська" },
  lang_en: { en: "English", ro: "engleză", ru: "английский", uk: "англійська" },
  lang_uk: { en: "Ukrainian", ro: "ucraineană", ru: "украинский", uk: "українська" },

  // ---- the text message the client gets at each step (homeowner, formal; <= 160 characters filled)
  sms_submitted: { en: "{company}: your connection file went to {op}, ref. {ref}. We will keep you posted.", ro: "{company}: dosarul de racordare a fost depus la {op}, ref. {ref}. Vă ținem la curent.", ru: "{company}: ваше дело о подключении подано в {op}, номер {ref}. Будем держать вас в курсе.", uk: "{company}: вашу справу про приєднання подано до {op}, номер {ref}. Будемо тримати вас у курсі." },
  sms_docs_requested: { en: "{company}: {op} asked for more documents for your connection. We will call you if we need anything.", ro: "{company}: {op} a cerut documente suplimentare pentru racordare. Vă sunăm dacă avem nevoie de ceva.", ru: "{company}: {op} запросил дополнительные документы. Позвоним вам, если что-то понадобится.", uk: "{company}: {op} запитав додаткові документи. Зателефонуємо вам, якщо щось знадобиться." },
  sms_approved: { en: "{company}: {op} approved your connection, ref. {ref}. The installation comes next.", ro: "{company}: {op} a aprobat racordarea, ref. {ref}. Urmează montajul.", ru: "{company}: {op} одобрил подключение, номер {ref}. Далее монтаж.", uk: "{company}: {op} схвалив приєднання, номер {ref}. Далі монтаж." },
  sms_meter_installed: { en: "{company}: {op} fitted your two-way meter. The connection comes next.", ro: "{company}: {op} a montat contorul bidirecțional. Urmează racordarea.", ru: "{company}: {op} установил двунаправленный счётчик. Далее подключение.", uk: "{company}: {op} встановив двонапрямлений лічильник. Далі приєднання." },
  sms_connected: { en: "{company}: your solar system is connected to the grid and producing.", ro: "{company}: sistemul dumneavoastră solar este racordat la rețea și produce.", ru: "{company}: ваша солнечная система подключена к сети и вырабатывает энергию.", uk: "{company}: вашу сонячну систему приєднано до мережі, вона виробляє енергію." },
  sms_rejected: { en: "{company}: {op} turned down the connection file. We will call you about the next steps.", ro: "{company}: {op} a respins dosarul de racordare. Vă sunăm pentru pașii următori.", ru: "{company}: {op} отклонил дело о подключении. Позвоним вам насчёт дальнейших шагов.", uk: "{company}: {op} відхилив справу про приєднання. Зателефонуємо щодо наступних кроків." },

  // ---- the overview, /grid
  go_title: { en: "Grid connections", ro: "Racordări", ru: "Подключения к сети", uk: "Приєднання до мережі" },
  go_sub: { en: "Every file sent to an operator: where it stands, how long it has waited, and what is overdue.", ro: "Fiecare dosar trimis la operator: unde a ajuns, cât a așteptat și ce a întârziat.", ru: "Каждое дело, отправленное оператору: где оно, сколько ждёт и что просрочено.", uk: "Кожна справа, надіслана оператору: де вона, скільки чекає і що прострочено." },
  go_open: { en: "Open files", ro: "Dosare deschise", ru: "Открытые дела", uk: "Відкриті справи" },
  go_overdue: { en: "Overdue", ro: "Întârziate", ru: "Просрочены", uk: "Прострочені" },
  go_avg: { en: "Signed offer to connection", ro: "De la oferta semnată la racordare", ru: "От подписания до подключения", uk: "Від підписання до приєднання" },
  go_avg_v: { en: "{d} days", ro: "{d} zile", ru: "{d} дн.", uk: "{d} дн." },
  go_avg_n: { en: "average of {n} files connected in the last 12 months", ro: "media a {n} dosare racordate în ultimele 12 luni", ru: "в среднем по {n} делам за последние 12 месяцев", uk: "у середньому за {n} справами за останні 12 місяців" },
  go_avg_none: { en: "No file connected in the last 12 months yet", ro: "Niciun dosar racordat în ultimele 12 luni", ru: "За последние 12 месяцев подключений пока нет", uk: "За останні 12 місяців приєднань ще немає" },
  go_all: { en: "All open", ro: "Toate deschise", ru: "Все открытые", uk: "Усі відкриті" },
  go_only_overdue: { en: "Overdue only", ro: "Doar întârziate", ru: "Только просроченные", uk: "Лише прострочені" },
  go_col_client: { en: "Client", ro: "Client", ru: "Клиент", uk: "Клієнт" },
  go_col_op: { en: "Operator", ro: "Operator", ru: "Оператор", uk: "Оператор" },
  go_col_status: { en: "Step", ro: "Pas", ru: "Шаг", uk: "Крок" },
  go_col_days: { en: "Days in this step", ro: "Zile în acest pas", ru: "Дней на шаге", uk: "Днів на кроці" },
  go_col_ref: { en: "Reference", ro: "Referință", ru: "Номер", uk: "Номер" },
  go_days: { en: "{d} of {e}", ro: "{d} din {e}", ru: "{d} из {e}", uk: "{d} з {e}" },
  go_late: { en: "{n} days late", ro: "{n} zile întârziere", ru: "просрочено на {n} дн.", uk: "прострочено на {n} дн." },
  go_closed_h: { en: "Closed in the last 90 days", ro: "Închise în ultimele 90 de zile", ru: "Закрыты за последние 90 дней", uk: "Закриті за останні 90 днів" },
  go_empty: { en: "No file has been sent to an operator yet. Send one from the grid card on a quote.", ro: "Niciun dosar nu a fost trimis încă la operator. Trimite unul din cardul de racordare al unei oferte.", ru: "Ни одно дело ещё не отправлено оператору. Отправьте его из карточки подключения в расчёте.", uk: "Жодну справу ще не надіслано оператору. Надішліть її з картки приєднання в розрахунку." },
  go_none_overdue: { en: "Nothing is overdue.", ro: "Nimic nu a întârziat.", ru: "Просроченных нет.", uk: "Прострочених немає." },
  go_rules: { en: "The usual days per step are working rules VoltMira keeps for each operator, not legal deadlines.", ro: "Zilele obișnuite pe pas sunt reguli de lucru pe care VoltMira le ține pentru fiecare operator, nu termene legale.", ru: "Обычные сроки по шагам: это рабочие правила VoltMira для каждого оператора, а не юридические сроки.", uk: "Звичайні терміни за кроками є робочими правилами VoltMira для кожного оператора, а не юридичними строками." },
  go_open_quote: { en: "Open the quote", ro: "Deschide oferta", ru: "Открыть расчёт", uk: "Відкрити розрахунок" },
  go_exception: { en: "sent with an exception", ro: "trimis cu excepție", ru: "отправлено с исключением", uk: "надіслано з винятком" },

  // ---- the admin's rules, /admin/grid
  gr_sub: { en: "What each operator asks for with a connection file, and how long a file usually waits in each step. A change is published as a new version; earlier versions stay.", ro: "Ce cere fiecare operator la dosarul de racordare și cât așteaptă de obicei un dosar în fiecare pas. O schimbare se publică drept versiune nouă; versiunile vechi rămân.", ru: "Что каждый оператор требует для дела о подключении и сколько дело обычно ждёт на каждом шаге. Изменение публикуется новой версией; прежние версии сохраняются.", uk: "Що кожен оператор вимагає для справи про приєднання і скільки справа зазвичай чекає на кожному кроці. Зміна публікується новою версією; попередні версії зберігаються." },
  gr_needs_db: { en: "These are the rules from code. Run supabase/add-grid-connection.sql in Supabase to publish new versions.", ro: "Acestea sunt regulile din cod. Rulează supabase/add-grid-connection.sql în Supabase ca să publici versiuni noi.", ru: "Это правила из кода. Выполните supabase/add-grid-connection.sql в Supabase, чтобы публиковать новые версии.", uk: "Це правила з коду. Виконайте supabase/add-grid-connection.sql у Supabase, щоб публікувати нові версії." },
  gr_in_force: { en: "In force: version {v}", ro: "În vigoare: versiunea {v}", ru: "Действует: версия {v}", uk: "Чинна: версія {v}" },
  gr_docs_person: { en: "Documents when a person applies", ro: "Documente când depune o persoană fizică", ru: "Документы, когда подаёт физлицо", uk: "Документи, коли подає фізична особа" },
  gr_docs_company: { en: "Documents when a company applies", ro: "Documente când depune o persoană juridică", ru: "Документы, когда подаёт юрлицо", uk: "Документи, коли подає юридична особа" },
  gr_auto: { en: "always: VoltMira fills it", ro: "mereu: îl completează VoltMira", ru: "всегда: заполняет VoltMira", uk: "завжди: заповнює VoltMira" },
  gr_age_h: { en: "How recent a document must be", ro: "Cât de recent trebuie să fie un document", ru: "Насколько свежим должен быть документ", uk: "Наскільки свіжим має бути документ" },
  gr_age_p: { en: "Days old at most on the day the file is sent. Empty: any age.", ro: "Câte zile poate avea cel mult în ziua trimiterii. Gol: orice vechime.", ru: "Не старше стольких дней в день отправки. Пусто: любой давности.", uk: "Не старше стількох днів у день надсилання. Порожньо: будь-якої давності." },
  gr_exp_h: { en: "Usual days in each step", ro: "Zile obișnuite în fiecare pas", ru: "Обычные дни на каждом шаге", uk: "Звичайні дні на кожному кроці" },
  gr_exp_p: { en: "After this many days the overview marks a file overdue. Working rules, not legal deadlines.", ro: "După atâtea zile, prezentarea marchează dosarul ca întârziat. Reguli de lucru, nu termene legale.", ru: "После стольких дней обзор отмечает дело просроченным. Рабочие правила, не юридические сроки.", uk: "Після стількох днів огляд позначає справу простроченою. Робочі правила, не юридичні строки." },
  gr_custom_h: { en: "A document of the operator's own", ro: "Un document cerut de operator", ru: "Собственный документ оператора", uk: "Власний документ оператора" },
  gr_custom_p: { en: "A short id (letters and _), its name in four languages, then tick it in the lists above.", ro: "Un cod scurt (litere și _), numele în patru limbi, apoi bifează-l în listele de mai sus.", ru: "Короткий код (буквы и _), название на четырёх языках, затем отметьте его в списках выше.", uk: "Короткий код (літери та _), назва чотирма мовами, потім позначте його в списках вище." },
  gr_custom_id: { en: "Id", ro: "Cod", ru: "Код", uk: "Код" },
  gr_custom_add: { en: "Add the document", ro: "Adaugă documentul", ru: "Добавить документ", uk: "Додати документ" },
  gr_custom_remove: { en: "Remove", ro: "Elimină", ru: "Убрать", uk: "Прибрати" },
  gr_optional: { en: "Optional", ro: "Opțional", ru: "Необязательно", uk: "Необов’язково" },
  gr_note: { en: "What changed and why (for the history)", ro: "Ce s-a schimbat și de ce (pentru istoric)", ru: "Что изменилось и почему (для истории)", uk: "Що змінилося і чому (для історії)" },
  gr_publish: { en: "Publish version {v}", ro: "Publică versiunea {v}", ru: "Опубликовать версию {v}", uk: "Опублікувати версію {v}" },
  gr_published: { en: "Version {v} published. Files sent from now on are checked against it.", ro: "Versiunea {v} a fost publicată. Dosarele trimise de acum se verifică după ea.", ru: "Версия {v} опубликована. Дела, отправленные с этого момента, проверяются по ней.", uk: "Версію {v} опубліковано. Справи, надіслані відтепер, перевіряються за нею." },
  gr_versions: { en: "Versions", ro: "Versiuni", ru: "Версии", uk: "Версії" },
  gr_by: { en: "{v}, {d}, by {who}", ro: "{v}, {d}, de {who}", ru: "{v}, {d}, автор {who}", uk: "{v}, {d}, автор {who}" },
};

export const GT = T;

export function gt(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.ro) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** The text message a client gets for a step, or "" for one that has none. */
export function gridSmsText(status, lang, { company = "", op = "", ref = "" } = {}) {
  return T["sms_" + status] ? gt("sms_" + status, lang, { company, op, ref }) : "";
}
