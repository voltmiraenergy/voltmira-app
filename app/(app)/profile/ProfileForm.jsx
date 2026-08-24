"use client";
// app/(app)/profile/ProfileForm.jsx — edit your own name, phone, title and avatar.
// The avatar is downscaled and stored inline (data URL) like the company logo, so
// no storage bucket is needed. Password change sends a real reset link by email.
import { useState } from "react";
import { supabaseBrowser, supabaseRecovery } from "../../../lib/supabase-browser.js";
import { saveProfile } from "../../../lib/actions.js";
import { t } from "../../../lib/i18n.js";

export default function ProfileForm({ lang, email, companyName, initial }) {
  const sb = supabaseBrowser();
  const [name, setName] = useState(initial.name || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [title, setTitle] = useState(["sales", "engineer", "manager"].includes(initial.title) ? initial.title : "sales");
  const [avatar, setAvatar] = useState(initial.avatar_url || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const isOwner = initial.role === "owner";
  const hasAvatar = /^(https:\/\/|data:image\/)/i.test(avatar || "");

  function onFile(e) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg(t("pf_bad", lang)); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 256, sc = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        setAvatar(cv.toDataURL("image/png"));
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  async function save() {
    setBusy(true); setMsg(t("pf_saving", lang));
    try { await saveProfile({ name, phone, title, avatar_url: avatar }); setMsg(t("pf_saved", lang)); }
    catch (e) { setMsg(e.message || "Error"); }
    finally { setBusy(false); }
  }

  async function resetPw() {
    setPwMsg(t("pf_pw_sending", lang));
    try {
      // Implicit-flow request + land straight on /reset-password, so the link
      // still works when it's opened on a different device than it was asked for.
      await supabaseRecovery().auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/reset-password" });
    } catch { /* same message regardless */ }
    setPwMsg(t("pf_pw_sent", lang));
  }

  return (
    <div style={{ maxWidth: 660, margin: "0 auto" }}>
      <div className="page-head">
        <h1>{t("pf_title", lang)}</h1>
        <span className="sub">{t("pf_sub", lang, { co: companyName })}</span>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3>{t("pf_personal", lang)}</h3>
        <div className="field"><label>{t("pf_avatar", lang)}</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {hasAvatar
              ? <img src={avatar} alt="" style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
              : <span style={{ width: 58, height: 58, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--green-tint)", color: "var(--green)", fontWeight: 700, fontSize: 21 }}>{(name || email || "?").trim()[0]?.toUpperCase() || "?"}</span>}
            <label className="btn ghost" style={{ cursor: "pointer" }}>
              {t("pf_upload", lang)}
              <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
            </label>
            {hasAvatar && <button type="button" className="btn ghost" onClick={() => setAvatar("")}>{t("pf_remove", lang)}</button>}
          </div>
        </div>
        <div className="set-grid">
          <div className="field"><label>{t("pf_name", lang)}</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Alexandru Popescu" /></div>
          <div className="field"><label>{t("pf_phone", lang)}</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+373 …" /></div>
        </div>
        <div className="field"><label>{t("pf_position", lang)}</label>
          {isOwner
            ? <input className="input" value={t("role_owner", lang)} disabled />
            : <select className="input" value={title} onChange={e => setTitle(e.target.value)}>
                <option value="sales">{t("role_sales", lang)}</option>
                <option value="engineer">{t("role_engineer", lang)}</option>
                <option value="manager">{t("role_manager", lang)}</option>
              </select>}
        </div>
        <div className="set-note">{t("pf_note", lang)}</div>
        <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn primary" disabled={busy} onClick={save}>{t("pf_save", lang)}</button>
          {msg && <span style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</span>}
        </div>
      </section>

      <section className="card">
        <h3>{t("pf_security", lang)}</h3>
        <div className="field"><label>{t("pf_email", lang)}</label>
          <input className="input" value={email} disabled /></div>
        <p className="set-note" style={{ margin: "0 0 12px" }}>{t("pf_pw_note", lang)}</p>
        <button type="button" className="btn ghost" onClick={resetPw}>{t("pf_pw_btn", lang)}</button>
        {pwMsg && <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0 0" }}>{pwMsg}</p>}
      </section>
    </div>
  );
}
