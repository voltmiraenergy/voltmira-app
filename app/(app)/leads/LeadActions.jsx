"use client";
// app/(app)/leads/LeadActions.jsx — per-lead action buttons. "Create quote" runs
// the whole funnel step (new project pre-filled from the lead) and opens the
// editor; the rest just re-triage the lead's status. Used on /leads and on the
// dashboard's Incoming leads card; styled by the shared .dx-btn (app/(app)/dx.css).
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLeadStatus, deleteLead, createProjectFromLead } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

export default function LeadActions({ id, status, projectId, lang, onEdit, onVisit, editing = false }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (s) => start(() => setLeadStatus(id, s));
  const convert = () =>
    start(() => createProjectFromLead(id).then((pid) => pid && router.push(`/projects/${pid}`)));
  const remove = () => {
    if (!confirm(t("lead_delete_confirm", lang))) return;
    start(() => deleteLead(id));
  };

  return (
    <div className="lead-acts" aria-busy={pending}>
      {/* Edit lives in this row (not floating above it) so it lines up with the
          other actions and shares their height, radius and spacing. It toggles
          the editor drawer, so it reflects the open state instead of firing a
          one-way action. */}
      {onEdit && (
        <button type="button" className={"dx-btn" + (editing ? " on" : "")}
          disabled={pending} onClick={onEdit} aria-expanded={editing}>{t("lead_edit", lang)}</button>
      )}
      {/* Book the site visit: opens the editor on the date field. */}
      {onVisit && (
        <button type="button" className="dx-btn" disabled={pending} onClick={onVisit}>{t("lead_visit_book", lang)}</button>
      )}
      {status === "converted" && projectId ? (
        <button type="button" className="dx-btn primary" disabled={pending} onClick={() => router.push(`/projects/${projectId}`)}>
          {t("lead_open_quote", lang)}
        </button>
      ) : (
        <button type="button" className="dx-btn primary" disabled={pending} onClick={convert}>{t("lead_make_quote", lang)}</button>
      )}
      {status !== "contacted" && status !== "converted" && (
        <button type="button" className="dx-btn" disabled={pending} onClick={() => set("contacted")}>{t("lead_mark_contacted", lang)}</button>
      )}
      {status !== "archived" ? (
        <button type="button" className="dx-btn" disabled={pending} onClick={() => set("archived")}>{t("lead_archive", lang)}</button>
      ) : (
        <button type="button" className="dx-btn" disabled={pending} onClick={() => set("new")}>{t("lead_restore", lang)}</button>
      )}
      <button type="button" className="dx-btn icon del" disabled={pending} onClick={remove}
        aria-label={t("lead_delete", lang)} title={t("lead_delete", lang)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></svg>
      </button>
    </div>
  );
}
