"use client";
// app/(app)/studio/jobs/[id]/configure/StudioWorkspace.jsx — the container:
// a header, the job's seven steps as one line (read the same way as the
// dashboard's lead-to-live line: where this job stands, at a glance), the
// open step, and the live numbers beside it. Every number is real: the same
// job object, catalog and engine the rest of Studio (and the Job Hub) use, so
// picking equipment here shows up on the Job Hub, in the annex and in
// payments immediately.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AlertTriangle, MapPin, Zap, Sun } from "lucide-react";
import { PREVIEW_BASE } from "../../../features.js";
import {
  useLang, tx, useStudioJobs, engineSettings, systemFor, jobCostEur, stringSizing, useFmt,
} from "../../../studio-kit.jsx";
import { quote, effectiveYield } from "../../../_engine.js";
import LiveEngineSidebar from "./LiveEngineSidebar.jsx";
import WizardSteps, { JobJourney, STEPS } from "./WizardSteps.jsx";
import { NEW_JOB } from "../../../jobs-data.js";

export default function StudioWorkspace({ jobId }) {
  const { NUM } = useFmt();
  const lang = useLang();
  const t = (o) => tx(o, lang);
  const { jobs, updateJob, hydrated } = useStudioJobs();
  const job = jobs.find((j) => j.id === jobId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // the open step is the URL's (?step=): each one a history entry, so back returns to the step before
  const asked = +(searchParams.get("step") || 0);
  const step = Number.isInteger(asked) && asked >= 0 && asked <= 6 ? asked : 0;
  const setStep = (n) => { if (n !== step) router.push(`${pathname}?step=${n}`, { scroll: false }); };
  // Steps that save straight to storage (checklist ticks, readings) bump this
  // so the journey line above them updates as they happen.
  const [rev, setRev] = useState(0);
  const touch = () => setRev((r) => r + 1);
  // A deep link from the Job Hub's outstanding-items list ("this job's
  // paperwork isn't filed") opens straight on its step, the same way.

  // Only updateJob on THIS page changes the engine inputs, so [job] is the
  // right dependency (and keeps simulate() off unrelated renders).
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
      <div className="dx ws">
        <div className="ws-card" style={{ maxWidth: 460, margin: "40px auto", textAlign: "center" }}>
          <AlertTriangle size={26} style={{ color: "var(--amber-ink)", margin: "0 auto 10px", display: "block" }} />
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t({ en: "Job not found.", ro: "Lucrarea nu a fost găsită.", ru: "Объект не найден.", uk: "Об’єкт не знайдено." })}</p>
          <Link href={PREVIEW_BASE} className="btn primary sm">{t({ en: "Back to Studio", ro: "Înapoi la Studio", ru: "Назад в Studio", uk: "Назад до Studio" })}</Link>
        </div>
      </div>
    );
  }

  const place = String(job.address || "").split(",").slice(0, 2).join(",").trim();
  return (
    <div className="dx ws">
      <div>
        <nav className="ws-crumbs" aria-label={t({ en: "Where you are", ro: "Unde ești", ru: "Где вы", uk: "Де ви" })}>
          <Link href={PREVIEW_BASE}>Studio</Link>
          <span aria-hidden="true">›</span>
          <Link href={`${PREVIEW_BASE}/jobs/${job.id}`}>{job.name || t(NEW_JOB)}</Link>
          <span aria-hidden="true">›</span>
          {/* the step's name only: the journey card below counts the steps done */}
          <span aria-current="page">{t(STEPS[step]?.label || STEPS[0].label)}</span>
        </nav>
        <header className="ws-head">
          <div className="ws-head-tx">
            <h1>{job.name || t(NEW_JOB)}</h1>
            <div className="ws-head-sub">
              {place && <span><MapPin size={14} aria-hidden="true" />{place}</span>}
              <span><Zap size={14} aria-hidden="true" /><b>{(+job.kw || 0).toFixed(1)} kWp</b>{(+job.batteryKwh || 0) > 0 ? ` + ${job.batteryKwh} kWh` : ""}</span>
              <span><Sun size={14} aria-hidden="true" /><b>{NUM(derived?.annualKwh || 0)} kWh</b>{t({ en: "a year", ro: "pe an", ru: "в год", uk: "на рік" })}</span>
            </div>
          </div>
        </header>
      </div>

      <JobJourney job={job} derived={derived} lang={lang} step={step} setStep={setStep} rev={rev} />

      <div className="ws-grid">
        <WizardSteps job={job} patch={patch} derived={derived} lang={lang} step={step} setStep={setStep} touch={touch} />
        <LiveEngineSidebar job={job} derived={derived} lang={lang} />
      </div>
    </div>
  );
}
