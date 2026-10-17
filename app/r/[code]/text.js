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
  eyebrow: { en: "A client's recommendation", ro: "Recomandarea unui client", ru: "Рекомендация клиента", uk: "Рекомендація клієнта" },
  proof_h: { en: "The system they installed", ro: "Sistemul instalat", ru: "Установленная система", uk: "Встановлена система" },
  proof_h_who: { en: "{who}'s system", ro: "Sistemul lui {who}", ru: "Система: {who}", uk: "Система: {who}" },
  k_kw: { en: "Power", ro: "Putere", ru: "Мощность", uk: "Потужність" },
  k_batt: { en: "Battery", ro: "Baterie", ru: "Батарея", uk: "Батарея" },
  k_where: { en: "Locality", ro: "Localitate", ru: "Населённый пункт", uk: "Населений пункт" },
  k_since: { en: "Working since", ro: "Funcționează din", ru: "Работает с", uk: "Працює з" },
  k_days: { en: "From signing to working", ro: "De la semnare la funcționare", ru: "От подписания до запуска", uk: "Від підписання до запуску" },
  k_days_v: { en: "{d} days", ro: "{d} zile", ru: "{d} дн.", uk: "{d} дн." },
  k_prod: { en: "Produced, last {n} months", ro: "Produs, ultimele {n} luni", ru: "Выработано, месяцев: {n}", uk: "Вироблено, місяців: {n}" },
  k_pct: { en: "Against the offer's forecast", ro: "Față de estimarea din ofertă", ru: "От прогноза в предложении", uk: "Від прогнозу в пропозиції" },
  k_state: { en: "Status", ro: "Stadiu", ru: "Статус", uk: "Статус" },
  k_state_v: { en: "Being installed", ro: "În curs de instalare", ru: "Идёт установка", uk: "Триває установка" },
  next_h: { en: "What happens next", ro: "Ce urmează", ru: "Что дальше", uk: "Що далі" },
  next_1: { en: "{co} calls you and asks what you need.", ro: "{co} vă sună și află ce vă trebuie.", ru: "{co} позвонит и уточнит, что вам нужно.", uk: "{co} зателефонує й уточнить, що вам потрібно." },
  next_2: { en: "The system is sized from your bill, with a visit to your roof if it is needed.", ro: "Sistemul se calculează după factura dumneavoastră, cu o vizită la acoperiș dacă e nevoie.", ru: "Систему рассчитают по вашему счёту, при необходимости с выездом на крышу.", uk: "Систему розрахують за вашим рахунком, за потреби з виїздом на дах." },
  next_3: { en: "You get an offer online, with every calculation shown so you can check it.", ro: "Primiți o ofertă online, cu toate calculele, pe care le puteți verifica.", ru: "Вы получите предложение онлайн со всеми расчётами, которые можно проверить.", uk: "Ви отримаєте пропозицію онлайн з усіма розрахунками, які можна перевірити." },
  bill: { en: "Average monthly bill (optional)", ro: "Factura medie lunară (opțional)", ru: "Средний счёт в месяц (необязательно)", uk: "Середній рахунок на місяць (необов’язково)" },
  direct: { en: "Rather call? {name}", ro: "Preferați să sunați? {name}", ru: "Удобнее позвонить? {name}", uk: "Зручніше зателефонувати? {name}" },
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
