"use client";
// app/(app)/leads/LeadActions.jsx — per-lead action buttons. "Create quote" runs
// the whole funnel step (new project pre-filled from the lead) and opens the
// editor; the rest (edit, visit, contacted, archive, delete) sit in a "more" menu
// and just re-triage the lead. Used on /leads and on the
// dashboard's Incoming leads card; styled by the shared .dx-btn (app/(app)/dx.css).
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLeadStatus, deleteLead, createProjectFromLead } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";
import { qft } from "../../../lib/quoteFastText.js";
import MoreMenu from "../../../components/MoreMenu.jsx";

export default function LeadActions({ id, status, projectId, lang, onEdit, onVisit, editing = false, fromEstimate = false }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (s) => start(() => setLeadStatus(id, s));
  const convert = () =>
    start(() => createProjectFromLead(id).then((pid) => pid && router.push(`/projects/${pid}`)));
  const remove = () => {
    if (!confirm(t("lead_delete_confirm", lang))) return;
    start(() => deleteLead(id));
  };

  // One clear main button (make or open the quote); everything else in the "more" menu (components/MoreMenu.jsx).
  const more = [
    onEdit && { label: t(editing ? "lead_edit_close" : "lead_edit", lang), onClick: onEdit },
    onVisit && { label: t("lead_visit_book", lang), onClick: onVisit },
    status !== "contacted" && status !== "converted" && { label: t("lead_mark_contacted", lang), onClick: () => set("contacted") },
    status !== "archived"
      ? { label: t("lead_archive", lang), onClick: () => set("archived") }
      : { label: t("lead_restore", lang), onClick: () => set("new") },
    { label: t("lead_delete", lang), onClick: remove, danger: true },
  ];

  return (
    <div className="lead-acts" aria-busy={pending}>
      {status === "converted" && projectId ? (
        <button type="button" className="dx-btn primary" disabled={pending} onClick={() => router.push(`/projects/${projectId}`)}>
          {t("lead_open_quote", lang)}
        </button>
      ) : (
        // a lead from the estimate page becomes a quote with its options already filled in
        <button type="button" className="dx-btn primary" disabled={pending} onClick={convert}>{fromEstimate ? qft("from_estimate", lang) : t("lead_make_quote", lang)}</button>
      )}
      <MoreMenu items={more} label={t("more_actions", lang)} disabled={pending} />
    </div>
  );
}
