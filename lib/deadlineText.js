// lib/deadlineText.js — the words of the permits and deadlines view and its
// weekly email, in four languages. Installer-facing: informal Romanian.

const T = {
  nav: { en: "Permits and deadlines", ro: "Avize și termene", ru: "Разрешения и сроки", uk: "Дозволи та строки" },
  title: { en: "Permits and deadlines", ro: "Avize și termene", ru: "Разрешения и сроки", uk: "Дозволи та строки" },
  sub: {
    en: "Every checklist item and grid step with a due date, across all your plants: what is late and what is due in the next {n} days.",
    ro: "Fiecare element din listă și fiecare pas de racordare cu termen, la toate centralele tale: ce întârzie și ce expiră în următoarele {n} zile.",
    ru: "Каждый пункт перечня и шаг подключения со сроком, по всем вашим станциям: что просрочено и что наступает в ближайшие {n} дней.",
    uk: "Кожен пункт переліку та крок приєднання зі строком, за всіма вашими станціями: що прострочено і що настає найближчими {n} днями.",
  },
  late_h: { en: "Late", ro: "Întârziate", ru: "Просрочено", uk: "Прострочено" },
  soon_h: { en: "Due in the next {n} days", ro: "Scadente în următoarele {n} zile", ru: "Срок в ближайшие {n} дней", uk: "Строк найближчими {n} днями" },
  none: {
    en: "Nothing is late and nothing is due in the next {n} days.",
    ro: "Nimic nu întârzie și nimic nu expiră în următoarele {n} zile.",
    ru: "Ничего не просрочено, и ничего не наступает в ближайшие {n} дней.",
    uk: "Нічого не прострочено, і нічого не настає найближчими {n} днями.",
  },
  no_plants: {
    en: "No plants yet. Add a plant to a portfolio to track its permits here.",
    ro: "Nicio centrală încă. Adaugă o centrală la un portofoliu ca să-i urmărești autorizațiile aici.",
    ru: "Станций пока нет. Добавьте станцию в портфель, чтобы отслеживать её разрешения здесь.",
    uk: "Станцій поки немає. Додайте станцію до портфеля, щоб відстежувати її дозволи тут.",
  },
  undated: {
    en: "{n} open items have no due date. Add one on the plant's checklist to see them here.",
    ro: "{n} elemente deschise nu au termen. Adaugă unul în lista centralei ca să le vezi aici.",
    ru: "У {n} открытых пунктов нет срока. Добавьте срок в перечне станции, чтобы видеть их здесь.",
    uk: "У {n} відкритих пунктів немає строку. Додайте строк у переліку станції, щоб бачити їх тут.",
  },
  undated_one: {
    en: "1 open item has no due date. Add one on the plant's checklist to see it here.",
    ro: "Un element deschis nu are termen. Adaugă unul în lista centralei ca să-l vezi aici.",
    ru: "У одного открытого пункта нет срока. Добавьте срок в перечне станции, чтобы видеть его здесь.",
    uk: "В одного відкритого пункту немає строку. Додайте строк у переліку станції, щоб бачити його тут.",
  },
  c_plant: { en: "Plant", ro: "Centrala", ru: "Станция", uk: "Станція" },
  c_item: { en: "Item", ro: "Element", ru: "Пункт", uk: "Пункт" },
  c_owner: { en: "Responsible", ro: "Responsabil", ru: "Ответственный", uk: "Відповідальний" },
  c_ref: { en: "Reference", ro: "Referință", ru: "Номер", uk: "Номер" },
  c_due: { en: "Due", ro: "Termen", ru: "Срок", uk: "Строк" },
  c_when: { en: "In", ro: "Rămas", ru: "Осталось", uk: "Лишилось" },
  d_late: { en: "{n} days late", ro: "{n} zile întârziere", ru: "просрочено на {n} дн.", uk: "прострочено на {n} дн." },
  d_late_one: { en: "1 day late", ro: "1 zi întârziere", ru: "просрочено на 1 день", uk: "прострочено на 1 день" },
  d_today: { en: "Today", ro: "Azi", ru: "Сегодня", uk: "Сьогодні" },
  d_in: { en: "in {n} days", ro: "peste {n} zile", ru: "через {n} дн.", uk: "через {n} дн." },
  d_in_one: { en: "tomorrow", ro: "mâine", ru: "завтра", uk: "завтра" },
  open: { en: "Open the checklist", ro: "Deschide lista", ru: "Открыть перечень", uk: "Відкрити перелік" },
  back: { en: "All portfolios", ro: "Toate portofoliile", ru: "Все портфели", uk: "Усі портфелі" },
  link: { en: "Permits and deadlines", ro: "Avize și termene", ru: "Разрешения и сроки", uk: "Дозволи та строки" },
  link_late: { en: "{n} late", ro: "întârziate: {n}", ru: "просрочено: {n}", uk: "прострочено: {n}" },
  needs_db: {
    en: "Portfolios need the database update first.",
    ro: "Portofoliile au nevoie mai întâi de actualizarea bazei de date.",
    ru: "Сначала портфелям нужно обновление базы данных.",
    uk: "Спершу портфелям потрібне оновлення бази даних.",
  },

  // ---- the weekly email
  em_subject: { en: "Permits and deadlines: {late} late, {soon} due soon", ro: "Avize și termene: întârziate {late}, scadente curând {soon}", ru: "Разрешения и сроки: просрочено {late}, скоро срок у {soon}", uk: "Дозволи та строки: прострочено {late}, незабаром строк у {soon}" },
  em_subject_late: { en: "Permits and deadlines: {late} late", ro: "Avize și termene: întârziate {late}", ru: "Разрешения и сроки: просрочено {late}", uk: "Дозволи та строки: прострочено {late}" },
  em_subject_soon: { en: "Permits and deadlines: {soon} due soon", ro: "Avize și termene: scadente curând {soon}", ru: "Разрешения и сроки: скоро срок у {soon}", uk: "Дозволи та строки: незабаром строк у {soon}" },
  em_kicker: { en: "Weekly summary", ro: "Rezumat săptămânal", ru: "Недельная сводка", uk: "Тижневий підсумок" },
  em_h1: { en: "What needs your attention this week", ro: "Ce cere atenția ta săptămâna asta", ru: "Что требует внимания на этой неделе", uk: "Що потребує уваги цього тижня" },
  em_more: { en: "and {n} more on the page.", ro: "și încă {n} pe pagină.", ru: "и ещё {n} на странице.", uk: "і ще {n} на сторінці." },
  em_cta: { en: "Open permits and deadlines", ro: "Deschide avize și termene", ru: "Открыть разрешения и сроки", uk: "Відкрити дозволи та строки" },
  em_foot: {
    en: "Sent on Mondays, only when something is late or due in the next {n} days. Turn it off in Settings, under Notifications.",
    ro: "Se trimite lunea, doar când ceva întârzie sau expiră în următoarele {n} zile. Îl oprești din Setări, la Notificări.",
    ru: "Приходит по понедельникам, только когда что-то просрочено или срок наступает в ближайшие {n} дней. Отключается в Настройках, в разделе «Уведомления».",
    uk: "Надходить щопонеділка, лише коли щось прострочено або строк настає найближчими {n} днями. Вимикається в Налаштуваннях, у розділі «Сповіщення».",
  },
  st_toggle: { en: "Email me a weekly summary of late permits and deadlines", ro: "Trimite-mi săptămânal un rezumat cu avizele și termenele care întârzie", ru: "Присылать раз в неделю сводку по просроченным разрешениям и срокам", uk: "Надсилати раз на тиждень підсумок щодо прострочених дозволів і строків" },
  st_note: { en: "Mondays, and only when something is late or due within 30 days.", ro: "Lunea, și doar când ceva întârzie sau expiră în 30 de zile.", ru: "По понедельникам и только когда что-то просрочено или срок в пределах 30 дней.", uk: "Щопонеділка і лише коли щось прострочено або строк у межах 30 днів." },
};

export const DLT = T;

export function dlt(key, lang = "en", vars = null) {
  const e = (vars && Number(vars.n) === 1 && T[key + "_one"]) || T[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v ?? ""));
  return s;
}

/** "3 days late", "today", "in 12 days". */
export function whenText(days, lang = "en") {
  if (days < 0) return dlt("d_late", lang, { n: -days });
  if (days === 0) return dlt("d_today", lang);
  return dlt("d_in", lang, { n: days });
}
