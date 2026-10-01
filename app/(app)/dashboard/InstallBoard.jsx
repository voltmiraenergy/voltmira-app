"use client";
// app/(app)/dashboard/InstallBoard.jsx — every won job's six install steps on
// one line, with the next step tickable from here. Uses the same
// setInstallStep() as the checklist inside the quote, and re-syncs from the
// map the server returns, so both places always agree.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setInstallStep } from "../../../lib/actions.js";
import { INSTALL_STEPS } from "../../../lib/dashboardMoves.js";

export default function InstallBoard({ jobs, stepLabels, labels }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(null);
  const [prog, setProg] = useState(() => Object.fromEntries(jobs.map((j) => [j.id, j.prog || {}])));

  function tick(id, step) {
    setBusy(id);
    setProg((p) => ({ ...p, [id]: { ...p[id], [step]: "…" } }));
    start(async () => {
      try {
        const server = await setInstallStep(id, step, true);
        if (server) setProg((p) => ({ ...p, [id]: server }));
        router.refresh();
      } catch {
        setProg((p) => { const c = { ...p[id] }; delete c[step]; return { ...p, [id]: c }; });
      } finally { setBusy(null); }
    });
  }

  return (
    <ul className="dx-jobs">
      {jobs.map((j) => {
        const pr = prog[j.id] || {};
        const done = INSTALL_STEPS.filter((s) => pr[s]).length;
        const next = INSTALL_STEPS.find((s) => !pr[s]);
        return (
          <li key={j.id} className="dx-job">
            <div className="dx-job-top">
              <Link href={`/projects/${j.id}`} className="dx-job-title">{j.title}</Link>
              {j.client && <span className="dx-job-client">{j.client}</span>}
              <span className="dx-job-n">{done === 0 ? labels.waiting : `${done}/${INSTALL_STEPS.length}`}</span>
            </div>
            <ol className="dx-steps" aria-label={j.title}>
              {INSTALL_STEPS.map((s) => {
                const st = pr[s] ? "done" : s === next ? "next" : "";
                return (
                  <li key={s} className={st} title={stepLabels[s] + (pr[s] && pr[s] !== "…" ? `, ${pr[s]}` : "")}>
                    <span className="sr">{stepLabels[s]}{pr[s] ? `, ${labels.mark}` : ""}</span>
                  </li>
                );
              })}
            </ol>
            {next && (
              <div className="dx-job-next">
                <span>{labels.next}: <b>{stepLabels[next]}</b></span>
                <button type="button" className="dx-btn" disabled={pending} aria-busy={busy === j.id} onClick={() => tick(j.id, next)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  {labels.mark}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
