"use client";
// app/(app)/dashboard/OnboardingChecklist.jsx — a short "get set up" checklist
// shown on the dashboard until the installer has hit the core aha (logo set,
// first quote, first tracked proposal). Auto-hides when done, and can be
// dismissed for good (localStorage). Completion is computed on the server.
import { useState, useEffect } from "react";
import Link from "next/link";
import { t } from "../../../lib/i18n.js";

export default function OnboardingChecklist({ steps, allDone, lang }) {
  // Start hidden so it never flashes on the server render; the effect reveals it
  // on the client if it hasn't been dismissed.
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem("vm_onboard_done") === "1"); } catch { setHidden(false); }
  }, []);
  if (allDone || hidden) return null;

  const done = steps.filter(s => s.done).length;
  function dismiss() { try { localStorage.setItem("vm_onboard_done", "1"); } catch {} setHidden(true); }

  return (
    <section className="card" style={{ marginBottom: 18, borderColor: "var(--green)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: 0 }}>{t("ob_title", lang)}</h3>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{done}/{steps.length}</span>
        <span className="spacer" />
        <button className="btn sm ghost" onClick={dismiss}>{t("ob_dismiss", lang)}</button>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {steps.map(s => (
          <Link key={s.key} href={s.href}
            style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--ink)" }}>
            <span aria-hidden="true" style={{
              width: 22, height: 22, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", fontSize: 13,
              background: s.done ? "var(--green)" : "var(--paper)", color: s.done ? "#fff" : "var(--muted)",
              border: s.done ? "none" : "1.5px solid var(--line)",
            }}>{s.done ? "✓" : ""}</span>
            <span style={{ fontSize: 14, fontWeight: 500, opacity: s.done ? 0.55 : 1, textDecoration: s.done ? "line-through" : "none" }}>{s.label}</span>
            {!s.done && <span style={{ marginLeft: "auto", color: "var(--green)", fontSize: 15 }}>→</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
