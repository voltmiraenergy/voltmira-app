// app/_landing/i18n-v6.mjs — Romanian and Russian copy for landing-en-v6.html.
//
// Same contract as i18n-v2.mjs: keys map 1:1 onto data-i18n / data-i18n-ph
// attributes, values are the element's inner HTML (lib/landing.js swaps
// innerHTML wholesale), and English is absent on purpose so the authored
// English in the HTML stands. Change the markup inside a translated element
// and you must change it here too.
//
// Where v6 says the same thing v2 said, the approved v2 wording is reused
// verbatim. New lines follow the same rules:
//
//   net metering  ro: compensare cantitativă   ru: сальдирование
//   net billing   ro: net billing              ru: нет-биллинг
//   prosumer      ro: prosumator               ru: просюмер
//   payback       ro: recuperarea investiției  ru: срок окупаемости
//
// No em-dash and no middle-dot separator in visible copy. The one exception is
// v6_h_h in Russian, the zero-copula "X - это Y", set with a plain hyphen
// exactly as v2_040 already was. Decimal commas and thousands separators
// follow each locale (1.222 in Romanian, 1 222 in Russian); figures that the
// page formats in JavaScript (data-num, data-money) are formatted by Intl for
// the served language and deliberately have no entry here.
//
// Russian payback figures are always fractional (7,4, 6,4, 5,8), so the unit
// is the genitive singular "года", which is what a fractional number takes.

