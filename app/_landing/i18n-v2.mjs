// app/_landing/i18n-v2.mjs — the v2 landing copy in Romanian and Russian.
//
// Keys map 1:1 onto the data-i18n attributes in landing-en-v2.html. Values are
// the element's inner HTML, so every tag, class and attribute must survive the
// translation untouched — lib/landing.js swaps innerHTML wholesale and does not
// re-parse. Change the markup in the HTML and you must change it here too.
//
// English is deliberately near-empty: substituteElements leaves an element
// alone when its key is absent, so the authored English simply stands. Only the
// document metadata is listed for `en`.
//
// Keys omitted from ro/ru on purpose: the wordmark, the e-mail address, the
// social network names, personal and place names, the export filename, and the
// figures inside the counters (their data-count attributes drive the animation
// and must stay machine-readable).
//
// TERMINOLOGY, supplied by the client — these are industry terms with legal
// weight in the market, not free translation choices:
//
//   net metering  ro: compensare cantitativă        ru: сальдирование
//   net billing   ro: net billing (term borrowed)   ru: нет-биллинг
//   prosumer      ro: prosumator                    ru: просюмер
//   payback       ro: perioada de recuperare a      ru: срок окупаемости
//                     investiției / recuperare
//
// Decimal separators follow each locale: 8,4 kW and 18.240 € in Romanian,
// 8,4 кВт in Russian.

