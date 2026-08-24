"use client";
// app/(app)/refer/ReferClient.jsx — copy/share the referral link + see who joined.
import { useState } from "react";
import { t } from "../../../lib/i18n.js";

export default function ReferClient({ link, code, referrals = [], lang, companyName }) {
  const tr = (k, v) => t(k, lang, v);
  const [copied, setCopied] = useState(false);
  const joined = referrals.length;
  const subscribed = referrals.filter(r => r.status === "subscribed" || r.status === "rewarded").length;

  const waText = tr("refer_share_msg", { company: companyName, url: link });
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(tr("refer_mail_subj"))}&body=${encodeURIComponent(waText)}`;

  const copy = () => {
    navigator.clipboard?.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const locale = { en: "en-GB", ro: "ro-RO", ru: "ru-RU" }[lang] || "en-GB";
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };
  const statusLabel = (s) => tr("refer_status_" + s);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div className="page-head">
        <h1>{tr("refer_title")}</h1>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 20px", maxWidth: "62ch" }}>{tr("refer_sub")}</p>

      <section className="card" style={{ marginBottom: 18 }}>
        <h3>{tr("refer_your_link")}</h3>
        <div className="link-row" style={{ marginTop: 6 }}>
          <code style={{ wordBreak: "break-all" }}>{link}</code>
          <button className="btn sm amber" onClick={copy}>{copied ? tr("t_copied") : tr("copy")}</button>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 12 }}>
          <a className="btn wapp" href={waHref} target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm5.52 13.99c-.25.7-1.47 1.36-2.02 1.4-.53.05-1.02.24-3.46-.72-2.91-1.15-4.77-4.12-4.92-4.31-.14-.2-1.18-1.57-1.18-3s.75-2.12 1.02-2.42c.27-.29.58-.36.77-.36l.56.01c.18.01.42-.07.66.5.25.6.84 2.07.91 2.22.07.15.12.32.02.52-.1.2-.15.32-.29.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.35 1.45.29.15.46.12.63-.07.17-.2.73-.85.92-1.14.2-.29.39-.24.66-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.34.07.12.07.7-.18 1.4Z" /></svg>
            {tr("refer_share_wa")}
          </a>
          <a className="btn ghost" href={mailHref}>{tr("refer_share_email")}</a>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "12px 0 0" }}>{tr("refer_reward")}</p>
      </section>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><b>{joined}</b><span>{tr("refer_kpi_joined")}</span></div>
        <div className="kpi"><b>{subscribed}</b><span>{tr("refer_kpi_subscribed")}</span></div>
        <div className="kpi"><b>{subscribed}</b><span>{tr("refer_kpi_reward")}</span></div>
      </div>

      <section className="card">
        <h3>{tr("refer_list_title")}</h3>
        {joined ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>{tr("refer_col_who")}</th><th>{tr("refer_col_status")}</th><th>{tr("refer_col_when")}</th></tr></thead>
            <tbody>
              {referrals.map((r, i) => (
                <tr key={i}>
                  <td><b>{r.referred_name || tr("refer_anon")}</b></td>
                  <td><span className={`chip ${r.status === "signed_up" ? "sent" : "won"}`}>{statusLabel(r.status)}</span></td>
                  <td>{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <div className="empty"><b>{tr("refer_empty_t")}</b>{tr("refer_empty_s")}</div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>{tr("refer_how_title")}</h3>
        <ol style={{ margin: "6px 0 0", paddingLeft: 20, color: "var(--ink)", lineHeight: 1.7, fontSize: 14 }}>
          <li>{tr("refer_how_1")}</li>
          <li>{tr("refer_how_2")}</li>
          <li>{tr("refer_how_3")}</li>
        </ol>
      </section>
    </div>
  );
}
