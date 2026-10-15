"use client";
// app/(app)/settings/LeadAssistant.jsx — where the lead assistant
// (lib/leadAgent.js) talks to homeowners: the website chat to embed, and the
// installer's own Telegram bots. Says plainly what's still missing on the
// server (API key, encryption key, a public HTTPS address) instead of
// offering a button that can't work yet.
import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n.js";

async function call(url, init) {
  try {
    const r = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, body: { error: "network" } };
  }
}

const ERR = {
  bad_token: "la_err_token", auth: "la_err_token", needs_https: "la_err_https", no_secret_key: "la_err_key",
  not_migrated: "la_err_migrate", webhook: "la_err_webhook", network: "la_err_network", forbidden: "la_err_forbidden", rate_limited: "la_err_rate",
};

export default function LeadAssistant({ lang }) {
  const [data, setData] = useState(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  async function load() {
    const r = await call("/api/agent/channels");
    setData(r.ok ? r.body : { error: true });
  }
  useEffect(() => { load(); }, []);

  if (!data) return <p className="set-note">{t("loading", lang)}</p>;
  if (data.error) return <p className="set-note">{t("la_err_load", lang)}</p>;

  const snippet = `<iframe src="${data.chatUrl.startsWith("http") ? data.chatUrl : (typeof location !== "undefined" ? location.origin : "") + data.chatUrl}" width="400" height="600" style="border:none;max-width:100%"></iframe>`;

  async function connect(e) {
    e.preventDefault();
    if (busy || !token.trim()) return;
    setBusy(true); setErr("");
    const r = await call("/api/agent/channels", { method: "POST", body: JSON.stringify({ token: token.trim() }) });
    setBusy(false);
    if (!r.ok) { setErr(t(ERR[r.body.error] || "la_err_generic", lang)); return; }
    setToken("");
    await load();
  }
  async function remove(id) {
    const r = await call(`/api/agent/channels/${id}`, { method: "DELETE" });
    setConfirmId(null);
    if (!r.ok) { setErr(t(ERR[r.body.error] || "la_err_generic", lang)); return; }
    await load();
  }

  const blockers = [
    !data.agentConfigured && t("la_need_ai", lang),
  ].filter(Boolean);
  const tgBlockers = [
    !data.migrated && t("la_err_migrate", lang),
    !data.keyConfigured && t("la_err_key", lang),
    !data.publicUrl && t("la_err_https", lang),
    !data.canManage && t("la_err_forbidden", lang),
  ].filter(Boolean);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
      {blockers.map((b) => <p key={b} className="set-note" style={{ margin: 0, background: "var(--amber-tint)", borderRadius: 10, padding: "9px 12px" }}>{b}</p>)}

      <div>
        <div className="st-glabel first">{t("la_web", lang)}</div>
        <p className="st-desc" style={{ marginBottom: 10 }}>{t("la_web_note", lang)}</p>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
          <code className="embed-code" style={{ flex: "1 1 280px", minWidth: 0, whiteSpace: "nowrap", overflowX: "auto" }}>{snippet}</code>
          <button type="button" className={copied ? "btn primary" : "btn ghost"}
            onClick={() => { navigator.clipboard?.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
            {copied ? t("s_copied", lang) : t("s_copy", lang)}
          </button>
          <a className="btn ghost" href={data.chatUrl} target="_blank" rel="noopener noreferrer">{t("la_open_chat", lang)}</a>
        </div>
      </div>

      <div>
        <div className="st-glabel first">Telegram</div>
        <p className="st-desc" style={{ marginBottom: 10 }}>{t("la_tg_note", lang)}</p>
        {data.channels.length > 0 && (
          <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0, display: "grid", gap: 8 }}>
            {data.channels.map((c) => (
              <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }}>
                <span className="st-cdot" style={{ background: c.status === "ok" ? "var(--green)" : "var(--red)" }} />
                <b style={{ fontSize: 14 }}>@{c.bot_username || "bot"}</b>
                <a href={`https://t.me/${c.bot_username}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--green)" }}>t.me/{c.bot_username}</a>
                {c.status !== "ok" && c.last_error && <span style={{ fontSize: 12, color: "var(--red)", flexBasis: "100%" }}>{c.last_error}</span>}
                <span style={{ flex: 1 }} />
                {data.canManage && (confirmId === c.id ? (
                  <>
                    <button type="button" className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(c.id)}>{t("la_disconnect_yes", lang)}</button>
                    <button type="button" className="btn ghost sm" onClick={() => setConfirmId(null)}>{t("lead_cancel", lang)}</button>
                  </>
                ) : (
                  <button type="button" className="btn ghost sm" onClick={() => setConfirmId(c.id)}>{t("la_disconnect", lang)}</button>
                ))}
              </li>
            ))}
          </ul>
        )}
        {tgBlockers.length > 0 ? (
          tgBlockers.map((b) => <p key={b} className="set-note" style={{ margin: "0 0 6px" }}>{b}</p>)
        ) : (
          <form onSubmit={connect} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ flex: "1 1 280px", margin: 0 }}>
              <label htmlFor="iTgToken">{t("la_tg_token", lang)}</label>
              <input className="input" id="iTgToken" type="password" autoComplete="new-password" spellCheck={false}
                placeholder="123456789:AA…" value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <button type="submit" className="btn primary" disabled={busy || !token.trim()}>{busy ? t("la_connecting", lang) : t("la_connect", lang)}</button>
          </form>
        )}
        {err && <p className="set-note" style={{ color: "var(--red)", margin: "8px 0 0" }} role="alert">{err}</p>}
      </div>

      <p className="set-note" style={{ margin: 0 }}>{t("la_other", lang)}</p>
    </div>
  );
}
