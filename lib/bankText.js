// lib/bankText.js — the words of the bank submission pack for one utility
// plant (lib/bankPack.js): the pack block on the plant editor, the credit
// summary a bank reads (app/(app)/portfolios/[id]/bank), and the manifest in
// the ZIP. Four languages; the pack itself ships in Romanian and English.
// The summary is written for the bank, in the third person. Module-local, like
// lib/plantText.js; lib/bankText.test.js checks languages, placeholders and
// punctuation.

const T = {
  // ---- the plant editor
  pack_h: { en: "Bank submission pack", ro: "Pachetul pentru bancă", ru: "Пакет для банка", uk: "Пакет для банку" },
  pack_p: {
    en: "One ZIP to send to the bank: the credit summary in Romanian and English, this plant's Excel model with live formulas, the permit checklist and the list of what is still missing.",
    ro: "Un singur ZIP de trimis la bancă: rezumatul de credit în română și engleză, modelul Excel al acestei centrale cu formule active, lista autorizațiilor și ce lipsește încă.",
    ru: "Один ZIP для банка: кредитное резюме на румынском и английском, Excel-модель этой станции с живыми формулами, перечень разрешений и список того, чего ещё не хватает.",
    uk: "Один ZIP для банку: кредитне резюме румунською та англійською, Excel-модель цієї станції з живими формулами, перелік дозволів і список того, чого ще бракує.",
  },
  pack_dl: { en: "Download the pack (ZIP)", ro: "Descarcă pachetul (ZIP)", ru: "Скачать пакет (ZIP)", uk: "Завантажити пакет (ZIP)" },
  pack_view: { en: "Read the summary in {l}", ro: "Citește rezumatul în {l}", ru: "Открыть резюме: {l}", uk: "Відкрити резюме: {l}" },
  pack_wait: { en: "Building the pack takes up to a minute.", ro: "Pregătirea pachetului durează până la un minut.", ru: "Сборка пакета занимает до минуты.", uk: "Збирання пакета триває до хвилини." },
  pack_saving: { en: "Saving your changes first.", ro: "Mai întâi se salvează modificările.", ru: "Сначала сохраняются изменения.", uk: "Спершу зберігаються зміни." },
  pack_missing: { en: "{n} items still missing: {x}.", ro: "Lipsesc încă {n} elemente: {x}.", ru: "Ещё не хватает пунктов: {n}. {x}.", uk: "Ще бракує пунктів: {n}. {x}." },
  pack_missing_one: { en: "1 item still missing: {x}.", ro: "Lipsește încă un element: {x}.", ru: "Ещё не хватает одного пункта: {x}.", uk: "Ще бракує одного пункту: {x}." },
  pack_missing_0: { en: "Nothing missing on the checklist.", ro: "Nu lipsește nimic din listă.", ru: "В перечне всё готово.", uk: "У переліку все готово." },
  f_borrower: { en: "Borrower", ro: "Împrumutatul", ru: "Заёмщик", uk: "Позичальник" },
  f_borrower_ph: { en: "The project company", ro: "Compania de proiect", ru: "Проектная компания", uk: "Проєктна компанія" },
  f_sponsor: { en: "Sponsor", ro: "Sponsorul", ru: "Спонсор", uk: "Спонсор" },
  lang_ro: { en: "Romanian", ro: "română", ru: "румынский", uk: "румунська" },
  lang_en: { en: "English", ro: "engleză", ru: "английский", uk: "англійська" },

  // ---- the credit summary
  title: { en: "Credit summary", ro: "Rezumat de credit", ru: "Кредитное резюме", uk: "Кредитне резюме" },
  lead: {
    en: "{borrower} requests a loan of {loan} over {t} years, {profile}, at {r}% a year, to build {name}: {mix}{where}.",
    ro: "{borrower} solicită un credit de {loan} pe {t} ani, {profile}, cu dobânda de {r}% pe an, pentru construcția centralei {name}: {mix}{where}.",
    ru: "{borrower} запрашивает кредит {loan} на {t} лет, {profile}, под {r}% годовых на строительство станции {name}: {mix}{where}.",
    uk: "{borrower} просить кредит {loan} на {t} років, {profile}, під {r}% річних на будівництво станції {name}: {mix}{where}.",
  },
  lead_nodebt: {
    en: "{name}: {mix}{where}. The structure has no loan yet: set the debt share on the portfolio to prepare the request.",
    ro: "{name}: {mix}{where}. Structura nu are încă un credit: setați ponderea datoriei în portofoliu pentru a pregăti cererea.",
    ru: "{name}: {mix}{where}. В структуре пока нет кредита: задайте долю долга в портфеле, чтобы подготовить заявку.",
    uk: "{name}: {mix}{where}. У структурі поки немає кредиту: задайте частку боргу в портфелі, щоб підготувати заявку.",
  },
  near: { en: ", near {x}", ro: ", lângă {x}", ru: ", около {x}", uk: ", поблизу {x}" },
  borrower_none: { en: "The project company (not named yet)", ro: "Compania de proiect (încă nenumită)", ru: "Проектная компания (ещё не названа)", uk: "Проєктна компанія (ще не названа)" },
  prof_annuity: { en: "repaid in equal instalments", ro: "rambursat în rate egale", ru: "с погашением равными платежами", uk: "з погашенням рівними платежами" },
  prof_sculpted: { en: "repaid in line with the cash flow (sculpted)", ro: "rambursat în funcție de fluxul de numerar (sculptat)", ru: "с погашением под денежный поток", uk: "з погашенням під грошовий потік" },
  sponsor_line: { en: "Sponsor: {x}.", ro: "Sponsor: {x}.", ru: "Спонсор: {x}.", uk: "Спонсор: {x}." },

  k_loan: { en: "Loan requested", ro: "Credit solicitat", ru: "Запрашиваемый кредит", uk: "Запитуваний кредит" },
  fit_ok: { en: "within the {x} the cash flow supports", ro: "în limita a {x} pe care le susține fluxul de numerar", ru: "в пределах {x}, которые выдерживает денежный поток", uk: "у межах {x}, які витримує грошовий потік" },
  fit_over: { en: "{x} above what the cash flow supports", ro: "cu {x} peste ce susține fluxul de numerar", ru: "на {x} больше, чем выдерживает денежный поток", uk: "на {x} більше, ніж витримує грошовий потік" },
  k_net: { en: "{x} after the grant", ro: "{x} după grant", ru: "{x} после гранта", uk: "{x} після гранту" },
  k_llcr: { en: "LLCR, P50", ro: "LLCR, P50", ru: "LLCR, P50", uk: "LLCR, P50" },
  k_gear: { en: "Debt to investment", ro: "Datorie la investiție", ru: "Долг к инвестициям", uk: "Борг до інвестицій" },
  k_gear_s: { en: "after the grant", ro: "după grant", ru: "после гранта", uk: "після гранту" },
  k_avg: { en: "Average DSCR, P50, repayment years", ro: "DSCR mediu, P50, anii de rambursare", ru: "Средний DSCR, P50, годы погашения", uk: "Середній DSCR, P50, роки погашення" },
  k_pirr: { en: "Project IRR", ro: "IRR al proiectului", ru: "IRR проекта", uk: "IRR проєкту" },

  terms_h: { en: "Proposed terms", ro: "Condițiile propuse", ru: "Предлагаемые условия", uk: "Пропоновані умови" },
  t_amount: { en: "Amount", ro: "Suma", ru: "Сумма", uk: "Сума" },
  t_currency: { en: "Loan currency", ro: "Moneda creditului", ru: "Валюта кредита", uk: "Валюта кредиту" },
  t_targets: { en: "Cover targets, P50 and P90", ro: "Ținte de acoperire, P50 și P90", ru: "Целевое покрытие, P50 и P90", uk: "Цільове покриття, P50 і P90" },
  t_build: { en: "Construction and reserve", ro: "Construcție și rezervă", ru: "Строительство и резерв", uk: "Будівництво та резерв" },
  t_steps: { en: "Rate by year, %", ro: "Dobânda pe ani, %", ru: "Ставка по годам, %", uk: "Ставка за роками, %" },
  lei: { en: "lei", ro: "lei", ru: "леи", uk: "леї" },

  plant_h: { en: "The plant", ro: "Centrala", ru: "Станция", uk: "Станція" },
  p_place: { en: "Location and coordinates", ro: "Amplasament și coordonate", ru: "Расположение и координаты", uk: "Розташування та координати" },
  p_grid: { en: "Grid nearby (OpenStreetMap)", ro: "Rețeaua din apropiere (OpenStreetMap)", ru: "Сеть рядом (OpenStreetMap)", uk: "Мережа поруч (OpenStreetMap)" },
  g_sub: { en: "{kv} kV substation {name}, {km} km", ro: "stația de {kv} kV {name}, la {km} km", ru: "подстанция {kv} кВ {name}, {km} км", uk: "підстанція {kv} кВ {name}, {km} км" },
  g_line: { en: "{kv} kV line, {km} km", ro: "linia de {kv} kV, la {km} km", ru: "линия {kv} кВ, {km} км", uk: "лінія {kv} кВ, {km} км" },
  g_est: { en: "connection estimate {x}", ro: "racordare estimată la {x}", ru: "оценка подключения {x}", uk: "оцінка підключення {x}" },
  g_near: { en: "near {x}", ro: "de lângă {x}", ru: "около {x}", uk: "біля {x}" },
  g_unnamed: { en: "(unnamed)", ro: "(fără nume)", ru: "(без названия)", uk: "(без назви)" },
  g_note: {
    en: "Grid distances are straight lines from OpenStreetMap (© OpenStreetMap contributors, ODbL); the capacity and the connection point are set by the operator's connection approval.",
    ro: "Distanțele față de rețea sunt în linie dreaptă, din OpenStreetMap (© contribuitorii OpenStreetMap, ODbL); capacitatea și punctul de racordare le stabilește avizul de racordare al operatorului.",
    ru: "Расстояния до сети указаны по прямой по OpenStreetMap (© участники OpenStreetMap, ODbL); мощность и точку подключения определяет разрешение оператора на подключение.",
    uk: "Відстані до мережі вказано по прямій за OpenStreetMap (© учасники OpenStreetMap, ODbL); потужність і точку підключення визначає дозвіл оператора на підключення.",
  },
  p_energy: { en: "Energy a year, P50 and P90", ro: "Producție pe an, P50 și P90", ru: "Выработка в год, P50 и P90", uk: "Генерація на рік, P50 і P90" },
  p_source: { en: "Energy figures from", ro: "Sursa cifrelor de producție", ru: "Источник цифр выработки", uk: "Джерело цифр генерації" },

  cover_years: { en: "The contract covers {n} of the loan's {t} years.", ro: "Contractul acoperă {n} din cei {t} ani ai creditului.", ru: "Договор покрывает {n} из {t} лет кредита.", uk: "Договір покриває {n} з {t} років кредиту." },
  cover_none: {
    en: "No contract: all energy is sold at market prices. Lenders usually ask for a contract over the loan's life.",
    ro: "Fără contract: toată energia se vinde la prețul pieței. Băncile cer de obicei un contract pe durata creditului.",
    ru: "Без договора: вся энергия продаётся по рыночным ценам. Банки обычно просят договор на срок кредита.",
    uk: "Без договору: уся енергія продається за ринковими цінами. Банки зазвичай просять договір на строк кредиту.",
  },
  headroom_h: { en: "Room before the cover target", ro: "Rezerva până la ținta de acoperire", ru: "Запас до целевого покрытия", uk: "Запас до цільового покриття" },
  col_yield: { en: "Energy", ro: "Producție", ru: "Выработка", uk: "Генерація" },
  col_dscr: { en: "Lowest DSCR", ro: "DSCR minim", ru: "Мин. DSCR", uk: "Мін. DSCR" },

  docs_h: { en: "Permits and documents", ro: "Autorizații și documente", ru: "Разрешения и документы", uk: "Дозволи та документи" },
  missing_h: { en: "Still missing before the credit decision", ro: "Ce lipsește încă înainte de decizia de creditare", ru: "Чего ещё не хватает до кредитного решения", uk: "Чого ще бракує до кредитного рішення" },
  missing_none: {
    en: "Nothing: every item on the checklist is done or marked not needed.",
    ro: "Nimic: fiecare element din listă este gata sau marcat ca nenecesar.",
    ru: "Ничего: каждый пункт перечня выполнен или отмечен как не требуемый.",
    uk: "Нічого: кожен пункт переліку виконано або позначено як непотрібний.",
  },
  m_by: { en: "responsible: {x}", ro: "responsabil: {x}", ru: "ответственный: {x}", uk: "відповідальний: {x}" },
  m_due: { en: "due {x}", ro: "termen {x}", ru: "срок {x}", uk: "термін {x}" },
  gap_borrower: {
    en: "Name the borrower (the project company) and the sponsor on the plant.",
    ro: "Numiți împrumutatul (compania de proiect) și sponsorul în fișa centralei.",
    ru: "Укажите заёмщика (проектную компанию) и спонсора в карточке станции.",
    uk: "Вкажіть позичальника (проєктну компанію) і спонсора в картці станції.",
  },
  gap_study: {
    en: "The yield study is marked done, but its P50 and P90 are not entered for {x}: the figures in this summary still come from public data (the screening or PVGIS).",
    ro: "Studiul de producție este marcat ca gata, dar P50 și P90 nu sunt introduse pentru {x}: cifrele din acest rezumat vin încă din date publice (estimarea sau PVGIS).",
    ru: "Исследование выработки отмечено как готовое, но P50 и P90 не введены для: {x}. Цифры этого резюме пока взяты из открытых данных (оценка или PVGIS).",
    uk: "Дослідження генерації позначено як готове, але P50 і P90 не введено для: {x}. Цифри цього резюме поки взято з відкритих даних (оцінка або PVGIS).",
  },

  gap_moved: {
    en: "The public {x} figures were looked up for a point {km} km from the site: look them up again at the site.",
    ro: "Cifrele publice pentru {x} au fost căutate pentru un punct aflat la {km} km de amplasament: trebuie căutate din nou pe amplasament.",
    ru: "Открытые данные ({x}) запрошены для точки в {km} км от площадки: их нужно запросить заново на площадке.",
    uk: "Відкриті дані ({x}) запитано для точки за {km} км від майданчика: їх треба запитати знову на майданчику.",
  },
  gap_moved_short: { en: "{x} figures looked up for another point", ro: "{x}: cifre căutate pentru alt punct", ru: "{x}: данные для другой точки", uk: "{x}: дані для іншої точки" },
  ax_title: { en: "Annex: grid connection", ro: "Anexă: racordarea la rețea", ru: "Приложение: подключение к сети", uk: "Додаток: підключення до мережі" },
  ax_lead: {
    en: "{name} is planned to connect to {point}, through {km} km of line ({how}). Estimated cost {cost}; the line loses {loss} of the energy, {mwh} a year.",
    ro: "{name} este planificată să se racordeze la {point}, printr-o linie de {km} km ({how}). Cost estimat {cost}; linia pierde {loss} din energie, {mwh} pe an.",
    ru: "{name} планируется подключить к {point} линией длиной {km} км ({how}). Оценка стоимости {cost}; линия теряет {loss} энергии, {mwh} в год.",
    uk: "{name} планується підключити до {point} лінією довжиною {km} км ({how}). Оцінка вартості {cost}; лінія втрачає {loss} енергії, {mwh} на рік.",
  },
  ax_lead_none: {
    en: "No connection option is applied yet: the summary uses the grid cost entered for the plant, {cost}. The nearest points are compared below.",
    ro: "Nicio opțiune de racordare nu este aplicată încă: rezumatul folosește costul racordării introdus pentru centrală, {cost}. Punctele cele mai apropiate sunt comparate mai jos.",
    ru: "Вариант подключения ещё не применён: резюме использует введённую стоимость подключения станции, {cost}. Ближайшие точки сравниваются ниже.",
    uk: "Варіант підключення ще не застосовано: резюме використовує введену вартість підключення станції, {cost}. Найближчі точки порівнюються нижче.",
  },
  ax_stale: {
    en: "The route changed after this option was applied: on the current route it would cost {cost}, which the summary does not yet include.",
    ro: "Traseul s-a schimbat după aplicarea acestei opțiuni: pe traseul actual ar costa {cost}, sumă pe care rezumatul nu o include încă.",
    ru: "Трасса изменилась после применения варианта: по текущей трассе он стоил бы {cost}, и резюме этого ещё не учитывает.",
    uk: "Трасу змінено після застосування варіанта: за поточною трасою він коштував би {cost}, і резюме цього ще не враховує.",
  },
  ax_pt_sub: { en: "the substation {name}", ro: "stația {name}", ru: "подстанции {name}", uk: "підстанції {name}" },
  ax_pt_line: { en: "the line {name}, as a tap", ro: "linia {name}, prin derivație", ru: "линии {name} через отпайку", uk: "лінії {name} через відгалуження" },
  ax_drawn: { en: "a route drawn on the map", ro: "traseu trasat pe hartă", ru: "трасса нарисована на карте", uk: "трасу намальовано на карті" },
  ax_straight: { en: "the straight line x {f}", ro: "linia dreaptă x {f}", ru: "прямая x {f}", uk: "пряма x {f}" },
  ax_options: { en: "Options compared", ro: "Opțiunile comparate", ru: "Сравнение вариантов", uk: "Порівняння варіантів" },
  ax_not_checked: { en: "The route has not been checked against OpenStreetMap yet.", ro: "Traseul nu a fost încă verificat în OpenStreetMap.", ru: "Трасса ещё не проверена по OpenStreetMap.", uk: "Трасу ще не перевірено за OpenStreetMap." },
  ax_steps: { en: "Where the connection stands", ro: "Stadiul racordării", ru: "Статус подключения", uk: "Стан підключення" },
  ax_open_h: { en: "What only the operator can answer", ro: "Ce poate răspunde doar operatorul", ru: "На что может ответить только оператор", uk: "На що може відповісти лише оператор" },
  ax_open: {
    en: "Whether the point has spare capacity for the plant; the connection point and voltage it will set; the works and reinforcements it will require, and who pays them; and the timeline. All of these come in the connection approval.",
    ro: "Dacă punctul are capacitate liberă pentru centrală; punctul și tensiunea de racordare pe care le va stabili; lucrările și întăririle de rețea pe care le va cere și cine le plătește; și termenele. Toate acestea vin în avizul de racordare.",
    ru: "Есть ли в точке свободная мощность для станции; какую точку и напряжение подключения он установит; какие работы и усиления сети потребует и кто за них платит; и сроки. Всё это указывается в разрешении на подключение.",
    uk: "Чи є в точці вільна потужність для станції; яку точку й напругу підключення він встановить; які роботи й посилення мережі вимагатиме та хто за них платить; і терміни. Усе це зазначається в дозволі на підключення.",
  },
  ax_basis: {
    en: "Line capacity and losses from typical conductor tables ({cond}); costs are the developer's figures; distances and crossings from OpenStreetMap (© OpenStreetMap contributors, ODbL), looked up {date}.",
    ro: "Capacitatea și pierderile liniei din tabele tipice de conductoare ({cond}); costurile sunt cifrele dezvoltatorului; distanțele și traversările din OpenStreetMap (© contribuitorii OpenStreetMap, ODbL), căutate la {date}.",
    ru: "Пропускная способность и потери линии по типовым таблицам проводов ({cond}); затраты введены девелопером; расстояния и пересечения по OpenStreetMap (© участники OpenStreetMap, ODbL), получены {date}.",
    uk: "Пропускна здатність і втрати лінії за типовими таблицями проводів ({cond}); витрати введено девелопером; відстані й перетини за OpenStreetMap (© учасники OpenStreetMap, ODbL), отримано {date}.",
  },
  basis_h: { en: "Basis of the figures", ro: "Baza cifrelor", ru: "Основа расчётов", uk: "Основа розрахунків" },
  basis_p: {
    en: "Every figure is computed by the VoltMira model of this plant, the same model as the Excel workbook in this pack, where each formula can be checked. Prices, costs and terms are the developer's inputs; energy comes from: {src}.",
    ro: "Fiecare cifră este calculată de modelul VoltMira al acestei centrale, același model ca registrul Excel din acest pachet, unde fiecare formulă poate fi verificată. Prețurile, costurile și condițiile sunt datele dezvoltatorului; producția vine din: {src}.",
    ru: "Каждая цифра рассчитана моделью VoltMira для этой станции, той же моделью, что и Excel-файл в этом пакете, где можно проверить каждую формулу. Цены, затраты и условия введены девелопером; выработка взята из: {src}.",
    uk: "Кожну цифру розраховано моделлю VoltMira для цієї станції, тією самою моделлю, що й Excel-файл у цьому пакеті, де можна перевірити кожну формулу. Ціни, витрати та умови введено девелопером; генерацію взято з: {src}.",
  },
  tax_basis: { en: "Corporate income tax: {x}; CFADS is after it.", ro: "Impozitul pe venit: {x}; CFADS este după impozit.", ru: "Налог на прибыль: {x}; CFADS после налога.", uk: "Податок на прибуток: {x}; CFADS після податку." },
  llcr_note: {
    en: "LLCR: the cash flow available for debt service over the loan's life, discounted at the loan rate, divided by the loan at financial close.",
    ro: "LLCR: fluxul de numerar disponibil pentru serviciul datoriei pe durata creditului, actualizat la dobânda creditului, împărțit la creditul la închiderea finanțării.",
    ru: "LLCR: денежный поток для обслуживания долга за срок кредита, дисконтированный по ставке кредита, делённый на сумму кредита на дату финансового закрытия.",
    uk: "LLCR: грошовий потік для обслуговування боргу за строк кредиту, дисконтований за ставкою кредиту, поділений на суму кредиту на дату фінансового закриття.",
  },
  disclaimer: {
    en: "This summary prepares a credit application. It is not a bank's credit assessment, an offer or a commitment to lend; each bank applies its own criteria and asks for its own documents.",
    ro: "Acest rezumat pregătește o cerere de credit. Nu este evaluarea de credit a unei bănci, o ofertă sau un angajament de creditare; fiecare bancă aplică propriile criterii și cere propriile documente.",
    ru: "Это резюме готовит кредитную заявку. Оно не является кредитной оценкой банка, предложением или обязательством кредитовать; каждый банк применяет свои критерии и запрашивает свои документы.",
    uk: "Це резюме готує кредитну заявку. Воно не є кредитною оцінкою банку, пропозицією чи зобов'язанням кредитувати; кожен банк застосовує власні критерії та запитує власні документи.",
  },
  not_found: { en: "This plant is not in the portfolio any more.", ro: "Această centrală nu mai este în portofoliu.", ru: "Этой станции больше нет в портфеле.", uk: "Цієї станції більше немає в портфелі." },

  // ---- the manifest in the ZIP
  mf_title: { en: "Bank submission pack: {name}", ro: "Pachet pentru bancă: {name}", ru: "Пакет для банка: {name}", uk: "Пакет для банку: {name}" },
  mf_by: { en: "Prepared by {co} on {date}, with VoltMira.", ro: "Pregătit de {co} la {date}, cu VoltMira.", ru: "Подготовлено: {co}, {date}, в VoltMira.", uk: "Підготовлено: {co}, {date}, у VoltMira." },
  mf_contents: { en: "Contents", ro: "Conținut", ru: "Содержание", uk: "Зміст" },
  mf_summary: {
    en: "Credit summary in {l}: the request, terms, plant, revenue, debt cover, stress tests, risks, permits and what is still missing, with an annex on the grid connection when one was studied.",
    ro: "Rezumatul de credit în {l}: cererea, condițiile, centrala, venitul, acoperirea datoriei, testele de stres, riscurile, autorizațiile și ce lipsește încă, cu o anexă despre racordarea la rețea când a fost studiată.",
    ru: "Кредитное резюме ({l}): заявка, условия, станция, выручка, покрытие долга, стресс-тесты, риски, разрешения и чего ещё не хватает, с приложением о подключении к сети, если оно изучалось.",
    uk: "Кредитне резюме ({l}): заявка, умови, станція, виручка, покриття боргу, стрес-тести, ризики, дозволи та чого ще бракує, з додатком про підключення до мережі, якщо його вивчали.",
  },
  mf_model: {
    en: "Excel model of this plant with live formulas: assumptions, cash flow, debt sizing and stress results.",
    ro: "Modelul Excel al acestei centrale cu formule active: ipoteze, flux de numerar, dimensionarea datoriei și testele de stres.",
    ru: "Excel-модель этой станции с живыми формулами: допущения, денежный поток, размер долга и стресс-тесты.",
    uk: "Excel-модель цієї станції з живими формулами: припущення, грошовий потік, розмір боргу та стрес-тести.",
  },
  mf_permits: {
    en: "The permit checklist, one row per item, in Romanian and English.",
    ro: "Lista autorizațiilor, câte un rând pe element, în română și engleză.",
    ru: "Перечень разрешений, по строке на пункт, на румынском и английском.",
    uk: "Перелік дозволів, по рядку на пункт, румунською та англійською.",
  },
  mf_pdf_fail: {
    en: "NOTE: the credit summary in {l} could not be built this time and is NOT in this archive. Open it from the plant and add it before sending.",
    ro: "ATENȚIE: rezumatul de credit în {l} nu a putut fi generat acum și NU este în această arhivă. Deschideți-l din fișa centralei și adăugați-l înainte de trimitere.",
    ru: "ВНИМАНИЕ: кредитное резюме ({l}) сейчас не удалось собрать, и его НЕТ в архиве. Откройте его в карточке станции и добавьте перед отправкой.",
    uk: "УВАГА: кредитне резюме ({l}) зараз не вдалося зібрати, і його НЕМАЄ в архіві. Відкрийте його в картці станції та додайте перед надсиланням.",
  },
  mf_docs: {
    en: "The documents on file are in 05-documents, one folder per checklist item.",
    ro: "Documentele depuse sunt în 05-documents, câte un dosar pentru fiecare element din listă.",
    ru: "Приложенные документы находятся в 05-documents, по папке на каждый пункт перечня.",
    uk: "Додані документи містяться в 05-documents, по теці на кожен пункт переліку.",
  },
  mf_docs_without: {
    en: "Items with no document on file: {x}.",
    ro: "Elemente fără document depus: {x}.",
    ru: "Пункты без документов: {x}.",
    uk: "Пункти без документів: {x}.",
  },
  mf_doc_fail: {
    en: "NOTE: {x} could not be read this time and is NOT in this archive. Download the pack again, or send it separately.",
    ro: "ATENȚIE: {x} nu a putut fi citit acum și NU este în această arhivă. Descărcați pachetul din nou sau trimiteți-l separat.",
    ru: "ВНИМАНИЕ: {x} сейчас не удалось прочитать, и его НЕТ в архиве. Скачайте пакет ещё раз или отправьте файл отдельно.",
    uk: "УВАГА: {x} зараз не вдалося прочитати, і його НЕМАЄ в архіві. Завантажте пакет ще раз або надішліть файл окремо.",
  },
  mf_not_included: {
    en: "Not included: the permits, contracts, studies and other documents themselves. Attach them from your own folder; the checklist shows which exist.",
    ro: "Nu sunt incluse: autorizațiile, contractele, studiile și celelalte documente propriu-zise. Atașați-le din dosarul propriu; lista arată care există.",
    ru: "Не включены: сами разрешения, договоры, исследования и другие документы. Приложите их из своей папки; перечень показывает, какие есть.",
    uk: "Не включено: самі дозволи, договори, дослідження та інші документи. Додайте їх зі своєї теки; перелік показує, які є.",
  },
};

export const BT = T;

/** The word for a key in a language (English when missing), with {placeholders} filled; "_one" picks the singular. */
export function bt(key, lang = "en", vars = null) {
  const e = (vars && Number(vars.n) === 1 && T[key + "_one"]) || T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}
