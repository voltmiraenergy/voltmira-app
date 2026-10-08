// app/p/[code]/text.js — every word the client-facing proposal page says that
// lib/i18n.js doesn't already say the same way, in four languages.
//
// Module-local (not lib/i18n.js) on purpose: this is the one page a homeowner
// reads, so it addresses them formally in every language (Romanian
// "dumneavoastră", Ukrainian and Russian "ви/вы"), which the app's own
// installer-facing strings do not always do. lib/proposalText.test.js fails if
// a key lacks a language, a language's {placeholders} differ from English's,
// or a string carries an em dash, a middle dot or a check mark.
//
// ppt(key, lang, { n: 3 }) fills {n}. Missing languages fall back to English,
// then to the key itself.

const T = {
  // ---- browser tab: generic on purpose, never the client's name (page.jsx)
  doc_title: { en: "Solar proposal", ro: "Ofertă solară", ru: "Предложение по солнечной станции", uk: "Пропозиція щодо сонячної станції" },
  // ---- cover
  for_client: { en: "Prepared for {c}", ro: "Pregătită pentru {c}", ru: "Клиент: {c}", uk: "Клієнт: {c}" },
  sys_line: { en: "{kw} kW solar system{b}", ro: "Sistem solar de {kw} kW{b}", ru: "Солнечная станция {kw} кВт{b}", uk: "Сонячна станція {kw} кВт{b}" },
  with_batt: { en: " with a {b} kWh battery", ro: " cu baterie de {b} kWh", ru: " с батареей {b} кВт·ч", uk: " з батареєю {b} кВт·год" },
  valid_until: { en: "Valid until {d}", ro: "Valabilă până la {d}", ru: "Действует до {d}", uk: "Діє до {d}" },
  expired_on: { en: "Offer period ended {d}", ro: "Termenul ofertei a expirat la {d}", ru: "Срок предложения истёк {d}", uk: "Строк пропозиції сплив {d}" },
  offer_h: { en: "The offer in figures", ro: "Oferta în cifre", ru: "Предложение в цифрах", uk: "Пропозиція в цифрах" },
  k_price: { en: "Total price", ro: "Preț total", ru: "Общая стоимость", uk: "Загальна вартість" },
  k_monthly: { en: "Estimated monthly payment", ro: "Rată lunară estimată", ru: "Оценочный ежемесячный платёж", uk: "Орієнтовний щомісячний платіж" },
  k_monthly_note: { en: "An estimate, not a loan offer", ro: "Estimare, nu o ofertă de credit", ru: "Оценка, а не кредитное предложение", uk: "Оцінка, а не кредитна пропозиція" },
  pay_full: { en: "In full", ro: "Integral", ru: "Сразу", uk: "Одразу" },
  pay_monthly: { en: "Monthly", ro: "Lunar", ru: "Помесячно", uk: "Щомісяця" },
  pay_mode: { en: "How to show the price", ro: "Cum se afișează prețul", ru: "Как показать цену", uk: "Як показати ціну" },
  k_save: { en: "Saved in the first year", ro: "Economie în primul an", ru: "Экономия за первый год", uk: "Економія за перший рік" },
  k_save_s: { en: "about {v} a month", ro: "aproximativ {v} pe lună", ru: "около {v} в месяц", uk: "близько {v} на місяць" },
  k_payback: { en: "Pays for itself in", ro: "Se amortizează în", ru: "Окупается за", uk: "Окупається за" },
  k_range: { en: "{a} to {b} years, depending on sun and prices", ro: "între {a} și {b} ani, în funcție de soare și prețuri", ru: "от {a} до {b} лет, в зависимости от солнца и цен", uk: "від {a} до {b} р., залежно від сонця й цін" },
  k_net: { en: "Net gain over {y}", ro: "Câștig net în {y}", ru: "Чистая выгода за {y}", uk: "Чиста вигода за {y}" },
  k_net_s: { en: "after the system has paid for itself", ro: "după ce sistemul s-a amortizat", ru: "после окупаемости системы", uk: "після окупності системи" },
  cta_accept: { en: "Accept and sign", ro: "Acceptați și semnați", ru: "Принять и подписать", uk: "Прийняти й підписати" },
  cta_done: { en: "Accepted and signed", ro: "Acceptată și semnată", ru: "Принято и подписано", uk: "Прийнято й підписано" },

  // ---- side summary and sticky bar
  rail_h: { en: "Your offer", ro: "Oferta dumneavoastră", ru: "Ваше предложение", uk: "Ваша пропозиція" },
  or_monthly: { en: "or about {v} a month on credit", ro: "sau aproximativ {v} pe lună în credit", ru: "или около {v} в месяц в кредит", uk: "або близько {v} на місяць у кредит" },
  agreed_was: { en: "Agreed price, was {v}", ro: "Preț convenit, inițial {v}", ru: "Согласованная цена, было {v}", uk: "Погоджена ціна, було {v}" },
  contact_h: { en: "Your contact", ro: "Persoana de contact", ru: "Контактное лицо", uk: "Контактна особа" },
  call_aria: { en: "Call {phone}", ro: "Sunați la {phone}", ru: "Позвонить: {phone}", uk: "Зателефонувати: {phone}" },

  // ---- options
  opt_h: { en: "Compare your options", ro: "Comparați opțiunile", ru: "Сравните варианты", uk: "Порівняйте варіанти" },
  opt_rec: { en: "Recommended", ro: "Recomandat", ru: "Рекомендуем", uk: "Рекомендуємо" },
  opt_n: { en: "Option {n}", ro: "Opțiunea {n}", ru: "Вариант {n}", uk: "Варіант {n}" },
  k_save_mo: { en: "Saving per month", ro: "Economie pe lună", ru: "Экономия в месяц", uk: "Економія на місяць" },

  // ---- what you are buying
  buy_h: { en: "What you are buying", ro: "Ce cumpărați", ru: "Что вы покупаете", uk: "Що ви купуєте" },
  buy_lead: { en: "A {kw} kW solar system{b} on your roof, making about {p} kWh a year.", ro: "Un sistem solar de {kw} kW{b} pe acoperișul dumneavoastră, care produce aproximativ {p} kWh pe an.", ru: "Солнечная станция {kw} кВт{b} на вашей крыше, около {p} кВт·ч в год.", uk: "Сонячна станція {kw} кВт{b} на вашому даху, близько {p} кВт·год на рік." },
  warr_maker: { en: "Manufacturer warranty: {y}", ro: "Garanția producătorului: {y}", ru: "Гарантия производителя: {y}", uk: "Гарантія виробника: {y}" },
  product_page: { en: "Product page", ro: "Pagina produsului", ru: "Страница продукта", uk: "Сторінка продукту" },
  new_tab: { en: "opens in a new tab", ro: "se deschide într-o filă nouă", ru: "откроется в новой вкладке", uk: "відкриється в новій вкладці" },
  install_warr: { en: "Workmanship warranty from {co}: {y}", ro: "Garanția manoperei de la {co}: {y}", ru: "Гарантия на монтаж от {co}: {y}", uk: "Гарантія на монтаж від {co}: {y}" },
  qty: { en: "Quantity", ro: "Cantitate", ru: "Количество", uk: "Кількість" },
  backup_h: { en: "About {h} hours of backup power", ro: "Aproximativ {h} ore de rezervă", ru: "Около {h} ч автономной работы", uk: "Близько {h} год автономної роботи" },
  backup_p: { en: "The {b} kWh battery keeps the power on through a grid outage at your average use. With only the essentials connected, it lasts longer.", ro: "Bateria de {b} kWh menține curentul în timpul unei pene de rețea, la consumul dumneavoastră mediu. Cu doar consumatorii esențiali conectați, ține mai mult.", ru: "Батарея {b} кВт·ч сохраняет электричество при отключении сети при обычном потреблении. Если подключено только самое необходимое, её хватит дольше.", uk: "Батарея {b} кВт·год зберігає електрику під час відключення мережі за звичайного споживання. Якщо підключено лише найнеобхідніше, її вистачить надовше." },
  fit_h: { en: "Designed for your home", ro: "Proiectat pentru casa dumneavoastră", ru: "Спроектировано для вашего дома", uk: "Спроєктовано для вашого дому" },

  // ---- energy
  e_line: { en: "{s}% of it is used in your home and the rest goes to the grid. It covers {c}% of the electricity you use in a year.", ro: "{s}% din ea se folosește în casă, iar restul pleacă în rețea. Acoperă {c}% din energia pe care o consumați într-un an.", ru: "{s}% используется дома, остальное уходит в сеть. Покрывает {c}% электроэнергии, которую вы потребляете за год.", uk: "{s}% використовується вдома, решта йде в мережу. Покриває {c}% електроенергії, яку ви споживаєте за рік." },
  energy_h: { en: "Your energy, month by month", ro: "Energia dumneavoastră, lună de lună", ru: "Ваша энергия по месяцам", uk: "Ваша енергія по місяцях" },
  e_prod: { en: "produced a year", ro: "produși pe an", ru: "выработка за год", uk: "генерація за рік" },
  e_self: { en: "used on site", ro: "consumată pe loc", ru: "потребляется на месте", uk: "споживається на місці" },
  e_cover: { en: "of your yearly use covered by solar", ro: "din consumul anual, acoperit din solar", ru: "годового потребления покрывает солнце", uk: "річного споживання покриває сонце" },
  ch_monthly: { en: "Production and consumption by month, in {u}", ro: "Producția și consumul pe luni, în {u}", ru: "Выработка и потребление по месяцам, {u}", uk: "Генерація і споживання по місяцях, {u}" },
  table_show: { en: "Show the figures as a table", ro: "Afișați cifrele ca tabel", ru: "Показать цифры таблицей", uk: "Показати цифри таблицею" },
  month: { en: "Month", ro: "Luna", ru: "Месяц", uk: "Місяць" },
  year: { en: "Year", ro: "Anul", ru: "Год", uk: "Рік" },

  // ---- money
  money_h: { en: "Your money over {y}", ro: "Banii dumneavoastră în {y}", ru: "Ваши деньги за {y}", uk: "Ваші гроші за {y}" },
  sc_pess: { en: "Pessimistic", ro: "Pesimist", ru: "Пессимистичный", uk: "Песимістичний" },
  sc_expc: { en: "Expected", ro: "Așteptat", ru: "Ожидаемый", uk: "Очікуваний" },
  sc_opti: { en: "Optimistic", ro: "Optimist", ru: "Оптимистичный", uk: "Оптимістичний" },
  sc_prod: { en: "Production {y}", ro: "Producție {y}", ru: "Выработка {y}", uk: "Генерація {y}" },
  sc_asest: { en: "as estimated", ro: "conform estimării", ru: "по оценке", uk: "за оцінкою" },
  sc_infl: { en: "prices rising {i}% a year", ro: "prețuri în creștere cu {i}% pe an", ru: "рост цен {i}% в год", uk: "зростання цін {i}% на рік" },
  sc_flat: { en: "prices unchanged", ro: "prețuri neschimbate", ru: "цены без изменений", uk: "ціни без змін" },
  sc_roi: { en: "Return over {y}", ro: "Randament în {y}", ru: "Доходность за {y}", uk: "Дохідність за {y}" },
  cash_cap: { en: "Your cumulative position, year by year. Below zero the system is still paying for itself; above zero it is money saved: about {v} by year {n} in the expected case.", ro: "Poziția dumneavoastră cumulată, an de an. Sub zero sistemul încă se amortizează, peste zero sunt bani economisiți: aproximativ {v} până în anul {n} în scenariul așteptat.", ru: "Ваш накопленный результат по годам. Ниже нуля система ещё окупается, выше нуля это сэкономленные деньги: около {v} к {n}-му году в ожидаемом сценарии.", uk: "Ваш накопичений результат за роками. Нижче нуля система ще окупається, вище нуля це заощаджені гроші: близько {v} до {n}-го року в очікуваному сценарії." },
  ch_cash: { en: "Cumulative position by year in three scenarios", ro: "Poziția cumulată pe ani, în trei scenarii", ru: "Накопленный результат по годам в трёх сценариях", uk: "Накопичений результат за роками у трьох сценаріях" },
  be: { en: "Break-even", ro: "Pragul de amortizare", ru: "Точка окупаемости", uk: "Точка окупності" },
  vs_h: { en: "Your electricity over {y}", ro: "Curentul dumneavoastră în {y}", ru: "Ваше электричество за {y}", uk: "Ваша електрика за {y}" },
  vs_without: { en: "From the grid only", ro: "Doar din rețea", ru: "Только из сети", uk: "Лише з мережі" },
  vs_with: { en: "With this system", ro: "Cu acest sistem", ru: "С этой системой", uk: "З цією системою" },
  vs_note: { en: "Grid bills at today's price, rising {i}% a year, against the bills left after solar plus the price of the system.", ro: "Facturile la prețul de azi, cu o creștere de {i}% pe an, față de facturile rămase după montaj plus prețul sistemului.", ru: "Счета по сегодняшней цене с ростом {i}% в год против счетов, которые останутся после установки, плюс стоимость системы.", uk: "Рахунки за сьогоднішньою ціною зі зростанням {i}% на рік проти рахунків, що залишаться після встановлення, плюс вартість системи." },
  assump_h: { en: "Every assumption used", ro: "Toate ipotezele folosite", ru: "Все использованные допущения", uk: "Усі використані припущення" },

  // ---- check it yourself (ClientAudit)
  audit_h: { en: "Check these numbers yourself", ro: "Verificați aceste cifre", ru: "Проверьте эти цифры сами", uk: "Перевірте ці цифри самі" },
  audit_p: { en: "Move the sliders or type your own figures. The payback is recalculated with the same method the installer used.", ro: "Mutați cursoarele sau introduceți propriile cifre. Amortizarea se recalculează cu aceeași metodă folosită de instalator.", ru: "Двигайте ползунки или введите свои цифры. Окупаемость пересчитывается тем же методом, что использовал установщик.", uk: "Рухайте повзунки або введіть власні цифри. Окупність перераховується тим самим методом, який використав монтажник." },
  audit_price: { en: "Electricity price", ro: "Prețul curentului", ru: "Цена электроэнергии", uk: "Ціна електроенергії" },
  audit_infl: { en: "Yearly price rise", ro: "Creșterea anuală a prețului", ru: "Годовой рост цены", uk: "Річне зростання ціни" },
  audit_reset: { en: "Back to the original estimate", ro: "Reveniți la estimarea inițială", ru: "Вернуть исходную оценку", uk: "Повернути початкову оцінку" },
  audit_was: { en: "was {v}", ro: "inițial {v}", ru: "было {v}", uk: "було {v}" },
  audit_note: { en: "These are your figures, not the installer's. Same calculation, nothing hidden.", ro: "Acestea sunt cifrele dumneavoastră, nu ale instalatorului. Același calcul, nimic ascuns.", ru: "Это ваши цифры, а не установщика. Тот же расчёт, ничего скрытого.", uk: "Це ваші цифри, а не монтажника. Той самий розрахунок, нічого прихованого." },
  audit_result: { en: "Payback with your figures", ro: "Amortizarea cu cifrele dumneavoastră", ru: "Окупаемость с вашими цифрами", uk: "Окупність із вашими цифрами" },

  // ---- paying monthly
  fin_h: { en: "Paying monthly", ro: "Plata lunară", ru: "Ежемесячная оплата", uk: "Щомісячна оплата" },
  fin_est: { en: "Estimated loan payment", ro: "Rata estimată a creditului", ru: "Оценочный платёж по кредиту", uk: "Орієнтовний платіж за кредитом" },
  fin_terms: { en: "At {r}% a year over {y}, on the full price. The bank sets the final terms: this is an estimate, not a loan offer.", ro: "La {r}% pe an, pe {y}, pentru prețul întreg. Condițiile finale le stabilește banca: este o estimare, nu o ofertă de credit.", ru: "Под {r}% годовых на {y}, на полную стоимость. Окончательные условия определяет банк: это оценка, а не кредитное предложение.", uk: "Під {r}% річних на {y}, на повну вартість. Остаточні умови визначає банк: це оцінка, а не кредитна пропозиція." },
  fin_loan: { en: "Monthly loan payment", ro: "Rata lunară a creditului", ru: "Ежемесячный платёж по кредиту", uk: "Щомісячний платіж за кредитом" },
  fin_save: { en: "Estimated monthly savings", ro: "Economia lunară estimată", ru: "Оценочная экономия в месяц", uk: "Орієнтовна економія на місяць" },
  fin_good: { en: "From the first month, the savings cover the payment and leave you about {v} a month.", ro: "Din prima lună, economia acoperă rata și vă rămân aproximativ {v} pe lună.", ru: "С первого месяца экономия покрывает платёж, и у вас остаётся около {v} в месяц.", uk: "З першого місяця економія покриває платіж, і у вас залишається близько {v} на місяць." },
  fin_bad: { en: "At first the payment is higher than the savings, by about {v} a month. As electricity prices rise, the savings grow towards it.", ro: "La început rata depășește economia cu aproximativ {v} pe lună. Pe măsură ce prețul curentului crește, economia se apropie de rată.", ru: "Сначала платёж выше экономии примерно на {v} в месяц. По мере роста цен на электроэнергию экономия приближается к нему.", uk: "Спочатку платіж перевищує економію приблизно на {v} на місяць. Зі зростанням цін на електроенергію економія наближається до нього." },

  // ---- accept
  next_h: { en: "Ready to go ahead?", ro: "Doriți să mergeți mai departe?", ru: "Готовы двигаться дальше?", uk: "Готові рухатися далі?" },
  next_p: { en: "Accept and sign online. {co} is notified and contacts you to arrange the next steps.", ro: "Acceptați și semnați online. {co} primește o notificare și vă contactează pentru pașii următori.", ru: "Примите и подпишите онлайн. {co} получит уведомление и свяжется с вами, чтобы договориться о следующих шагах.", uk: "Прийміть і підпишіть онлайн. {co} отримає сповіщення та зв’яжеться з вами, щоб домовитися про наступні кроки." },
  steps_h: { en: "What happens next", ro: "Ce urmează", ru: "Что дальше", uk: "Що далі" },
  step1: { en: "A site visit confirms the roof, the shading and the grid connection.", ro: "O vizită la fața locului confirmă acoperișul, umbrirea și racordul la rețea.", ru: "Выезд на объект: проверяются крыша, затенение и подключение к сети.", uk: "Виїзд на об’єкт: перевіряються дах, затінення й підключення до мережі." },
  step2: { en: "Final design and the grid paperwork.", ro: "Proiectul final și actele pentru rețea.", ru: "Финальный проект и документы для сети.", uk: "Фінальний проєкт і документи для мережі." },
  step3: { en: "Installation on your roof.", ro: "Montajul pe acoperișul dumneavoastră.", ru: "Монтаж на вашей крыше.", uk: "Монтаж на вашому даху." },
  step4: { en: "Grid connection and start-up: the savings begin.", ro: "Racordarea și punerea în funcțiune: încep economiile.", ru: "Подключение и запуск: начинается экономия.", uk: "Підключення й запуск: починається економія." },
  pdf_go: { en: "Ready to go ahead? Accept this offer online at {url}", ro: "Doriți să mergeți mai departe? Acceptați oferta online la {url}", ru: "Готовы двигаться дальше? Примите предложение онлайн: {url}", uk: "Готові рухатися далі? Прийміть пропозицію онлайн: {url}" },
  pdf_call: { en: "or call {who} on {phone}.", ro: "sau sunați la {phone} ({who}).", ru: "или позвоните: {who}, {phone}.", uk: "або зателефонуйте: {who}, {phone}." },
  request: { en: "Request a call", ro: "Solicitați un apel", ru: "Заказать звонок", uk: "Замовити дзвінок" },
  requested: { en: "Request sent. The installer will be in touch.", ro: "Cererea a fost trimisă. Instalatorul vă va contacta.", ru: "Запрос отправлен. Установщик свяжется с вами.", uk: "Запит надіслано. Монтажник зв’яжеться з вами." },
  sig_h: { en: "Sign to accept", ro: "Semnați pentru a accepta", ru: "Подпишите, чтобы принять", uk: "Підпишіть, щоб прийняти" },
  sig_p: { en: "Type your full name and sign with your finger or mouse. This confirms that you accept this offer.", ro: "Scrieți numele complet și semnați cu degetul sau cu mouse-ul. Astfel confirmați că acceptați această ofertă.", ru: "Введите полное имя и распишитесь пальцем или мышью. Так вы подтверждаете, что принимаете это предложение.", uk: "Введіть повне ім’я та розпишіться пальцем або мишею. Так ви підтверджуєте, що приймаєте цю пропозицію." },
  sig_name: { en: "Full name", ro: "Numele complet", ru: "Полное имя", uk: "Повне ім’я" },
  sig_draw: { en: "Your signature", ro: "Semnătura dumneavoastră", ru: "Ваша подпись", uk: "Ваш підпис" },
  sig_here: { en: "Sign here", ro: "Semnați aici", ru: "Распишитесь здесь", uk: "Розпишіться тут" },
  sig_clear: { en: "Clear", ro: "Ștergeți", ru: "Очистить", uk: "Очистити" },
  sig_confirm: { en: "Confirm and accept", ro: "Confirmați și acceptați", ru: "Подтвердить и принять", uk: "Підтвердити й прийняти" },
  sig_sending: { en: "Confirming…", ro: "Se confirmă…", ru: "Подтверждаем…", uk: "Підтверджуємо…" },
  sig_cancel: { en: "Cancel", ro: "Anulați", ru: "Отмена", uk: "Скасувати" },
  sig_legal: { en: "By signing, you agree that this is your electronic signature, legally equivalent to a signature on paper.", ro: "Prin semnare, sunteți de acord că aceasta este semnătura dumneavoastră electronică, echivalentă legal cu semnătura pe hârtie.", ru: "Подписывая, вы соглашаетесь, что это ваша электронная подпись, юридически равная подписи на бумаге.", uk: "Підписуючи, ви погоджуєтеся, що це ваш електронний підпис, юридично рівноцінний підпису на папері." },
  sig_error: { en: "Your signature could not be sent. Check the connection and try again.", ro: "Semnătura nu a putut fi trimisă. Verificați conexiunea și încercați din nou.", ru: "Не удалось отправить подпись. Проверьте соединение и попробуйте ещё раз.", uk: "Не вдалося надіслати підпис. Перевірте з’єднання та спробуйте ще раз." },
  sig_done: { en: "Signed and accepted. The installer has been notified.", ro: "Semnată și acceptată. Instalatorul a fost anunțat.", ru: "Подписано и принято. Установщик уведомлён.", uk: "Підписано й прийнято. Монтажника повідомлено." },
  signed_by: { en: "Signed by {name}, {date}", ro: "Semnată de {name}, {date}", ru: "Подписано: {name}, {date}", uk: "Підписано: {name}, {date}" },
  signed_by_nd: { en: "Signed by {name}", ro: "Semnată de {name}", ru: "Подписано: {name}", uk: "Підписано: {name}" },
  ref_q: { en: "How did you hear about us?", ro: "Cum ați aflat despre noi?", ru: "Как вы о нас узнали?", uk: "Як ви про нас дізналися?" },
  ref_thanks: { en: "Thank you, noted.", ro: "Mulțumim, am notat.", ru: "Спасибо, записали.", uk: "Дякуємо, записали." },
  offer_detail: { en: "That is {pct}% ({save}) off, agreed in the chat. It applies when you accept below and stands until {date}.", ro: "Adică o reducere de {pct}% ({save}), convenită în chat. Se aplică atunci când acceptați mai jos și este valabilă până pe {date}.", ru: "Это скидка {pct}% ({save}), согласованная в чате. Она действует, когда вы примете предложение ниже, и сохраняется до {date}.", uk: "Це знижка {pct}% ({save}), погоджена в чаті. Вона діє, коли ви приймете пропозицію нижче, і зберігається до {date}." },
  option_chosen: { en: "You chose {label}. It applies when you accept below.", ro: "Ați ales {label}. Se aplică atunci când acceptați mai jos.", ru: "Вы выбрали: {label}. Выбор действует, когда вы примете предложение ниже.", uk: "Ви обрали: {label}. Вибір діє, коли ви приймете пропозицію нижче." },

  // ---- questions
  faq_h: { en: "Questions", ro: "Întrebări", ru: "Вопросы", uk: "Питання" },
  q_guar: { en: "Are these figures guaranteed?", ro: "Sunt garantate aceste cifre?", ru: "Эти цифры гарантированы?", uk: "Ці цифри гарантовані?" },
  a_guar: { en: "No. They are estimates based on the assumptions listed on this page, which you can check and change yourself. The pessimistic scenario shows what happens if things go worse than expected.", ro: "Nu. Sunt estimări bazate pe ipotezele de pe această pagină, pe care le puteți verifica și modifica. Scenariul pesimist arată ce se întâmplă dacă lucrurile merg mai rău decât se așteaptă.", ru: "Нет. Это оценки на основе допущений на этой странице, которые вы можете проверить и изменить сами. Пессимистичный сценарий показывает, что будет, если всё пойдёт хуже ожидаемого.", uk: "Ні. Це оцінки на основі припущень на цій сторінці, які ви можете перевірити й змінити самі. Песимістичний сценарій показує, що буде, якщо все піде гірше, ніж очікується." },
  q_sign: { en: "What happens when I accept?", ro: "Ce se întâmplă după ce accept?", ru: "Что происходит после принятия?", uk: "Що відбувається після прийняття?" },
  a_sign: { en: "You type your name and sign on the screen. {co} is notified and contacts you to arrange the site visit, the final design and the installation.", ro: "Scrieți numele și semnați pe ecran. {co} primește o notificare și vă contactează pentru vizita la fața locului, proiectul final și montaj.", ru: "Вы вводите имя и расписываетесь на экране. {co} получает уведомление и связывается с вами, чтобы договориться о выезде на объект, финальном проекте и монтаже.", uk: "Ви вводите ім’я та розписуєтеся на екрані. {co} отримує сповіщення й зв’язується з вами, щоб домовитися про виїзд на об’єкт, фінальний проєкт і монтаж." },
  q_warr: { en: "What warranties are included?", ro: "Ce garanții sunt incluse?", ru: "Какие гарантии включены?", uk: "Які гарантії включено?" },
  a_warr: { en: "The manufacturers' warranties for the equipment in this offer:", ro: "Garanțiile producătorilor pentru echipamentele din această ofertă:", ru: "Гарантии производителей на оборудование в этом предложении:", uk: "Гарантії виробників на обладнання в цій пропозиції:" },
  q_surplus: { en: "What happens to the electricity I do not use?", ro: "Ce se întâmplă cu energia pe care nu o consum?", ru: "Что происходит с электроэнергией, которую я не использую?", uk: "Що відбувається з електроенергією, яку я не використовую?" },
  a_surplus_md: { en: "It goes to the grid and is bought at the price the operator publishes each month. The figures on this page already count it.", ro: "Pleacă în rețea și este cumpărată la prețul publicat lunar de operator. Cifrele de pe această pagină țin deja cont de asta.", ru: "Она уходит в сеть и выкупается по цене, которую оператор публикует каждый месяц. Цифры на этой странице это уже учитывают.", uk: "Вона йде в мережу й викуповується за ціною, яку оператор публікує щомісяця. Цифри на цій сторінці це вже враховують." },
  a_surplus_ro: { en: "It goes to the grid and is credited against your bills, one for one. The figures on this page already count it.", ro: "Pleacă în rețea și se compensează în facturile dumneavoastră, unu la unu. Cifrele de pe această pagină țin deja cont de asta.", ru: "Она уходит в сеть и засчитывается в ваших счетах один к одному. Цифры на этой странице это уже учитывают.", uk: "Вона йде в мережу й зараховується у ваших рахунках один до одного. Цифри на цій сторінці це вже враховують." },
  a_surplus_ua: { en: "It is sold under the green tariff described above. The figures on this page already count it.", ro: "Se vinde la tariful verde descris mai sus. Cifrele de pe această pagină țin deja cont de asta.", ru: "Она продаётся по зелёному тарифу, описанному выше. Цифры на этой странице это уже учитывают.", uk: "Вона продається за зеленим тарифом, описаним вище. Цифри на цій сторінці це вже враховують." },
  q_change: { en: "What if my roof or my consumption is different?", ro: "Ce se întâmplă dacă acoperișul sau consumul meu este diferit?", ru: "Что, если моя крыша или потребление отличаются?", uk: "Що, як мій дах або споживання відрізняються?" },
  a_change: { en: "Let the installer know before you sign. The offer can be recalculated with your real figures, using the same method.", ro: "Anunțați instalatorul înainte de a semna. Oferta poate fi recalculată cu cifrele dumneavoastră reale, prin aceeași metodă.", ru: "Сообщите об этом установщику до подписания. Предложение можно пересчитать по вашим реальным данным тем же методом.", uk: "Повідомте про це монтажнику до підписання. Пропозицію можна перерахувати за вашими реальними даними тим самим методом." },
  q_loan: { en: "Is the monthly payment a loan offer?", ro: "Rata lunară este o ofertă de credit?", ru: "Ежемесячный платёж является кредитным предложением?", uk: "Щомісячний платіж є кредитною пропозицією?" },
  a_loan: { en: "No. It is an estimate at {r}% a year over {y}. The bank sets the final terms.", ro: "Nu. Este o estimare la {r}% pe an, pe {y}. Condițiile finale le stabilește banca.", ru: "Нет. Это оценка под {r}% годовых на {y}. Окончательные условия определяет банк.", uk: "Ні. Це оцінка під {r}% річних на {y}. Остаточні умови визначає банк." },

  // ---- assistant (QaWidget)
  qa_h: { en: "Ask a question about your offer", ro: "Puneți o întrebare despre ofertă", ru: "Задайте вопрос о предложении", uk: "Поставте запитання щодо пропозиції" },
  qa_sub: { en: "The assistant answers from the figures in this offer.", ro: "Asistentul răspunde pe baza cifrelor din această ofertă.", ru: "Ассистент отвечает на основе цифр этого предложения.", uk: "Асистент відповідає на основі цифр цієї пропозиції." },
  qa_ph: { en: "For example: what does the warranty cover?", ro: "De exemplu: ce acoperă garanția?", ru: "Например: что покрывает гарантия?", uk: "Наприклад: що покриває гарантія?" },
  qa_label: { en: "Your question", ro: "Întrebarea dumneavoastră", ru: "Ваш вопрос", uk: "Ваше запитання" },
  qa_send: { en: "Ask", ro: "Întrebați", ru: "Спросить", uk: "Запитати" },
  qa_thinking: { en: "Thinking…", ro: "Se gândește…", ru: "Думаю…", uk: "Думаю…" },
  qa_disclaimer: { en: "AI-generated from your offer's real figures. Check anything important with {who}.", ro: "Generat de AI din cifrele reale ale ofertei. Verificați orice lucru important cu {who}.", ru: "Сгенерировано ИИ на основе реальных цифр предложения. Важное уточняйте: {who}.", uk: "Згенеровано ШІ на основі реальних цифр пропозиції. Важливе уточнюйте: {who}." },
  qa_installer: { en: "your installer", ro: "instalatorul dumneavoastră", ru: "ваш установщик", uk: "ваш монтажник" },
  qa_error: { en: "Could not get an answer right now. Please try again.", ro: "Nu am putut obține un răspuns acum. Vă rugăm să încercați din nou.", ru: "Не удалось получить ответ. Попробуйте ещё раз.", uk: "Не вдалося отримати відповідь. Спробуйте ще раз." },
  qa_you: { en: "You", ro: "Dumneavoastră", ru: "Вы", uk: "Ви" },
  qa_bot: { en: "Assistant", ro: "Asistent", ru: "Ассистент", uk: "Асистент" },

  // ---- footer
  valid_full: { en: "This offer is valid until {d}. All figures are estimates based on the assumptions on this page.", ro: "Această ofertă este valabilă până la {d}. Toate cifrele sunt estimări bazate pe ipotezele de pe această pagină.", ru: "Предложение действует до {d}. Все цифры являются оценками на основе допущений на этой странице.", uk: "Пропозиція дійсна до {d}. Усі цифри є оцінками на основі припущень на цій сторінці." },
  expired_full: { en: "The offer period ended on {d}. Ask the installer to confirm the figures before you sign.", ro: "Termenul ofertei a expirat la {d}. Cereți instalatorului să confirme cifrele înainte de a semna.", ru: "Срок предложения истёк {d}. Попросите установщика подтвердить цифры до подписания.", uk: "Строк пропозиції сплив {d}. Попросіть монтажника підтвердити цифри до підписання." },
  privacy: { en: "How your data is used", ro: "Cum sunt folosite datele dumneavoastră", ru: "Как используются ваши данные", uk: "Як використовуються ваші дані" },
};

