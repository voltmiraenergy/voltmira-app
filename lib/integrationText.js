// lib/integrationText.js — the installer's words for the local integrations
// (docs/INTEGRATIONS.md): billing (e-Factura and payments), the 1C export
// and sending the grid file to the operator. Romanian first, the installer
// addressed with "tu" like the rest of the app.
const T = {
  // ---- billing page
  bl_title: { en: "Billing: {title}", ro: "Facturare: {title}", ru: "Счета: {title}", uk: "Рахунки: {title}" },
  bl_sub: { en: "Invoice {no}, {total}", ro: "Factura {no}, {total}", ru: "Счёт {no}, {total}", uk: "Рахунок {no}, {total}" },
  bl_no_number: { en: "This quote has no invoice number yet. Open the proforma once and it gets the next one.", ro: "Oferta nu are încă număr de factură. Deschide o dată factura proformă și primește următorul număr.", ru: "У этого расчёта ещё нет номера счёта. Открой проформу один раз, и он получит следующий номер.", uk: "У цього розрахунку ще немає номера рахунку. Відкрий проформу один раз, і він отримає наступний номер." },
  bl_open_invoice: { en: "Open the proforma", ro: "Deschide factura proformă", ru: "Открыть проформу", uk: "Відкрити проформу" },
  bl_back: { en: "Back to the quote", ro: "Înapoi la ofertă", ru: "Назад к расчёту", uk: "Назад до розрахунку" },
  bl_needs_db: { en: "Billing is not switched on in the database yet: run supabase/add-integrations.sql.", ro: "Facturarea nu este încă activată în baza de date: rulează supabase/add-integrations.sql.", ru: "Счета ещё не включены в базе данных: запусти supabase/add-integrations.sql.", uk: "Рахунки ще не ввімкнено в базі даних: запусти supabase/add-integrations.sql." },
  bl_link: { en: "e-Factura and payments", ro: "e-Factura și plăți", ru: "e-Factura и платежи", uk: "e-Factura і платежі" },

  // ---- e-Factura
  ef_h: { en: "e-Factura (SFS)", ro: "e-Factura (SFS)", ru: "e-Factura (ГНС)", uk: "e-Factura (ДФС Молдови)" },
  ef_lead: { en: "Sends this invoice to the State Tax Service as a fiscal invoice. The amounts are the proforma's, computed again on the server.", ro: "Trimite factura la Serviciul Fiscal de Stat ca factură fiscală. Sumele sunt cele din proformă, calculate din nou pe server.", ru: "Отправляет этот счёт в Государственную налоговую службу как налоговую накладную. Суммы те же, что в проформе, пересчитанные на сервере.", uk: "Надсилає цей рахунок до Державної податкової служби Молдови як податкову накладну. Суми ті самі, що в проформі, перераховані на сервері." },
  ef_mock: { en: "Test mode: SFS is simulated. Nothing reaches SFS until access is set up.", ro: "Mod de test: SFS este simulat. Nimic nu ajunge la SFS până nu este configurat accesul.", ru: "Тестовый режим: ГНС имитируется. Ничего не уходит в ГНС, пока не настроен доступ.", uk: "Тестовий режим: податкова служба імітується. Нічого не надсилається, доки не налаштовано доступ." },
  ef_none: { en: "Not sent yet.", ro: "Netrimisă încă.", ru: "Ещё не отправлен.", uk: "Ще не надіслано." },
  ef_st_submitted: { en: "Being processed by SFS", ro: "În procesare la SFS", ru: "Обрабатывается в ГНС", uk: "Обробляється податковою" },
  ef_st_accepted: { en: "Accepted, fiscal number {n}", ro: "Acceptată, număr fiscal {n}", ru: "Принят, фискальный номер {n}", uk: "Прийнято, фіскальний номер {n}" },
  ef_st_rejected: { en: "Rejected: {reason}", ro: "Respinsă: {reason}", ru: "Отклонён: {reason}", uk: "Відхилено: {reason}" },
  ef_st_error: { en: "Not sent: {reason}", ro: "Netrimisă: {reason}", ru: "Не отправлен: {reason}", uk: "Не надіслано: {reason}" },
  ef_attempt: { en: "Attempt {n}, {date}", ro: "Încercarea {n}, {date}", ru: "Попытка {n}, {date}", uk: "Спроба {n}, {date}" },
  ef_submit: { en: "Send to e-Factura", ro: "Trimite la e-Factura", ru: "Отправить в e-Factura", uk: "Надіслати до e-Factura" },
  ef_retry: { en: "Send again", ro: "Retrimite", ru: "Отправить снова", uk: "Надіслати знову" },
  ef_refresh: { en: "Check the status", ro: "Verifică starea", ru: "Проверить статус", uk: "Перевірити статус" },
  ef_sending: { en: "Sending...", ro: "Se trimite...", ru: "Отправка...", uk: "Надсилання..." },
  ef_ready_h: { en: "Before you send", ro: "Înainte de trimitere", ru: "Перед отправкой", uk: "Перед надсиланням" },
  ef_ready_ok: { en: "Everything SFS checks is filled in.", ro: "Tot ce verifică SFS este completat.", ru: "Всё, что проверяет ГНС, заполнено.", uk: "Усе, що перевіряє податкова, заповнено." },
  ef_settings: { en: "Complete it in Settings", ro: "Completează în Setări", ru: "Заполнить в настройках", uk: "Заповнити в налаштуваннях" },
  ef_buyer_idno: { en: "Client's IDNO (company)", ro: "IDNO-ul clientului (persoană juridică)", ru: "IDNO клиента (юрлицо)", uk: "IDNO клієнта (юрособа)" },
  ef_history: { en: "Attempts", ro: "Încercări", ru: "Попытки", uk: "Спроби" },
  // reasons, as the validation and the adapters name them
  ef_e_invoice_number: { en: "the invoice has no number", ro: "factura nu are număr", ru: "у счёта нет номера", uk: "рахунок не має номера" },
  ef_e_invoice_date: { en: "the invoice date is missing", ro: "lipsește data facturii", ru: "нет даты счёта", uk: "немає дати рахунку" },
  ef_e_currency_not_mdl: { en: "e-Factura takes invoices in lei only; this quote is in another currency", ro: "e-Factura primește doar facturi în lei; oferta este în altă valută", ru: "e-Factura принимает счета только в леях; этот расчёт в другой валюте", uk: "e-Factura приймає рахунки лише в леях; цей розрахунок в іншій валюті" },
  ef_e_seller_name: { en: "your company's legal name is missing", ro: "lipsește denumirea juridică a firmei tale", ru: "нет юридического названия твоей фирмы", uk: "немає юридичної назви твоєї фірми" },
  ef_e_seller_idno: { en: "your company's IDNO (13 digits) is missing", ro: "lipsește IDNO-ul firmei tale (13 cifre)", ru: "нет IDNO твоей фирмы (13 цифр)", uk: "немає IDNO твоєї фірми (13 цифр)" },
  ef_e_seller_vat_no: { en: "the invoice has VAT but your VAT code is missing", ro: "factura are TVA, dar lipsește codul tău TVA", ru: "в счёте есть НДС, но нет твоего кода НДС", uk: "у рахунку є ПДВ, але немає твого коду ПДВ" },
  ef_e_buyer_name: { en: "the client's name is missing", ro: "lipsește numele clientului", ru: "нет имени клиента", uk: "немає імені клієнта" },
  ef_e_buyer_idno: { en: "the client is a company: its IDNO (13 digits) is needed", ro: "clientul este persoană juridică: e nevoie de IDNO-ul lui (13 cifre)", ru: "клиент юрлицо: нужен его IDNO (13 цифр)", uk: "клієнт юрособа: потрібен його IDNO (13 цифр)" },
  ef_e_no_amount: { en: "the invoice has no amount", ro: "factura nu are sumă", ru: "в счёте нет суммы", uk: "у рахунку немає суми" },
  ef_e_totals: { en: "the totals do not add up", ro: "totalurile nu se potrivesc", ru: "итоги не сходятся", uk: "підсумки не сходяться" },
  ef_e_not_configured: { en: "access to SFS is not set up yet", ro: "accesul la SFS nu este încă configurat", ru: "доступ к ГНС ещё не настроен", uk: "доступ до податкової ще не налаштовано" },
  ef_e_not_implemented: { en: "the SFS connection is not finished yet", ro: "conexiunea cu SFS nu este încă finalizată", ru: "подключение к ГНС ещё не завершено", uk: "підключення до податкової ще не завершено" },
  ef_e_in_progress: { en: "a submission is already in progress", ro: "o trimitere este deja în curs", ru: "отправка уже идёт", uk: "надсилання вже триває" },
  ef_e_already_accepted: { en: "this invoice is already accepted", ro: "factura este deja acceptată", ru: "этот счёт уже принят", uk: "цей рахунок уже прийнято" },
  ef_e_no_invoice_no: { en: "open the proforma first, so the invoice has a number", ro: "deschide întâi factura proformă, ca să aibă număr", ru: "сначала открой проформу, чтобы у счёта был номер", uk: "спершу відкрий проформу, щоб рахунок мав номер" },
  ef_e_not_sent: { en: "the attempt stopped before reaching SFS", ro: "încercarea s-a oprit înainte să ajungă la SFS", ru: "попытка остановилась до ГНС", uk: "спроба зупинилася, не дійшовши до податкової" },
  ef_e_other: { en: "something went wrong; try again", ro: "ceva nu a mers; încearcă din nou", ru: "что-то пошло не так; попробуй снова", uk: "щось пішло не так; спробуй знову" },

  // ---- payments
  pm_h: { en: "Payments", ro: "Plăți", ru: "Платежи", uk: "Платежі" },
  pm_invoiced: { en: "Invoiced", ro: "Facturat", ru: "Выставлено", uk: "Виставлено" },
  pm_paid: { en: "Paid", ro: "Încasat", ru: "Оплачено", uk: "Сплачено" },
  pm_due: { en: "Still due", ro: "Rest de plată", ru: "Осталось", uk: "Залишок" },
  pm_settled: { en: "Paid in full", ro: "Achitat integral", ru: "Оплачено полностью", uk: "Сплачено повністю" },
  pm_other_cur: { en: "{n} payment(s) in another currency are listed but not counted.", ro: "{n} plăți în altă valută sunt listate, dar nu sunt adunate.", ru: "{n} платежей в другой валюте показаны, но не учтены.", uk: "{n} платежів в іншій валюті показано, але не враховано." },
  pm_amount: { en: "Amount", ro: "Suma", ru: "Сумма", uk: "Сума" },
  pm_currency: { en: "Currency", ro: "Valuta", ru: "Валюта", uk: "Валюта" },
  pm_date: { en: "Paid on", ro: "Data plății", ru: "Дата оплаты", uk: "Дата оплати" },
  pm_method: { en: "Method", ro: "Metoda", ru: "Способ", uk: "Спосіб" },
  pm_m_bank: { en: "Bank transfer", ro: "Transfer bancar", ru: "Банковский перевод", uk: "Банківський переказ" },
  pm_m_cash: { en: "Cash", ro: "Numerar", ru: "Наличные", uk: "Готівка" },
  pm_m_card: { en: "Card", ro: "Card", ru: "Карта", uk: "Картка" },
  pm_reference: { en: "Reference (optional)", ro: "Referință (opțional)", ru: "Назначение (необязательно)", uk: "Призначення (необов’язково)" },
  pm_add: { en: "Record the payment", ro: "Înregistrează plata", ru: "Записать платёж", uk: "Записати платіж" },
  pm_saving: { en: "Saving...", ro: "Se salvează...", ru: "Сохранение...", uk: "Збереження..." },
  pm_none: { en: "No payments recorded yet.", ro: "Încă nicio plată înregistrată.", ru: "Платежей пока нет.", uk: "Платежів поки немає." },
  pm_remove: { en: "Remove", ro: "Șterge", ru: "Удалить", uk: "Видалити" },
  pm_remove_q: { en: "Remove this payment? The audit log keeps a record of it.", ro: "Ștergi această plată? Jurnalul de audit păstrează o înregistrare.", ru: "Удалить этот платёж? Журнал аудита сохранит запись.", uk: "Видалити цей платіж? Журнал аудиту збереже запис." },
  pm_bad: { en: "Check the amount and the date (not in the future).", ro: "Verifică suma și data (nu în viitor).", ru: "Проверь сумму и дату (не в будущем).", uk: "Перевір суму й дату (не в майбутньому)." },
  pm_failed: { en: "The payment was not saved. Try again.", ro: "Plata nu a fost salvată. Încearcă din nou.", ru: "Платёж не сохранён. Попробуй снова.", uk: "Платіж не збережено. Спробуй знову." },

  // ---- 1C export
  ex_title: { en: "Export for 1C", ro: "Export pentru 1C", ru: "Выгрузка для 1С", uk: "Вивантаження для 1С" },
  ex_sub: { en: "Customers, invoices and payments for a period, in the form 1C imports.", ro: "Clienți, facturi și plăți pe o perioadă, în forma pe care o importă 1C.", ru: "Клиенты, счета и платежи за период в виде, который загружает 1С.", uk: "Клієнти, рахунки й платежі за період у вигляді, який завантажує 1С." },
  ex_from: { en: "From", ro: "De la", ru: "С", uk: "З" },
  ex_to: { en: "To", ro: "Până la", ru: "По", uk: "По" },
  ex_format: { en: "Format", ro: "Format", ru: "Формат", uk: "Формат" },
  ex_csv: { en: "CSV, a ZIP with three files", ro: "CSV, o arhivă ZIP cu trei fișiere", ru: "CSV, ZIP-архив с тремя файлами", uk: "CSV, ZIP-архів із трьома файлами" },
  ex_xml: { en: "XML, one file", ro: "XML, un singur fișier", ru: "XML, один файл", uk: "XML, один файл" },
  ex_download: { en: "Download", ro: "Descarcă", ru: "Скачать", uk: "Завантажити" },
  ex_help: { en: "The CSV files load with 1C's standard processing for loading data from a spreadsheet. The XML has a fixed structure, described for your 1C programmer.", ro: "Fișierele CSV se încarcă prin prelucrarea standard 1C de încărcare a datelor din document tabelar. XML-ul are o structură fixă, descrisă pentru programatorul tău 1C.", ru: "CSV-файлы загружаются стандартной обработкой 1С «Загрузка данных из табличного документа». XML имеет фиксированную структуру, описанную для твоего программиста 1С.", uk: "CSV-файли завантажуються стандартною обробкою 1С для завантаження даних із табличного документа. XML має фіксовану структуру, описану для твого програміста 1С." },
  ex_bad_range: { en: "Pick a period: the start before the end, at most a year.", ro: "Alege o perioadă: începutul înaintea sfârșitului, cel mult un an.", ru: "Выбери период: начало раньше конца, не больше года.", uk: "Обери період: початок раніше за кінець, не більше року." },
  ex_mapping_h: { en: "Columns for 1C", ro: "Coloanele pentru 1C", ru: "Колонки для 1С", uk: "Колонки для 1С" },
  ex_mapping_sub: { en: "Column names, separator, decimals and date as your 1C configuration expects them. Saved for your company.", ro: "Denumirile coloanelor, separatorul, zecimalele și data, așa cum le așteaptă configurația ta 1C. Se salvează pentru firma ta.", ru: "Названия колонок, разделитель, десятичные и дата, как их ждёт твоя конфигурация 1С. Сохраняется для твоей фирмы.", uk: "Назви колонок, роздільник, десяткові й дата, як їх очікує твоя конфігурація 1С. Зберігається для твоєї фірми." },
  ex_delim: { en: "Column separator", ro: "Separator de coloane", ru: "Разделитель колонок", uk: "Роздільник колонок" },
  ex_delim_semi: { en: "Semicolon (;)", ro: "Punct și virgulă (;)", ru: "Точка с запятой (;)", uk: "Крапка з комою (;)" },
  ex_delim_comma: { en: "Comma (,)", ro: "Virgulă (,)", ru: "Запятая (,)", uk: "Кома (,)" },
  ex_delim_tab: { en: "Tab", ro: "Tab", ru: "Табуляция", uk: "Табуляція" },
  ex_decimal: { en: "Decimal mark", ro: "Separator zecimal", ru: "Десятичный разделитель", uk: "Десятковий роздільник" },
  ex_dec_comma: { en: "Comma (1234,56)", ro: "Virgulă (1234,56)", ru: "Запятая (1234,56)", uk: "Кома (1234,56)" },
  ex_dec_dot: { en: "Dot (1234.56)", ro: "Punct (1234.56)", ru: "Точка (1234.56)", uk: "Крапка (1234.56)" },
  ex_date: { en: "Date format", ro: "Formatul datei", ru: "Формат даты", uk: "Формат дати" },
  ex_bom: { en: "Start with the UTF-8 mark (BOM), so Excel and 1C read the diacritics", ro: "Cu marcajul UTF-8 (BOM) la început, ca Excel și 1C să citească diacriticele", ru: "С меткой UTF-8 (BOM) в начале, чтобы Excel и 1С читали буквы правильно", uk: "З міткою UTF-8 (BOM) на початку, щоб Excel і 1С правильно читали літери" },
  ex_ent_customers: { en: "Customers", ro: "Clienți", ru: "Клиенты", uk: "Клієнти" },
  ex_ent_invoices: { en: "Invoices", ro: "Facturi", ru: "Счета", uk: "Рахунки" },
  ex_ent_payments: { en: "Payments", ro: "Plăți", ru: "Платежи", uk: "Платежі" },
  ex_save: { en: "Save the columns", ro: "Salvează coloanele", ru: "Сохранить колонки", uk: "Зберегти колонки" },
  ex_saved: { en: "Saved.", ro: "Salvat.", ru: "Сохранено.", uk: "Збережено." },
  ex_save_failed: { en: "Not saved. Try again.", ro: "Nu s-a salvat. Încearcă din nou.", ru: "Не сохранено. Попробуй снова.", uk: "Не збережено. Спробуй знову." },
  ex_defaults: { en: "Back to the default columns", ro: "Revino la coloanele implicite", ru: "Вернуть колонки по умолчанию", uk: "Повернути типові колонки" },
  ex_link: { en: "Export for 1C", ro: "Export 1C", ru: "Выгрузка 1С", uk: "Вивантаження 1С" },
};

export const XT = T;

export function xt(key, lang = "en", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** A reason code from e-Factura's validation or an adapter, said plainly. */
export const efReason = (code, lang) => (T["ef_e_" + code] ? xt("ef_e_" + code, lang) : xt("ef_e_other", lang));
