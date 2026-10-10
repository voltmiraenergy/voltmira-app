"use client";
// app/(app)/dashboard/Phases.jsx — "Jobs by phase": the four parts of the
// planned line (lib/workflow.js PHASES: sell, close, build, run), one row each
// with how many jobs sit there, their contract value and how many are stuck.
// Tapping a phase opens its jobs, most urgent first, each with its stage and
// its next step as a button that does it (ActionRow.jsx). Under the phases,
// one line says what could go to a lender. The numbers come from the server
// (pipelineSummary, workflowsFor); nothing here is illustrative.
import { useState } from "react";
import Link from "next/link";
import ActionRow from "./ActionRow.jsx";

const Chevron = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default function Phases({ phases, lender, labels }) {
  const [open, setOpen] = useState(null);
  const total = phases.reduce((s, p) => s + p.n, 0);

  return (
    <section className="dx-card dx-phases" aria-labelledby="dx-phases-h">
      <header className="dx-card-head">
        <div>
          <h2 id="dx-phases-h">{labels.title}</h2>
          <p>{labels.sub}</p>
        </div>
      </header>

      {total > 0 && (
        <div className="dx-ph-bar" aria-hidden="true">
          {phases.filter((p) => p.n > 0).map((p) => <span key={p.id} className={"ph-" + p.id} style={{ flexGrow: p.n }} />)}
        </div>
      )}

      <ul className="dx-ph-list">
        {phases.map((p) => {
          const isOpen = open === p.id;
          return (
            <li key={p.id} className={"dx-ph ph-" + p.id + (isOpen ? " open" : "") + (p.n ? "" : " zero")}>
              <button type="button" className="dx-ph-row" aria-expanded={isOpen} aria-controls={"dx-ph-" + p.id}
                onClick={() => setOpen(isOpen ? null : p.id)} disabled={!p.n}>
                <span className="dx-ph-sw" aria-hidden="true" />
                <span className="dx-ph-name">{p.label}</span>
                <span className="dx-ph-n">{p.nLabel}</span>
                <span className="dx-ph-v">{p.value}</span>
                {p.stuck > 0 && <span className="dx-ph-stuck">{p.stuckLabel}</span>}
                <Chevron open={isOpen} />
              </button>
              {isOpen && (
                <div id={"dx-ph-" + p.id} className="dx-ph-jobs">
                  {p.jobs.length ? (
                    <ul>
                      {p.jobs.map((j) => (
                        <li key={j.key} className={j.stuck ? "stuck" : ""}>
                          <div className="dx-ph-job-top">
                            <Link href={j.href} className="dx-ph-job-t">{j.title}</Link>
                            <span className="dx-ph-stage">{j.stage}</span>
                          </div>
                          {(j.sub || j.when) && (
                            <p className="dx-ph-job-s">
                              {j.sub && <span>{j.sub}</span>}
                              {j.when && <span className={j.stuck ? "late" : ""}>{j.when}</span>}
                            </p>
                          )}
                          <ActionRow actions={j.actions} labels={labels.acts} small />
                        </li>
                      ))}
                    </ul>
                  ) : <p className="dx-muted-note">{labels.empty}</p>}
                  {p.more && <Link className="dx-link dx-ph-more" href={p.more.href}>{p.more.label}</Link>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {lender && (
        <div className="dx-lender">
          <p>{lender.line}</p>
          <Link className="dx-btn" href="/portfolios">{lender.cta}</Link>
        </div>
      )}
    </section>
  );
}