export const PP = T;

/** ppt("valid_until", "uk", { d: "20 жовт. 2026" }) */
export function ppt(key, lang = "en", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v));
  return s;
}

const LOC = { en: "en-GB", ro: "ro-RO", ru: "ru-RU", uk: "uk-UA" };
// The word for "year" after a whole number, by the language's plural rule.
// Romanian adds "de" from 20 up ("25 de ani"), which Intl reports as "other".
const YEAR_FORMS = {
  en: { one: "year", other: "years" },
  ro: { one: "an", few: "ani", other: "de ani" },
  ru: { one: "год", few: "года", many: "лет", other: "года" },
  uk: { one: "рік", few: "роки", many: "років", other: "року" },
};

/** yearsN(25, "ro") -> "25 de ani"; yearsN(3, "ru") -> "3 года". */
export function yearsN(n, lang = "en") {
  const l = YEAR_FORMS[lang] ? lang : "en";
  const v = Number(n) || 0;
  const forms = YEAR_FORMS[l];
  const cat = new Intl.PluralRules(LOC[l]).select(v);
  return `${v.toLocaleString(LOC[l], { maximumFractionDigits: 1 })} ${forms[cat] || forms.other}`;
}

/** The energy units in the reader's language. */
export const kwhUnit = (lang) => ({ ru: "кВт·ч", uk: "кВт·год" }[lang] || "kWh");
export const kwUnit = (lang) => (lang === "ru" || lang === "uk" ? "кВт" : "kW");
