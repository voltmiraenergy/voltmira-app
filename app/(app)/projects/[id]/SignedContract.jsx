"use client";
// app/(app)/projects/[id]/SignedContract.jsx — the installer-side view of the
// homeowner's e-signature. The drawn signature is deliberately NOT exposed on the
// public proposal link; it's shown here, inside the authenticated app, once the
// client has signed-to-accept. Includes the light audit trail (name, time, IP,
// device) that gives the signature its evidentiary weight.
import { t } from "../../../../lib/i18n.js";
import { fmtDate, fmtTime } from "../../../../lib/tz.js";

export default function SignedContract({ signed, lang = "en" }) {
  if (!signed || (!signed.signature && !signed.signerName)) return null;
  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";
  const when = signed.acceptedAt
    ? `${fmtDate(signed.acceptedAt, locale, { day: "numeric", month: "short", year: "numeric" })} · ${fmtTime(signed.acceptedAt, locale)}`
    : "";
  // Trim the UA down to a readable device/browser hint.
  const device = String(signed.signedUa || "").replace(/^Mozilla\/[\d.]+ \(/, "").split(")")[0].slice(0, 60);

  return (
    <section className="card" style={{ marginTop: 16, borderColor: "var(--green)" }}>
      <h3 style={{ marginTop: 0 }}>{t("sc_signed_title", lang)}</h3>

      {signed.signature ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, background: "#fff",
          padding: 12, display: "grid", placeItems: "center", minHeight: 90 }}>
          <img src={signed.signature} alt="" style={{ maxWidth: "100%", maxHeight: 160 }} />
        </div>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: 13.5 }}>{t("sc_no_sig", lang)}</div>
      )}

      <div style={{ marginTop: 12, fontSize: 14 }}>
        <b>{t("sig_signed_by", lang)}:</b> {signed.signerName || "—"}{when ? ` · ${when}` : ""}
      </div>
      {(signed.signedIp || device) && (
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
          {t("sc_audit", lang, { ip: signed.signedIp || "—" })}{device ? ` · ${device}` : ""}
        </div>
      )}
      {signed.signature && (
        <a className="btn sm ghost" href={signed.signature} download="signature.png"
          style={{ marginTop: 12, display: "inline-block" }}>
          {t("sc_download", lang)}
        </a>
      )}
    </section>
  );
}
