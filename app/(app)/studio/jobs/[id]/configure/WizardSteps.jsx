"use client";
// WizardSteps.jsx — the job's seven steps. JobJourney draws them as one line
// (node, label, the step's own figure, a short status), read the same way as
// the dashboard's lead-to-live line; clicking a stage opens it below. Steps
// can be visited in any order: this is a job's workspace, not a checkout.
// Each step writes straight to the real job via `patch`, no separate save.
import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  MapPin, Zap, Euro as EuroIcon, FileText, Check, ChevronRight, Plug, HardHat, Activity, FileCheck2, ClipboardCheck, LineChart,
} from "lucide-react";
import { tx, jobStageContext, isStepDone, readJSON, installKey, actualsKey, systemFor } from "../../../studio-kit.jsx";
import { p50Row } from "../../../fleet-data.js";
import SiteRoofStep from "./SiteRoofStep.jsx";
import EquipmentStep from "./EquipmentStep.jsx";
import FinancialsStep from "./FinancialsStep.jsx";
import GridConnectionStep from "./GridConnectionStep.jsx";
import InstallationStep from "./InstallationStep.jsx";
import MonitoringStep from "./MonitoringStep.jsx";

export const STEPS = [
  { key: 0, icon: MapPin, label: { en: "Site & roof", ro: "Amplasament", ru: "Участок и крыша" },
    desc: { en: "Where the system goes and how the roof faces the sun. Pitch, orientation and shading set this job's yield.", ro: "Unde se montează sistemul și cum e orientat acoperișul. Înclinarea, orientarea și umbrirea stabilesc producția lucrării.", ru: "Где стоит система и как крыша смотрит на солнце. Уклон, ориентация и затенение задают выработку объекта." } },
  { key: 1, icon: Zap, label: { en: "Equipment", ro: "Echipament", ru: "Оборудование" },
    desc: { en: "Panels, inverter and battery from your supplier catalog. Tick two or more in a list to compare them side by side.", ro: "Panouri, invertor și baterie din catalogul furnizorilor. Bifează două sau mai multe dintr-o listă ca să le compari.", ru: "Панели, инвертор и батарея из каталога поставщиков. Отметьте два или больше в списке, чтобы сравнить их." } },
  { key: 2, icon: EuroIcon, label: { en: "Financials", ro: "Financiar", ru: "Финансы" },
    desc: { en: "How the client pays, and what the system does for their cash over 25 years.", ro: "Cum plătește clientul și ce face sistemul pentru banii lui în 25 de ani.", ru: "Как платит клиент и что система даёт его деньгам за 25 лет." } },
  { key: 3, icon: Plug, label: { en: "Grid connection", ro: "Racordare", ru: "Подключение" },
    desc: { en: "The technical annex for the grid operator, built from this job's equipment, ready to print and file.", ro: "Anexa tehnică pentru operatorul de rețea, construită din echipamentul lucrării, gata de printat și depus.", ru: "Техническое приложение для оператора сети из оборудования объекта, готово к печати и подаче." } },
  { key: 4, icon: HardHat, label: { en: "Installation", ro: "Montaj", ru: "Монтаж" },
    desc: { en: "Put the job in the week, check materials, run the site checklist and get the handover signed.", ro: "Programează lucrarea, verifică materialele, parcurge lista de pe teren și obține semnătura la predare.", ru: "Поставьте объект в неделю, проверьте материалы, пройдите чек-лист и получите подпись при сдаче." } },
  { key: 5, icon: Activity, label: { en: "Monitoring", ro: "Monitorizare", ru: "Мониторинг" },
    desc: { en: "Monthly production against what the quote promised, warranties and service tickets.", ro: "Producția lunară față de ce a promis oferta, garanții și tichete de service.", ru: "Помесячная выработка против обещанного в расчёте, гарантии и сервисные заявки." } },
  { key: 6, icon: FileText, label: { en: "Documents", ro: "Documente", ru: "Документы" },
    desc: { en: "What's ready for this job and what's still missing before it's complete.", ro: "Ce e gata pentru această lucrare și ce mai lipsește până la final.", ru: "Что готово по объекту и чего ещё не хватает до завершения." } },
];

