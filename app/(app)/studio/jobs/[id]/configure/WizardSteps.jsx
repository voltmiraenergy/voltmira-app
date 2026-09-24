"use client";
// WizardSteps.jsx — the left panel: 4 tabs (Site & Roof, Equipment,
// Financials, Documents), each writing straight to the real job via `patch`
// (no separate save step — matches how every other Studio surface behaves).
import Link from "next/link";
import {
  MapPin, Zap, Euro as EuroIcon, FileText, CheckCircle2,
  ChevronRight, Plug, HardHat, Activity,
} from "lucide-react";
import { tx, jobStageContext, isStepDone } from "../../../studio-kit.jsx";
import SiteRoofStep from "./SiteRoofStep.jsx";
import EquipmentStep from "./EquipmentStep.jsx";
import FinancialsStep from "./FinancialsStep.jsx";
import GridConnectionStep from "./GridConnectionStep.jsx";
import InstallationStep from "./InstallationStep.jsx";
import MonitoringStep from "./MonitoringStep.jsx";

const TABS = [
  { key: 0, icon: MapPin, label: { en: "Site & Roof", ro: "Amplasament", ru: "Участок и крыша" } },
  { key: 1, icon: Zap, label: { en: "Equipment", ro: "Echipament", ru: "Оборудование" } },
  { key: 2, icon: EuroIcon, label: { en: "Financials", ro: "Financiar", ru: "Финансы" } },
  { key: 3, icon: Plug, label: { en: "Grid Connection", ro: "Racordare", ru: "Подключение" } },
  { key: 4, icon: HardHat, label: { en: "Installation", ro: "Montaj", ru: "Монтаж" } },
  { key: 5, icon: Activity, label: { en: "Monitoring", ro: "Monitorizare", ru: "Мониторинг" } },
  { key: 6, icon: FileText, label: { en: "Documents", ro: "Documente", ru: "Документы" } },
];

