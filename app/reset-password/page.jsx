"use client";
// app/reset-password/page.jsx — where BOTH the password-reset email and the team
// invite land. The link carries a token in the URL hash; supabase-js exchanges it
// for a session automatically on load, after which updateUser({password}) works.
//
// An invited teammate is setting their FIRST password, not resetting one, so the
// copy follows `type` from the callback hash. Language comes from localStorage
// (stashed by the app layout) then the browser — an invitee has neither on a
// fresh device, so English is the fallback, same as the error boundary.
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser.js";
import { t } from "../../lib/i18n.js";

function detectLang() {
  try {
    const s = localStorage.getItem("voltmira_lang");
    if (s === "en" || s === "ro" || s === "ru") return s;
  } catch { /* ignore */ }
  try {
    const n = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (n === "ro" || n === "ru") return n;
  } catch { /* ignore */ }
  return "en";
}

// Supabase puts the flow type in the hash (implicit) or the query (PKCE).
function detectInvite() {
  try {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    const q = new URLSearchParams(location.search);
    return (h.get("type") || q.get("type")) === "invite";
  } catch { return false; }
}

export default function ResetPassword() {
  // One client for the lifetime of the page — calling supabaseBrowser() straight
  // in the body would mint a fresh one on every render.
  const [sb] = useState(() => supabaseBrowser());
  const [lang, setLang] = useState("en");
  const [invite, setInvite] = useState(false);
  const [ready, setReady] = useState(false);   // recovery session established?
  const [linkErr, setLinkErr] = useState("");  // Supabase said the link itself is bad
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Read the hash before supabase-js has any chance to clear it.
    setInvite(detectInvite());
    setLang(detectLang());
    document.title = "VoltMira";

    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");
    const hashErr = h.get("error_description") || h.get("error");

    if (hashErr) { setLinkErr(hashErr.replace(/\+/g, " ")); return; }

    if (access_token && refresh_token) {
      // THE INVITE PATH. Our client runs the PKCE flow (the @supabase/ssr
      // default), and a PKCE client deliberately ignores an implicit-grant hash
      // — which is exactly what an admin-generated invite link comes back as,
      // since no code_verifier was ever created in THIS browser. So
      // detectSessionInUrl silently does nothing and the page looks "expired"
      // while a perfectly good token sits in the URL. Adopt it by hand instead.
      sb.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (error) return setLinkErr(error.message);
        setReady(true);
        // Don't leave credentials in the address bar / history.
        history.replaceState(null, "", location.pathname + location.search);
      });
      return;
    }

    // Browser-initiated reset (?code=…, PKCE) or an already-signed-in visitor.
    sb.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    // Match on the session, not the event name: a session recovered from the URL
    // arrives as INITIAL_SESSION on current supabase-js, not SIGNED_IN.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    if (pw.length < 8) return setMsg(t("rp_min8", lang));
    if (pw !== pw2) return setMsg(t("rp_nomatch", lang));
    setBusy(true);
    try {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) return setMsg(error.message);
      setDone(true);
      setTimeout(() => { location.href = "/dashboard"; }, 1500);
    } finally {
      setBusy(false);
    }
  }

  const input = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--app-line)",
    fontSize: 15, boxSizing: "border-box", background: "var(--app-surface)", color: "var(--app-text)" };
  const lbl = { fontSize: 13, fontWeight: 600, color: "var(--app-muted)", display: "block", margin: "14px 0 6px" };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--app-bg)",
      fontFamily: "Inter, system-ui, sans-serif", padding: 18 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "var(--app-surface)", border: "1px solid var(--app-line)",
        borderRadius: 16, padding: "30px 26px", color: "var(--app-text)" }}>
        <h1 style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 22, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
          {t(invite ? "rp_title_invite" : "rp_title_reset", lang)}</h1>
        {invite && !done && ready && (
          <p style={{ color: "var(--app-muted)", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 4px" }}>
            {t("rp_sub_invite", lang)}</p>
        )}

        {done ? (
          <p style={{ color: "var(--app-ok)", fontWeight: 600 }}>{t("rp_done", lang)}</p>
        ) : !ready ? (
          <>
            <p style={{ color: "var(--app-muted)", fontSize: 14, lineHeight: 1.6 }}>
              {t("rp_expired", lang)} <a href="/login" style={{ color: "var(--app-ok)" }}>{t("rp_signin_page", lang)}</a>.
            </p>
            {/* Never swallow the reason again — a silent "expired" here cost real
                debugging time when the token was actually fine. */}
            {linkErr && <p style={{ color: "var(--app-bad)", fontSize: 12.5, marginTop: 10, wordBreak: "break-word" }}>{linkErr}</p>}
          </>
        ) : (
          <form onSubmit={submit}>
            <label style={lbl} htmlFor="npw">{t("rp_new_pw", lang)}</label>
            <input id="npw" style={input} type="password" value={pw} onChange={e => setPw(e.target.value)}
                   minLength={8} required autoComplete="new-password" />
            <label style={lbl} htmlFor="npw2">{t("rp_repeat", lang)}</label>
            <input id="npw2" style={input} type="password" value={pw2} onChange={e => setPw2(e.target.value)}
                   minLength={8} required autoComplete="new-password" />
            {msg && <p style={{ color: "var(--app-bad)", fontSize: 13, margin: "10px 0 0" }}>{msg}</p>}
            <button disabled={busy} style={{ width: "100%", marginTop: 18, padding: 13, borderRadius: 10, border: "none",
              background: "#1E6B4E", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
              opacity: busy ? 0.7 : 1 }}>
              {busy ? t("rp_saving", lang) : t("rp_save", lang)}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