/** The figure and status each stage shows on the line, all from the job's own data. */
function stageFacts(job, derived, lang) {
  const t = (o) => tx(o, lang);
  const ctx = jobStageContext(job.id);
  const sys = derived?.sys || systemFor(job);
  const fin = job.financing;
  const install = readJSON(installKey(job.id), {}) || {};
  const checks = Object.values(install.steps || {}).filter(Boolean).length;
  const actuals = readJSON(actualsKey(job.id), null);
  let ytd = null;
  if (Array.isArray(actuals)) {
    const p50 = p50Row(job);
    let a = 0, p = 0;
    actuals.forEach((v, i) => { const n = Number(v); if (v !== "" && v != null && Number.isFinite(n)) { a += n; p += p50[i] || 0; } });
    if (p > 0) ytd = Math.round((a / p) * 100);
  }
  const docsReady = [job.roofFactor != null, !!job.panelId && !!job.inverterId, !!fin, !!job.paperworkFiled].filter(Boolean).length;
  const payback = derived?.results?.e?.payback;
  const yrs = t({ en: "yrs", ro: "ani", ru: "лет" });
  return [
    job.roofFactor != null
      ? { v: `${Math.round(job.roofFactor * 100)}%`, sub: t({ en: "of the ideal yield", ro: "din producția ideală", ru: "от идеальной выработки" }) }
      : { v: "—", sub: t({ en: "Survey the roof", ro: "Măsoară acoperișul", ru: "Осмотрите крышу" }) },
    { v: `${(+job.kw || 0).toFixed(1)} kWp`, sub: job.inverterId ? `${sys.panel.brand}, ${sys.inverter.brand}` : t({ en: "Pick an inverter", ro: "Alege un invertor", ru: "Выберите инвертор" }) },
    { v: payback == null ? "—" : `${payback.toFixed(1)} ${yrs}`, sub: !fin ? t({ en: "Choose how they pay", ro: "Alege cum plătește", ru: "Выберите способ оплаты" })
      : fin.type === "credit" ? t({ en: `Green credit, ${fin.months} mo`, ro: `Credit verde, ${fin.months} luni`, ru: `Зелёный кредит, ${fin.months} мес.` })
      : t({ en: "Paid in cash", ro: "Plată cash", ru: "Оплата наличными" }) },
    job.paperworkFiled
      ? { v: t({ en: "Filed", ro: "Depus", ru: "Подано" }), sub: t({ en: "with the grid operator", ro: "la operatorul de rețea", ru: "оператору сети" }) }
      : { v: t({ en: "To file", ro: "De depus", ru: "Подать" }), sub: t({ en: "The annex is ready", ro: "Anexa e gata", ru: "Приложение готово" }) },
    { v: `${checks}/5`, sub: ctx.signed ? t({ en: "Signed on site", ro: "Semnat pe teren", ru: "Подписано на объекте" }) : t({ en: "site checks done", ro: "verificări făcute", ru: "проверок сделано" }) },
    ytd != null
      ? { v: `${ytd}%`, sub: t({ en: "of P50 this year", ro: "din P50 anul acesta", ru: "от P50 за год" }) }
      : { v: "—", sub: t({ en: "No readings yet", ro: "Fără citiri încă", ru: "Показаний пока нет" }) },
    { v: `${docsReady}/4`, sub: t({ en: "ready to hand over", ro: "gata de predat", ru: "готово к передаче" }) },
  ];
}

