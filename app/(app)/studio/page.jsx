"use client";
// app/(app)/studio/page.jsx — the Studio landing, now a Job Hub instead of a
// flat menu of 7 unrelated tools. Every job gets a real, DERIVED pipeline
// stage (see jobs-data.js) — this page is the at-a-glance list an installer
// actually needs: which jobs need a survey, which are stuck on paperwork,
// which owe money, sorted/filterable by stage. Bankability + the lead widget
// aren't per-job, so they sit in a small "Tools" row below, not mixed into
// the job list as if they were equals.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PREVIEW_BASE } from "./features.js";
import {
  useLang, tx, EUR, FeatureIcon, PreviewBadge,
  useStudioJobs, STAGES, jobProgress, jobMoneySummary, newJobId,
} from "./studio-kit.jsx";

const T = {
  sub: {
    en: "Every job's real progress in one list — who needs a survey, whose paperwork is stuck, who's scheduled, who owes money. Stage is derived from what you've actually done in each tool, not a status you set by hand.",
    ro: "Progresul real al fiecărei lucrări, într-o listă — cui îi trebuie vizită, cui i s-a blocat dosarul, cine e programat, cine are bani neîncasați. Etapa se calculează din ce ai făcut deja în fiecare unealtă, nu e un status setat manual.",
    ru: "Реальный прогресс каждого объекта в одном списке — кому нужен осмотр, у кого застряли документы, кто в графике, за кем долг. Этап вычисляется из того, что уже сделано в каждом инструменте, а не задаётся вручную.",
  },
  all: { en: "All", ro: "Toate", ru: "Все" },
  newJob: { en: "+ New job", ro: "+ Lucrare nouă", ru: "+ Новый объект" },
  add: { en: "Add job", ro: "Adaugă lucrarea", ru: "Добавить объект" },
  cancel: { en: "Cancel", ro: "Anulează", ru: "Отмена" },
  name: { en: "Client / company", ro: "Client / firmă", ru: "Клиент / компания" },
  address: { en: "Address", ro: "Adresă", ru: "Адрес" },
  kw: { en: "System size (kW)", ro: "Putere (kW)", ru: "Мощность (кВт)" },
  needSurvey: { en: "need a survey", ro: "au nevoie de vizită", ru: "нужен осмотр" },
  stuckPaperwork: { en: "stuck on paperwork", ro: "blocate la documentație", ru: "застряли на документах" },
  totalOwed: { en: "owed across all jobs", ro: "de încasat, în total", ru: "к получению, всего" },
  active: { en: "active jobs", ro: "lucrări active", ru: "активных объектов" },
  empty: { en: "No jobs yet.", ro: "Încă nicio lucrare.", ru: "Пока нет объектов." },
  paidFull: { en: "paid in full", ro: "achitat integral", ru: "оплачено полностью" },
  owed: { en: "owed", ro: "de încasat", ru: "к получению" },
  toolsTitle: { en: "Tools", ro: "Unelte", ru: "Инструменты" },
  toolsSub: {
    en: "Not tied to one job — monitoring for every system you've handed over, a lender export and the public widget's control panel.",
    ro: "Nu sunt legate de o lucrare — monitorizarea tuturor sistemelor predate, un export pentru finanțator și panoul widgetului public.",
    ru: "Не привязаны к одному объекту — мониторинг всех сданных систем, экспорт для кредитора и панель публичного виджета.",
  },
};

