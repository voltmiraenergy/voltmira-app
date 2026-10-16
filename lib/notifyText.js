// lib/notifyText.js — the words of the alerts VoltMira emails an installer
// (lib/email.js ownerAlertEmail), in the installer's language. Module-local
// like lib/creditsText.js; lib/notifyText.test.js holds it to the same rules
// (four languages, the same placeholders, no dashes, middle dots or check
// marks). Installer copy says "tu" in Romanian.
//
// nt(key, lang, { x: "…" }) fills {x}.

const T = {
  // ---- a client asked for a call from the offer page
  call_subject: { en: "{client} asked you to call", ro: "{client} îți cere să-l suni", ru: "{client} просит вас перезвонить", uk: "{client} просить вас передзвонити" },
  call_kicker: { en: "Call request", ro: "Cerere de apel", ru: "Запрос звонка", uk: "Запит дзвінка" },
  call_heading: { en: "{client} wants a call about {title}", ro: "{client} vrea un apel despre {title}", ru: "{client} ждёт звонка по {title}", uk: "{client} чекає дзвінка щодо {title}" },
  call_phone: { en: "Phone", ro: "Telefon", ru: "Телефон", uk: "Телефон" },
  call_when: { en: "Best time", ro: "Când e potrivit", ru: "Удобное время", uk: "Зручний час" },
  call_lead: {
    en: "They are reading the offer and want to talk. The request is also in Leads, marked hot.",
    ro: "Citește oferta și vrea să discute. Cererea e și în Contacte, marcată ca fierbinte.",
    ru: "Клиент читает КП и хочет поговорить. Запрос также есть в контактах с пометкой «горячий».",
    uk: "Клієнт читає пропозицію і хоче поговорити. Запит також є в контактах із позначкою «гарячий».",
  },
  call_cta: { en: "Open the quote", ro: "Deschide oferta", ru: "Открыть КП", uk: "Відкрити пропозицію" },
  when_any: { en: "Any time", ro: "Oricând", ru: "В любое время", uk: "Будь-коли" },
  when_morning: { en: "Morning", ro: "Dimineața", ru: "Утром", uk: "Зранку" },
  when_afternoon: { en: "Afternoon", ro: "După-amiaza", ru: "Днём", uk: "Удень" },
  when_evening: { en: "Evening", ro: "Seara", ru: "Вечером", uk: "Увечері" },
  no_phone: { en: "Not given: call the number on the quote", ro: "Nu a lăsat: sună la numărul din ofertă", ru: "Не указан: звоните по номеру из КП", uk: "Не вказано: телефонуйте за номером із пропозиції" },
  // ---- a client accepted the offer online
  acc_subject: { en: "{client} accepted your offer", ro: "{client} a acceptat oferta", ru: "{client} принял ваше КП", uk: "{client} прийняв вашу пропозицію" },
  acc_kicker: { en: "Offer accepted", ro: "Ofertă acceptată", ru: "КП принято", uk: "Пропозицію прийнято" },
  acc_heading: { en: "{client} accepted {title}", ro: "{client} a acceptat {title}", ru: "{client} принял {title}", uk: "{client} прийняв {title}" },
  acc_signer: { en: "Signed by", ro: "Semnat de", ru: "Подписал", uk: "Підписав" },
  acc_when: { en: "Signed", ro: "Semnat", ru: "Подписано", uk: "Підписано" },
  acc_discount: { en: "Discount agreed", ro: "Reducere convenită", ru: "Согласованная скидка", uk: "Погоджена знижка" },
  acc_lead: {
    en: "The quote is marked won. Next: the deposit invoice, then the grid file.",
    ro: "Oferta e marcată câștigată. Urmează: factura de avans, apoi dosarul de racordare.",
    ru: "КП отмечено как выигранное. Дальше: счёт на аванс, затем документы на подключение.",
    uk: "Пропозицію позначено як виграну. Далі: рахунок на аванс, потім документи на приєднання.",
  },
  acc_cta: { en: "Open the quote", ro: "Deschide oferta", ru: "Открыть КП", uk: "Відкрити пропозицію" },

  // ---- commissioned systems with no production reading for 30 days
  rd_subject: { en: "{n} systems have had no reading for 30 days", ro: "{n} sisteme nu au nicio citire de 30 de zile", ru: "{n} систем без показаний 30 дней", uk: "{n} систем без показників 30 днів" },
  rd_subject_1: { en: "A system has had no reading for 30 days", ro: "Un sistem nu are nicio citire de 30 de zile", ru: "Система без показаний 30 дней", uk: "Система без показників 30 днів" },
  rd_kicker: { en: "Monitoring", ro: "Monitorizare", ru: "Мониторинг", uk: "Моніторинг" },
  rd_heading: { en: "{n} systems with no production reading for 30 days", ro: "{n} sisteme fără nicio citire de producție de 30 de zile", ru: "{n} систем без показаний выработки 30 дней", uk: "{n} систем без показників генерації 30 днів" },
  rd_heading_1: { en: "A system with no production reading for 30 days", ro: "Un sistem fără nicio citire de producție de 30 de zile", ru: "Система без показаний выработки 30 дней", uk: "Система без показників генерації 30 днів" },
  rd_last: { en: "last reading {date}", ro: "ultima citire {date}", ru: "последнее показание {date}", uk: "останній показник {date}" },
  rd_none: { en: "none since commissioning, {date}", ro: "niciuna de la punerea în funcțiune, {date}", ru: "ни одного с ввода, {date}", uk: "жодного з введення, {date}" },
  rd_lead: {
    en: "A fault would go unnoticed, and the client would find it first. Enter this month's reading on each, or connect its inverter portal.",
    ro: "O defecțiune ar trece neobservată, iar clientul ar afla primul. Introdu citirea lunii la fiecare sau conectează portalul invertorului.",
    ru: "Неисправность останется незамеченной, и клиент узнает о ней первым. Введите показание за месяц для каждой или подключите портал инвертора.",
    uk: "Несправність залишиться непоміченою, і клієнт дізнається про неї першим. Введіть показник за місяць для кожної або підключіть портал інвертора.",
  },
  rd_more: { en: "And {n} more in the app.", ro: "Și încă {n} în aplicație.", ru: "И ещё {n} в приложении.", uk: "І ще {n} у застосунку." },
  rd_cta: { en: "Open the won quotes", ro: "Deschide ofertele câștigate", ru: "Открыть выигранные КП", uk: "Відкрити виграні пропозиції" },

  // ---- the morning "offers opened" email
  od_subject: { en: "{n} offers were read yesterday", ro: "{n} oferte au fost citite ieri", ru: "Вчера прочитали КП: {n}", uk: "Учора прочитали пропозицій: {n}" },
  od_subject_1: { en: "An offer was read yesterday", ro: "O ofertă a fost citită ieri", ru: "Вчера прочитали КП", uk: "Учора прочитали пропозицію" },
  od_kicker: { en: "Offers opened", ro: "Oferte deschise", ru: "Открытые КП", uk: "Відкриті пропозиції" },
  od_heading: { en: "{n} offers read in the last day", ro: "{n} oferte citite în ultima zi", ru: "КП, прочитанных за сутки: {n}", uk: "Пропозицій, прочитаних за добу: {n}" },
  od_heading_1: { en: "An offer read in the last day", ro: "O ofertă citită în ultima zi", ru: "КП, прочитанное за сутки", uk: "Пропозиція, прочитана за добу" },
  od_row: { en: "{n}x, last {when}", ro: "de {n} ori, ultima {when}", ru: "{n} раз, последний {when}", uk: "{n} раз, останній {when}" },
  od_open: { en: "Open the quote", ro: "Deschide oferta", ru: "Открыть КП", uk: "Відкрити пропозицію" },
  od_lead: {
    en: "An offer read three times or more is the time to call. You chose one email a morning in Settings, Notifications.",
    ro: "O ofertă citită de trei ori sau mai mult înseamnă că e momentul să suni. Ai ales un singur email dimineața, din Setări, Notificări.",
    ru: "КП, прочитанное три раза и больше, значит пора звонить. Вы выбрали одно письмо утром в настройках уведомлений.",
    uk: "Пропозиція, прочитана три рази й більше, означає, що час дзвонити. Ви обрали один лист уранці в налаштуваннях сповіщень.",
  },
  od_cta: { en: "Open the hot quotes", ro: "Deschide ofertele fierbinți", ru: "Открыть горячие КП", uk: "Відкрити гарячі пропозиції" },
  rd_enter: { en: "Enter the reading", ro: "Introdu citirea", ru: "Ввести показание", uk: "Ввести показник" },
  rd_snooze: { en: "Checked, remind me in 30 days", ro: "Verificat, amintește-mi peste 30 de zile", ru: "Проверено, напомнить через 30 дней", uk: "Перевірено, нагадати через 30 днів" },
  rk_title: { en: "Reading reminder", ro: "Memento pentru citire", ru: "Напоминание о показании", uk: "Нагадування про показник" },
  rk_ask: { en: "Checked this system yourself? No reading reminder for it for {n} days.", ro: "Ai verificat sistemul? Nu mai primești memento pentru el {n} zile.", ru: "Проверили систему? Напоминаний по ней не будет {n} дней.", uk: "Перевірили систему? Нагадувань щодо неї не буде {n} днів." },
  rk_btn: { en: "Checked, remind me in 30 days", ro: "Verificat, amintește-mi peste 30 de zile", ru: "Проверено, напомнить через 30 дней", uk: "Перевірено, нагадати через 30 днів" },
  rk_done: { en: "Done: no reminder for this system until {date}.", ro: "Gata: niciun memento pentru acest sistem până la {date}.", ru: "Готово: напоминаний по системе не будет до {date}.", uk: "Готово: нагадувань щодо системи не буде до {date}." },
  rk_fail: { en: "It could not be saved. Open the quote in VoltMira.", ro: "Nu s-a putut salva. Deschide oferta în VoltMira.", ru: "Не удалось сохранить. Откройте КП в VoltMira.", uk: "Не вдалося зберегти. Відкрийте пропозицію у VoltMira." },

  // ---- a test sent from Settings, Notifications
  test_kicker: { en: "Test email", ro: "E-mail de test", ru: "Тестовое письмо", uk: "Тестовий лист" },
  test_lead: {
    en: "This is a test from Settings, with sample figures: nothing really happened.",
    ro: "Acesta e un test din Setări, cu cifre de exemplu: nu s-a întâmplat nimic real.",
    ru: "Это тест из настроек с примерными цифрами: ничего на самом деле не произошло.",
    uk: "Це тест із налаштувань із прикладними цифрами: нічого насправді не сталося.",
  },
  test_client: { en: "Ion Popescu (sample)", ro: "Ion Popescu (exemplu)", ru: "Ион Попеску (пример)", uk: "Іон Попеску (приклад)" },
  test_title: { en: "Casa Popescu, 6 kW (sample)", ro: "Casa Popescu, 6 kW (exemplu)", ru: "Дом Попеску, 6 кВт (пример)", uk: "Будинок Попеску, 6 кВт (приклад)" },

  foot: {
    en: "You get this because you use VoltMira. Choose which emails you get in Settings, Notifications.",
    ro: "Primești asta pentru că folosești VoltMira. Alegi ce e-mailuri primești din Setări, Notificări.",
    ru: "Вы получили это, потому что пользуетесь VoltMira. Выберите письма в разделе «Настройки», «Уведомления».",
    uk: "Ви отримали це, бо користуєтеся VoltMira. Оберіть листи в розділі «Налаштування», «Сповіщення».",
  },
};

export const NT = T;

export function nt(key, lang = "en", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** The best-time choices a client may pick when asking for a call. */
export const CALL_TIMES = ["any", "morning", "afternoon", "evening"];