export const I18N_V2 = {
  en: {
    meta_title: "VoltMira — Solar quotes your clients can fact-check",
    meta_desc:
      "Solar quoting software for installers: honest three-band payback from real PVGIS data, tracked proposals with open alerts, WhatsApp sharing, one-tap acceptance and a full pipeline. Free trial. Romania & Moldova.",
  },

  ro: {
    meta_title: "VoltMira — Oferte solare pe care clienții le pot verifica",
    meta_desc:
      "Software de ofertare fotovoltaică pentru instalatori: recuperarea investiției în trei scenarii oneste, din date PVGIS reale, oferte urmărite cu alerte la deschidere, partajare pe WhatsApp și acceptare dintr-o atingere. Probă gratuită. România și Moldova.",

    // nav
    v2_002: "Motorul onestității",
    v2_003: "Oferte urmărite",
    v2_004: "Prețuri",
    v2_005: "Întrebări",
    v2_006: "Demo live",
    v2_007: "Autentificare",
    v2_012: 'Începe gratuit',

    // hero
    v2_013: "Pentru instalatori fotovoltaici · România și Moldova",
    v2_147:
      'Oferte solare<br>pe care clienții<br><span class="hl">le pot verifica.<svg viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M4 30 C 80 12, 180 34, 260 20 S 380 22, 396 14"/></svg></span>',
    v2_014:
      "Majoritatea programelor de ofertare arată un singur număr măgulitor. VoltMira arată <b>trei scenarii oneste</b>, calculate din date solare reale pentru acoperișul clientului — și îți spune în clipa în care acesta deschide oferta.",
    v2_015: 'Începe gratuit',
    v2_016: "Vezi cum funcționează",
    v2_017: "Fără card bancar · Gratuit în perioada beta · Configurare în 2 minute",
    v2_018:
      '<img src="/landing/hero-rooftop.jpg" alt="Instalație fotovoltaică rezidențială pe un acoperiș de țiglă, sub cer senin"> <span class="cap">Casa Popescu · Iași</span>',

    // hero proposal card
    v2_019: "Deschisă de 2×",
    v2_020: "8,4 kW pe acoperiș · 12 panouri + baterie",
    v2_021: "Economii totale 18.240 €",
    v2_022: "Recuperarea investiției — trei scenarii oneste",
    v2_023: '<span>Pesim.</span><b>9,1<small style="font-size:9px;font-weight:600"> ani</small></b>',
    v2_024: '<span>Așteptat</span><b>7,3<small style="font-size:9px;font-weight:600"> ani</small></b>',
    v2_025: '<span>Optim.</span><b>6,2<small style="font-size:9px;font-weight:600"> ani</small></b>',
    v2_026: "Acceptă oferta ✓",

    // stat strip
    v2_027: "<b>3 scenarii</b><span>Pesimist · așteptat · optimist la fiecare ofertă</span>",
    v2_028: "<b>Date satelitare PVGIS</b><span>Iradianță reală pentru acel acoperiș, nu o medie</span>",
    v2_029: "<b>RO · MD</b><span>Compensare cantitativă, net billing și tarife feed-in incluse</span>",
    v2_030: "<b>&lt; 2 min</b><span>De la adresă la o ofertă gata de trimis</span>",

    // how it works
    v2_031: "De la adresă la ofertă semnată",
    v2_032: "Construit pentru instalatorul<br>care stă pe acoperiș.",
    v2_033: "Scrie adresa",
    v2_034:
      "VoltMira preia iradianța reală pentru acel acoperiș din <b>PVGIS</b> și aplică automat schema tarifară potrivită pieței.",
    v2_035: "Primești trei numere oneste",
    v2_036:
      "Pesimist, așteptat, optimist — cu <b>fiecare ipoteză tipărită</b> pe ofertă, gata de susținut la masa din bucătărie.",
    v2_037: "Trimite linkul, urmărește activitatea",
    v2_038:
      "Un link pe telefonul clientului. Vezi <b>deschideri, minute vizualizate, comutări de baterie</b> — iar Acceptă aduce afacerea în pipeline.",

    // honesty engine
    v2_039: "Motorul onestității",
    v2_040: "Un singur număr e un discurs de vânzare.<br>Trei numere sunt adevărul.",
    v2_041:
      "Fiecare ofertă VoltMira arată perioada de recuperare a investiției în ipoteze pesimiste, așteptate și optimiste — cu fiecare ipoteză tipărită pe ofertă. Clienții au încredere în ce pot verifica. Încrederea închide contracte.",
    v2_042: "Pesimist",
    v2_043: '<b class="cu" data-count="6.6" data-decimals="1">6,6</b><small> ani</small>',
    v2_044:
      "<b>Soare puțin, prețuri plate.</b> −8% producție, degradare 0,8%/an, zero inflație la energie. Dacă și acest număr funcționează, afacerea e sigură.",
    v2_045: "Așteptat",
    v2_046: '<b class="cu" data-count="6.0" data-decimals="1">6,0</b><small> ani</small>',
    v2_047:
      "<b>Rezultatul cel mai probabil.</b> Producție PVGIS pentru acel acoperiș, degradare 0,5%/an, inflație 3%. Numărul pe care îl susții.",
    v2_048: "Optimist",
    v2_049: '<b class="cu" data-count="5.7" data-decimals="1">5,7</b><small> ani</small>',
    v2_050:
      "<b>Dacă prețurile continuă să crească.</b> +8% producție, degradare 0,3%/an, inflație 5%. Arătat onest ca cel mai bun caz — niciodată ca titlu.",
    v2_051: "Tipărit pe fiecare ofertă",
    v2_052: '<span class="k">Producție (PVGIS)</span><span class="v">1.168 kWh/kWp</span>',
    v2_053: '<span class="k">Degradare</span><span class="v">0,5%/an</span>',
    v2_054: '<span class="k">Inflația prețului</span><span class="v">3%/an</span>',
    v2_055: '<span class="k">Schema tarifară</span><span class="v">Compensare cantitativă 1:1</span>',

    // break section
    v2_056: "De ce trec instalatorii la VoltMira",
    v2_057: "Nu un tabel Excel.<br>O ofertă în care clientul <em>crede.</em>",
    v2_058:
      "Clienții au auzit prea multe promisiuni perfecte. Un interval cu ipoteze vizibile se citește ca inginerie; un singur număr roz se citește ca vânzare. Când până și cel mai prost caz al tău bate factura lor la energie, afacerea se apără singură.",
    v2_059: 'Vezi prețurile',
    v2_061: "<span>Client</span><span>kW</span><span>Recuperare</span>",
    v2_062: "<span>Popescu I.</span><span>6,0</span><span>7,2 ani</span>",
    v2_063: "<span>Rusu V.</span><span>8,4</span><span>6,1 ani</span>",
    v2_064: "<span>Ceban A.</span><span>4,5</span><span>9,4 ani</span>",
    v2_065: "<span>Ionescu M.</span><span>5,2</span><span>&mdash;</span>",
    v2_066: '<span class="mq-badge">Ofertă solară</span><span class="mq-open">Deschisă de 2&times;</span>',
    v2_068: "8,4 kW &middot; Chi&#537;in&#259;u",
    v2_069: "<span>Pesim.</span><b>6,6<small> ani</small></b>",
    v2_070: "<span>Așteptat</span><b>6,0<small> ani</small></b>",
    v2_071: "<span>Optim.</span><b>5,7<small> ani</small></b>",
    v2_072: "Acceptă oferta &#10003;",

    // tracked proposals
    v2_073: "Oferte urmărite",
    v2_074: "Află clipa<br>în care o deschid.",
    v2_075:
      "Nu mai ghici când să revii. Trimite un link viu în loc de un PDF mort — și vezi ce se întâmplă de cealaltă parte.",
    v2_076:
      '<span class="dot">✓</span><span><b>Deschideri și timp vizualizat</b> — „Ion a deschis-o de două ori, câte 3 minute” bate „trimisă marțea trecută, niciun răspuns”.</span>',
    v2_077:
      '<span class="dot">✓</span><span><b>Semnale de interacțiune</b> — a comutat bateria? Asta e o întrebare de cumpărare. Sună-l despre baterii.</span>',
    v2_078:
      '<span class="dot">✓</span><span><b>Acceptare din pagină</b> — o atingere pe telefonul lui marchează afacerea drept Câștigată în pipeline.</span>',
    v2_079:
      '<span class="dot">✓</span><span><b>Datele tale rămân ale tale</b> — exporți fiecare ofertă și client în CSV dintr-un clic, fără blocare.</span>',
    v2_080: "Fluxul tău de activitate",
    v2_081:
      '<span class="ic">◉</span><span class="tx"><b>Ion Popescu</b> a deschis <b>Casa Popescu</b></span><time>chiar acum</time>',
    v2_082:
      '<span class="ic">⏱</span><span class="tx">Vizualizat <b>3m 34s</b> — cel mai mult până acum</span><time>2m</time>',
    v2_083:
      '<span class="ic">⚡</span><span class="tx">A activat <b>bateria</b> · recuperare recalculată</span><time>3m</time>',
    v2_084:
      '<span class="ic">◉</span><span class="tx">A deschis din nou — <b>a 2-a vizită azi</b></span><time>1h</time>',
    v2_085:
      '<span class="ic g">✓</span><span class="tx"><b>A acceptat oferta</b> — proiect marcat Câștigat</span><time>1h</time>',

    // scale
    v2_086: "De la un acoperiș la un parc întreg",
    v2_087: "Aceeași matematică onestă,<br>6 kW sau 600 kW.",
    v2_148:
      '<i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></i>Trei scenarii oneste',
    v2_088:
      "Pesimist, așteptat, optimist — fiecare ipoteză tipărită pe ofertă, gata de susținut.",
    v2_149:
      '<i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></i>Date PVGIS pentru fiecare acoperiș',
    v2_089:
      "Producție satelitară pentru coordonatele exacte, nu o medie națională aproximativă.",
    v2_150:
      '<i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></i>Vezi când o citesc',
    v2_090:
      "Deschideri, minute vizualizate, baterie comutată — știi exact când să suni.",

    // pricing
    v2_091: "Prețuri",
    v2_092: "Costă mai puțin decât cafeaua<br>de la o afacere pierdută.",
    v2_093:
      "Probă gratuită 21 de zile — fără card. O singură afacere în plus pe an plătește VoltMira pentru ~20 de ani.",
    v2_094: "Pro",
    v2_095: '<b class="cu" data-count="49" data-prefix="€">49 €</b><small>/lună</small>',
    v2_096: "Pentru instalatorul care vinde",
    v2_097: "Logoul tău pe fiecare ofertă și PDF",
    v2_098: "Linkuri urmărite + alerte la deschidere",
    v2_099: "Widget de lead-uri pentru site",
    v2_100: "Clienți salvați și pipeline complet",
    v2_101: "Începe gratuit",
    v2_102: "Echipă",
    v2_103: '<b class="cu" data-count="119" data-prefix="€">119 €</b><small>/lună</small>',
    v2_104: "Până la 5 persoane, un singur pipeline",
    v2_105: "Tot ce include Pro",
    v2_106: "5 locuri, cu responsabili de proiect",
    v2_107: "Clienți partajați și analiza ratei de câștig",
    v2_108: "Suport prioritar în RO/RU/EN",
    v2_109: "Începe gratuit",
    v2_110: "Enterprise",
    v2_111: '<b style="font-size:22px">Personalizat</b>',
    v2_112: "Pentru instalatori cu mai multe filiale",
    v2_113: "Tot ce include Echipă, locuri nelimitate",
    v2_114: "Jurnal complet de audit al fiecărei modificări",
    v2_115: "Reguli personalizate de subvenții și tarife",
    v2_116: "Manager dedicat și SLA",
    v2_117: "Contactează-ne",

    // faq
    v2_118: "Întrebări pe care le pun instalatorii",
    v2_119: "Întrebări corecte.",
    v2_151: 'De unde vin numerele solare?<span class="pl">+</span>',
    v2_120:
      "Producția anuală și lunară vin din PVGIS, baza de date solare a Comisiei Europene, derivată din satelit, pentru coordonatele exacte ale acoperișului. Schemele tarifare se aplică automat, în funcție de piață. Fiecare ipoteză este tipărită pe ofertă.",
    v2_152: 'De ce să arăt un număr pesimist? Nu sperie clienții?<span class="pl">+</span>',
    v2_121:
      "Dimpotrivă, în practică. Un interval cu ipoteze vizibile se citește ca inginerie; un singur număr roz se citește ca vânzare. Când până și cel mai prost caz al tău bate factura lor la energie, afacerea se apără singură.",
    v2_153: 'Funcționează pentru net billing-ul din Moldova?<span class="pl">+</span>',
    v2_122:
      "Da — acolo suntem acasă. Prețul mic de export din Moldova face din autoconsum tot jocul, așa că motorul îl modelează lună de lună și evaluează corect stocarea în baterii.",
    v2_154: 'Cum încep?<span class="pl">+</span>',
    v2_123:
      "Te înregistrezi și ești înăuntru — fără listă de așteptare, fără card. Acces complet ca să construiești oferte și să trimiți propuneri urmărite imediat, gratuit pe toată perioada beta.",

    // final cta + footer
    v2_124: "Fii instalatorul ale cărui<br>numere rezistă.",
    v2_125:
      "Începe gratuit astăzi în România și Moldova — fără listă de așteptare, fără card, configurare în câteva minute.",
    v2_126: 'Începe gratuit',
    v2_127:
      "<span>Fără card bancar</span><span>Gratuit în beta</span><span>Anulezi oricând</span>",
    v2_129:
      "Instrumentul de ofertare pe care clienții tăi îl pot verifica. Construit pentru instalatori din Moldova și România.",
    v2_130: "Motorul onestității",
    v2_131: "Oferte urmărite",
    v2_132: "Prețuri",
    v2_133: "Întrebări",
    v2_134: "Autentificare",
    v2_135: "Începe gratuit",
    v2_136: "Demo live",
    v2_137: "Recomandă un instalator",
    v2_141: "© 2026 VoltMira. Toate drepturile rezervate.",
    v2_143: "Confidențialitate",
    v2_144: "Termeni",
    v2_145: "Rambursări",
    v2_146: "Credite foto",
  },

  ru: {
    meta_title: "VoltMira — Солнечные расчёты, которые клиент может проверить",
    meta_desc:
      "Софт для расчёта солнечных станций: срок окупаемости в трёх честных сценариях на реальных данных PVGIS, отслеживаемые коммерческие предложения с уведомлениями об открытии, отправка в WhatsApp и приём в одно касание. Бесплатный доступ. Румыния и Молдова.",

    // nav
    v2_002: "Движок честности",
    v2_003: "Отслеживаемые предложения",
    v2_004: "Тарифы",
    v2_005: "Вопросы",
    v2_006: "Демо",
    v2_007: "Войти",
    v2_012: 'Начать бесплатно',

    // hero
    v2_013: "Для монтажников СЭС · Румыния и Молдова",
    v2_147:
      'Солнечные расчёты,<br>которые клиент<br><span class="hl">может проверить.<svg viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M4 30 C 80 12, 180 34, 260 20 S 380 22, 396 14"/></svg></span>',
    v2_014:
      "Большинство программ показывают одну красивую цифру. VoltMira показывает <b>три честных сценария</b>, рассчитанных по реальным солнечным данным для крыши клиента, — и сообщает в тот момент, когда он открыл предложение.",
    v2_015: 'Начать бесплатно',
    v2_016: "Как это работает",
    v2_017: "Без карты · Бесплатно в бете · Настройка за 2 минуты",
    v2_018:
      '<img src="/landing/hero-rooftop.jpg" alt="Солнечные панели на черепичной крыше частного дома под ясным небом"> <span class="cap">Casa Popescu · Яссы</span>',

    // hero proposal card
    v2_019: "Открыто 2×",
    v2_020: "8,4 кВт на крыше · 12 панелей + аккумулятор",
    v2_021: "Экономия за срок службы 18 240 €",
    v2_022: "Срок окупаемости — три честных сценария",
    v2_023: '<span>Пессим.</span><b>9,1<small style="font-size:9px;font-weight:600"> лет</small></b>',
    v2_024: '<span>Ожидаемый</span><b>7,3<small style="font-size:9px;font-weight:600"> лет</small></b>',
    v2_025: '<span>Оптим.</span><b>6,2<small style="font-size:9px;font-weight:600"> лет</small></b>',
    v2_026: "Принять предложение ✓",

    // stat strip
    v2_027: "<b>3 сценария</b><span>Пессимистичный · ожидаемый · оптимистичный в каждом расчёте</span>",
    v2_028: "<b>Спутниковые данные PVGIS</b><span>Реальная инсоляция для конкретной крыши, а не среднее</span>",
    v2_029: "<b>RO · MD</b><span>Сальдирование, нет-биллинг и зелёный тариф уже учтены</span>",
    v2_030: "<b>&lt; 2 мин</b><span>От адреса до готового предложения</span>",

    // how it works
    v2_031: "От адреса до подписанного расчёта",
    v2_032: "Сделано для монтажника,<br>который стоит на крыше.",
    v2_033: "Введите адрес",
    v2_034:
      "VoltMira берёт реальную инсоляцию для этой крыши из <b>PVGIS</b> и автоматически применяет тарифную схему нужного рынка.",
    v2_035: "Получаете три честных числа",
    v2_036:
      "Пессимистичное, ожидаемое, оптимистичное — и <b>каждое допущение напечатано</b> в предложении, готовое к разговору за кухонным столом.",
    v2_037: "Отправьте ссылку и следите за лентой",
    v2_038:
      "Одна ссылка на телефон клиента. Вы видите <b>открытия, минуты просмотра, включение аккумулятора</b> — а «Принять» переводит сделку в вашу воронку.",

    // honesty engine
    v2_039: "Движок честности",
    v2_040: "Одно число — это продажа.<br>Три числа — это правда.",
    v2_041:
      "Каждый расчёт VoltMira показывает срок окупаемости при пессимистичных, ожидаемых и оптимистичных допущениях — и каждое допущение напечатано в предложении. Клиенты доверяют тому, что могут проверить. Доверие закрывает сделки.",
    v2_042: "Пессимистичный",
    v2_043: '<b class="cu" data-count="6.6" data-decimals="1">6,6</b><small> лет</small>',
    v2_044:
      "<b>Мало солнца, цены на месте.</b> −8% выработки, деградация 0,8%/год, нулевая инфляция на электроэнергию. Если работает даже это число — сделка надёжна.",
    v2_045: "Ожидаемый",
    v2_046: '<b class="cu" data-count="6.0" data-decimals="1">6,0</b><small> лет</small>',
    v2_047:
      "<b>Самый вероятный исход.</b> Выработка PVGIS для конкретной крыши, деградация 0,5%/год, инфляция 3%. Число, за которое вы отвечаете.",
    v2_048: "Оптимистичный",
    v2_049: '<b class="cu" data-count="5.7" data-decimals="1">5,7</b><small> лет</small>',
    v2_050:
      "<b>Если цены продолжат расти.</b> +8% выработки, деградация 0,3%/год, инфляция 5%. Показан честно как лучший случай — и никогда как заголовок.",
    v2_051: "Печатается в каждом предложении",
    v2_052: '<span class="k">Выработка (PVGIS)</span><span class="v">1 168 кВт·ч/кВт</span>',
    v2_053: '<span class="k">Деградация</span><span class="v">0,5%/год</span>',
    v2_054: '<span class="k">Инфляция цен</span><span class="v">3%/год</span>',
    v2_055: '<span class="k">Тарифная схема</span><span class="v">Сальдирование 1:1</span>',

    // break section
    v2_056: "Почему монтажники переходят",
    v2_057: "Не таблица Excel.<br>Расчёт, которому клиент <em>верит.</em>",
    v2_058:
      "Клиенты слышали слишком много идеальных обещаний. Диапазон с видимыми допущениями читается как инженерия; одна красивая цифра читается как продажа. Когда даже ваш худший сценарий выгоднее их счёта за электричество, сделка защищает себя сама.",
    v2_059: 'Смотреть тарифы',
    v2_061: "<span>Клиент</span><span>кВт</span><span>Окупаемость</span>",
    v2_062: "<span>Popescu I.</span><span>6,0</span><span>7,2 лет</span>",
    v2_063: "<span>Rusu V.</span><span>8,4</span><span>6,1 лет</span>",
    v2_064: "<span>Ceban A.</span><span>4,5</span><span>9,4 лет</span>",
    v2_065: "<span>Ionescu M.</span><span>5,2</span><span>&mdash;</span>",
    v2_066: '<span class="mq-badge">Расчёт СЭС</span><span class="mq-open">Открыто 2&times;</span>',
    v2_068: "8,4 кВт &middot; Кишинёв",
    v2_069: "<span>Пессим.</span><b>6,6<small> лет</small></b>",
    v2_070: "<span>Ожидаемый</span><b>6,0<small> лет</small></b>",
    v2_071: "<span>Оптим.</span><b>5,7<small> лет</small></b>",
    v2_072: "Принять расчёт &#10003;",

    // tracked proposals
    v2_073: "Отслеживаемые предложения",
    v2_074: "Знайте момент,<br>когда его открыли.",
    v2_075:
      "Хватит гадать, когда напомнить о себе. Отправьте живую ссылку вместо мёртвого PDF — и смотрите, что происходит на той стороне.",
    v2_076:
      '<span class="dot">✓</span><span><b>Открытия и время просмотра</b> — «Ион открыл дважды, по 3 минуты» лучше, чем «отправил во вторник, ответа нет».</span>',
    v2_077:
      '<span class="dot">✓</span><span><b>Сигналы взаимодействия</b> — включил аккумулятор? Это вопрос покупателя. Позвоните и поговорите про накопители.</span>',
    v2_078:
      '<span class="dot">✓</span><span><b>Приём прямо со страницы</b> — одно касание на его телефоне переводит сделку в «Выиграна».</span>',
    v2_079:
      '<span class="dot">✓</span><span><b>Ваши данные остаются вашими</b> — выгрузка всех расчётов и клиентов в CSV в один клик, без привязки.</span>',
    v2_080: "Ваша лента активности",
    v2_081:
      '<span class="ic">◉</span><span class="tx"><b>Ion Popescu</b> открыл <b>Casa Popescu</b></span><time>только что</time>',
    v2_082:
      '<span class="ic">⏱</span><span class="tx">Просмотр <b>3м 34с</b> — дольше всего</span><time>2м</time>',
    v2_083:
      '<span class="ic">⚡</span><span class="tx">Включил <b>аккумулятор</b> · окупаемость пересчитана</span><time>3м</time>',
    v2_084:
      '<span class="ic">◉</span><span class="tx">Открыл снова — <b>2-й визит сегодня</b></span><time>1ч</time>',
    v2_085:
      '<span class="ic g">✓</span><span class="tx"><b>Принял предложение</b> — проект «Выигран»</span><time>1ч</time>',

    // scale
    v2_086: "От одной крыши до целого парка",
    v2_087: "Та же честная математика,<br>6 кВт или 600 кВт.",
    v2_148:
      '<i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></i>Три честных сценария',
    v2_088:
      "Пессимистичный, ожидаемый, оптимистичный — каждое допущение напечатано в расчёте.",
    v2_149:
      '<i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></i>Данные PVGIS по каждой крыше',
    v2_089:
      "Спутниковая выработка для точных координат, а не грубое среднее по стране.",
    v2_150:
      '<i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></i>Видно, когда прочитали',
    v2_090:
      "Открытия, минуты просмотра, включение аккумулятора — вы точно знаете, когда звонить.",

    // pricing
    v2_091: "Тарифы",
    v2_092: "Дешевле, чем кофе<br>на одной упущенной сделке.",
    v2_093:
      "21 день бесплатно — без карты. Одна дополнительная сделка в год окупает VoltMira примерно на 20 лет.",
    v2_094: "Pro",
    v2_095: '<b class="cu" data-count="49" data-prefix="€">49 €</b><small>/мес</small>',
    v2_096: "Для монтажника, который продаёт",
    v2_097: "Ваш логотип в каждом предложении и PDF",
    v2_098: "Отслеживаемые ссылки + уведомления об открытии",
    v2_099: "Виджет заявок для сайта",
    v2_100: "Сохранённые клиенты и полная воронка",
    v2_101: "Начать бесплатно",
    v2_102: "Команда",
    v2_103: '<b class="cu" data-count="119" data-prefix="€">119 €</b><small>/мес</small>',
    v2_104: "До 5 человек, одна воронка",
    v2_105: "Всё, что в Pro",
    v2_106: "5 мест с владельцами проектов",
    v2_107: "Общие клиенты и аналитика конверсии",
    v2_108: "Приоритетная поддержка на RO/RU/EN",
    v2_109: "Начать бесплатно",
    v2_110: "Enterprise",
    v2_111: '<b style="font-size:22px">Индивидуально</b>',
    v2_112: "Для монтажников с несколькими филиалами",
    v2_113: "Всё, что в «Команде», мест без ограничений",
    v2_114: "Полный журнал аудита всех изменений",
    v2_115: "Свои правила субсидий и тарифов",
    v2_116: "Выделенный менеджер и SLA",
    v2_117: "Связаться с нами",

    // faq
    v2_118: "Что спрашивают монтажники",
    v2_119: "Честные вопросы.",
    v2_151: 'Откуда берутся солнечные цифры?<span class="pl">+</span>',
    v2_120:
      "Годовая и месячная выработка берутся из PVGIS — спутниковой базы солнечных данных Еврокомиссии — для точных координат крыши. Тарифные схемы применяются автоматически по рынку. Каждое допущение напечатано в предложении.",
    v2_152: 'Зачем показывать пессимистичное число? Не спугнёт ли это клиента?<span class="pl">+</span>',
    v2_121:
      "На практике наоборот. Диапазон с видимыми допущениями читается как инженерия; одна красивая цифра читается как продажа. Когда даже ваш худший сценарий выгоднее их счёта за электричество, сделка защищает себя сама.",
    v2_153: 'Работает ли это с нет-биллингом в Молдове?<span class="pl">+</span>',
    v2_122:
      "Да — это наша родная территория. Низкая цена экспорта в Молдове делает собственное потребление главным фактором, поэтому движок моделирует его помесячно и корректно оценивает накопители.",
    v2_154: 'Как начать?<span class="pl">+</span>',
    v2_123:
      "Регистрируетесь — и вы внутри. Без листа ожидания и без карты. Сразу полный доступ: создавайте расчёты и отправляйте отслеживаемые предложения, бесплатно на всё время беты.",

    // final cta + footer
    v2_124: "Станьте монтажником,<br>чьи числа выдерживают проверку.",
    v2_125:
      "Начните бесплатно сегодня в Румынии и Молдове — без листа ожидания, без карты, настройка за минуты.",
    v2_126: 'Начать бесплатно',
    v2_127:
      "<span>Карта не нужна</span><span>Бесплатно в бете</span><span>Отмена в любой момент</span>",
    v2_129:
      "Инструмент расчёта, который ваши клиенты могут проверить. Сделан для монтажников в Молдове и Румынии.",
    v2_130: "Движок честности",
    v2_131: "Отслеживаемые предложения",
    v2_132: "Тарифы",
    v2_133: "Вопросы",
    v2_134: "Войти",
    v2_135: "Начать бесплатно",
    v2_136: "Демо",
    v2_137: "Порекомендовать монтажника",
    v2_141: "© 2026 VoltMira. Все права защищены.",
    v2_143: "Конфиденциальность",
    v2_144: "Условия",
    v2_145: "Возвраты",
    v2_146: "Фотографии",
  },
};

export default I18N_V2;