export default function StudioOverview() {
  const lang = useLang();
  const t = (o) => tx(o, lang);
  const { jobs, addJob, hydrated } = useStudioJobs();
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", kw: "5", market: "MD" });
  useEffect(() => { document.title = "Studio — VoltMira"; }, []);

  // Memoized on [jobs] only: stage/money read localStorage keys the other
  // tools write directly (schedule/install/actuals), but the only way THOSE
  // change is by visiting another tool page and back, which unmounts and
  // remounts this component — so a fresh mount always recomputes regardless
  // of this dependency array. Keying on [jobs] just stops every keystroke in
  // the "+ New job" form from re-running the real engine's simulate() for
  // every existing job (the actual cause of the "really slow" complaint).
  const rows = useMemo(
    () => jobs.map((job) => ({ job, progress: jobProgress(job), money: jobMoneySummary(job) })),
    [jobs]
  );

  const counts = useMemo(() => {
    const c = { all: rows.length };
    for (const s of STAGES) c[s.key] = rows.filter((r) => r.progress.key === s.key).length;
    return c;
  }, [rows]);

  const totalOwed = useMemo(
    () => rows.reduce((sum, r) => sum + (r.money.done ? 0 : (r.money.depPaid ? r.money.bal : r.money.dep)), 0),
    [rows]
  );

  const visible = filter === "all" ? rows : rows.filter((r) => r.progress.key === filter);

  function submitNewJob() {
    if (!form.name.trim()) return;
    addJob({
      id: newJobId(), name: form.name.trim(), address: form.address.trim(), contractNo: "", ref: "",
      market: form.market, kw: +form.kw || 5, cons: (+form.kw || 5) * 900, price: form.market === "MD" ? 0.185 : 0.21,
      batteryKwh: 0, phases: 1,
    });
    setForm({ name: "", address: "", kw: "5", market: "MD" });
    setAdding(false);
  }

  if (!hydrated) return null;   // avoid a flash of pre-hydration default state

  return (
    <>
      <div className="pv-head">
        <div className="pv-head-ic"><FeatureIcon slug="overview" size={20} /></div>
        <div className="pv-head-tx">
          <div className="pv-head-t">
            <h1>Studio</h1>
            <PreviewBadge lang={lang} />
          </div>
          <p>{t(T.sub)}</p>
        </div>
      </div>

      <div className="pv-metrics" style={{ marginBottom: 18 }}>
        <div className={"pv-metric" + (counts.survey ? " warn" : "")}><b>{counts.survey || 0}</b><span>{t(T.needSurvey)}</span></div>
        <div className={"pv-metric" + (counts.paperwork ? " warn" : "")}><b>{counts.paperwork || 0}</b><span>{t(T.stuckPaperwork)}</span></div>
        <div className={"pv-metric" + (totalOwed > 0 ? " warn" : " good")}><b>{EUR(totalOwed)}</b><span>{t(T.totalOwed)}</span></div>
        <div className="pv-metric"><b>{counts.all}</b><span>{t(T.active)}</span></div>
      </div>

      <div className="pv-fchips" style={{ marginBottom: 14 }}>
        <button className={"pv-fchip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
          {t(T.all)} · {counts.all}
        </button>
        {STAGES.map((s) => (
          <button key={s.key} className={"pv-fchip" + (filter === s.key ? " on" : "")} onClick={() => setFilter(s.key)}>
            {(s.label[lang] || s.label.en)} · {counts[s.key] || 0}
          </button>
        ))}
      </div>

      <div className="jb-list">
        {visible.map(({ job, progress, money }) => (
          <Link key={job.id} href={`${PREVIEW_BASE}/jobs/${job.id}`} className="jb-card">
            <span className={"pv-stage " + progress.meta.chip}>{progress.meta.label[lang] || progress.meta.label.en}</span>
            <span className="jb-card-tx">
              <b>{job.name || "—"}</b>
              <span>{[String(job.address || "").split(",")[0].trim(), `${(+job.kw || 0).toFixed(1)} kW`, job.market].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="jb-card-right">
              <span className={"jb-money " + (money.done ? "ok" : "owed")}>
                {money.done ? t(T.paidFull) : `${EUR(money.depPaid ? money.bal : money.dep)} ${t(T.owed)}`}
              </span>
            </span>
          </Link>
        ))}
        {visible.length === 0 && <div className="jb-empty">{t(T.empty)}</div>}
      </div>

      <div className="jb-new">
        {adding ? (
          <div className="pv-panel" style={{ width: "100%" }}>
            <div className="cl-grid">
              <label>{t(T.name)}<input className="pv-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
              <label style={{ gridColumn: "1 / -1" }}>{t(T.address)}<input className="pv-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></label>
              <label>{t(T.kw)}<input className="pv-input" type="number" min="1" value={form.kw} onChange={(e) => setForm((f) => ({ ...f, kw: e.target.value }))} /></label>
              <label>{tx({ en: "Market", ro: "Piață", ru: "Рынок" }, lang)}
                <div className="pv-seg">
                  <button className={form.market === "MD" ? "on" : ""} onClick={() => setForm((f) => ({ ...f, market: "MD" }))}>MD</button>
                  <button className={form.market === "RO" ? "on" : ""} onClick={() => setForm((f) => ({ ...f, market: "RO" }))}>RO</button>
                </div></label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn ghost sm" onClick={() => setAdding(false)}>{t(T.cancel)}</button>
              <button className="btn primary sm" onClick={submitNewJob}>{t(T.add)}</button>
            </div>
          </div>
        ) : (
          <button className="btn ghost sm" onClick={() => setAdding(true)}>{t(T.newJob)}</button>
        )}
      </div>

      <div className="pv-panel" style={{ marginTop: 26 }}>
        <h3>{t(T.toolsTitle)}</h3>
        <p style={{ margin: "-4px 0 14px", fontSize: 12.5, color: "var(--muted)" }}>{t(T.toolsSub)}</p>
        <div className="jb-tools">
          <Link href={`${PREVIEW_BASE}/monitoring`} className="jb-tool">
            <span className="jb-tool-ic"><FeatureIcon slug="monitoring" size={16} /></span>
            <b>{tx({ en: "Fleet monitoring", ro: "Monitorizarea parcului", ru: "Мониторинг систем" }, lang)}</b>
          </Link>
          <Link href={`${PREVIEW_BASE}/bankability`} className="jb-tool">
            <span className="jb-tool-ic"><FeatureIcon slug="bankability" size={16} /></span>
            <b>{tx({ en: "P50 / P90 export", ro: "Export P50 / P90", ru: "Экспорт P50 / P90" }, lang)}</b>
          </Link>
          <Link href={`${PREVIEW_BASE}/lead-widget`} className="jb-tool">
            <span className="jb-tool-ic"><FeatureIcon slug="lead-widget" size={16} /></span>
            <b>{tx({ en: "Public calculator widget", ro: "Widget calculator public", ru: "Публичный калькулятор" }, lang)}</b>
          </Link>
        </div>
      </div>
    </>
  );
}
