"use client";
// The step that gives a proforma its number: lib/invoiceIssue.js draws it and fixes the amounts shown.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { issueInvoice } from "../../../../../lib/actions.js";
import { t } from "../../../../../lib/i18n.js";

export default function IssueInvoice({ projectId, deposit = 0, lang }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function issue() {
    setBusy(true); setFailed(false);
    try {
      const r = await issueInvoice(projectId, deposit);
      if (r?.ok) router.refresh(); else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button type="button" className="btn amber" disabled={busy} aria-busy={busy} onClick={issue}>{busy ? t("inv_issue_busy", lang) : t("inv_issue", lang)}</button>
      {failed && <span role="alert" style={{ fontSize: 13, color: "var(--red)" }}>{t("inv_issue_fail", lang)}</span>}
    </span>
  );
}
