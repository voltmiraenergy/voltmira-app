"use client";
// app/(app)/studio/jobs/[id]/page.jsx — the per-job hub: one page that shows
// where a job actually stands (the derived stage tracker), what's still
// outstanding (each row links straight into the tool that fixes it), the
// money position, and quick links into every operational tool — instead of
// installers having to remember which of 7 separate menu items to check.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PREVIEW_BASE } from "../../features.js";
import {
  useLang, tx, EUR, FeatureIcon, ClientBar,
  useStudioJobs, STAGES, jobProgress, jobMoneySummary, readJSON, writeJSON,
} from "../../studio-kit.jsx";

const T = {
  back: { en: "All jobs", ro: "Toate lucrările", ru: "Все объекты" },
  outstanding: { en: "Outstanding", ro: "De rezolvat", ru: "Осталось сделать" },
  allDone: { en: "Everything's done for this job's current stage.", ro: "Totul e făcut pentru etapa curentă a lucrării.", ru: "Всё сделано для текущего этапа этого объекта." },
  money: { en: "Money", ro: "Bani", ru: "Деньги" },
  deposit: { en: "Deposit", ro: "Avans", ru: "Аванс" },
  balance: { en: "Balance", ro: "Rest", ru: "Остаток" },
  paidFull: { en: "Paid in full", ro: "Achitat integral", ru: "Оплачено полностью" },
  paid: { en: "paid", ro: "plătit", ru: "оплачено" },
  notPaid: { en: "not paid yet", ro: "neîncasat încă", ru: "пока не оплачено" },
  managePayments: { en: "Manage in Payments →", ro: "Gestionează în Încasări →", ru: "Управлять в Оплатах →" },
  tools: { en: "Tools for this job", ro: "Unelte pentru această lucrare", ru: "Инструменты для этого объекта" },
  notes: { en: "Notes", ro: "Notițe", ru: "Заметки" },
  notesPh: { en: "Anything worth remembering about this job…", ro: "Ceva de reținut despre această lucrare…", ru: "Что-то важное об этом объекте…" },
  survey: { en: "Site survey", ro: "Vizită tehnică", ru: "Техобследование" },
  annex: { en: "Technical annex", ro: "Anexă tehnică", ru: "Техническое приложение" },
  payments: { en: "Payments", ro: "Încasări", ru: "Оплаты" },
  schedule: { en: "Install schedule", ro: "Planificare montaj", ru: "График монтажа" },
  monitoring: { en: "Monitoring", ro: "Monitorizare", ru: "Мониторинг" },
  bankability: { en: "Lender export", ro: "Export finanțator", ru: "Экспорт для кредитора" },
  notFound: { en: "Job not found.", ro: "Lucrarea nu a fost găsită.", ru: "Объект не найден." },
  openWorkspace: { en: "Open configuration workspace", ro: "Deschide spațiul de configurare", ru: "Открыть рабочее пространство" },
};

