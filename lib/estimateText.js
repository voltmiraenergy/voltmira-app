// lib/estimateText.js — the words of the installer's public estimate page (/estimate/[slug]), in the visitor's
// language. A homeowner reads them, so Romanian is formal ("dumneavoastră") and Russian and Ukrainian use
// "вы/ви". lib/estimateText.test.js holds them to four languages, the same placeholders, and no dashes, middle
// dots or check marks. et(key, lang, { x: "…" }) fills {x}.

const T = {
  title: { en: "How much could you save with solar?", ro: "Cât puteți economisi cu panouri solare?", ru: "Сколько вы можете сэкономить с солнечными панелями?", uk: "Скільки ви можете заощадити із сонячними панелями?" },
  sub: {
    en: "Enter your address and your monthly bill. The estimate uses real sun data for your roof.",
    ro: "Introduceți adresa și factura lunară. Calculul folosește date reale despre soare pentru acoperișul dumneavoastră.",
    ru: "Укажите адрес и месячный счёт. Расчёт использует реальные данные о солнце для вашей крыши.",
    uk: "Вкажіть адресу й місячний рахунок. Розрахунок використовує реальні дані про сонце для вашого даху.",
  },
  addr: { en: "Address", ro: "Adresa", ru: "Адрес", uk: "Адреса" },
  addr_ph: { en: "Street, number, town", ro: "Strada, numărul, localitatea", ru: "Улица, номер, населённый пункт", uk: "Вулиця, номер, населений пункт" },
  by: { en: "I know my", ro: "Știu", ru: "Я знаю", uk: "Я знаю" },
  by_bill: { en: "monthly bill", ro: "factura lunară", ru: "счёт в месяц", uk: "рахунок на місяць" },
  by_kwh: { en: "monthly use", ro: "consumul lunar", ru: "расход в месяц", uk: "споживання на місяць" },
  bill_label: { en: "Monthly bill, {cur}", ro: "Factura lunară, {cur}", ru: "Счёт в месяц, {cur}", uk: "Рахунок на місяць, {cur}" },
  kwh_label: { en: "Monthly use, {unit}", ro: "Consumul lunar, {unit}", ru: "Расход в месяц, {unit}", uk: "Споживання на місяць, {unit}" },
  calc: { en: "Calculate", ro: "Calculează", ru: "Рассчитать", uk: "Розрахувати" },
  calculating: { en: "Calculating...", ro: "Se calculează...", ru: "Считаем...", uk: "Рахуємо..." },
  res_for: { en: "For {place}", ro: "Pentru {place}", ru: "Для: {place}", uk: "Для: {place}" },
  res_kw: { en: "Recommended system", ro: "Sistem recomandat", ru: "Рекомендуемая система", uk: "Рекомендована система" },
  res_prod: { en: "Production per year", ro: "Producție pe an", ru: "Выработка за год", uk: "Виробіток за рік" },
  res_price: { en: "Indicative price", ro: "Preț orientativ", ru: "Ориентировочная цена", uk: "Орієнтовна ціна" },
  res_save: { en: "Saving per month", ro: "Economie pe lună", ru: "Экономия в месяц", uk: "Економія на місяць" },
  res_payback: { en: "Pays for itself in", ro: "Se amortizează în", ru: "Окупается за", uk: "Окупається за" },
  res_monthly: { en: "Estimated monthly payment", ro: "Rată lunară estimată", ru: "Примерный платёж в месяц", uk: "Орієнтовний платіж на місяць" },
  res_monthly_note: { en: "over {y} years at {r}% a year", ro: "pe {y} ani, la {r}% pe an", ru: "на {y} лет под {r}% годовых", uk: "на {y} років під {r}% річних" },
  res_note: {
    en: "An estimate from public sun and tariff data. {co} gives the exact offer after looking at your roof.",
    ro: "O estimare din date publice despre soare și tarife. {co} vă face oferta exactă după ce vede acoperișul.",
    ru: "Оценка по открытым данным о солнце и тарифах. Точное предложение {co} сделает, посмотрев на крышу.",
    uk: "Оцінка за відкритими даними про сонце й тарифи. Точну пропозицію {co} зробить, оглянувши дах.",
  },
  recalc: { en: "Change the address or the bill", ro: "Altă adresă sau factură", ru: "Другой адрес или счёт", uk: "Інша адреса чи рахунок" },
  cta_h: { en: "Get the full proposal from {co}", ro: "Primiți oferta completă de la {co}", ru: "Получите полное предложение от {co}", uk: "Отримайте повну пропозицію від {co}" },
  name: { en: "Your name", ro: "Numele dumneavoastră", ru: "Ваше имя", uk: "Ваше ім’я" },
  phone: { en: "Phone", ro: "Telefon", ru: "Телефон", uk: "Телефон" },
  phone_ph: { en: "069 123 456", ro: "069 123 456", ru: "069 123 456", uk: "069 123 456" },
  email: { en: "Email (optional)", ro: "E-mail (opțional)", ru: "E-mail (необязательно)", uk: "E-mail (необов’язково)" },
  when_q: { en: "When would you like it installed?", ro: "Când doriți montajul?", ru: "Когда хотите установку?", uk: "Коли бажаєте монтаж?" },
  when_now: { en: "As soon as possible", ro: "Cât mai curând", ru: "Как можно скорее", uk: "Якнайшвидше" },
  when_soon: { en: "In the next 3 months", ro: "În următoarele 3 luni", ru: "В ближайшие 3 месяца", uk: "У найближчі 3 місяці" },
  when_later: { en: "Later, just looking", ro: "Mai târziu, mă informez", ru: "Позже, пока узнаю", uk: "Пізніше, поки дізнаюся" },
  fin: { en: "I am interested in paying in instalments", ro: "Mă interesează plata în rate", ru: "Интересует оплата в рассрочку", uk: "Цікавить оплата в розстрочку" },
  msg: { en: "Anything to add (optional)", ro: "Altceva de adăugat (opțional)", ru: "Что-то ещё (необязательно)", uk: "Щось іще (необов’язково)" },
  consent: {
    en: "I agree that {co} may contact me about this proposal and keep my details for it.",
    ro: "Sunt de acord ca {co} să mă contacteze despre această ofertă și să-mi păstreze datele în acest scop.",
    ru: "Я согласен, чтобы {co} связался со мной по этому предложению и хранил мои данные для этого.",
    uk: "Я погоджуюся, щоб {co} зв’язався зі мною щодо цієї пропозиції та зберігав мої дані для цього.",
  },
  privacy: { en: "Privacy policy", ro: "Politica de confidențialitate", ru: "Политика конфиденциальности", uk: "Політика конфіденційності" },
  send: { en: "Send the request", ro: "Trimiteți cererea", ru: "Отправить заявку", uk: "Надіслати заявку" },
  sending: { en: "Sending...", ro: "Se trimite...", ru: "Отправляем...", uk: "Надсилаємо..." },
  thanks_h: { en: "Thank you!", ro: "Mulțumim!", ru: "Спасибо!", uk: "Дякуємо!" },
  thanks: { en: "{co} has your request and will be in touch soon.", ro: "{co} a primit cererea și vă contactează în curând.", ru: "{co} получил вашу заявку и скоро свяжется с вами.", uk: "{co} отримав вашу заявку й незабаром зв’яжеться з вами." },
  err_address: { en: "Enter the address.", ro: "Introduceți adresa.", ru: "Укажите адрес.", uk: "Вкажіть адресу." },
  err_not_found: { en: "We could not find that address. Add the town.", ro: "Nu am găsit adresa. Adăugați localitatea.", ru: "Не удалось найти адрес. Добавьте населённый пункт.", uk: "Не вдалося знайти адресу. Додайте населений пункт." },
  err_rate: { en: "Too many tries. Please wait a minute.", ro: "Prea multe încercări. Așteptați un minut.", ru: "Слишком много попыток. Подождите минуту.", uk: "Забагато спроб. Зачекайте хвилину." },
  err_upstream: { en: "The sun data service is busy. Please try again.", ro: "Serviciul de date solare e ocupat. Încercați din nou.", ru: "Сервис данных о солнце занят. Попробуйте ещё раз.", uk: "Сервіс даних про сонце зайнятий. Спробуйте ще раз." },
  err_name: { en: "Write your name.", ro: "Scrieți numele.", ru: "Напишите имя.", uk: "Напишіть ім’я." },
  err_phone: { en: "Write a phone number from {country}, for example {example}.", ro: "Scrieți un număr de telefon din {country}, de exemplu {example}.", ru: "Укажите номер телефона ({country}), например {example}.", uk: "Вкажіть номер телефону ({country}), наприклад {example}." },
  err_email: { en: "That email does not look right.", ro: "Adresa de e-mail nu pare corectă.", ru: "Адрес e-mail выглядит неверно.", uk: "Адреса e-mail виглядає неправильно." },
  err_consent: { en: "Tick the agreement so we can send your request.", ro: "Bifați acordul ca să putem trimite cererea.", ru: "Отметьте согласие, чтобы мы могли отправить заявку.", uk: "Позначте згоду, щоб ми могли надіслати заявку." },
  err_captcha: { en: "Please confirm you are not a robot.", ro: "Confirmați că nu sunteți robot.", ru: "Подтвердите, что вы не робот.", uk: "Підтвердьте, що ви не робот." },
  err: { en: "The request could not be sent. Please try again.", ro: "Cererea nu s-a putut trimite. Încercați din nou.", ru: "Не удалось отправить заявку. Попробуйте ещё раз.", uk: "Не вдалося надіслати заявку. Спробуйте ще раз." },
  country_MD: { en: "Moldova", ro: "Moldova", ru: "Молдова", uk: "Молдова" },
  country_RO: { en: "Romania", ro: "România", ru: "Румыния", uk: "Румунія" },
  country_UA: { en: "Ukraine", ro: "Ucraina", ru: "Украина", uk: "Україна" },
  powered: { en: "Calculated with VoltMira", ro: "Calculat cu VoltMira", ru: "Рассчитано в VoltMira", uk: "Розраховано у VoltMira" },

  // the cover, the result and the sections under it
  lang_label: { en: "Language", ro: "Limba", ru: "Язык", uk: "Мова" },
  fact_sun: { en: "Real sun data for your address, from PVGIS (European Commission)", ro: "Date reale despre soare pentru adresa dumneavoastră, de la PVGIS (Comisia Europeană)", ru: "Реальные данные о солнце для вашего адреса, из PVGIS (Европейская комиссия)", uk: "Реальні дані про сонце для вашої адреси, з PVGIS (Європейська комісія)" },
  fact_same: { en: "The same calculation as the final offer from {co}", ro: "Același calcul ca oferta finală de la {co}", ru: "Тот же расчёт, что и в итоговом предложении {co}", uk: "Той самий розрахунок, що й у підсумковій пропозиції {co}" },
  fact_free: { en: "Free, with no obligation", ro: "Gratuit și fără obligații", ru: "Бесплатно и без обязательств", uk: "Безкоштовно й без зобов’язань" },
  form_h: { en: "Your estimate", ro: "Estimarea dumneavoastră", ru: "Ваш расчёт", uk: "Ваш розрахунок" },
  res_payback_range: { en: "between {a} and {b}", ro: "între {a} și {b}", ru: "от {a} до {b}", uk: "від {a} до {b}" },
  res_payback_note: { en: "depending on energy prices and the weather", ro: "în funcție de prețul energiei și de vreme", ru: "в зависимости от цен на энергию и погоды", uk: "залежно від цін на енергію та погоди" },
  res_year: { en: "Saving in the first year", ro: "Economie în primul an", ru: "Экономия за первый год", uk: "Економія за перший рік" },
  cta_go: { en: "Get the exact offer", ro: "Primiți oferta exactă", ru: "Получить точное предложение", uk: "Отримати точну пропозицію" },
  cta_p: {
    en: "Free and with no obligation. {co} replies with an offer made for your roof.",
    ro: "Gratuit și fără obligații. {co} vă răspunde cu o ofertă făcută pentru acoperișul dumneavoastră.",
    ru: "Бесплатно и без обязательств. {co} ответит предложением, рассчитанным для вашей крыши.",
    uk: "Безкоштовно й без зобов’язань. {co} відповість пропозицією, розрахованою для вашого даху.",
  },
  months_h: { en: "Production month by month", ro: "Producția lună de lună", ru: "Выработка по месяцам", uk: "Виробіток по місяцях" },
  months_p: {
    en: "What the recommended system makes each month at this address, next to the use worked out from your bill. Summer surplus goes to the grid.",
    ro: "Cât produce sistemul recomandat în fiecare lună la această adresă, alături de consumul calculat din factură. Surplusul de vară merge în rețea.",
    ru: "Сколько рекомендуемая система вырабатывает каждый месяц по этому адресу, рядом с потреблением, рассчитанным по счёту. Летний излишек уходит в сеть.",
    uk: "Скільки рекомендована система виробляє щомісяця за цією адресою, поруч зі споживанням, розрахованим за рахунком. Літній надлишок іде в мережу.",
  },
  months_prod: { en: "Production", ro: "Producție", ru: "Выработка", uk: "Виробіток" },
  months_cons: { en: "Your use", ro: "Consumul dumneavoastră", ru: "Ваше потребление", uk: "Ваше споживання" },
  months_title: { en: "Production and use per month, {u}", ro: "Producție și consum pe lună, {u}", ru: "Выработка и потребление по месяцам, {u}", uk: "Виробіток і споживання по місяцях, {u}" },
  sat_house: { en: "Your house from above", ro: "Casa dumneavoastră văzută de sus", ru: "Ваш дом сверху", uk: "Ваш будинок згори" },
  sat_street: { en: "Your street from above", ro: "Strada dumneavoastră văzută de sus", ru: "Ваша улица сверху", uk: "Ваша вулиця згори" },
  sat_note: { en: "Found from the address. {co} checks the roof itself before the offer.", ro: "Locul este găsit după adresă. {co} verifică acoperișul înainte de ofertă.", ru: "Место найдено по адресу. {co} проверит крышу перед предложением.", uk: "Місце знайдено за адресою. {co} перевірить дах перед пропозицією." },
  near_h: { en: "What systems nearby really produce", ro: "Cât produc cu adevărat sistemele din apropiere", ru: "Сколько на самом деле вырабатывают системы рядом", uk: "Скільки насправді виробляють системи поруч" },
  near_body: {
    en: "In {d}, {n} monitored systems produced a typical {y} {u} for each kWp installed over the last 12 months.",
    ro: "În {d}, {n} sisteme monitorizate au produs în mod obișnuit {y} {u} pentru fiecare kWp instalat în ultimele 12 luni.",
    ru: "В районе {d} {n} систем под мониторингом обычно вырабатывали {y} {u} на каждый установленный кВт за последние 12 месяцев.",
    uk: "У районі {d} {n} систем під моніторингом зазвичай виробляли {y} {u} на кожен встановлений кВт за останні 12 місяців.",
  },
  near_own: { en: "This estimate counts on {y} {u} for each kWp.", ro: "Această estimare calculează cu {y} {u} pentru fiecare kWp.", ru: "Этот расчёт исходит из {y} {u} на каждый кВт.", uk: "Цей розрахунок виходить із {y} {u} на кожен кВт." },
  near_src: {
    en: "Measured production of systems VoltMira monitors, from several installers; no system or owner is named.",
    ro: "Producția măsurată a sistemelor monitorizate de VoltMira, de la mai mulți instalatori; niciun sistem sau proprietar nu este numit.",
    ru: "Измеренная выработка систем, которые отслеживает VoltMira, от нескольких монтажников; ни система, ни владелец не называются.",
    uk: "Виміряний виробіток систем, які відстежує VoltMira, від кількох монтажників; жодна система чи власник не називаються.",
  },
  steps_h: { en: "How it goes from here", ro: "Cum se desfășoară", ru: "Как всё происходит", uk: "Як усе відбувається" },
  step1_h: { en: "The estimate", ro: "Estimarea", ru: "Расчёт", uk: "Розрахунок" },
  step1: { en: "The figures on this page, from your address and your bill.", ro: "Cifrele de pe această pagină, din adresa și factura dumneavoastră.", ru: "Цифры на этой странице, по вашему адресу и счёту.", uk: "Цифри на цій сторінці, за вашою адресою та рахунком." },
  step2_h: { en: "A call and a visit", ro: "Un apel și o vizită", ru: "Звонок и визит", uk: "Дзвінок і візит" },
  step2: { en: "{co} calls you and looks at the roof.", ro: "{co} vă sună și vede acoperișul.", ru: "{co} позвонит вам и осмотрит крышу.", uk: "{co} зателефонує вам і огляне дах." },
  step3_h: { en: "The exact offer", ro: "Oferta exactă", ru: "Точное предложение", uk: "Точна пропозиція" },
  step3: { en: "On your phone, with the price, the equipment and the payback, ready to sign.", ro: "Pe telefon, cu prețul, echipamentul și amortizarea, gata de semnat.", ru: "На телефоне: цена, оборудование и окупаемость, можно сразу подписать.", uk: "На телефоні: ціна, обладнання й окупність, можна одразу підписати." },
  step4_h: { en: "Installation", ro: "Montajul", ru: "Монтаж", uk: "Монтаж" },
  step4: { en: "{co} installs the system, then it is connected to the grid.", ro: "{co} montează sistemul, apoi urmează racordarea la rețea.", ru: "{co} устанавливает систему, затем её подключают к сети.", uk: "{co} встановлює систему, потім її підключають до мережі." },
};

export const ET = T;

export function et(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.ro) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** A local phone written the usual way, per market, for the hint. */
export const PHONE_EXAMPLE = { MD: "069 123 456", RO: "0721 234 567", UA: "050 123 4567" };
