// app/_landing/i18n-v6.mjs — Romanian, Russian and Ukrainian copy for landing-en-v6.html.
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
    meta_title: "Solar Quoting Software for Installers | VoltMira",
    meta_desc:
      "Solar quoting software for installers in Romania and Moldova: honest payback in three scenarios from real PVGIS data, tracked proposals and online acceptance.",
    // social cards keep the slogan; search results lead with what people type
    og_title: "VoltMira: Solar quotes your clients can fact-check",
  },

  ro: {
    meta_title: "Program de ofertare fotovoltaică pentru instalatori | VoltMira",
    meta_desc:
      "Program de ofertare pentru instalatorii de panouri solare din România și Moldova: amortizare în trei scenarii din date PVGIS reale, oferte urmărite și acceptare online.",
    // social cards keep the slogan; search results lead with what people type
    og_title: "VoltMira: Oferte solare pe care clienții le pot verifica",

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
      '<img src="/landing/hero-tile-roof-1600.webp" srcset="/landing/hero-tile-roof-800.webp 800w, /landing/hero-tile-roof-1600.webp 1600w" sizes="100vw" alt="Panouri solare pe acoperișul de țiglă roșie al unei case" fetchpriority="high">',
    v6_hero_h1: 'Oferte solare<br>pe care clienții<br><span class="hl">le pot verifica.</span>',
    v6_hero_lead:
      "Majoritatea programelor de ofertare arată un singur număr măgulitor. VoltMira arată <b>trei scenarii oneste</b>, calculate din date solare reale pentru acoperișul clientului. Afli chiar în clipa în care acesta deschide oferta.",
    v6_hero_cta1: "Începe gratuit",
    v6_hero_cta2: "Verifică un acoperiș",
    v6_hc_toast: "<b>Ion Rusu</b> ți-a deschis oferta",
    v6_t_now: "chiar acum",
    v6_hc_sr:
      "Exemplu de ofertă: un acoperiș de 5 kWp din Chișinău își recuperează investiția în 7,4, 6,4 sau 5,8 ani, în funcție de scenariu.",
    v6_hc_label: "Ofertă solară",
    v6_hc_eyebrow: "SolarTech, ofertă solară",
    v6_hc_for: "pregătită pentru Ion Rusu, Chișinău",
    v6_hc_kw_l: "Sistem solar",
    v6_hc_price: "103.950 lei",
    v6_hc_price_l: "Investiție totală",
    v6_hc_accept2: "Acceptă această ofertă",
    v6_ph_cash: "Cash",
    v6_ph_monthly: "Lunar",
    v6_ph_glance: "Sistemul pe scurt",
    v6_ph_inv: "Deye 5 kW hibrid",
    v6_ph_opt1: "Doar panouri",
    v6_ph_opt2: "Cu baterie",
    v6_ph_money: "Banii tăi pe 25 ani",
    v6_hc_open: "Deschisă de 2×",
    v6_hc_sub: "5 kWp pe acoperiș, Chișinău",
    v6_hc_cap: "Poziția de numerar pe 25 de ani",
    v6_b_pess_s: "Pesimist",
    v6_b_expc_s: "Așteptat",
    v6_b_opti_s: "Optimist",
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
      '<img src="/landing/installer-metal-roof-1600.webp" srcset="/landing/installer-metal-roof-800.webp 800w, /landing/installer-metal-roof-1600.webp 1200w" sizes="(min-width: 900px) 50vw, 100vw" alt="Un instalator cu cască fixează panouri solare pe un acoperiș de tablă roșie" loading="lazy">',
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
    v6_fd_3: "A ales varianta <b>cu baterie</b>. Recuperare recalculată",
    v6_fd_4: "A deschis-o din nou, <b>a 2-a vizită azi</b>",
    v6_fd_5: "<b>A acceptat oferta.</b> Proiect marcat Câștigat",
    v6_t_2m: "2 min",
    v6_t_3m: "3 min",
    v6_t_6m: "6 min",
    v6_t_1h: "1 h",

    // scale band
    v6_sc_img:
      '<img src="/landing/warehouse-rooftop-1600.webp" srcset="/landing/warehouse-rooftop-800.webp 800w, /landing/warehouse-rooftop-1600.webp 1600w" sizes="100vw" alt="Vedere de sus a unui depozit logistic cu acoperișul acoperit de panouri solare și camioane la rampe" loading="lazy">',
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
    v6_m2_p: "Formularele reale Premier Energy și RED Nord, completate din proiect. Fiecare dosar are un tracker care îți spune când operatorul întârzie și e momentul să suni.",
    v6_m3_h: "Lista de materiale din propriul catalog",
    v6_m3_p:
      "Descrii sistemul în cuvinte simple. Panourile, invertorul și bateria vin doar din catalogul tău, la prețurile tale.",
    v6_m4_h: "Facturi proforma, făcute corect",
    v6_m4_p:
      "TVA-ul este calculat corect, facturile sunt numerotate în ordine și totul se exportă în CSV pentru contabil.",
    v6_m5_h: "Un widget de lead-uri pentru site-ul tău",
    v6_m5_p: "Pe site-ul tău și pe Telegram răspunde în limba clientului, citește poza facturii, dă o estimare în lei și îți transmite cererea de vizită.",
    v6_m6_h: "WhatsApp sau e-mail dintr-o atingere",
    v6_m6_p: "Trimiți linkul urmărit pe WhatsApp sau Viber, ori oferta PDF cu brandul tău pe e-mail, direct din VoltMira.",

    // pricing
    v6_p_h: "Costă mai puțin decât cafeaua de la o afacere pierdută.",
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
    v6_fin_p: "Începe gratuit astăzi. Fără listă de așteptare, fără card, configurare în câteva minute.",
    v6_fin_cta: "Începe gratuit",
    v6_fin_demo: "Deschide demo-ul live",
    v6_ft_blurb:
      "Instrumentul de ofertare pe care clienții tăi îl pot verifica. Construit pentru instalatori din Moldova și România.",
    v6_ft_prod: "Produs",
    v6_ft_comp: "Companie",
    v6_ft_touch: "Contact",
    v6_ft_track: "Oferte urmărite",
    v6_ft_copy: "© 2026 VoltMira. Toate drepturile rezervate.",
    v6_ft_founder: 'Fondat de <a href="https://voltmira.com/" rel="author">Bogdan Toctarov</a>',
    v6_ft_priv: "Confidențialitate",
    v6_ft_terms: "Termeni",
    v6_ft_ref: "Rambursări",
    v6_ft_cook: "Cookie-uri",
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
    v6_s3_b: "Făcut pentru Moldova",
    v6_s3_t: "Net billing, formularele Premier Energy și RED Nord, prețuri în lei",
    v6_m2_h: "Actele de racordare, completate și urmărite",
    v6_m5_h: "Un asistent care răspunde clienților și noaptea",
    v6_m6_h: "WhatsApp, Viber sau e-mail dintr-o atingere",
    v6_m7_h: "Proiectezi acoperișul pe imaginea din satelit",
    v6_m7_p: "Conturezi fiecare parte a acoperișului, marchezi coșurile și copacii, iar panourile se așază singure. Numărul, prețul și recuperarea ajung direct în ofertă.",
    v6_m8_h: "Monitorizare care ține cont de vreme",
    v6_m8_p: "Conectezi FusionSolar, Solarman sau Growatt și fiecare sistem e comparat cu soarele pe care l-a avut de fapt, ca o lună înnorată să nu pară o defecțiune.",
  },

  ru: {
    meta_title: "Программа расчёта солнечных станций для монтажников | VoltMira",
    meta_desc:
      "Программа для монтажников солнечных панелей в Молдове и Румынии: окупаемость в трёх сценариях по реальным данным PVGIS, отслеживаемые предложения и онлайн-подтверждение.",
    // social cards keep the slogan; search results lead with what people type
    og_title: "VoltMira: Солнечные расчёты, которые клиент может проверить",

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
      '<img src="/landing/hero-tile-roof-1600.webp" srcset="/landing/hero-tile-roof-800.webp 800w, /landing/hero-tile-roof-1600.webp 1600w" sizes="100vw" alt="Солнечные панели на красной черепичной крыше жилого дома" fetchpriority="high">',
    v6_hero_h1: 'Солнечные расчёты,<br>которые клиент<br><span class="hl">может проверить.</span>',
    v6_hero_lead:
      "Большинство программ показывают одну красивую цифру. VoltMira показывает <b>три честных сценария</b>, рассчитанных по реальным солнечным данным для крыши клиента. Вы узнаёте об этом в тот момент, когда клиент открыл предложение.",
    v6_hero_cta1: "Начать бесплатно",
    v6_hero_cta2: "Проверить крышу",
    v6_hc_toast: "<b>Ion Rusu</b> открыл ваше предложение",
    v6_t_now: "только что",
    v6_hc_sr:
      "Пример предложения: СЭС 5 кВт в Кишинёве окупается за 7,4, 6,4 или 5,8 года в зависимости от сценария.",
    v6_hc_label: "Расчёт СЭС",
    v6_hc_eyebrow: "SolarTech, расчёт СЭС",
    v6_hc_for: "подготовлено для Иона Руссу, Кишинёв",
    v6_hc_kw_l: "Солнечная станция",
    v6_hc_price: "103 950 лей",
    v6_hc_price_l: "Общие инвестиции",
    v6_hc_accept2: "Принять эту смету",
    v6_ph_cash: "Наличные",
    v6_ph_monthly: "Ежемесячно",
    v6_ph_glance: "Система вкратце",
    v6_ph_inv: "Deye 5 кВт гибрид",
    v6_ph_opt1: "Только панели",
    v6_ph_opt2: "С аккумулятором",
    v6_ph_money: "Ваши деньги за 25 лет",
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
      '<img src="/landing/installer-metal-roof-1600.webp" srcset="/landing/installer-metal-roof-800.webp 800w, /landing/installer-metal-roof-1600.webp 1200w" sizes="(min-width: 900px) 50vw, 100vw" alt="Монтажник в каске крепит солнечные панели на красной металлической крыше" loading="lazy">',
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
    v6_fd_3: "Выбрал вариант <b>с аккумулятором</b>. Окупаемость пересчитана",
    v6_fd_4: "Открыл снова, <b>2-й визит сегодня</b>",
    v6_fd_5: "<b>Принял предложение.</b> Проект «Выигран»",
    v6_t_2m: "2 мин",
    v6_t_3m: "3 мин",
    v6_t_6m: "6 мин",
    v6_t_1h: "1 ч",

    // scale band
    v6_sc_img:
      '<img src="/landing/warehouse-rooftop-1600.webp" srcset="/landing/warehouse-rooftop-800.webp 800w, /landing/warehouse-rooftop-1600.webp 1600w" sizes="100vw" alt="Вид сверху на логистический склад с солнечными панелями на крыше и грузовиками у рамп" loading="lazy">',
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
    v6_m2_p: "Настоящие формы Premier Energy и RED Nord, заполненные из проекта. По каждому делу видно, когда оператор задерживает ответ и пора звонить.",
    v6_m3_h: "Спецификация из вашего каталога",
    v6_m3_p:
      "Опишите систему простыми словами. Панели, инвертор и аккумулятор берутся только из вашего каталога, по вашим ценам.",
    v6_m4_h: "Проформы без ошибок",
    v6_m4_p:
      "НДС рассчитывается правильно, счета нумеруются по порядку, а всё выгружается в CSV для бухгалтера.",
    v6_m5_h: "Виджет заявок для вашего сайта",
    v6_m5_p: "На вашем сайте и в Telegram он отвечает на языке клиента, читает фото счёта, даёт оценку в леях и передаёт вам заявку на выезд.",
    v6_m6_h: "WhatsApp или e-mail в одно касание",
    v6_m6_p: "Отправьте отслеживаемую ссылку в WhatsApp или Viber, либо фирменный PDF по e-mail прямо из VoltMira.",

    // pricing
    v6_p_h: "Дешевле, чем кофе на одной упущенной сделке.",
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
    v6_fin_p: "Начните бесплатно сегодня. Без листа ожидания, без карты, настройка за минуты.",
    v6_fin_cta: "Начать бесплатно",
    v6_fin_demo: "Открыть демо",
    v6_ft_blurb:
      "Инструмент расчёта, который ваши клиенты могут проверить. Сделан для монтажников в Молдове и Румынии.",
    v6_ft_prod: "Продукт",
    v6_ft_comp: "Компания",
    v6_ft_touch: "Связь",
    v6_ft_track: "Отслеживаемые предложения",
    v6_ft_copy: "© 2026 VoltMira. Все права защищены.",
    v6_ft_founder: 'Основатель: <a href="https://voltmira.com/" rel="author">Bogdan Toctarov</a>',
    v6_ft_priv: "Конфиденциальность",
    v6_ft_terms: "Условия",
    v6_ft_ref: "Возвраты",
    v6_ft_cook: "Файлы cookie",
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
    v6_s3_b: "Сделано для Молдовы",
    v6_s3_t: "Нет-биллинг, формы Premier Energy и RED Nord, цены в леях",
    v6_m2_h: "Документы на подключение: заполнены и под контролем",
    v6_m5_h: "Помощник, который отвечает клиентам даже ночью",
    v6_m6_h: "WhatsApp, Viber или e-mail в одно касание",
    v6_m7_h: "Проектирование крыши по спутниковому снимку",
    v6_m7_p: "Обведите скаты, отметьте дымоходы и деревья, и панели разложатся сами. Количество, цена и окупаемость сразу попадают в смету.",
    v6_m8_h: "Мониторинг с учётом погоды",
    v6_m8_p: "Подключите FusionSolar, Solarman или Growatt, и каждая система сравнивается с реальным солнцем за месяц, поэтому пасмурный месяц не выглядит как неисправность.",
  },

  uk: {
    meta_title: "Програма розрахунку сонячних станцій для монтажників | VoltMira",
    meta_desc:
      "Програма для монтажників сонячних панелей у Молдові та Румунії: окупність у трьох сценаріях за реальними даними PVGIS, відстежувані пропозиції та онлайн-підтвердження.",
    // social cards keep the slogan; search results lead with what people type
    og_title: "VoltMira: сонячні розрахунки, які клієнт може перевірити",

    // nav
    v6_skip: "Перейти до вмісту",
    v6_nav_check: "Перевірити дах",
    v6_nav_honesty: "Три числа",
    v6_nav_pricing: "Тарифи",
    v6_nav_faq: "Запитання",
    v6_nav_demo: "Демо",
    v6_nav_signin: "Увійти",
    v6_nav_cta: "Почати безкоштовно",
    v6_sr_lang: "Змінити мову",
    v6_sr_theme: "Перемкнути світлу або темну тему",

    // hero
    v6_hero_img:
      '<img src="/landing/hero-tile-roof-1600.webp" srcset="/landing/hero-tile-roof-800.webp 800w, /landing/hero-tile-roof-1600.webp 1600w" sizes="100vw" alt="Сонячні панелі на червоному черепичному даху житлового будинку" fetchpriority="high">',
    v6_hero_h1: 'Сонячні розрахунки,<br>які клієнт<br><span class="hl">може перевірити.</span>',
    v6_hero_lead:
      "Більшість програм показують одну гарну цифру. VoltMira показує <b>три чесні сценарії</b>, розраховані за реальними сонячними даними для даху клієнта. Ви дізнаєтеся про це в ту мить, коли клієнт відкрив пропозицію.",
    v6_hero_cta1: "Почати безкоштовно",
    v6_hero_cta2: "Перевірити дах",
    v6_hc_toast: "<b>Ion Rusu</b> відкрив вашу пропозицію",
    v6_t_now: "щойно",
    v6_hc_sr:
      "Приклад пропозиції: СЕС 5 кВт у Кишиневі окуповується за 7,4, 6,4 або 5,8 року залежно від сценарію.",
    v6_hc_label: "Розрахунок СЕС",
    v6_hc_eyebrow: "SolarTech, розрахунок СЕС",
    v6_hc_for: "підготовлено для Іона Руссу, Кишинів",
    v6_hc_kw_l: "Сонячна станція",
    v6_hc_price: "103 950 лей",
    v6_hc_price_l: "Загальні інвестиції",
    v6_hc_accept2: "Прийняти цей розрахунок",
    v6_ph_cash: "Готівка",
    v6_ph_monthly: "Щомісяця",
    v6_ph_glance: "Система коротко",
    v6_ph_inv: "Deye 5 кВт гібрид",
    v6_ph_opt1: "Лише панелі",
    v6_ph_opt2: "З акумулятором",
    v6_ph_money: "Ваші гроші за 25 років",
    v6_hc_open: "Відкрито 2×",
    v6_hc_sub: "5 кВт на даху, Кишинів",
    v6_hc_cap: "Грошовий потік за 25 років",
    v6_b_pess_s: "Песиміст.",
    v6_b_expc_s: "Очікуваний",
    v6_b_opti_s: "Оптиміст.",
    v6_u_yrs: "року",
    v6_u_years: "року",
    v6_u_year: "рік",
    v6_hc_accept: "Прийняти пропозицію",

    // spec strip
    v6_s1_b: "3 сценарії",
    v6_s1_t: "Песимістичний, очікуваний і оптимістичний у кожному розрахунку",
    v6_s2_b: "Супутникові дані PVGIS",
    v6_s2_t: "Реальна інсоляція для конкретного даху, а не середнє",
    v6_s3_b: "Створено для Молдови",
    v6_s3_t: "Нетбілінг, форми Premier Energy і RED Nord, ціни в леях",
    v6_s4_b: "Менше 2 хвилин",
    v6_s4_t: "Від адреси до готової пропозиції",

    // fact-check instrument
    v6_ck_h: "Не вірте нам на слово. Перевірте будь-який дах.",
    v6_ck_lead:
      "Введіть адресу в Румунії чи Молдові та щомісячний рахунок за електроенергію. Працює той самий рушій і ті самі супутникові дані PVGIS, які клієнти бачать у пропозиції VoltMira.",
    v6_ck_country: "Країна",
    v6_ck_md: "Молдова",
    v6_ck_ro: "Румунія",
    v6_ck_addr: "Адреса",
    v6_ck_addr_ph: "Вулиця, будинок, місто",
    v6_ck_bill: "Щомісячний рахунок за електроенергію",
    v6_ck_run: "Розрахувати",
    v6_ck_fine:
      "Розрахунок для даху на південь із нахилом 35° і без акумулятора. У VoltMira ви задаєте реальний дах, обладнання й ціну.",
    v6_sh_brand: "Оцінка VoltMira",
    v6_sh_kw: "Рекомендована система",
    v6_sh_yield: "Генерація, PVGIS",
    v6_sh_cost: "Вартість із монтажем",
    v6_sh_save: "Економія за перший рік",
    v6_sh_pay: "Окупність, три сценарії",
    v6_sh_expected: "за очікуваним сценарієм",
    v6_b_pess: "Песимістичний",
    v6_b_expc: "Очікуваний",
    v6_b_opti: "Оптимістичний",
    v6_sh_foot:
      "Ці самі числа, з кожним надрукованим припущенням, стають пропозицією, яку відкриває клієнт.",
    v6_sh_cta: "Перетворити на пропозицію",

    // three numbers
    v6_h_h: "Одне число це продаж. Три числа це правда.",
    v6_h_lead:
      "Кожен розрахунок VoltMira показує строк окупності за песимістичних, очікуваних і оптимістичних припущень, і кожне припущення надруковано в пропозиції. Клієнти довіряють тому, що можуть перевірити. Довіра закриває угоди.",
    v6_h_cap:
      "Накопичений грошовий потік по роках. Приклад: будинок із СЕС 5 кВт у Кишиневі, 1 222 кВт·год/кВт за PVGIS, 5 250 € із монтажем, молдовський нетбілінг.",
    v6_h_hint: "Проведіть по графіку, щоб побачити будь-який рік",
    v6_h_p_desc:
      "<b>Мало сонця, ціни на місці.</b> −8% генерації, деградація 0,8%/рік, нульова інфляція на електроенергію. Якщо працює навіть це число, угода надійна.",
    v6_h_e_desc:
      "<b>Найімовірніший результат.</b> Генерація PVGIS для конкретного даху, деградація 0,5%/рік, інфляція 3%. Число, за яке ви відповідаєте.",
    v6_h_o_desc:
      "<b>Якщо ціни й далі зростатимуть.</b> +8% генерації, деградація 0,3%/рік, інфляція 5%. Показано чесно як найкращий випадок, але ніколи як заголовок.",
    v6_h_after: "через 25 років",
    v6_a_t: "Друкується в кожній пропозиції",
    v6_a_yield: "Генерація, PVGIS",
    v6_a_degr: "Деградація",
    v6_a_degr_v: "0,5% на рік",
    v6_a_infl: "Інфляція цін",
    v6_a_infl_v: "3% на рік",
    v6_a_scheme: "Тарифна схема",
    v6_a_scheme_v: "Нетбілінг",

    // how it works
    v6_how_img:
      '<img src="/landing/installer-metal-roof-1600.webp" srcset="/landing/installer-metal-roof-800.webp 800w, /landing/installer-metal-roof-1600.webp 1200w" sizes="(min-width: 900px) 50vw, 100vw" alt="Монтажник у касці кріпить сонячні панелі на червоному металевому даху" loading="lazy">',
    v6_how_h: "Створено для монтажника, який стоїть на даху.",
    v6_how_1_h: "Введіть адресу",
    v6_how_1_p:
      "VoltMira бере реальну інсоляцію для цього даху з <b>PVGIS</b> і автоматично застосовує тарифну схему потрібного ринку.",
    v6_how_2_h: "Отримуєте три чесні числа",
    v6_how_2_p:
      "Песимістичне, очікуване й оптимістичне, і <b>кожне припущення надруковано</b> в пропозиції, готове до розмови за кухонним столом.",
    v6_how_3_h: "Надішліть посилання й стежте за стрічкою",
    v6_how_3_p:
      "Одне посилання на телефон клієнта. Ви бачите <b>відкриття, хвилини перегляду й увімкнення акумулятора</b>, а «Прийняти» переводить угоду у вашу воронку.",

    // tracking
    v6_t_h: "Знайте мить, коли її відкрили.",
    v6_t_lead:
      "Годі гадати, коли нагадати про себе. Надішліть живе посилання замість мертвого PDF і дивіться, що відбувається з того боку.",
    v6_t_f1:
      "<b>Відкриття й час перегляду.</b> «Іон відкрив двічі, по 3 хвилини» краще, ніж «надіслав у вівторок, відповіді немає».",
    v6_t_f2:
      "<b>Сигнали взаємодії.</b> Увімкнув акумулятор? Це запитання покупця. Зателефонуйте й поговоріть про накопичувачі.",
    v6_t_f3:
      "<b>Прийняття просто зі сторінки.</b> Один дотик на його телефоні переводить угоду у «Виграно».",
    v6_t_f4:
      "<b>Ваші дані лишаються вашими.</b> Вивантаження всіх розрахунків і клієнтів у CSV одним кліком. Без прив’язки.",
    v6_ph_exp: "Окупність, очікуваний сценарій",
    v6_ph_batt: "Додати акумулятор",
    v6_ph_note: "Усі припущення, що стоять за цими числами, надруковано нижче на цій сторінці.",
    v6_fd_t: "Ваша стрічка активності",
    v6_fd_live: "Онлайн",
    v6_fd_1: "<b>Ion Rusu</b> відкрив <b>Casa Rusu</b>",
    v6_fd_2: "Перегляд <b>3 хв 34 с</b>, найдовший",
    v6_fd_3: "Вибрав варіант <b>з акумулятором</b>. Окупність перераховано",
    v6_fd_4: "Відкрив знову, <b>2-й візит сьогодні</b>",
    v6_fd_5: "<b>Прийняв пропозицію.</b> Проєкт «Виграно»",
    v6_t_2m: "2 хв",
    v6_t_3m: "3 хв",
    v6_t_6m: "6 хв",
    v6_t_1h: "1 год",

    // scale band
    v6_sc_img:
      '<img src="/landing/warehouse-rooftop-1600.webp" srcset="/landing/warehouse-rooftop-800.webp 800w, /landing/warehouse-rooftop-1600.webp 1600w" sizes="100vw" alt="Вигляд згори на логістичний склад із сонячними панелями на даху та вантажівками біля рамп" loading="lazy">',
    v6_sc_h: "Та сама чесна математика, 6&nbsp;кВт чи 600&nbsp;кВт.",
    v6_sc_p:
      "Приватні будинки, ферми й склади рахуються одним рушієм, із тими самими трьома сценаріями й тими самими надрукованими припущеннями.",

    // after the yes
    v6_m_h: "І все, що після «так».",
    v6_m_lead: "З розрахунку робота лише починається. VoltMira веде документи до самого кінця.",
    v6_m1_h: "Читає рахунок за електроенергію за вас",
    v6_m1_p:
      "Сфотографуйте рахунок клієнта. Річне споживання, номер лічильника й постачальника буде розпізнано автоматично, і нічого не застосовується, доки ви не перевірите.",
    v6_m2_h: "Документи на приєднання: заповнені й під контролем",
    v6_m2_p: "Справжні форми Premier Energy і RED Nord, заповнені з проєкту. За кожною справою видно, коли оператор затримує відповідь і час телефонувати.",
    v6_m3_h: "Специфікація з вашого каталогу",
    v6_m3_p:
      "Опишіть систему простими словами. Панелі, інвертор і акумулятор беруться лише з вашого каталогу, за вашими цінами.",
    v6_m4_h: "Проформи без помилок",
    v6_m4_p:
      "ПДВ розраховується правильно, рахунки нумеруються по порядку, а все вивантажується в CSV для бухгалтера.",
    v6_m5_h: "Помічник, який відповідає клієнтам навіть уночі",
    v6_m5_p: "На вашому сайті й у Telegram він відповідає мовою клієнта, читає фото рахунку, дає оцінку в леях і передає вам заявку на виїзд.",
    v6_m6_h: "WhatsApp, Viber або e-mail одним дотиком",
    v6_m6_p: "Надішліть відстежуване посилання у WhatsApp чи Viber або фірмовий PDF поштою просто з VoltMira.",
    v6_m7_h: "Проєктування даху за супутниковим знімком",
    v6_m7_p: "Обведіть схили, позначте димарі й дерева, і панелі розкладуться самі. Кількість, ціна й окупність одразу потрапляють у розрахунок.",
    v6_m8_h: "Моніторинг з урахуванням погоди",
    v6_m8_p: "Підключіть FusionSolar, Solarman або Growatt, і кожна система порівнюється з реальним сонцем за місяць, тож хмарний місяць не виглядає як несправність.",

    // pricing
    v6_p_h: "Дешевше, ніж кава на одній втраченій угоді.",
    v6_p_flag: "Почніть тут",
    v6_p_pro_amt: "<b>49 €</b><small>/ міс.</small>",
    v6_p_pro_for: "Для монтажника, який продає",
    v6_p_pro_1: "Ваш логотип у кожній пропозиції та PDF",
    v6_p_pro_2: "Відстежувані посилання й сповіщення про відкриття",
    v6_p_pro_3: "Віджет заявок для сайту",
    v6_p_pro_4: "Збережені клієнти й повна воронка",
    v6_p_cta: "Почати безкоштовно",
    v6_p_team: "Команда",
    v6_p_team_amt: "<b>119 €</b><small>/ міс.</small>",
    v6_p_team_for: "До 5 людей, одна воронка",
    v6_p_team_1: "Усе, що в Pro",
    v6_p_team_2: "5 місць із власниками проєктів",
    v6_p_team_3: "Спільні клієнти й аналітика конверсії",
    v6_p_team_4: "Пріоритетна підтримка",
    v6_p_ent:
      "Для монтажників із кількома філіями: необмежена кількість місць, повний журнал аудиту всіх змін, власні правила субсидій і тарифів, виділений менеджер і SLA.",
    v6_p_ent_cta: "Зв’язатися з нами",

    // faq
    v6_f_h: "Чесні запитання.",
    v6_f_side:
      'Не знайшли відповіді? Напишіть нам у <a href="https://wa.me/37362121019" target="_blank" rel="noopener">WhatsApp</a>.',
    v6_f_q1: "Звідки беруться сонячні цифри?",
    v6_f_a1:
      "Річна й місячна генерація беруться з PVGIS, супутникової бази сонячних даних Єврокомісії, для точних координат даху. Тарифні схеми застосовуються автоматично за ринком. Кожне припущення надруковано в пропозиції.",
    v6_f_q2: "Навіщо показувати песимістичне число? Чи не злякає це клієнта?",
    v6_f_a2:
      "На практиці навпаки. Діапазон із видимими припущеннями читається як інженерія; одна гарна цифра читається як продаж. Коли навіть ваш найгірший сценарій вигідніший за їхній рахунок за електроенергію, угода захищає себе сама.",
    v6_f_q3: "Чи працює це з нетбілінгом у Молдові?",
    v6_f_a3:
      "Так, це наша рідна територія. Низька ціна експорту в Молдові робить власне споживання головним чинником, тому рушій моделює його помісячно й коректно оцінює накопичувачі.",
    v6_f_q4: "Що відстежувана пропозиція означає для приватності клієнта?",
    v6_f_a4:
      "Посилання фіксує відкриття, час на сторінці й дії із самим розрахунком. Більше нічого. Без рекламних трекерів, без профілювання, хостинг у ЄС.",
    v6_f_q5: "Як почати?",
    v6_f_a5:
      "Реєструєтеся, і ви всередині. Без списку очікування й без картки: одразу повний доступ, створюйте розрахунки й надсилайте відстежувані пропозиції, безкоштовно на весь час бети.",

    // final + footer
    v6_fin_h: "Станьте монтажником, чиї числа витримують перевірку.",
    v6_fin_p: "Почніть безкоштовно сьогодні. Без списку очікування, без картки, налаштування за хвилини.",
    v6_fin_cta: "Почати безкоштовно",
    v6_fin_demo: "Відкрити демо",
    v6_ft_blurb:
      "Інструмент розрахунку, який ваші клієнти можуть перевірити. Створений для монтажників у Молдові та Румунії.",
    v6_ft_prod: "Продукт",
    v6_ft_comp: "Компанія",
    v6_ft_touch: "Зв’язок",
    v6_ft_track: "Відстежувані пропозиції",
    v6_ft_copy: "© 2026 VoltMira. Усі права захищено.",
    v6_ft_founder: 'Засновник: <a href="https://voltmira.com/" rel="author">Bogdan Toctarov</a>',
    v6_ft_priv: "Конфіденційність",
    v6_ft_terms: "Умови",
    v6_ft_ref: "Повернення коштів",
    v6_ft_cook: "Файли cookie",
    v6_ft_cred: "Фотографії",
    v6_ft_t1: "Хостинг у ЄС",
    v6_ft_t2: "Відповідність GDPR",
    v6_ft_t3: "Румунія, Молдова, ЄС",

    // strings the scripts read
    v6_js_example: "Приклад даху",
    v6_js_live: "Ваш дах",
    v6_js_loading: "Завантажуємо супутникові дані для цього даху…",
    v6_js_year: "Рік",
    v6_js_err_empty: "Введіть адресу для перевірки.",
    v6_js_err_bill: "Введіть щомісячний рахунок числом.",
    v6_js_err_nf: "Не вдалося знайти цю адресу. Спробуйте додати місто.",
    v6_js_err_rate: "Забагато дахів за хвилину. Спробуйте трохи пізніше.",
    v6_js_err_up: "Сервіс супутникових даних зайнятий. Спробуйте за мить.",
    v6_js_err_net: "Немає з’єднання. Перевірте інтернет і спробуйте знову.",
    v6_js_nopay: "понад 25",
    v6_js_paid: "Окуповується за",
    v6_js_slider: "Рік {y}: песимістичний {p}, очікуваний {e}, оптимістичний {o}",
  },
};
