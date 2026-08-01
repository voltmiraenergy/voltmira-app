"use client";
// app/reset-password/page.jsx — where the Supabase recovery email lands.
// The link carries a recovery token in the URL hash; supabase-js exchanges it
// for a session automatically on load, after which updateUser({password}) works.
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser.js";

export default function ResetPassword() {
  const sb = supabaseBrowser();
  const [ready, setReady] = useState(false);   // recovery session established?
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Reset password — VoltMira";
    // Session may already be set by the time we mount, or arrive a moment later.
    sb.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    if (pw.length < 8) return setMsg("Password must be at least 8 characters.");
    if (pw !== pw2) return setMsg("Passwords don't match.");
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
          Set a new password</h1>

        {done ? (
          <p style={{ color: "var(--app-ok)", fontWeight: 600 }}>Password updated — taking you to your dashboard…</p>
        ) : !ready ? (
          <p style={{ color: "var(--app-muted)", fontSize: 14, lineHeight: 1.6 }}>
            This page only works from the link in a password-reset email.
            If yours has expired, request a new one from the <a href="/login" style={{ color: "var(--app-ok)" }}>sign-in page</a>.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label style={lbl} htmlFor="npw">New password</label>
            <input id="npw" style={input} type="password" value={pw} onChange={e => setPw(e.target.value)}
                   minLength={8} required autoComplete="new-password" />
            <label style={lbl} htmlFor="npw2">Repeat it</label>
            <input id="npw2" style={input} type="password" value={pw2} onChange={e => setPw2(e.target.value)}
                   minLength={8} required autoComplete="new-password" />
            {msg && <p style={{ color: "var(--app-bad)", fontSize: 13, margin: "10px 0 0" }}>{msg}</p>}
            <button disabled={busy} style={{ width: "100%", marginTop: 18, padding: 13, borderRadius: 10, border: "none",
              background: "#1E6B4E", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
              opacity: busy ? 0.7 : 1 }}>
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
