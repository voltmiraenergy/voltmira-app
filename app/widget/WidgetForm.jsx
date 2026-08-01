"use client";
// app/widget/WidgetForm.jsx — the lead form itself. `lang` is resolved on the
// server from the installer's company setting (see page.jsx), so a homeowner on
// a Romanian installer's site reads Romanian without the embed passing anything.
import { useState } from "react";
import { t } from "../../lib/i18n.js";

export default function WidgetForm({ companyId, lang }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", address: "", bill: "", email: "", phone: "", message: "", website: "" });

  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    const res = await fetch("/api/widget-lead", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, ...f }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) setSent(true);
    else setErr(t("wg_err", lang));
  }

  const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3E1D6",
    fontSize: 14, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!companyId) return <p style={{ padding: 20, color: "#C4543B" }}>{t("wg_missing_id", lang)}</p>;
  if (sent) return (
    <div style={{ textAlign: "center", padding: "30px 10px" }}>
      <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#E4EFE9", color: "#1E6B4E",
        display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 26 }}>✓</div>
      <h2 style={{ fontFamily: "Inter", margin: "0 0 6px" }}>{t("wg_thanks", lang)}</h2>
      <p style={{ color: "#66756C", fontSize: 14 }}>{t("wg_thanks_sub", lang)}</p>
    </div>
  );

  return (
    <form onSubmit={submit}>
      <h2 style={{ fontFamily: "Inter", letterSpacing: "-0.02em", margin: "0 0 4px" }}>
        {t("wg_title", lang)}</h2>
      <p style={{ color: "#66756C", fontSize: 13.5, margin: "0 0 16px" }}>
        {t("wg_sub", lang)}</p>
      <input style={input} placeholder={t("wg_name", lang)} value={f.name} onChange={set("name")} required />
      <input style={input} placeholder={t("wg_addr", lang)} value={f.address} onChange={set("address")} />
      <input style={input} placeholder={t("wg_bill", lang)} type="number" value={f.bill} onChange={set("bill")} />
      <input style={input} placeholder={t("wg_email", lang)} type="email" value={f.email} onChange={set("email")} />
      <input style={input} placeholder={t("wg_phone", lang)} type="tel" value={f.phone} onChange={set("phone")} />
      <textarea style={{ ...input, minHeight: 54 }} placeholder={t("wg_msg", lang)} value={f.message} onChange={set("message")} />
      {/* honeypot — bots fill it, humans never see it */}
      <input style={{ position: "absolute", left: -9999 }} tabIndex={-1} autoComplete="off"
             value={f.website} onChange={set("website")} placeholder="website" />
      {err && <p style={{ color: "#C4543B", fontSize: 13 }}>{err}</p>}
      <button disabled={busy} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none",
        background: "#E89B2D", color: "#142A21", fontWeight: 700, fontSize: 15, cursor: "pointer",
        opacity: busy ? 0.7 : 1 }}>
        {busy ? t("wg_sending", lang) : t("wg_send", lang)}
      </button>
      <p style={{ textAlign: "center", color: "#66756C", fontSize: 11, marginTop: 12 }}>
        {t("wg_powered", lang)}</p>
    </form>
  );
}