// A real horizontal stepper — numbered/iconed circles on a connecting line,
// not squished text links — even though the steps can still be visited in
// any order (this is a configuration workspace, not a strictly linear
// checkout flow), so it communicates "7 areas of this job" rather than
// implying you must finish one before the next unlocks.
export default function WizardSteps({ job, patch, derived, lang, step, setStep }) {
  // Real per-tab completion — same localStorage-backed signals the Job Hub's
  // pipeline stage already reads (jobStageContext/isStepDone), just cheap
  // enough to call once per render (a handful of readJSON calls, no engine
  // math) rather than memoized: switching tabs already re-renders this via
  // setStep, which is exactly when a just-finished tab's circle should flip.
  const ctx = jobStageContext(job.id);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
      <div className="flex items-start overflow-x-auto px-4 pb-4 pt-5 dark:border-[#2C2C2C]">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          const on = step === tab.key;
          const done = !on && isStepDone(tab.key, job, ctx);
          return (
            <div key={tab.key} className="flex flex-1 items-center">
              <button type="button" onClick={() => setStep(tab.key)} className="group flex flex-none flex-col items-center gap-1.5">
                <span className={"flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 transition-all " +
                  (on ? "border-brand-600 bg-brand-600 text-white shadow-[0_0_0_4px_var(--color-brand-100)] dark:shadow-[0_0_0_4px_rgba(79,181,132,.22)]"
                    : done ? "border-brand-500 bg-brand-500 text-white"
                    : "border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600 dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-[#8A8A8A]")}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className={"whitespace-nowrap text-[11px] font-semibold transition-colors " +
                  (on ? "text-brand-700 underline decoration-2 underline-offset-4 dark:text-brand-400"
                    : done ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-400 group-hover:text-slate-600 dark:text-[#8A8A8A] dark:group-hover:text-[#C4C4C4]")}>
                  {tab.label[lang] || tab.label.en}
                </span>
              </button>
              {i < TABS.length - 1 && <span className="mx-1.5 h-0.5 min-w-[14px] flex-1 rounded-full bg-slate-100 dark:bg-[#242424]" style={{ marginBottom: 18 }} />}
            </div>
          );
        })}
      </div>
      {/* key={step} forces a remount on tab switch, which is what triggers
          the ws-step-enter fade/slide defined in workspace.css — a real CSS
          transition, not a fake network-loading delay. */}
      <div key={step} className="ws-step-enter border-t border-slate-100 p-5 dark:border-[#242424]">
        {step === 0 && <SiteRoofStep job={job} patch={patch} lang={lang} />}
        {step === 1 && <EquipmentStep job={job} patch={patch} derived={derived} lang={lang} />}
        {step === 2 && <FinancialsStep job={job} patch={patch} derived={derived} lang={lang} />}
        {step === 3 && <GridConnectionStep job={job} patch={patch} derived={derived} lang={lang} />}
        {step === 4 && <InstallationStep job={job} derived={derived} lang={lang} />}
        {step === 5 && <MonitoringStep job={job} lang={lang} />}
        {step === 6 && <DocumentsStep job={job} derived={derived} lang={lang} setStep={setStep} />}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Documents */
function ChecklistRow({ done, label, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left last:border-b-0 dark:border-[#242424]">
      <span className={"flex h-5 w-5 flex-none items-center justify-center rounded-full " +
        (done ? "bg-brand-500 text-white" : "border-2 border-slate-300 dark:border-[#3A3A3A]")}>
        {done && <CheckCircle2 className="h-3.5 w-3.5" />}
      </span>
      <span className={"flex-1 text-sm " + (done ? "text-slate-400 line-through dark:text-[#8A8A8A]" : "text-slate-800 dark:text-white")}>{label}</span>
      <ChevronRight className="h-4 w-4 flex-none text-slate-400" />
    </button>
  );
}

function DocumentsStep({ job, derived, lang, setStep }) {
  const t = (o) => tx(o, lang);
  const surveyed = job.roofFactor != null;
  const equipped = !!job.panelId && !!job.inverterId;
  const financed = !!job.financing;
  const filed = !!job.paperworkFiled;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "Readiness checklist", ro: "Listă de verificare", ru: "Чек-лист готовности" })}</h3>
        <div>
          <ChecklistRow done={surveyed} onClick={() => setStep(0)} label={t({ en: "Site surveyed (roof pitch, azimuth, shading)", ro: "Vizită efectuată (înclinare, orientare, umbrire)", ru: "Осмотр проведён (уклон, ориентация, затенение)" })} />
          <ChecklistRow done={equipped} onClick={() => setStep(1)} label={t({ en: "Panels and inverter selected", ro: "Panouri și invertor selectate", ru: "Панели и инвертор выбраны" })} />
          <ChecklistRow done={financed} onClick={() => setStep(2)} label={t({ en: "Financing option set", ro: "Opțiune de finanțare setată", ru: "Способ финансирования задан" })} />
          <ChecklistRow done={filed} onClick={() => setStep(3)} label={t({ en: "Grid-connection paperwork filed", ro: "Dosar de racordare depus", ru: "Заявка на подключение подана" })} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "Documents produced by this job", ro: "Documente generate de această lucrare", ru: "Документы этого объекта" })}</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => setStep(3)} className="rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-brand-400 dark:border-[#2C2C2C]">
            <div className="text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "Technical annex", ro: "Anexă tehnică", ru: "Техническое приложение" })}</div>
            <div className="text-xs text-slate-500 dark:text-[#B0B0B0]">{t({ en: "Single-line diagram, equipment schedule", ro: "Schemă monofilară, borderou echipamente", ru: "Однолинейная схема, спецификация" })}</div>
          </button>
          <button type="button" onClick={() => setStep(4)} className="rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-brand-400 dark:border-[#2C2C2C]">
            <div className="text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "Handover certificate", ro: "Proces-verbal de predare", ru: "Акт приёмки" })}</div>
            <div className="text-xs text-slate-500 dark:text-[#B0B0B0]">{t({ en: "Commissioning checks, signature", ro: "Verificări la PIF, semnătură", ru: "Проверки, подпись" })}</div>
          </button>
          <button type="button" onClick={() => setStep(5)} className="rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-brand-400 dark:border-[#2C2C2C]">
            <div className="text-sm font-semibold text-slate-800 dark:text-white">{t({ en: "Performance report", ro: "Raport de performanță", ru: "Отчёт о производительности" })}</div>
            <div className="text-xs text-slate-500 dark:text-[#B0B0B0]">{t({ en: "Actual vs P50, warranties", ro: "Real vs P50, garanții", ru: "Факт vs P50, гарантии" })}</div>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2C2C2C] dark:bg-[#242424]/50">
        <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-[#B0B0B0]">
          {t({
            en: "Studio is a preview — it doesn't generate a client-facing proposal itself. The documents above are ready to attach to a filing or hand to the client; the real, sendable proposal is built in Projects.",
            ro: "Studio este o previzualizare — nu generează el însuși o ofertă pentru client. Documentele de mai sus sunt gata de atașat la un dosar sau predate clientului; oferta reală, trimisă clientului, se construiește în Oferte.",
            ru: "Studio — это превью, оно само не создаёт предложение для клиента. Документы выше готовы для подачи или передачи клиенту; настоящее предложение собирается в разделе «Проекты».",
          })}
        </p>
        <Link href="/projects" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white dark:border-[#3A3A3A] dark:text-[#D4D4D4] dark:hover:bg-[#242424]">
          {t({ en: "Build the real proposal", ro: "Construiește oferta reală", ru: "Собрать реальное предложение" })}
        </Link>
      </div>
    </div>
  );
}
