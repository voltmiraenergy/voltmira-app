// lib/feeSimText.js — the words of the fee walk-through (components/FeeSimulator.jsx), in the four languages.
// Plain text: no dashes, no middle dots.
const T = {
  sim_kicker: { en: "Interactive example", ro: "Exemplu interactiv", ru: "Интерактивный пример", uk: "Інтерактивний приклад" },
  sim_h: { en: "How paying works, from the signature to the transfer", ro: "Cum merge plata, de la semnătură la transfer", ru: "Как устроена оплата, от подписи до перевода", uk: "Як працює оплата, від підпису до переказу" },
  sim_p: { en: "One example job, with the real rules. Move the day or press the buttons: nothing is saved and nothing is sent to anyone.", ro: "O lucrare de exemplu, cu regulile adevărate. Mută ziua sau apasă butoanele: nimic nu se salvează și nu se trimite nimănui.", ru: "Один пример объекта с настоящими правилами. Двигайте день или нажимайте кнопки: ничего не сохраняется и никому не отправляется.", uk: "Один приклад об’єкта зі справжніми правилами. Рухайте день або натискайте кнопки: нічого не зберігається і нікому не надсилається." },
  sim_kw: { en: "Signed system", ro: "Sistemul semnat", ru: "Подписанная система", uk: "Підписана система" },
  sim_free: { en: "One of the company's first {n} jobs (free)", ro: "Una din primele {n} lucrări ale firmei (gratuită)", ru: "Один из первых {n} объектов фирмы (бесплатно)", uk: "Один із перших {n} об’єктів фірми (безкоштовно)" },
  sim_papers: { en: "You made the contract or the invoice for it", ro: "Ai făcut contractul sau factura pentru ea", ru: "Вы оформили договор или счёт", uk: "Ви оформили договір або рахунок" },
  sim_day: { en: "Day", ro: "Ziua", ru: "День", uk: "День" },
  sim_m_signed: { en: "The client signs", ro: "Clientul semnează", ru: "Клиент подписывает", uk: "Клієнт підписує" },
  sim_m_issued: { en: "The statement comes", ro: "Vine extrasul", ru: "Приходит выписка", uk: "Надходить виписка" },
  sim_m_last: { en: "Last day to pay", ro: "Ultima zi de plată", ru: "Последний день оплаты", uk: "Останній день оплати" },
  sim_m_locked: { en: "Paperwork locked", ro: "Documente blocate", ru: "Документы заблокированы", uk: "Документи заблоковано" },
  sim_m_hold30: { en: "No new offers", ro: "Fără oferte noi", ru: "Без новых предложений", uk: "Без нових пропозицій" },
  sim_m_hold60: { en: "Read-only", ro: "Doar citire", ru: "Только чтение", uk: "Лише читання" },
  sim_fee_h: { en: "The job's fee", ro: "Taxa lucrării", ru: "Плата за объект", uk: "Плата за об’єкт" },
  sim_can_h: { en: "What you can do", ro: "Ce poți face", ru: "Что можно делать", uk: "Що можна робити" },
  sim_mail_h: { en: "Emails you got", ro: "E-mailuri primite", ru: "Полученные письма", uk: "Отримані листи" },
  sim_mail_none: { en: "No email yet.", ro: "Niciun e-mail încă.", ru: "Писем пока нет.", uk: "Листів поки немає." },
  sim_s_free: { en: "Free", ro: "Gratuită", ru: "Бесплатно", uk: "Безкоштовно" },
  sim_s_month: { en: "Counted this month", ro: "Adunată luna aceasta", ru: "Учтена в этом месяце", uk: "Врахована цього місяця" },
  sim_s_open: { en: "On the statement, to pay", ro: "Pe extras, de plătit", ru: "В выписке, к оплате", uk: "У виписці, до сплати" },
  sim_s_late: { en: "{n} days late", ro: "Întârziată {n} zile", ru: "Просрочено на {n} дн.", uk: "Прострочено на {n} дн." },
  sim_s_paid: { en: "Paid", ro: "Plătită", ru: "Оплачено", uk: "Сплачено" },
  sim_s_void: { en: "Cancelled, nothing to pay", ro: "Anulată, nimic de plată", ru: "Отменено, платить нечего", uk: "Скасовано, нічого сплачувати" },
  sim_s_kept: { en: "Still owed, waiver asked", ro: "Rămâne de plată, iertare cerută", ru: "К оплате, запрошено списание", uk: "До сплати, запитано списання" },
  sim_x_free: { en: "The company's first {n} signed jobs, counted by its IDNO, cost nothing. No statement, nothing locked.", ro: "Primele {n} lucrări semnate ale firmei, numărate după IDNO, nu costă nimic. Fără extras, nimic blocat.", ru: "Первые {n} подписанных объекта фирмы, по IDNO, ничего не стоят. Без выписки, ничего не блокируется.", uk: "Перші {n} підписані об’єкти фірми, за IDNO, нічого не коштують. Без виписки, нічого не блокується." },
  sim_x_month: { en: "The fee is added up with the month's other signed jobs. You pay nothing now: the statement comes on {d}.", ro: "Taxa se adună cu celelalte lucrări semnate în luna aceasta. Nu plătești nimic acum: extrasul vine pe {d}.", ru: "Плата суммируется с другими подписанными объектами месяца. Сейчас вы ничего не платите: выписка придёт {d}.", uk: "Плата додається до інших підписаних об’єктів місяця. Зараз ви нічого не сплачуєте: виписка надійде {d}." },
  sim_x_open: { en: "The statement is in your email and in Settings. Pay it by bank transfer with the reference printed on it, by {d}.", ro: "Extrasul e în e-mail și în Setări. Îl plătești prin transfer bancar, cu destinația tipărită pe el, până pe {d}.", ru: "Выписка пришла на e-mail и есть в Настройках. Оплатите её банковским переводом с указанным назначением до {d}.", uk: "Виписка надійшла на e-mail і є в Налаштуваннях. Сплатіть її банківським переказом із зазначеним призначенням до {d}." },
  sim_x_late1: { en: "The job's paperwork is locked until the transfer arrives. Offers, clients and everything else keep working.", ro: "Documentele lucrării sunt blocate până sosește transferul. Ofertele, clienții și restul merg mai departe.", ru: "Документы объекта заблокированы до поступления перевода. Предложения, клиенты и остальное работают.", uk: "Документи об’єкта заблоковано до надходження переказу. Пропозиції, клієнти й решта працюють." },
  sim_x_late2: { en: "30 days late: no new offer can be sent, and sent offers cannot be changed. Offers already sent stay open to clients.", ro: "30 de zile întârziere: nu poți trimite oferte noi și nu poți schimba cele trimise. Ofertele deja trimise rămân deschise clienților.", ru: "30 дней просрочки: нельзя отправлять новые предложения и менять отправленные. Уже отправленные остаются открытыми для клиентов.", uk: "30 днів прострочки: не можна надсилати нові пропозиції й змінювати надіслані. Уже надіслані залишаються відкритими для клієнтів." },
  sim_x_late3: { en: "60 days late: the workspace is read-only. Nothing is deleted; it all opens again the day the transfer arrives.", ro: "60 de zile întârziere: spațiul de lucru e doar pentru citire. Nu se șterge nimic; totul se redeschide în ziua în care sosește transferul.", ru: "60 дней просрочки: пространство только для чтения. Ничего не удаляется; всё откроется в день поступления перевода.", uk: "60 днів прострочки: простір лише для читання. Нічого не видаляється; усе відкриється в день надходження переказу." },
  sim_x_paid: { en: "The transfer arrived on {d}. VoltMira marked the statement paid and everything is open.", ro: "Transferul a sosit pe {d}. VoltMira a marcat extrasul plătit și totul e deschis.", ru: "Перевод поступил {d}. VoltMira отметила выписку оплаченной, всё открыто.", uk: "Переказ надійшов {d}. VoltMira позначила виписку сплаченою, усе відкрито." },
  sim_x_void: { en: "The client gave up before any paperwork was made: you owe nothing for this job.", ro: "Clientul a renunțat înainte de orice act: nu datorezi nimic pentru această lucrare.", ru: "Клиент отказался до оформления документов: вы ничего не должны за этот объект.", uk: "Клієнт відмовився до оформлення документів: ви нічого не винні за цей об’єкт." },
  sim_x_kept: { en: "The client gave up after you made paperwork for the job: the fee stays. You wrote why, and VoltMira decides whether to waive it.", ro: "Clientul a renunțat după ce ai făcut acte pentru lucrare: taxa rămâne. Ai scris de ce, iar VoltMira decide dacă o iartă.", ru: "Клиент отказался после оформления документов: плата остаётся. Вы написали причину, VoltMira решает, списать ли её.", uk: "Клієнт відмовився після оформлення документів: плата залишається. Ви написали причину, VoltMira вирішує, чи списати її." },
  sim_c_docs: { en: "Contract, invoice, grid file", ro: "Contract, factură, dosar de racordare", ru: "Договор, счёт, документы на подключение", uk: "Договір, рахунок, документи на приєднання" },
  sim_c_offers: { en: "New offers", ro: "Oferte noi", ru: "Новые предложения", uk: "Нові пропозиції" },
  sim_c_edit: { en: "Changes to quotes", ro: "Modificări în oferte", ru: "Изменения в предложениях", uk: "Зміни в пропозиціях" },
  sim_open: { en: "Open", ro: "Deschis", ru: "Открыто", uk: "Відкрито" },
  sim_locked: { en: "Locked", ro: "Blocat", ru: "Заблокировано", uk: "Заблоковано" },
  sim_stopped: { en: "Stopped", ro: "Oprite", ru: "Остановлены", uk: "Зупинено" },
  sim_readonly: { en: "Read-only", ro: "Doar citire", ru: "Только чтение", uk: "Лише читання" },
  sim_st_h: { en: "VoltMira statement (example)", ro: "Extrasul VoltMira (exemplu)", ru: "Выписка VoltMira (пример)", uk: "Виписка VoltMira (приклад)" },
  sim_st_ref: { en: "Payment reference", ro: "Destinația plății", ru: "Назначение платежа", uk: "Призначення платежу" },
  sim_st_sum: { en: "To pay", ro: "De plătit", ru: "К оплате", uk: "До сплати" },
  sim_st_until: { en: "By", ro: "Până pe", ru: "До", uk: "До" },
  sim_st_iban: { en: "VoltMira's IBAN, printed on the statement", ro: "IBAN-ul VoltMira, tipărit pe extras", ru: "IBAN VoltMira, напечатан в выписке", uk: "IBAN VoltMira, надрукований у виписці" },
  sim_st_none: { en: "No statement yet: it comes on {d}.", ro: "Încă nu e extras: vine pe {d}.", ru: "Выписки пока нет: она придёт {d}.", uk: "Виписки поки немає: вона надійде {d}." },
  sim_st_free: { en: "A free job goes on no statement.", ro: "O lucrare gratuită nu apare pe niciun extras.", ru: "Бесплатный объект не попадает в выписку.", uk: "Безкоштовний об’єкт не потрапляє у виписку." },
  sim_pay: { en: "Simulate the transfer", ro: "Simulează transferul", ru: "Смоделировать перевод", uk: "Змоделювати переказ" },
  sim_pay_hint: { en: "For real, VoltMira marks the statement paid when the money reaches its account, usually the same day.", ro: "În realitate, VoltMira marchează extrasul plătit când banii ajung în cont, de obicei în aceeași zi.", ru: "На деле VoltMira отмечает выписку оплаченной, когда деньги поступают на счёт, обычно в тот же день.", uk: "Насправді VoltMira позначає виписку сплаченою, коли гроші надходять на рахунок, зазвичай того ж дня." },
  sim_gave_up: { en: "The client gave up", ro: "Clientul a renunțat", ru: "Клиент отказался", uk: "Клієнт відмовився" },
  sim_reset: { en: "Start over", ro: "Reia exemplul", ru: "Начать заново", uk: "Почати знову" },
};

export function simt(key, lang = "ro", vars = null) {
  const e = T[key];
  let s = e ? (e[lang] ?? e.ro) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

export const SIM_TEXT = T;
