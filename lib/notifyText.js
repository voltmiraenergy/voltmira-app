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
