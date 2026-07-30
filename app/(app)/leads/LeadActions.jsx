"use client";
// app/(app)/leads/LeadActions.jsx — per-lead action buttons. "Create quote" runs
// the whole funnel step (new project pre-filled from the lead) and opens the
// editor; the rest just re-triage the lead's status.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLeadStatus, deleteLead, createProjectFromLead } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

export default function LeadActions({ id, status, projectId, lang }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (s) => start(() => setLeadStatus(id, s));
  const convert = () =>
    start(() => createProjectFromLead(id).then((pid) => pid && router.push(`/projects/${pid}`)));
  const remove = () => {
    if (!confirm(t("lead_delete_confirm", lang))) return;
    start(() => deleteLead(id));
  };

  const btn = { fontSize: 12.5, padding: "6px 11px", borderRadius: 9, cursor: "pointer",
    border: "1px solid var(--line)", background: "var(--paper-2)", color: "var(--ink)", whiteSpace: "nowrap" };
  const primary = { ...btn, background: "var(--ink)", color: "var(--paper)", border: "none", fontWeight: 600 };

  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {status === "converted" && projectId ? (
        <button style={primary} disabled={pending} onClick={() => router.push(`/projects/${projectId}`)}>
          {t("lead_open_quote", lang)}
        </button>
      ) : (
        <button style={primary} disabled={pending} onClick={convert}>{t("lead_make_quote", lang)}</button>
      )}
      {status !== "contacted" && status !== "converted" && (
        <button style={btn} disabled={pending} onClick={() => set("contacted")}>{t("lead_mark_contacted", lang)}</button>
      )}
      {status !== "archived" ? (
        <button style={btn} disabled={pending} onClick={() => set("archived")} title={t("lead_archive", lang)} aria-label={t("lead_archive", lang)}>{t("lead_archive", lang)}</button>
      ) : (
        <button style={btn} disabled={pending} onClick={() => set("new")}>{t("lead_restore", lang)}</button>
      )}
      <button style={{ ...btn, color: "var(--muted)" }} disabled={pending} onClick={remove}
        aria-label={t("lead_delete", lang)} title={t("lead_delete", lang)}>✕</button>
    </div>
  );
}
