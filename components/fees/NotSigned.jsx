// components/fees/NotSigned.jsx — what the invoice and billing pages show for
// a job that is not signed while the pay-per-signed-job model is on
// (lib/successFees.js invoiceBlocked): why, and the way back to the job, where
// the invoice button asks to mark it signed.
import "./fees.css";
import Link from "next/link";
import { ft } from "../../lib/feeText.js";
import { t } from "../../lib/i18n.js";
import { FileSignature } from "lucide-react";

export default function NotSigned({ projectId, lang = "en" }) {
  return (
    <div className="dx-card fe-jobcard" style={{ maxWidth: 520, margin: "40px auto" }}>
      <h3 className="fe-job-h"><FileSignature size={16} strokeWidth={2} aria-hidden="true" />{ft("ig_h", lang)}</h3>
      <p className="fe-job-s" style={{ marginBottom: 14 }}>{ft("not_signed", lang)}</p>
      <Link className="btn primary" href={`/projects/${projectId}`}>{t("col_project", lang)}</Link>
    </div>
  );
}
