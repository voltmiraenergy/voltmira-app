"use client";
// app/(app)/projects/[id]/InstallChecklist.jsx — post-sale tracking. Once a deal is
// Won the installer's job continues (permit, equipment, install, grid, commissioning);
// this checklist lives on the quote so the whole job has one home. Each step stores
// the date it was completed.
import { useState, useTransition } from "react";
import { setInstallStep } from "../../../../lib/actions.js";
import { t } from "../../../../lib/i18n.js";

const STEPS = ["deposit", "permit", "order", "install", "grid", "commission"];

export default function InstallChecklist({ projectId, initial = {}, lang }) {
  const [prog, setProg] = useState(initial || {});
  const [pending, start] = useTransition();

  const toggle = (step) => {
    const done = !prog[step];
    // optimistic
    setProg(p => {
      const n = { ...p };
      if (done) n[step] = new Date().toISOString().slice(0, 10); else delete n[step];
      return n;
    });
    start(() => setInstallStep(projectId, step, done));
  };

  const doneCount = STEPS.filter(s => prog[s]).length;

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{t("inst_title", lang)}</h3>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-m,monospace)", fontSize: 12, color: "var(--muted)" }}>
          {doneCount}/{STEPS.length}
        </span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>{t("inst_sub", lang)}</p>

      {/* progress bar */}
      <div style={{ height: 6, borderRadius: 99, background: "var(--line)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${(doneCount / STEPS.length) * 100}%`,
          background: "var(--green)", borderRadius: 99, transition: "width .3s ease" }} />
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        {STEPS.map(step => {
          const date = prog[step];
          return (
            <button key={step} onClick={() => toggle(step)} disabled={pending}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                background: "none", border: "none", borderTop: "1px solid var(--line)", padding: "11px 2px",
                cursor: "pointer", color: "var(--ink)" }}>
              <span aria-hidden="true" style={{ flex: "none", width: 22, height: 22, borderRadius: 7,
                display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700,
                border: date ? "none" : "1.5px solid var(--line)",
                background: date ? "var(--green)" : "transparent", color: "#fff" }}>
                {date ? "✓" : ""}
              </span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: date ? 600 : 400,
                color: date ? "var(--ink)" : "var(--ink-soft,#2B4438)" }}>
                {t("inst_" + step, lang)}
              </span>
              {date && <span style={{ fontFamily: "var(--font-m,monospace)", fontSize: 11.5, color: "var(--muted)" }}>{date}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
