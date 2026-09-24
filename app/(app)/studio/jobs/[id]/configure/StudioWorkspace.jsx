"use client";
// app/(app)/studio/jobs/[id]/configure/StudioWorkspace.jsx — the container.
// Split-screen: a live ticker on top, a 4-step wizard on the left (~60%),
// and a sticky live-engine summary on the right (~40%). Every number here is
// real — the same job object, catalog and engine the rest of Studio (and the
// Job Hub) already use, so picking equipment here shows up back on the Job
// Hub, in the annex's equipment schedule, and in payments immediately.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PREVIEW_BASE } from "../../../features.js";
import {
  useLang, tx, useStudioJobs, engineSettings, systemFor, jobCostEur, stringSizing,
} from "../../../studio-kit.jsx";
import { quote, effectiveYield } from "../../../_engine.js";
import WorkspaceHeader from "./WorkspaceHeader.jsx";
import LiveEngineSidebar from "./LiveEngineSidebar.jsx";
import WizardSteps from "./WizardSteps.jsx";

export default function StudioWorkspace({ jobId }) {
  const lang = useLang();
  const { jobs, updateJob, hydrated } = useStudioJobs();
  const job = jobs.find((j) => j.id === jobId);
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  // Deep-link from the Job Hub's outstanding-items list ("this job's
  // paperwork isn't filed" -> jump straight to the Grid Connection step)
  // instead of landing on Site & Roof and making the installer find it.
  useEffect(() => {
    const n = +searchParams.get("step");
    if (Number.isInteger(n) && n >= 0 && n <= 6) setStep(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Same reasoning as the Job Hub page: the only things that change this
  // job's engine inputs happen through updateJob on THIS page, so memoizing
  // on [job] alone is correct (and stops re-running simulate() on every
  // unrelated render).
  const derived = useMemo(() => {
    if (!job) return null;
    const sys = systemFor(job);
    const E = engineSettings();
    const project = {
      market: job.market, kw: +job.kw || 0, price: +job.price || 0.185,
      cons: +job.cons || 0, batt: (+job.batteryKwh || 0) > 0, battKwh: +job.batteryKwh || 0,
      yieldOverride: effectiveYield(job),
    };
    const results = quote(project, E);
    const strings = stringSizing(+job.kw || 0, sys.panel);
    const vocExceeds = !!job.inverterId && strings.vocCold > sys.inverter.maxDcV;
    return {
      sys, E, project, results,
      costEur: jobCostEur(job),
      annualKwh: effectiveYield(job) * (+job.kw || 0),
      strings, vocExceeds,
    };
  }, [job]);

  const patch = (p) => job && updateJob(job.id, p);

  if (!hydrated) return null;

  if (!job) {
    return (
      <div className="max-w-lg mx-auto mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-[#2C2C2C] dark:bg-[#1E1E1E]">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-accent-500" />
        <p className="mb-4 text-sm text-slate-600 dark:text-[#C4C4C4]">
          {tx({ en: "Job not found.", ro: "Lucrarea nu a fost găsită.", ru: "Объект не найден." }, lang)}
        </p>
        <Link href={PREVIEW_BASE} className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          {tx({ en: "Back to Studio", ro: "Înapoi la Studio", ru: "Назад в Studio" }, lang)}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-[#121212] -mx-1 rounded-2xl">
      <WorkspaceHeader job={job} derived={derived} lang={lang} />
      <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-5 p-4">
        <WizardSteps
          job={job} patch={patch} derived={derived} lang={lang}
          step={step} setStep={setStep}
        />
        <div className="lg:sticky lg:top-4 lg:self-start">
          <LiveEngineSidebar job={job} derived={derived} lang={lang} />
        </div>
      </div>
    </div>
  );
}
