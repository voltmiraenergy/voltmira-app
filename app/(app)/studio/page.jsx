"use client";
// app/(app)/studio/page.jsx — the Studio landing, a Job Hub instead of a flat
// menu of unrelated tools. Every job gets a real, DERIVED pipeline stage (see
// jobs-data.js) — this page is the at-a-glance list an installer actually
// needs: which jobs need a survey, which are stuck on paperwork, which owe
// money, filterable by stage. The tools that aren't per-job (payments across
// jobs, fleet monitoring, the lender export, the widget) sit in a side panel,
// not mixed into the job list as if they were equals.
//
// Money is read from the same per-job pay record the Payments tool edits, so
// "collected" and "to collect" here always match what that screen says.
// Preview-only like the rest of Studio: all of it lives in this browser.
import "../dx.css";
import "./hub.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Cloud, CloudUpload, CloudOff, HardDrive } from "lucide-react";
import { PREVIEW_BASE } from "./features.js";
import {
  useLang, tx, EUR, FeatureIcon,
  useStudioJobs, STAGES, jobProgress, jobMoneySummary, newJobId,
} from "./studio-kit.jsx";
import { useStudioSync } from "./studio-sync.js";

const T = {
  title: { en: "Studio", ro: "Studio", ru: "Studio", uk: "Studio" },
  summary: {
    en: "{n} jobs from survey to monitoring. {owed} still to collect.",
    ro: "{n} lucrări, de la vizită la monitorizare. {owed} de încasat.",
    ru: "Объектов: {n}, от осмотра до мониторинга. К получению: {owed}.",
    uk: "Об’єктів: {n}, від огляду до моніторингу. До отримання: {owed}.",
  },
  summaryEmpty: {
    en: "Add a job to track it from the site survey to the first production reading.",
    ro: "Adaugă o lucrare ca s-o urmărești de la vizita tehnică la prima citire de producție.",
    ru: "Добавьте объект, чтобы вести его от осмотра до первых данных о выработке.",
    uk: "Додайте об’єкт, щоб вести його від огляду до перших даних про генерацію.",
  },
  // Where Studio's data lives right now (studio-sync.js).
  sync_cloud: {
    en: "Saved to your workspace, on every device you sign in on.",
    ro: "Salvat în spațiul tău de lucru, pe orice dispozitiv te conectezi.",
    ru: "Сохраняется в рабочем пространстве, на любом вашем устройстве.",
    uk: "Зберігається в робочому просторі, на будь-якому вашому пристрої.",
  },
  sync_saving: { en: "Saving to your workspace…", ro: "Se salvează…", ru: "Сохранение…", uk: "Збереження…" },
  sync_offline: {
    en: "Can't reach the server. Changes are kept here and will save when you're back online.",
    ro: "Serverul nu răspunde. Modificările sunt păstrate aici și se salvează când revii online.",
    ru: "Нет связи с сервером. Изменения сохранены здесь и отправятся, когда связь вернётся.",
    uk: "Немає зв’язку із сервером. Зміни збережено тут, і вони надішлються, коли зв’язок повернеться.",
  },
  sync_local: {
    en: "Saved in this browser only.",
    ro: "Salvat doar în acest browser.",
    ru: "Сохраняется только в этом браузере.",
    uk: "Зберігається лише в цьому браузері.",
  },
  flowTitle: { en: "Where every job stands", ro: "Unde se află fiecare lucrare", ru: "Где сейчас каждый объект", uk: "Де зараз кожен об’єкт" },
  flowSub: {
    en: "The stage comes from what you've done in each tool, never from a status set by hand. Tap a stage to filter.",
    ro: "Etapa vine din ce ai făcut în fiecare unealtă, nu dintr-un status setat manual. Atinge o etapă ca să filtrezi.",
    ru: "Этап вычисляется из сделанного в инструментах, а не задаётся вручную. Нажмите на этап для фильтра.",
    uk: "Етап обчислюється з того, що зроблено в інструментах, а не задається вручну. Натисніть на етап, щоб відфільтрувати.",
  },
  idle: { en: "none here", ro: "niciuna", ru: "пусто", uk: "порожньо" },
  jobsTitle: { en: "Jobs", ro: "Lucrări", ru: "Объекты", uk: "Об’єкти" },
  showAll: { en: "Show all", ro: "Arată toate", ru: "Показать все", uk: "Показати всі" },
  newJob: { en: "New job", ro: "Lucrare nouă", ru: "Новый объект", uk: "Новий об’єкт" },
  add: { en: "Add job", ro: "Adaugă lucrarea", ru: "Добавить объект", uk: "Додати об’єкт" },
  cancel: { en: "Cancel", ro: "Anulează", ru: "Отмена", uk: "Скасувати" },
  name: { en: "Client or company", ro: "Client sau firmă", ru: "Клиент или компания", uk: "Клієнт або компанія" },
  address: { en: "Address", ro: "Adresă", ru: "Адрес", uk: "Адреса" },
  kw: { en: "System size (kW)", ro: "Putere (kW)", ru: "Мощность (кВт)", uk: "Потужність (кВт)" },
  market: { en: "Market", ro: "Piață", ru: "Рынок", uk: "Ринок" },
  needName: { en: "Add the client's name first.", ro: "Adaugă mai întâi numele clientului.", ru: "Сначала укажите имя клиента.", uk: "Спершу вкажіть ім’я клієнта." },
  next: { en: "Next", ro: "Urmează", ru: "Далее", uk: "Далі" },
  allDone: {
    en: "Every step done. Keep logging production each month.",
    ro: "Toți pașii gata. Continuă să introduci producția lunar.",
    ru: "Все этапы пройдены. Вносите выработку каждый месяц.",
    uk: "Усі етапи пройдено. Вносьте генерацію щомісяця.",
  },
  battery: { en: "{n} kWh battery", ro: "baterie {n} kWh", ru: "батарея {n} кВт·ч", uk: "батарея {n} кВт·год" },
  depDue: { en: "Deposit due", ro: "Avans de încasat", ru: "Ждём аванс", uk: "Чекаємо аванс" },
  balDue: { en: "Balance due", ro: "Rest de încasat", ru: "Ждём остаток", uk: "Чекаємо залишок" },
  paid: { en: "Paid in full", ro: "Achitat integral", ru: "Оплачено полностью", uk: "Оплачено повністю" },
  of: { en: "of {total}", ro: "din {total}", ru: "из {total}", uk: "з {total}" },
  empty: { en: "No jobs at this stage.", ro: "Nicio lucrare în această etapă.", ru: "На этом этапе объектов нет.", uk: "На цьому етапі об’єктів немає." },
  emptyAll: { en: "No jobs yet", ro: "Încă nicio lucrare", ru: "Пока нет объектов", uk: "Поки немає об’єктів" },
  moneyTitle: { en: "Money on these jobs", ro: "Banii din aceste lucrări", ru: "Деньги по объектам", uk: "Гроші за об’єктами" },
  contract: { en: "Contract value", ro: "Valoare contracte", ru: "Сумма договоров", uk: "Сума договорів" },
  collected: { en: "Collected", ro: "Încasat", ru: "Получено", uk: "Отримано" },
  toCollect: { en: "To collect", ro: "De încasat", ru: "К получению", uk: "До отримання" },
  moneyLink: { en: "Open payments", ro: "Deschide încasările", ru: "Открыть оплаты", uk: "Відкрити оплати" },
  toolsTitle: { en: "Tools", ro: "Unelte", ru: "Инструменты", uk: "Інструменти" },
  toolsSub: {
    en: "Not tied to a single job.",
    ro: "Nu sunt legate de o singură lucrare.",
    ru: "Не привязаны к одному объекту.",
    uk: "Не прив’язані до одного об’єкта.",
  },
};
const TOOLS = [
  { slug: "payments", name: { en: "Payments", ro: "Încasări", ru: "Оплаты", uk: "Оплати" },
    desc: { en: "Deposits, balances and invoices for every job", ro: "Avansuri, resturi și facturi pentru fiecare lucrare", ru: "Авансы, остатки и счета по всем объектам", uk: "Аванси, залишки й рахунки за всіма об’єктами" } },
  { slug: "monitoring", name: { en: "Fleet monitoring", ro: "Monitorizarea parcului", ru: "Мониторинг систем", uk: "Моніторинг систем" },
    desc: { en: "Every handed-over system against its promised P50", ro: "Fiecare sistem predat față de P50-ul promis", ru: "Каждая система против обещанного P50", uk: "Кожна система проти обіцяного P50" } },
  { slug: "bankability", name: { en: "P50 / P90 export", ro: "Export P50 / P90", ru: "Экспорт P50 / P90", uk: "Експорт P50 / P90" },
    desc: { en: "The yield assessment a lender asks for", ro: "Evaluarea producției cerută de un finanțator", ru: "Оценка выработки для кредитора", uk: "Оцінка генерації для кредитора" } },
  { slug: "lead-widget", name: { en: "Calculator widget", ro: "Widget calculator", ru: "Виджет-калькулятор", uk: "Віджет-калькулятор" },
    desc: { en: "The public estimate that fills your Leads", ro: "Estimarea publică ce îți umple lead-urile", ru: "Публичный расчёт, который приносит заявки", uk: "Публічний розрахунок, який приносить заявки" } },
];

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
const kEUR = (n) => (n >= 1000 ? "€" + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : EUR(n));
function initials(s) {
  const p = String(s || "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || p[0]?.[1] || "")).toUpperCase() || "—";
}

export default function StudioOverview() {
  const lang = useLang();
  const t = (o, vars) => (vars ? fill(tx(o, lang), vars) : tx(o, lang));
  const { jobs, addJob, hydrated } = useStudioJobs();
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", address: "", kw: "5", market: "MD" });
  const nameRef = useRef(null);
  const sync = useStudioSync();
  useEffect(() => { document.title = "Studio | VoltMira"; }, []);
  useEffect(() => { if (adding) setTimeout(() => nameRef.current?.focus(), 30); }, [adding]);

  // Memoized on [jobs] only: stage/money read localStorage keys the other
  // tools write directly (schedule/install/actuals), but the only way THOSE
  // change is by visiting another tool page and back, which unmounts and
  // remounts this component — so a fresh mount always recomputes regardless
  // of this dependency array. Keying on [jobs] just stops every keystroke in
  // the "New job" form from re-running the real engine's simulate() for
  // every existing job (the actual cause of the "really slow" complaint).
  const rows = useMemo(
    () => jobs.map((job) => {
      const money = jobMoneySummary(job);
      const collected = money.done ? money.eur : money.depPaid ? money.dep : 0;
      return { job, progress: jobProgress(job), money, collected };
    }),
    [jobs]
  );

  const stages = useMemo(() => STAGES.map((s) => {
    const r = rows.filter((x) => x.progress.key === s.key);
    return { ...s, n: r.length, eur: r.reduce((sum, x) => sum + x.money.eur, 0) };
  }), [rows]);

  const totals = useMemo(() => {
    const contract = rows.reduce((s, r) => s + r.money.eur, 0);
    const collected = rows.reduce((s, r) => s + r.collected, 0);
    return { contract, collected, owed: contract - collected };
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.progress.key === filter);

  function submitNewJob(e) {
    e?.preventDefault();
    if (!form.name.trim()) { setErr(t(T.needName)); nameRef.current?.focus(); return; }
    addJob({
      id: newJobId(), name: form.name.trim(), address: form.address.trim(), contractNo: "", ref: "",
      market: form.market, kw: +form.kw || 5, cons: (+form.kw || 5) * 900, price: form.market === "MD" ? 0.185 : 0.21,
      batteryKwh: 0, phases: 1,
    });
    setForm({ name: "", address: "", kw: "5", market: "MD" });
    setErr("");
    setAdding(false);
    setFilter("all");
  }

  if (!hydrated) return null;   // avoid a flash of pre-hydration default state

  const paidPct = totals.contract ? Math.round((totals.collected / totals.contract) * 100) : 0;

  return (
    <div className="dx sx">
      <header className="dx-head">
        <div className="dx-hello">
          <h1>{t(T.title)}</h1>
          <p className="dx-summary">
            {rows.length ? t(T.summary, { n: rows.length, owed: EUR(totals.owed) }) : t(T.summaryEmpty)}
          </p>
          <p className={"sx-preview s-" + sync} role="status">
            {sync === "saving" ? <CloudUpload size={15} aria-hidden="true" />
              : sync === "offline" ? <CloudOff size={15} aria-hidden="true" />
              : sync === "local" ? <HardDrive size={15} aria-hidden="true" />
              : <Cloud size={15} aria-hidden="true" />}
            {t(T["sync_" + (sync === "loading" ? "cloud" : sync)] || T.sync_local)}
          </p>
        </div>
        <div className="dx-head-tools">
          <button type="button" className="dx-new" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            {t(T.newJob)}
          </button>
        </div>
      </header>

      {adding && (
        <form className="dx-card sx-new" onSubmit={submitNewJob}>
          <div className="sx-new-grid">
            <label className="wide">{t(T.name)}
              <input id="sx-new-name" ref={nameRef} value={form.name} aria-invalid={!!err}
                onChange={(e) => { setErr(""); setForm((f) => ({ ...f, name: e.target.value })); }} />
            </label>
            <label className="wide">{t(T.address)}
              <input id="sx-new-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </label>
            <label>{t(T.kw)}
              <input id="sx-new-kw" type="number" min="1" step="0.5" value={form.kw} onChange={(e) => setForm((f) => ({ ...f, kw: e.target.value }))} />
            </label>
            <div className="sx-new-market" role="group" aria-label={t(T.market)}>
              <span>{t(T.market)}</span>
              <div className="sx-seg">
                {["MD", "UA", "RO"].map((m) => (
                  <button key={m} type="button" className={form.market === m ? "on" : ""} aria-pressed={form.market === m}
                    onClick={() => setForm((f) => ({ ...f, market: m }))}>{m}</button>
                ))}
              </div>
            </div>
          </div>
          {err && <p className="sx-err" role="alert">{err}</p>}
          <footer className="sx-new-foot">
            <button type="button" className="dx-btn" onClick={() => { setAdding(false); setErr(""); }}>{t(T.cancel)}</button>
            <button type="submit" className="dx-btn primary">{t(T.add)}</button>
          </footer>
        </form>
      )}

      {/* ---------------- stage line: the filter and the summary in one ---------------- */}
      <section className="dx-card sx-flow" aria-labelledby="sx-flow-h">
        <div className="sx-flow-head">
          <h2 id="sx-flow-h">{t(T.flowTitle)}</h2>
          <p>{t(T.flowSub)}</p>
        </div>
        <ol className="sx-flow-line">
          {stages.map((s, i) => (
            <li key={s.key} className={"sx-stage c-" + s.chip + (s.n ? "" : " zero") + (filter === s.key ? " on" : "")}>
              <button type="button" aria-pressed={filter === s.key} onClick={() => setFilter(filter === s.key ? "all" : s.key)}>
                <span className="sx-stage-lbl"><i className="sx-stage-n-i">{i + 1}</i>{s.label[lang] || s.label.en}</span>
                <b>{s.n}</b>
                <span className="sx-stage-eur">{s.n ? kEUR(s.eur) : t(T.idle)}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="dx-grid dx-grid-main sx-main">
        {/* ---------------- jobs ---------------- */}
        <section className="sx-jobs" aria-labelledby="sx-jobs-h">
          <header className="sx-jobs-head">
            <h2 id="sx-jobs-h">
              {filter === "all" ? t(T.jobsTitle) : (STAGES.find((s) => s.key === filter)?.label[lang] || "")}
              <span className="dx-count">{visible.length}</span>
            </h2>
            {filter !== "all" && <button type="button" className="dx-link" onClick={() => setFilter("all")}>{t(T.showAll)}</button>}
          </header>

          {visible.length ? (
            <div className="sx-job-grid">
              {visible.map(({ job, progress, money }) => {
                const due = money.done ? null : money.depPaid ? { k: "bal", amt: money.bal } : { k: "dep", amt: money.dep };
                const depW = money.eur ? (money.dep / money.eur) * 100 : 30;
                return (
                  <Link key={job.id} href={`${PREVIEW_BASE}/jobs/${job.id}`} className={"sx-job c-" + progress.meta.chip}>
                    <div className="sx-job-top">
                      <span className="sx-avatar" aria-hidden="true">{initials(job.name)}</span>
                      <span className="sx-job-id">
                        <b>{job.name || "—"}</b>
                        <small>{String(job.address || "").split(",").slice(0, 2).join(",").trim() || "—"}</small>
                      </span>
                      <span className={"pv-stage " + progress.meta.chip}>{progress.meta.label[lang] || progress.meta.label.en}</span>
                    </div>

                    <div className="sx-specs">
                      <span>{(+job.kw || 0).toFixed(1)} kW</span>
                      <span>{job.market}</span>
                      {+job.batteryKwh > 0 && <span>{t(T.battery, { n: +job.batteryKwh })}</span>}
                    </div>

                    <ol className="sx-steps" aria-label={progress.meta.label[lang] || progress.meta.label.en}>
                      {STAGES.map((s, i) => (
                        <li key={s.key} className={i < progress.index ? "done" : i === progress.index ? "now" : ""}>
                          <span className="sr">{s.label[lang] || s.label.en}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="sx-next">
                      {progress.key === "monitoring"
                        ? t(T.allDone)
                        : <><b>{t(T.next)}:</b> {progress.meta.todo[lang] || progress.meta.todo.en}</>}
                    </p>

                    <div className="sx-money">
                      <span className="sx-pay" aria-hidden="true">
                        <i className={"dep" + (money.depPaid || money.done ? " paid" : "")} style={{ width: depW + "%" }} />
                        <i className={"bal" + (money.done ? " paid" : "")} style={{ width: 100 - depW + "%" }} />
                      </span>
                      <span className="sx-money-tx">
                        {due
                          ? <><b className="owed">{t(due.k === "dep" ? T.depDue : T.balDue)} {EUR(due.amt)}</b> <small>{t(T.of, { total: EUR(money.eur) })}</small></>
                          : <b className="ok">{t(T.paid)} {EUR(money.eur)}</b>}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="dx-card">
              <div className="dx-empty">
                <b>{rows.length ? t(T.empty) : t(T.emptyAll)}</b>
                {!rows.length && <span>{t(T.summaryEmpty)}</span>}
                {rows.length
                  ? <button type="button" className="dx-btn" onClick={() => setFilter("all")}>{t(T.showAll)}</button>
                  : <button type="button" className="dx-btn primary" onClick={() => setAdding(true)}>{t(T.newJob)}</button>}
              </div>
            </div>
          )}
        </section>

        <div className="dx-stack">
          {/* ---------------- money ---------------- */}
          <section className="dx-card sx-cash" aria-labelledby="sx-cash-h">
            <header className="dx-card-head">
              <div><h2 id="sx-cash-h">{t(T.moneyTitle)}</h2></div>
              <Link className="dx-link" href={`${PREVIEW_BASE}/payments`}>{t(T.moneyLink)}</Link>
            </header>
            <div className="sx-cash-big">
              <b>{EUR(totals.owed)}</b>
              <span>{t(T.toCollect)}</span>
            </div>
            <span className="sx-cash-bar" aria-hidden="true"><i style={{ width: paidPct + "%" }} /></span>
            <dl className="sx-cash-rows">
              <div><dt>{t(T.contract)}</dt><dd>{EUR(totals.contract)}</dd></div>
              <div><dt><i className="ok" aria-hidden="true" />{t(T.collected)}</dt><dd>{EUR(totals.collected)} <small>{paidPct}%</small></dd></div>
              <div><dt><i className="owed" aria-hidden="true" />{t(T.toCollect)}</dt><dd>{EUR(totals.owed)}</dd></div>
            </dl>
          </section>

          {/* ---------------- tools ---------------- */}
          <section className="dx-card sx-tools" aria-labelledby="sx-tools-h">
            <header className="dx-card-head">
              <div><h2 id="sx-tools-h">{t(T.toolsTitle)}</h2><p>{t(T.toolsSub)}</p></div>
            </header>
            <ul>
              {TOOLS.map((tool) => (
                <li key={tool.slug}>
                  <Link href={`${PREVIEW_BASE}/${tool.slug}`}>
                    <span className="sx-tool-ic"><FeatureIcon slug={tool.slug} size={16} /></span>
                    <span className="sx-tool-tx"><b>{t(tool.name)}</b><small>{t(tool.desc)}</small></span>
                    <svg className="sx-tool-go" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
