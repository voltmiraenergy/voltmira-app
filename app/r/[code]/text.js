// app/r/[code]/text.js — the words of a recommendation page and its form, in
// four languages, in the formal register the offer page uses (a homeowner
// reads it). rt(key, lang, { co: "..." }) fills {co}.

const T = {
  title: { en: "A recommendation for {co}", ro: "O recomandare pentru {co}", ru: "Рекомендация: {co}", uk: "Рекомендація: {co}" },
  h: { en: "{co} comes recommended", ro: "{co} vine recomandat", ru: "{co} вам рекомендуют", uk: "{co} вам рекомендують" },
  h_who: { en: "{who} recommends {co}", ro: "{who} vă recomandă {co}", ru: "{who} рекомендует {co}", uk: "{who} рекомендує {co}" },
  lead: { en: "{co} installed a {kw} kW solar system for them.", ro: "{co} le-a instalat un sistem solar de {kw} kW.", ru: "{co} установили им солнечную систему на {kw} кВт.", uk: "{co} встановили їм сонячну систему на {kw} кВт." },
  lead_where: { en: "{co} installed a {kw} kW solar system for them in {where}.", ro: "{co} le-a instalat un sistem solar de {kw} kW, în {where}.", ru: "{co} установили им солнечную систему на {kw} кВт в {where}.", uk: "{co} встановили їм сонячну систему на {kw} кВт у {where}." },
  produced: { en: "It has produced {kwh} kWh in the last {n} months with a reading.", ro: "A produs {kwh} kWh în ultimele {n} luni cu citire.", ru: "Она выработала {kwh} кВт·ч за последние месяцы с показаниями: {n}.", uk: "Вона виробила {kwh} кВт·год за останні місяці з показниками: {n}." },
  form_h: { en: "Would you like an offer too?", ro: "Doriți și dumneavoastră o ofertă?", ru: "Хотите тоже получить предложение?", uk: "Бажаєте теж отримати пропозицію?" },
  form_p: { en: "Leave your name and phone: {co} calls you, free and with no obligation.", ro: "Lăsați numele și telefonul: {co} vă sună, gratuit și fără obligații.", ru: "Оставьте имя и телефон: {co} перезвонит, бесплатно и без обязательств.", uk: "Залиште ім’я та телефон: {co} передзвонить, безкоштовно й без зобов’язань." },
  name: { en: "Your name", ro: "Numele dumneavoastră", ru: "Ваше имя", uk: "Ваше ім’я" },
  phone: { en: "Phone", ro: "Telefon", ru: "Телефон", uk: "Телефон" },
  place: { en: "Locality (optional)", ro: "Localitatea (opțional)", ru: "Населённый пункт (необязательно)", uk: "Населений пункт (необов’язково)" },
  send: { en: "Ask for a call", ro: "Cereți un apel", ru: "Заказать звонок", uk: "Замовити дзвінок" },
  sending: { en: "Sending...", ro: "Se trimite...", ru: "Отправляем...", uk: "Надсилаємо..." },
  sent: { en: "Thank you. {co} will call you soon.", ro: "Vă mulțumim. {co} vă va suna în curând.", ru: "Спасибо. {co} скоро вам перезвонит.", uk: "Дякуємо. {co} скоро вам передзвонить." },
  failed: { en: "It could not be sent. Please check the phone and try again.", ro: "Nu s-a putut trimite. Verificați telefonul și încercați din nou.", ru: "Не удалось отправить. Проверьте телефон и попробуйте снова.", uk: "Не вдалося надіслати. Перевірте телефон і спробуйте ще раз." },
  fine: { en: "Your name and phone go only to {co}, to call you about this.", ro: "Numele și telefonul ajung doar la {co}, ca să vă sune în legătură cu aceasta.", ru: "Имя и телефон получит только {co}, чтобы перезвонить по этому вопросу.", uk: "Ім’я та телефон отримає лише {co}, щоб передзвонити з цього питання." },
};

export const RT = T;

export function rt(key, lang = "en", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