// `rev` is only a re-render trigger: stage facts read storage that the
// Installation and Monitoring steps write without changing the job object.
// eslint-disable-next-line no-unused-vars
export function JobJourney({ job, derived, lang, step, setStep, rev }) {
  const t = (o) => tx(o, lang);
  const ctx = jobStageContext(job.id);
  const facts = stageFacts(job, derived, lang);
  const doneN = STEPS.filter((s) => isStepDone(s.key, job, ctx)).length;
  // On a narrow screen the line scrolls sideways: keep the open step in view.
  const lineRef = useRef(null);
  useEffect(() => {
    const line = lineRef.current, on = line?.querySelector(".ws-stage.on");
    if (line && on && line.scrollWidth > line.clientWidth) line.scrollTo({ left: Math.max(0, on.offsetLeft - 16), behavior: "smooth" });
  }, [step]);
  return (
    <section className="ws-journey" aria-labelledby="ws-journey-h">
      <div className="ws-journey-head">
        <h2 id="ws-journey-h">{t({ en: "The job, step by step", ro: "Lucrarea, pas cu pas", ru: "Объект, шаг за шагом" })}</h2>
        <p>{t({ en: `${doneN} of 6 steps done. Everything saves as you work; open any step, in any order.`, ro: `${doneN} din 6 pași gata. Totul se salvează pe loc; deschide orice pas, în orice ordine.`, ru: `Готово шагов: ${doneN} из 6. Всё сохраняется сразу; открывайте шаги в любом порядке.` })}</p>
      </div>
      <ol className="ws-line" ref={lineRef}>
        {STEPS.map((s, i) => {
          const on = step === s.key;
          const done = isStepDone(s.key, job, ctx);
          const f = facts[i];
          return (
            <li key={s.key} className={"ws-stage" + (on ? " on" : "") + (done ? " done" : " todo")}>
              <span className="ws-node" aria-hidden="true">{done && !on ? <Check size={9} strokeWidth={4} /> : null}</span>
              {i < STEPS.length - 1 && <span className="ws-join" aria-hidden="true" />}
              <button type="button" className="ws-stage-in" onClick={() => setStep(s.key)} aria-current={on ? "step" : undefined}>
                <span className="ws-stage-lbl">{s.label[lang] || s.label.en}</span>
                <b className="ws-stage-v">{f.v}</b>
                <span className="ws-stage-sub">{f.sub}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function WizardSteps({ job, patch, derived, lang, step, setStep, touch }) {
  const s = STEPS[step] || STEPS[0];
  const Icon = s.icon;
  return (
    <section className="dx-card ws-step" aria-labelledby="ws-step-h">
      <header className="ws-step-head">
        <span className="ws-step-ic" aria-hidden="true"><Icon size={18} /></span>
        <div>
          <h2 id="ws-step-h">{s.label[lang] || s.label.en}</h2>
          <p>{s.desc[lang] || s.desc.en}</p>
        </div>
        <span className="ws-step-no">{tx({ en: `Step ${step + 1} of 7`, ro: `Pasul ${step + 1} din 7`, ru: `Шаг ${step + 1} из 7` }, lang)}</span>
      </header>
      {/* key={step}: a fresh mount per step, which also replays the short fade-in */}
      <div key={step} className="ws-step-body">
        {step === 0 && <SiteRoofStep job={job} patch={patch} lang={lang} />}
        {step === 1 && <EquipmentStep job={job} patch={patch} derived={derived} lang={lang} />}
        {step === 2 && <FinancialsStep job={job} patch={patch} derived={derived} lang={lang} />}
        {step === 3 && <GridConnectionStep job={job} patch={patch} derived={derived} lang={lang} />}
        {step === 4 && <InstallationStep job={job} derived={derived} lang={lang} touch={touch} />}
        {step === 5 && <MonitoringStep job={job} lang={lang} touch={touch} />}
        {step === 6 && <DocumentsStep job={job} lang={lang} setStep={setStep} />}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Documents */
function ChecklistRow({ done, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className={"ws-check" + (done ? " done" : "")}>
      <span className="box" aria-hidden="true">{done && <Check size={13} strokeWidth={3} />}</span>
      <span className="lbl">{label}</span>
      <ChevronRight size={16} className="go" aria-hidden="true" />
    </button>
  );
}

function DocumentsStep({ job, lang, setStep }) {
  const t = (o) => tx(o, lang);
  const items = [
    [job.roofFactor != null, 0, { en: "Site surveyed: roof pitch, orientation and shading", ro: "Vizită făcută: înclinare, orientare și umbrire", ru: "Осмотр проведён: уклон, ориентация и затенение" }],
    [!!job.panelId && !!job.inverterId, 1, { en: "Panels and inverter chosen", ro: "Panouri și invertor alese", ru: "Панели и инвертор выбраны" }],
    [!!job.financing, 2, { en: "Payment method set", ro: "Metoda de plată stabilită", ru: "Способ оплаты задан" }],
    [!!job.paperworkFiled, 3, { en: "Grid-connection file sent to the operator", ro: "Dosarul de racordare trimis operatorului", ru: "Заявка на подключение отправлена оператору" }],
  ];
  const done = items.filter(([d]) => d).length;
  return (
    <>
      <div className="ws-sec">
        <div className="ws-sec-h">{t({ en: "Ready to complete", ro: "Gata de finalizare", ru: "Готовность" })}<span className="ws-aside">{done}/4</span></div>
        <div className="ws-progress" aria-hidden="true"><i style={{ width: (done / 4) * 100 + "%" }} /></div>
        <div className="ws-checks">
          {items.map(([d, to, label]) => <ChecklistRow key={to} done={d} onClick={() => setStep(to)} label={t(label)} />)}
        </div>
      </div>

      <div className="ws-sec">
        <div className="ws-sec-h">{t({ en: "Documents this job produces", ro: "Documentele acestei lucrări", ru: "Документы этого объекта" })}</div>
        <div className="ws-docs">
          <button type="button" onClick={() => setStep(3)} className="ws-doc">
            <FileCheck2 size={20} aria-hidden="true" />
            <b>{t({ en: "Technical annex", ro: "Anexă tehnică", ru: "Техническое приложение" })}</b>
            <small>{t({ en: "Single-line diagram and equipment schedule, for the grid operator", ro: "Schemă monofilară și borderou de echipamente, pentru operatorul de rețea", ru: "Однолинейная схема и спецификация, для оператора сети" })}</small>
          </button>
          <button type="button" onClick={() => setStep(4)} className="ws-doc">
            <ClipboardCheck size={20} aria-hidden="true" />
            <b>{t({ en: "Handover certificate", ro: "Proces-verbal de predare", ru: "Акт приёмки" })}</b>
            <small>{t({ en: "Commissioning checks and the client's signature", ro: "Verificări la punerea în funcțiune și semnătura clientului", ru: "Проверки при вводе и подпись клиента" })}</small>
          </button>
          <button type="button" onClick={() => setStep(5)} className="ws-doc">
            <LineChart size={20} aria-hidden="true" />
            <b>{t({ en: "Performance report", ro: "Raport de performanță", ru: "Отчёт о выработке" })}</b>
            <small>{t({ en: "Actual production against P50, and warranties", ro: "Producția reală față de P50 și garanțiile", ru: "Фактическая выработка против P50 и гарантии" })}</small>
          </button>
        </div>
      </div>

      <div className="ws-note">
        <FileText size={16} aria-hidden="true" />
        <div>
          {t({
            en: "The proposal the client signs is built in Quotes, from the same numbers you set here.",
            ro: "Oferta pe care o semnează clientul se construiește în Oferte, din aceleași cifre setate aici.",
            ru: "Предложение, которое подписывает клиент, собирается в разделе «Предложения» из тех же цифр.",
          })}{" "}
          <Link href="/projects" style={{ color: "var(--green)", fontWeight: 650 }}>{t({ en: "Open Quotes", ro: "Deschide Oferte", ru: "Открыть предложения" })}</Link>
        </div>
      </div>
    </>
  );
}
