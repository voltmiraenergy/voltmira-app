"use client";
// app/(app)/projects/NewQuoteMenu.jsx — "New quote" split button: the main
// button starts a blank quote; the caret opens saved templates so an installer
// doing the same system every week spins up a pre-filled quote in one click.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject, createProjectFromTemplate } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

export default function NewQuoteMenu({ templates = [], lang }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const go = (promise) => start(() => promise.then(id => id && router.push(`/projects/${id}`)));
  const plus = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

  return (
    <div style={{ position: "relative", display: "inline-flex" }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button className="btn primary" disabled={pending} style={{ borderRadius: templates.length ? "11px 0 0 11px" : 11 }}
        onClick={() => go(createProject())}>{plus}{t("btn_new_quote", lang)}</button>
      {templates.length > 0 && (
        <button className="btn primary" disabled={pending} aria-label="Templates" aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          style={{ borderRadius: "0 11px 11px 0", borderLeft: "1px solid rgba(255,255,255,.25)", padding: "10.5px 11px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      )}
      {open && templates.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, minWidth: 240,
          background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: 6 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--muted)", padding: "6px 10px 4px", fontWeight: 700 }}>{t("tpl_from", lang)}</div>
          {templates.map(tp => (
            <button key={tp.id} className="tpl-item" disabled={pending}
              onClick={() => { setOpen(false); go(createProjectFromTemplate(tp.id)); }}
              style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, textAlign: "left",
                padding: "9px 10px", borderRadius: 8, cursor: "pointer", background: "none", border: "none", color: "var(--ink)" }}>
              <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tp.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{Number(tp.kw).toFixed(1)} kW · {tp.market}{tp.batt ? " · 🔋" : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