export default function JobHub() {
  const lang = useLang();
  const t = (o) => tx(o, lang);
  const params = useParams();
  const { jobs, activeId, selectJob, hydrated } = useStudioJobs();
  const job = jobs.find((j) => j.id === params.id);

  useEffect(() => { document.title = job ? `${job.name} — VoltMira Studio` : "Studio"; }, [job]);
  useEffect(() => {
    if (job && activeId !== job.id) selectJob(job.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (job) setNotes(readJSON("voltmira_studio_notes_" + job.id, ""));
  }, [job?.id]);
  const saveNotes = (v) => { setNotes(v); if (job) writeJSON("voltmira_studio_notes_" + job.id, v); };

  // Memoized on [job]: the only way schedule/monitoring/payments state
  // changes is by navigating to that tool and back, which remounts this
  // page — so a fresh mount always recomputes regardless of this array.
  const progress = useMemo(() => (job ? jobProgress(job) : null), [job]);
  const money = useMemo(() => (job ? jobMoneySummary(job) : null), [job]);

  if (!hydrated) return null;   // avoid a flash of pre-hydration default state
  if (!job) {
    return (
      <div className="pv-panel" style={{ textAlign: "center", padding: 40 }}>
        <p style={{ margin: "0 0 14px", color: "var(--muted)" }}>{t(T.notFound)}</p>
        <Link href={PREVIEW_BASE} className="btn ghost sm">{t(T.back)}</Link>
      </div>
    );
  }

  const stepState = (i) => (i < progress.index ? "done" : i === progress.index ? "current" : "");

  return (
    <>
      <Link href={PREVIEW_BASE} className="pv-back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        {t(T.back)}
      </Link>

      <div className="pv-head" style={{ marginTop: 10 }}>
        <div className="pv-head-ic"><FeatureIcon slug="overview" size={20} /></div>
        <div className="pv-head-tx">
          <div className="pv-head-t">
            <h1>{job.name}</h1>
            <span className={"pv-stage " + progress.meta.chip}>{progress.meta.label[lang] || progress.meta.label.en}</span>
          </div>
          <p>{[job.address, `${(+job.kw || 0).toFixed(1)} kW`, job.market, +job.batteryKwh > 0 ? `${job.batteryKwh} kWh` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="pv-head-right">
          <Link href={`${PREVIEW_BASE}/jobs/${job.id}/configure`} className="btn primary sm">{t(T.openWorkspace)}</Link>
        </div>
      </div>

      <div className="jb-tracker pv-noprint">
        {STAGES.map((s, i) => (
          <div key={s.key} className={"jb-step " + stepState(i)}>
            <span className="jb-step-dot">
              {i < progress.index ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              ) : (i + 1)}
            </span>
            <span className="jb-step-lbl">{s.label[lang] || s.label.en}</span>
          </div>
        ))}
      </div>

      <ClientBar lang={lang} />

      <div className="pv-panel">
        <h3>{t(T.outstanding)}</h3>
        <div className="jb-todos">
          {STAGES.map((s, i) => {
            const done = i < progress.index;
            return (
              <Link key={s.key} href={`${PREVIEW_BASE}/jobs/${job.id}/configure?step=${s.step}`} className={"jb-todo" + (done ? " done" : "")}>
                <span className="jb-todo-ic">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </span>
                <span className="jb-todo-tx">{done ? (s.label[lang] || s.label.en) : (s.todo[lang] || s.todo.en)}</span>
                <svg className="jb-todo-go" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pv-panel">
        <h3>{t(T.money)}</h3>
        <div className="pv-metrics">
          <div className={"pv-metric" + (money.depPaid || money.done ? " good" : " warn")}>
            <b>{EUR(money.dep)}</b><span>{t(T.deposit)} · {money.depPaid || money.done ? t(T.paid) : t(T.notPaid)}</span>
          </div>
          <div className={"pv-metric" + (money.done ? " good" : "")}>
            <b>{money.done ? EUR(0) : EUR(money.bal)}</b><span>{t(T.balance)} · {money.done ? t(T.paidFull) : (money.depPaid ? t(T.notPaid) : "—")}</span>
          </div>
        </div>
        <p style={{ margin: "12px 0 0" }}><Link href={`${PREVIEW_BASE}/payments`} className="btn ghost sm">{t(T.managePayments)}</Link></p>
      </div>

      <div className="pv-panel">
        <h3>{t(T.tools)}</h3>
        <div className="jb-tools">
          <Link href={`${PREVIEW_BASE}/payments`} className="jb-tool"><span className="jb-tool-ic"><FeatureIcon slug="payments" size={16} /></span><b>{t(T.payments)}</b></Link>
          <Link href={`${PREVIEW_BASE}/monitoring?job=${job.id}`} className="jb-tool"><span className="jb-tool-ic"><FeatureIcon slug="monitoring" size={16} /></span><b>{t(T.monitoring)}</b></Link>
          <Link href={`${PREVIEW_BASE}/bankability`} className="jb-tool"><span className="jb-tool-ic"><FeatureIcon slug="bankability" size={16} /></span><b>{t(T.bankability)}</b></Link>
        </div>
      </div>

      <div className="pv-panel">
        <h3>{t(T.notes)}</h3>
        <textarea className="pv-input" rows={3} style={{ resize: "vertical", fontFamily: "inherit" }}
          placeholder={t(T.notesPh)} value={notes} onChange={(e) => saveNotes(e.target.value)} />
      </div>
    </>
  );
}