export const I18N_V6 = {
  en: {
    meta_title: "VoltMira: Solar quotes your clients can fact-check",
    meta_desc:
      "Solar quoting software for installers: honest three-band payback from real PVGIS data, tracked proposals with open alerts, WhatsApp sharing, one-tap acceptance and a full pipeline. Free trial. Romania & Moldova.",
  },

  ro: {
    meta_title: "VoltMira: Oferte solare pe care clienții le pot verifica",
    meta_desc:
      "Software de ofertare fotovoltaică pentru instalatori: recuperarea investiției în trei scenarii oneste, din date PVGIS reale, oferte urmărite cu alerte la deschidere, partajare pe WhatsApp și acceptare dintr-o atingere. Probă gratuită. România și Moldova.",

    // nav
    v6_skip: "Sari la conținut",
    v6_nav_check: "Verifică un acoperiș",
    v6_nav_honesty: "Trei numere",
    v6_nav_pricing: "Prețuri",
    v6_nav_faq: "Întrebări",
    v6_nav_demo: "Demo live",
    v6_nav_signin: "Autentificare",
    v6_nav_cta: "Începe gratuit",
    v6_sr_lang: "Schimbă limba",
    v6_sr_theme: "Comută între tema deschisă și cea întunecată",

    // hero
    v6_hero_img:
      '<img src="/landing/hero-rooftop.jpg" alt="Instalație fotovoltaică rezidențială pe un acoperiș de țiglă, sub cer senin" fetchpriority="high">',
    v6_hero_h1: 'Oferte solare<br>pe care clienții<br><span class="hl">le pot verifica.</span>',
    v6_hero_lead:
      "Majoritatea programelor de ofertare arată un singur număr măgulitor. VoltMira arată <b>trei scenarii oneste</b>, calculate din date solare reale pentru acoperișul clientului. Afli chiar în clipa în care acesta deschide oferta.",
    v6_hero_cta1: "Începe gratuit",
    v6_hero_cta2: "Verifică un acoperiș",
    v6_hero_note: "Fără card bancar, gratuit în perioada beta, configurare în 2 minute.",
    v6_hc_toast: "<b>Ion Rusu</b> ți-a deschis oferta",
    v6_t_now: "chiar acum",
    v6_hc_sr:
      "Exemplu de ofertă: un acoperiș de 5 kWp din Chișinău își recuperează investiția în 7,4, 6,4 sau 5,8 ani, în funcție de scenariu.",
    v6_hc_label: "Ofertă solară",
    v6_hc_open: "Deschisă de 2×",
    v6_hc_sub: "5 kWp pe acoperiș, Chișinău",
    v6_hc_cap: "Poziția de numerar pe 25 de ani",
    v6_b_pess_s: "Pesim.",
    v6_b_expc_s: "Așteptat",
    v6_b_opti_s: "Optim.",
    v6_u_yrs: "ani",
    v6_u_years: "ani",
    v6_u_year: "an",
    v6_hc_accept: "Acceptă oferta",

    // spec strip
    v6_s1_b: "3 scenarii",
    v6_s1_t: "Pesimist, așteptat și optimist la fiecare ofertă",
    v6_s2_b: "Date satelitare PVGIS",
    v6_s2_t: "Iradianță reală pentru acel acoperiș, nu o medie",
    v6_s3_b: "România și Moldova",
    v6_s3_t: "Regulile de compensare cantitativă și net billing, incluse",
    v6_s4_b: "Sub 2 minute",
    v6_s4_t: "De la o adresă la o ofertă gata de trimis",

    // fact-check instrument
    v6_ck_h: "Nu ne crede pe cuvânt. Verifică orice acoperiș.",
    v6_ck_lead:
      "Scrie o adresă din România sau Moldova și factura lunară la energie. Rulează același motor de calcul și aceleași date satelitare PVGIS pe care clienții tăi le văd într-o ofertă VoltMira.",
    v6_ck_country: "Țara",
    v6_ck_md: "Moldova",
    v6_ck_ro: "România",
    v6_ck_addr: "Adresa",
    v6_ck_addr_ph: "Strada, numărul, localitatea",
    v6_ck_bill: "Factura lunară la energie",
    v6_ck_run: "Calculează",
    v6_ck_fine:
      "Presupune un acoperiș orientat spre sud, înclinat la 35°, fără baterie. În VoltMira setezi acoperișul real, echipamentele și prețul.",
    v6_sh_brand: "Estimare VoltMira",
    v6_sh_kw: "Sistem recomandat",
    v6_sh_yield: "Producție solară, PVGIS",
    v6_sh_cost: "Cost cu montaj",
    v6_sh_save: "Economii în primul an",
    v6_sh_pay: "Recuperarea investiției, trei scenarii",
    v6_sh_expected: "în scenariul așteptat",
    v6_b_pess: "Pesimist",
    v6_b_expc: "Așteptat",
    v6_b_opti: "Optimist",
    v6_sh_foot:
      "Aceleași numere, cu fiecare ipoteză tipărită, devin oferta pe care o deschide clientul.",
    v6_sh_cta: "Transformă în ofertă",

    // three numbers
    v6_h_h: "Un singur număr e un discurs de vânzare. Trei numere sunt adevărul.",
    v6_h_lead:
      "Fiecare ofertă VoltMira arată perioada de recuperare a investiției în ipoteze pesimiste, așteptate și optimiste, cu fiecare ipoteză tipărită pe ofertă. Clienții au încredere în ce pot verifica. Încrederea închide contracte.",
    v6_h_cap:
      "Poziția cumulată de numerar, an de an. Exemplu: o casă cu 5 kWp în Chișinău, 1.222 kWh/kWp din PVGIS, 5.250 € cu montaj, în regim de net billing din Moldova.",
    v6_h_hint: "Trage peste grafic ca să citești orice an",
    v6_h_p_desc:
      "<b>Soare puțin, prețuri plate.</b> −8% producție, degradare 0,8%/an, zero inflație la energie. Dacă și acest număr funcționează, afacerea e sigură.",
    v6_h_e_desc:
      "<b>Rezultatul cel mai probabil.</b> Producție PVGIS pentru acel acoperiș, degradare 0,5%/an, inflație 3%. Numărul pe care îl susții.",
    v6_h_o_desc:
      "<b>Dacă prețurile continuă să crească.</b> +8% producție, degradare 0,3%/an, inflație 5%. Arătat onest ca cel mai bun caz, niciodată ca titlu.",
    v6_h_after: "după 25 de ani",
    v6_a_t: "Tipărit pe fiecare ofertă",
    v6_a_yield: "Producție, PVGIS",
    v6_a_degr: "Degradare",
    v6_a_degr_v: "0,5% pe an",
    v6_a_infl: "Inflația prețului",
    v6_a_infl_v: "3% pe an",
    v6_a_scheme: "Schema tarifară",
    v6_a_scheme_v: "Net billing",

    // how it works
    v6_how_img:
      '<img src="/landing/installers.jpg" alt="Doi instalatori montează panouri solare monocristaline pe un acoperiș de țiglă" loading="lazy">',
    v6_how_h: "Construit pentru instalatorul care stă pe acoperiș.",
    v6_how_1_h: "Scrie adresa",
    v6_how_1_p:
      "VoltMira preia iradianța reală pentru acel acoperiș din <b>PVGIS</b> și aplică automat schema tarifară potrivită pieței.",
    v6_how_2_h: "Primești trei numere oneste",
    v6_how_2_p:
      "Pesimist, așteptat și optimist, cu <b>fiecare ipoteză tipărită</b> pe ofertă și gata de susținut la masa din bucătărie.",
    v6_how_3_h: "Trimite linkul, urmărește activitatea",
    v6_how_3_p:
      "Un link pe telefonul clientului. Vezi <b>deschideri, minute vizualizate și comutări de baterie</b>, iar Acceptă aduce afacerea în pipeline.",

    // tracking
    v6_t_h: "Află clipa în care o deschid.",
    v6_t_lead:
      "Nu mai ghici când să revii. Trimite un link viu în loc de un PDF mort, și vezi ce se întâmplă de cealaltă parte.",
    v6_t_f1:
      "<b>Deschideri și timp vizualizat.</b> „Ion a deschis-o de două ori, câte 3 minute” bate „trimisă marțea trecută, niciun răspuns”.",
    v6_t_f2:
      "<b>Semnale de interacțiune.</b> A activat bateria? Asta e o întrebare de cumpărare. Sună-l despre baterii.",
    v6_t_f3:
      "<b>Acceptare din pagină.</b> O atingere pe telefonul clientului marchează afacerea drept Câștigată în pipeline.",
    v6_t_f4:
      "<b>Datele tale rămân ale tale.</b> Exporți fiecare ofertă și client în CSV dintr-un clic. Fără blocare.",
    v6_ph_exp: "Recuperare, scenariul așteptat",
    v6_ph_batt: "Adaugă o baterie",
    v6_ph_note: "Toate ipotezele din spatele acestor numere sunt tipărite mai jos, pe această pagină.",
    v6_fd_t: "Fluxul tău de activitate",
    v6_fd_live: "În direct",
    v6_fd_1: "<b>Ion Rusu</b> a deschis <b>Casa Rusu</b>",
    v6_fd_2: "Vizualizată <b>3 min 34 s</b>, cel mai mult până acum",
    v6_fd_3: "A activat <b>bateria</b>. Recuperare recalculată",
    v6_fd_4: "A deschis-o din nou, <b>a 2-a vizită azi</b>",
    v6_fd_5: "<b>A acceptat oferta.</b> Proiect marcat Câștigat",
    v6_t_2m: "2 min",
    v6_t_3m: "3 min",
    v6_t_6m: "6 min",
    v6_t_1h: "1 h",

    // scale band
    v6_sc_img:
      '<img src="/landing/commercial-rooftop.jpg" alt="Un acoperiș comercial mare, acoperit complet cu panouri solare" loading="lazy">',
    v6_sc_h: "Aceeași matematică onestă, 6&nbsp;kW sau 600&nbsp;kW.",
    v6_sc_p:
      "Case, ferme și hale trec prin același motor, cu aceleași trei scenarii și aceleași ipoteze tipărite.",

    // after the yes
    v6_m_h: "Și tot ce urmează după „da”.",
    v6_m_lead: "Oferta e doar începutul lucrării. VoltMira duce hârtiile până la capăt.",
    v6_m1_h: "Citește factura la energie în locul tău",
    v6_m1_p:
      "Fotografiezi factura clientului. Consumul anual, numărul contorului și furnizorul sunt citite automat, iar nimic nu se aplică până nu verifici tu.",
    v6_m2_h: "Cererea de racordare din Moldova, completată",
    v6_m2_p:
      "Formularul propriu al Premier Energy Distribution pentru prosumatori, completat din datele proiectului. Formularul real, nu un șablon care seamănă.",
    v6_m3_h: "Lista de materiale din propriul catalog",
    v6_m3_p:
      "Descrii sistemul în cuvinte simple. Panourile, invertorul și bateria vin doar din catalogul tău, la prețurile tale.",
    v6_m4_h: "Facturi proforma, făcute corect",
    v6_m4_p:
      "TVA-ul este calculat corect, facturile sunt numerotate în ordine și totul se exportă în CSV pentru contabil.",
    v6_m5_h: "Un widget de lead-uri pentru site-ul tău",
    v6_m5_p:
      "Vizitatorii scriu o adresă și o factură și primesc aceeași estimare onestă. Lead-ul ajunge direct în pipeline-ul tău.",
    v6_m6_h: "WhatsApp sau e-mail dintr-o atingere",
    v6_m6_p:
      "Trimiți linkul urmărit pe WhatsApp sau oferta PDF cu brandul tău pe e-mail, direct din VoltMira.",

    // pricing
    v6_p_h: "Costă mai puțin decât cafeaua de la o afacere pierdută.",
    v6_p_lead:
      "Probă gratuită 21 de zile, fără card. O singură afacere în plus pe an plătește VoltMira pentru aproape 20 de ani.",
    v6_p_flag: "Începe de aici",
    v6_p_pro_amt: "<b>49 €</b><small>/ lună</small>",
    v6_p_pro_for: "Pentru instalatorul care vinde",
    v6_p_pro_1: "Logoul tău pe fiecare ofertă și PDF",
    v6_p_pro_2: "Linkuri urmărite și alerte la deschidere",
    v6_p_pro_3: "Widget de lead-uri pentru site",
    v6_p_pro_4: "Clienți salvați și pipeline complet",
    v6_p_cta: "Începe gratuit",
    v6_p_team: "Echipă",
    v6_p_team_amt: "<b>119 €</b><small>/ lună</small>",
    v6_p_team_for: "Până la 5 persoane, un singur pipeline",
    v6_p_team_1: "Tot ce include Pro",
    v6_p_team_2: "5 locuri, cu responsabili de proiect",
    v6_p_team_3: "Clienți partajați și analiza ratei de câștig",
    v6_p_team_4: "Suport prioritar în română, rusă și engleză",
    v6_p_ent:
      "Pentru instalatori cu mai multe filiale: locuri nelimitate, jurnal complet de audit al fiecărei modificări, reguli personalizate de subvenții și tarife, manager dedicat și SLA.",
    v6_p_ent_cta: "Contactează-ne",

    // faq
    v6_f_h: "Întrebări corecte.",
    v6_f_side:
      'Ceva ce n-am acoperit? Scrie-ne pe <a href="https://wa.me/37362121019" target="_blank" rel="noopener">WhatsApp</a>.',
    v6_f_q1: "De unde vin numerele solare?",
    v6_f_a1:
      "Producția anuală și lunară vin din PVGIS, baza de date solare a Comisiei Europene, derivată din satelit, pentru coordonatele exacte ale acoperișului. Schemele tarifare se aplică automat, în funcție de piață. Fiecare ipoteză este tipărită pe ofertă.",
    v6_f_q2: "De ce să arăt un număr pesimist? Nu sperie clienții?",
    v6_f_a2:
      "Dimpotrivă, în practică. Un interval cu ipoteze vizibile se citește ca inginerie; un singur număr roz se citește ca vânzare. Când până și cel mai prost caz al tău bate factura lor la energie, afacerea se apără singură.",
    v6_f_q3: "Funcționează pentru net billing-ul din Moldova?",
    v6_f_a3:
      "Da, acolo suntem acasă. Prețul mic de export din Moldova face din autoconsum tot jocul, așa că motorul îl modelează lună de lună și evaluează corect stocarea în baterii.",
    v6_f_q4: "Ce înseamnă o ofertă urmărită pentru confidențialitatea clientului?",
    v6_f_a4:
      "Linkul înregistrează deschiderile, timpul petrecut pe pagină și interacțiunile cu oferta în sine. Nimic altceva. Fără trackere publicitare, fără profilare, găzduire în UE.",
    v6_f_q5: "Cum încep?",
    v6_f_a5:
      "Te înregistrezi și ești înăuntru. Fără listă de așteptare, fără card: acces complet ca să construiești oferte și să trimiți propuneri urmărite imediat, gratuit pe toată perioada beta.",

    // final + footer
    v6_fin_h: "Fii instalatorul ale cărui numere rezistă.",
    v6_fin_p:
      "Începe gratuit astăzi în România și Moldova. Fără listă de așteptare, fără card, configurare în câteva minute.",
    v6_fin_cta: "Începe gratuit",
    v6_fin_demo: "Deschide demo-ul live",
    v6_fin_chips: "<span>Fără card bancar</span><span>Gratuit în beta</span><span>Anulezi oricând</span>",
    v6_ft_blurb:
      "Instrumentul de ofertare pe care clienții tăi îl pot verifica. Construit pentru instalatori din Moldova și România.",
    v6_ft_prod: "Produs",
    v6_ft_comp: "Companie",
    v6_ft_touch: "Contact",
    v6_ft_track: "Oferte urmărite",
    v6_ft_refer: "Recomandă un instalator",
    v6_ft_copy: "© 2026 VoltMira. Toate drepturile rezervate.",
    v6_ft_founder: 'Fondat de <a href="https://voltmira.com/" rel="author">Bogdan Toctarov</a>',
    v6_ft_priv: "Confidențialitate",
    v6_ft_terms: "Termeni",
    v6_ft_ref: "Rambursări",
    v6_ft_cred: "Credite foto",
    v6_ft_t1: "Găzduit în UE",
    v6_ft_t2: "Pregătit pentru GDPR",
    v6_ft_t3: "România, Moldova, UE",

    // strings the scripts read
    v6_js_example: "Acoperiș exemplu",
    v6_js_live: "Acoperișul tău",
    v6_js_loading: "Citim datele satelitare pentru acest acoperiș…",
    v6_js_year: "Anul",
    v6_js_err_empty: "Scrie o adresă ca să o verificăm.",
    v6_js_err_bill: "Scrie factura lunară ca număr.",
    v6_js_err_nf: "Nu am găsit această adresă. Încearcă să adaugi localitatea.",
    v6_js_err_rate: "Multe acoperișuri într-un minut. Încearcă din nou peste puțin timp.",
    v6_js_err_up: "Serviciul de date satelitare e ocupat. Încearcă din nou într-o clipă.",
    v6_js_err_net: "Nu există conexiune. Verifică internetul și încearcă din nou.",
    v6_js_nopay: "peste 25",
    v6_js_paid: "Investiția recuperată după",
    v6_js_slider: "Anul {y}: pesimist {p}, așteptat {e}, optimist {o}",
  },

  ru: {
    meta_title: "VoltMira: Солнечные расчёты, которые клиент может проверить",
    meta_desc:
      "Софт для расчёта солнечных станций: срок окупаемости в трёх честных сценариях на реальных данных PVGIS, отслеживаемые коммерческие предложения с уведомлениями об открытии, отправка в WhatsApp и приём в одно касание. Бесплатный доступ. Румыния и Молдова.",

    // nav
    v6_skip: "Перейти к содержимому",
    v6_nav_check: "Проверить крышу",
    v6_nav_honesty: "Три числа",
    v6_nav_pricing: "Тарифы",
    v6_nav_faq: "Вопросы",
    v6_nav_demo: "Демо",
    v6_nav_signin: "Войти",
    v6_nav_cta: "Начать бесплатно",
    v6_sr_lang: "Сменить язык",
    v6_sr_theme: "Переключить светлую или тёмную тему",

    // hero
    v6_hero_img:
      '<img src="/landing/hero-rooftop.jpg" alt="Солнечные панели на черепичной крыше частного дома под ясным небом" fetchpriority="high">',
    v6_hero_h1: 'Солнечные расчёты,<br>которые клиент<br><span class="hl">может проверить.</span>',
    v6_hero_lead:
      "Большинство программ показывают одну красивую цифру. VoltMira показывает <b>три честных сценария</b>, рассчитанных по реальным солнечным данным для крыши клиента. Вы узнаёте об этом в тот момент, когда клиент открыл предложение.",
    v6_hero_cta1: "Начать бесплатно",
    v6_hero_cta2: "Проверить крышу",
    v6_hero_note: "Без карты, бесплатно в бете, настройка за 2 минуты.",
    v6_hc_toast: "<b>Ion Rusu</b> открыл ваше предложение",
    v6_t_now: "только что",
    v6_hc_sr:
      "Пример предложения: СЭС 5 кВт в Кишинёве окупается за 7,4, 6,4 или 5,8 года в зависимости от сценария.",
    v6_hc_label: "Расчёт СЭС",
    v6_hc_open: "Открыто 2×",
    v6_hc_sub: "5 кВт на крыше, Кишинёв",
    v6_hc_cap: "Денежный поток за 25 лет",
    v6_b_pess_s: "Пессим.",
    v6_b_expc_s: "Ожидаемый",
    v6_b_opti_s: "Оптим.",
    v6_u_yrs: "года",
    v6_u_years: "года",
    v6_u_year: "год",
    v6_hc_accept: "Принять предложение",

    // spec strip
    v6_s1_b: "3 сценария",
    v6_s1_t: "Пессимистичный, ожидаемый и оптимистичный в каждом расчёте",
    v6_s2_b: "Спутниковые данные PVGIS",
    v6_s2_t: "Реальная инсоляция для конкретной крыши, а не среднее",
    v6_s3_b: "Румыния и Молдова",
    v6_s3_t: "Правила сальдирования и нет-биллинга уже учтены",
    v6_s4_b: "Меньше 2 минут",
    v6_s4_t: "От адреса до готового предложения",

    // fact-check instrument
    v6_ck_h: "Не верьте нам на слово. Проверьте любую крышу.",
    v6_ck_lead:
      "Введите адрес в Румынии или Молдове и ежемесячный счёт за электричество. Работает тот же движок и те же спутниковые данные PVGIS, что клиенты видят в предложении VoltMira.",
    v6_ck_country: "Страна",
    v6_ck_md: "Молдова",
    v6_ck_ro: "Румыния",
    v6_ck_addr: "Адрес",
    v6_ck_addr_ph: "Улица, дом, город",
    v6_ck_bill: "Ежемесячный счёт за электричество",
    v6_ck_run: "Рассчитать",
    v6_ck_fine:
      "Расчёт для крыши на юг с наклоном 35° и без аккумулятора. В VoltMira вы задаёте реальную крышу, оборудование и цену.",
    v6_sh_brand: "Оценка VoltMira",
    v6_sh_kw: "Рекомендуемая система",
    v6_sh_yield: "Выработка, PVGIS",
    v6_sh_cost: "Стоимость с монтажом",
    v6_sh_save: "Экономия за первый год",
    v6_sh_pay: "Окупаемость, три сценария",
    v6_sh_expected: "по ожидаемому сценарию",
    v6_b_pess: "Пессимистичный",
    v6_b_expc: "Ожидаемый",
    v6_b_opti: "Оптимистичный",
    v6_sh_foot:
      "Эти же числа, с каждым напечатанным допущением, становятся предложением, которое открывает клиент.",
    v6_sh_cta: "Превратить в предложение",

    // three numbers
    v6_h_h: "Одно число - это продажа. Три числа - это правда.",
    v6_h_lead:
      "Каждый расчёт VoltMira показывает срок окупаемости при пессимистичных, ожидаемых и оптимистичных допущениях, и каждое допущение напечатано в предложении. Клиенты доверяют тому, что могут проверить. Доверие закрывает сделки.",
    v6_h_cap:
      "Накопленный денежный поток по годам. Пример: дом с СЭС 5 кВт в Кишинёве, 1 222 кВт·ч/кВт по PVGIS, 5 250 € с монтажом, молдавский нет-биллинг.",
    v6_h_hint: "Проведите по графику, чтобы увидеть любой год",
    v6_h_p_desc:
      "<b>Мало солнца, цены на месте.</b> −8% выработки, деградация 0,8%/год, нулевая инфляция на электроэнергию. Если работает даже это число, сделка надёжна.",
    v6_h_e_desc:
      "<b>Самый вероятный исход.</b> Выработка PVGIS для конкретной крыши, деградация 0,5%/год, инфляция 3%. Число, за которое вы отвечаете.",
    v6_h_o_desc:
      "<b>Если цены продолжат расти.</b> +8% выработки, деградация 0,3%/год, инфляция 5%. Показан честно как лучший случай, но никогда как заголовок.",
    v6_h_after: "через 25 лет",
    v6_a_t: "Печатается в каждом предложении",
    v6_a_yield: "Выработка, PVGIS",
    v6_a_degr: "Деградация",
    v6_a_degr_v: "0,5% в год",
    v6_a_infl: "Инфляция цен",
    v6_a_infl_v: "3% в год",
    v6_a_scheme: "Тарифная схема",
    v6_a_scheme_v: "Нет-биллинг",

    // how it works
    v6_how_img:
      '<img src="/landing/installers.jpg" alt="Двое монтажников устанавливают монокристаллические панели на черепичной крыше" loading="lazy">',
    v6_how_h: "Сделано для монтажника, который стоит на крыше.",
    v6_how_1_h: "Введите адрес",
    v6_how_1_p:
      "VoltMira берёт реальную инсоляцию для этой крыши из <b>PVGIS</b> и автоматически применяет тарифную схему нужного рынка.",
    v6_how_2_h: "Получаете три честных числа",
    v6_how_2_p:
      "Пессимистичное, ожидаемое и оптимистичное, и <b>каждое допущение напечатано</b> в предложении, готовое к разговору за кухонным столом.",
    v6_how_3_h: "Отправьте ссылку и следите за лентой",
    v6_how_3_p:
      "Одна ссылка на телефон клиента. Вы видите <b>открытия, минуты просмотра и включение аккумулятора</b>, а «Принять» переводит сделку в вашу воронку.",

    // tracking
    v6_t_h: "Знайте момент, когда его открыли.",
    v6_t_lead:
      "Хватит гадать, когда напомнить о себе. Отправьте живую ссылку вместо мёртвого PDF, и смотрите, что происходит на той стороне.",
    v6_t_f1:
      "<b>Открытия и время просмотра.</b> «Ион открыл дважды, по 3 минуты» лучше, чем «отправил во вторник, ответа нет».",
    v6_t_f2:
      "<b>Сигналы взаимодействия.</b> Включил аккумулятор? Это вопрос покупателя. Позвоните и поговорите про накопители.",
    v6_t_f3:
      "<b>Приём прямо со страницы.</b> Одно касание на его телефоне переводит сделку в «Выиграна».",
    v6_t_f4:
      "<b>Ваши данные остаются вашими.</b> Выгрузка всех расчётов и клиентов в CSV в один клик. Без привязки.",
    v6_ph_exp: "Окупаемость, ожидаемый сценарий",
    v6_ph_batt: "Добавить аккумулятор",
    v6_ph_note: "Все допущения, стоящие за этими числами, напечатаны ниже на этой странице.",
    v6_fd_t: "Ваша лента активности",
    v6_fd_live: "Онлайн",
    v6_fd_1: "<b>Ion Rusu</b> открыл <b>Casa Rusu</b>",
    v6_fd_2: "Просмотр <b>3 мин 34 с</b>, дольше всего",
    v6_fd_3: "Включил <b>аккумулятор</b>. Окупаемость пересчитана",
    v6_fd_4: "Открыл снова, <b>2-й визит сегодня</b>",
    v6_fd_5: "<b>Принял предложение.</b> Проект «Выигран»",
    v6_t_2m: "2 мин",
    v6_t_3m: "3 мин",
    v6_t_6m: "6 мин",
    v6_t_1h: "1 ч",

    // scale band
    v6_sc_img:
      '<img src="/landing/commercial-rooftop.jpg" alt="Крупная коммерческая крыша, полностью покрытая солнечными панелями" loading="lazy">',
    v6_sc_h: "Та же честная математика, 6&nbsp;кВт или 600&nbsp;кВт.",
    v6_sc_p:
      "Частные дома, фермы и склады считаются одним движком, с теми же тремя сценариями и теми же напечатанными допущениями.",

    // after the yes
    v6_m_h: "И всё, что после «да».",
    v6_m_lead: "С расчёта работа только начинается. VoltMira ведёт документы до самого конца.",
    v6_m1_h: "Читает счёт за электричество за вас",
    v6_m1_p:
      "Сфотографируйте счёт клиента. Годовое потребление, номер счётчика и поставщик распознаются автоматически, и ничего не применяется, пока вы не проверите.",
    v6_m2_h: "Заявка на подключение в Молдове, уже заполнена",
    v6_m2_p:
      "Собственная форма Premier Energy Distribution для просюмеров, заполненная по данным проекта. Настоящая форма, а не похожий шаблон.",
    v6_m3_h: "Спецификация из вашего каталога",
    v6_m3_p:
      "Опишите систему простыми словами. Панели, инвертор и аккумулятор берутся только из вашего каталога, по вашим ценам.",
    v6_m4_h: "Проформы без ошибок",
    v6_m4_p:
      "НДС рассчитывается правильно, счета нумеруются по порядку, а всё выгружается в CSV для бухгалтера.",
    v6_m5_h: "Виджет заявок для вашего сайта",
    v6_m5_p:
      "Посетители вводят адрес и счёт и получают ту же честную оценку. Заявка сразу попадает в вашу воронку.",
    v6_m6_h: "WhatsApp или e-mail в одно касание",
    v6_m6_p:
      "Отправьте отслеживаемую ссылку в WhatsApp или брендированный PDF по e-mail прямо из VoltMira.",

    // pricing
    v6_p_h: "Дешевле, чем кофе на одной упущенной сделке.",
    v6_p_lead:
      "21 день бесплатно, без карты. Одна дополнительная сделка в год окупает VoltMira примерно на 20 лет.",
    v6_p_flag: "Начните здесь",
    v6_p_pro_amt: "<b>49 €</b><small>/ мес</small>",
    v6_p_pro_for: "Для монтажника, который продаёт",
    v6_p_pro_1: "Ваш логотип в каждом предложении и PDF",
    v6_p_pro_2: "Отслеживаемые ссылки и уведомления об открытии",
    v6_p_pro_3: "Виджет заявок для сайта",
    v6_p_pro_4: "Сохранённые клиенты и полная воронка",
    v6_p_cta: "Начать бесплатно",
    v6_p_team: "Команда",
    v6_p_team_amt: "<b>119 €</b><small>/ мес</small>",
    v6_p_team_for: "До 5 человек, одна воронка",
    v6_p_team_1: "Всё, что в Pro",
    v6_p_team_2: "5 мест с владельцами проектов",
    v6_p_team_3: "Общие клиенты и аналитика конверсии",
    v6_p_team_4: "Приоритетная поддержка на румынском, русском и английском",
    v6_p_ent:
      "Для монтажников с несколькими филиалами: неограниченное число мест, полный журнал аудита всех изменений, свои правила субсидий и тарифов, выделенный менеджер и SLA.",
    v6_p_ent_cta: "Связаться с нами",

    // faq
    v6_f_h: "Честные вопросы.",
    v6_f_side:
      'Не нашли ответа? Напишите нам в <a href="https://wa.me/37362121019" target="_blank" rel="noopener">WhatsApp</a>.',
    v6_f_q1: "Откуда берутся солнечные цифры?",
    v6_f_a1:
      "Годовая и месячная выработка берутся из PVGIS, спутниковой базы солнечных данных Еврокомиссии, для точных координат крыши. Тарифные схемы применяются автоматически по рынку. Каждое допущение напечатано в предложении.",
    v6_f_q2: "Зачем показывать пессимистичное число? Не спугнёт ли это клиента?",
    v6_f_a2:
      "На практике наоборот. Диапазон с видимыми допущениями читается как инженерия; одна красивая цифра читается как продажа. Когда даже ваш худший сценарий выгоднее их счёта за электричество, сделка защищает себя сама.",
    v6_f_q3: "Работает ли это с нет-биллингом в Молдове?",
    v6_f_a3:
      "Да, это наша родная территория. Низкая цена экспорта в Молдове делает собственное потребление главным фактором, поэтому движок моделирует его помесячно и корректно оценивает накопители.",
    v6_f_q4: "Что отслеживаемое предложение значит для приватности клиента?",
    v6_f_a4:
      "Ссылка фиксирует открытия, время на странице и действия с самим расчётом. Больше ничего. Без рекламных трекеров, без профилирования, хостинг в ЕС.",
    v6_f_q5: "Как начать?",
    v6_f_a5:
      "Регистрируетесь, и вы внутри. Без листа ожидания и без карты: сразу полный доступ, создавайте расчёты и отправляйте отслеживаемые предложения, бесплатно на всё время беты.",

    // final + footer
    v6_fin_h: "Станьте монтажником, чьи числа выдерживают проверку.",
    v6_fin_p:
      "Начните бесплатно сегодня в Румынии и Молдове. Без листа ожидания, без карты, настройка за минуты.",
    v6_fin_cta: "Начать бесплатно",
    v6_fin_demo: "Открыть демо",
    v6_fin_chips: "<span>Карта не нужна</span><span>Бесплатно в бете</span><span>Отмена в любой момент</span>",
    v6_ft_blurb:
      "Инструмент расчёта, который ваши клиенты могут проверить. Сделан для монтажников в Молдове и Румынии.",
    v6_ft_prod: "Продукт",
    v6_ft_comp: "Компания",
    v6_ft_touch: "Связь",
    v6_ft_track: "Отслеживаемые предложения",
    v6_ft_refer: "Порекомендовать монтажника",
    v6_ft_copy: "© 2026 VoltMira. Все права защищены.",
    v6_ft_founder: 'Основатель: <a href="https://voltmira.com/" rel="author">Bogdan Toctarov</a>',
    v6_ft_priv: "Конфиденциальность",
    v6_ft_terms: "Условия",
    v6_ft_ref: "Возвраты",
    v6_ft_cred: "Фотографии",
    v6_ft_t1: "Хостинг в ЕС",
    v6_ft_t2: "Соответствие GDPR",
    v6_ft_t3: "Румыния, Молдова, ЕС",

    // strings the scripts read
    v6_js_example: "Пример крыши",
    v6_js_live: "Ваша крыша",
    v6_js_loading: "Загружаем спутниковые данные для этой крыши…",
    v6_js_year: "Год",
    v6_js_err_empty: "Введите адрес для проверки.",
    v6_js_err_bill: "Введите ежемесячный счёт числом.",
    v6_js_err_nf: "Не удалось найти этот адрес. Попробуйте добавить город.",
    v6_js_err_rate: "Слишком много крыш за минуту. Попробуйте чуть позже.",
    v6_js_err_up: "Сервис спутниковых данных занят. Попробуйте через мгновение.",
    v6_js_err_net: "Нет соединения. Проверьте интернет и попробуйте снова.",
    v6_js_nopay: "более 25",
    v6_js_paid: "Окупается за",
    v6_js_slider: "Год {y}: пессимистичный {p}, ожидаемый {e}, оптимистичный {o}",
  },
};
