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
import Logo from "../../lib/Logo.jsx";
import Link from "next/link";

function detectLang() {
  try {
    const s = localStorage.getItem("voltmira_lang");
    if (s === "en" || s === "ro" || s === "ru" || s === "uk") return s;
  } catch { /* ignore */ }
  try {
    const n = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (n === "ro" || n === "ru" || n === "uk") return n;
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
  const [show, setShow] = useState(false);
  // a moment to read the link before saying it does not work (it used to flash "expired" while loading)
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Read the hash before supabase-js has any chance to clear it.
    setInvite(detectInvite());
    setLang(detectLang());
    document.title = "VoltMira";

    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");
    const hashErr = h.get("error_description") || h.get("error");

    const stop = setTimeout(() => setChecking(false), 2500);
    if (hashErr) { setLinkErr(hashErr.replace(/\+/g, " ")); setChecking(false); return () => clearTimeout(stop); }

    if (access_token && refresh_token) {
      // THE INVITE PATH. Our client runs the PKCE flow (the @supabase/ssr
      // default), and a PKCE client deliberately ignores an implicit-grant hash
      // — which is exactly what an admin-generated invite link comes back as,
      // since no code_verifier was ever created in THIS browser. So
      // detectSessionInUrl silently does nothing and the page looks "expired"
      // while a perfectly good token sits in the URL. Adopt it by hand instead.
      sb.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        setChecking(false);
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
    return () => { clearTimeout(stop); sub.subscription.unsubscribe(); };
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

  // how strong the new password is: -1 nothing typed, 0 too short, then 1 fair, 2 good, 3 strong
  const extras = (pw.length >= 12 ? 1 : 0) + (/\d/.test(pw) ? 1 : 0) + (/[a-z]/.test(pw) && /[A-Z]/.test(pw) ? 1 : 0);
  const level = !pw ? -1 : pw.length < 8 ? 0 : Math.min(3, 1 + Math.max(0, extras - 1));

  return (
    <main className="rp">
      <style>{CSS}</style>
      <Link className="rp-logo" href="/" aria-label="VoltMira"><Logo size={32} /></Link>
      <section className="rp-card" aria-live="polite">
        <div className="rp-band" aria-hidden="true"><i /><i /><i /></div>
        <header className="rp-head">
          <span className="rp-kicker">{t(invite ? "rp_kicker_invite" : "rp_kicker_reset", lang)}</span>
          <h1>{done ? t("rp_done_h", lang) : ready || checking ? t(invite ? "rp_title_invite" : "rp_title_reset", lang) : t("rp_expired_h", lang)}</h1>
          {!done && ready && <p>{t(invite ? "rp_sub_invite" : "rp_lead_reset", lang)}</p>}
        </header>

        <div className="rp-body">
          {done ? (
            <p className="rp-done">{t("rp_done", lang)}</p>
          ) : !ready ? (
            checking ? (
              <p className="rp-muted">{t("rp_checking", lang)}</p>
            ) : (
              <>
                <p className="rp-muted">{t("rp_expired_p", lang)}</p>
                <Link className="rp-btn" href="/login">{t("rp_new_link", lang)}</Link>
                {/* never swallow the reason: a silent "expired" once hid a perfectly good token */}
                {linkErr && <p className="rp-err rp-reason">{linkErr}</p>}
              </>
            )
          ) : (
            <form onSubmit={submit} noValidate>
              <label className="rp-lbl" htmlFor="npw">{t("rp_new_pw", lang)}</label>
              <div className="rp-pw">
                <input id="npw" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)}
                  minLength={8} required autoComplete="new-password" autoFocus />
                <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}>{t(show ? "rp_hide" : "rp_show", lang)}</button>
              </div>
              <div className={"rp-meter l" + Math.max(0, level)} aria-hidden={level < 0}>
                <span><i /><i /><i /></span>
                {level >= 0 && <b>{t("rp_str_" + level, lang)}</b>}
              </div>
              <p className="rp-tip">{t("rp_tip", lang)}</p>

              <label className="rp-lbl rp-lbl2" htmlFor="npw2">{t("rp_repeat", lang)}</label>
              <div className="rp-pw">
                <input id="npw2" type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)}
                  minLength={8} required autoComplete="new-password" />
              </div>
              {pw2 && pw2 === pw && pw.length >= 8 && <p className="rp-ok">{t("rp_match", lang)}</p>}
              {msg && <p className="rp-err" role="alert">{msg}</p>}
              <button className="rp-btn" disabled={busy} aria-busy={busy}>{busy ? t("rp_saving", lang) : t("rp_save", lang)}</button>
            </form>
          )}
        </div>
      </section>
      <p className="rp-foot">VoltMira, Chișinău, Republica Moldova</p>
    </main>
  );
}

const CSS = `
.rp{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:28px 16px;
  background:var(--app-bg);font-family:'Inter',system-ui,sans-serif;color:var(--app-text);box-sizing:border-box}
.rp-logo{display:inline-flex;padding:6px 10px;border-radius:12px;background:var(--logo-plate);text-decoration:none}
.rp-card{width:100%;max-width:440px;background:var(--app-surface);border:1px solid var(--app-line);border-radius:20px;overflow:hidden;
  box-shadow:0 18px 50px rgba(20,42,33,.10)}
.rp-band{display:flex;height:5px}.rp-band i{flex:1}
.rp-band i:nth-child(1){background:#C4543B}.rp-band i:nth-child(2){background:#E89B2D}.rp-band i:nth-child(3){background:#3FAE6A}
.rp-head{padding:26px 28px 24px;background:#142A21;background-image:linear-gradient(135deg,#142A21 0%,#1B3A2C 60%,#24503A 100%);color:#fff}
.rp-kicker{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#E89B2D}
.rp-head h1{margin:8px 0 0;font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-.02em;text-wrap:balance}
.rp-head p{margin:10px 0 0;font-size:14.5px;line-height:1.55;color:#C9D6CE}
.rp-body{padding:24px 28px 28px}
.rp-lbl{display:block;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--app-muted);margin:0 0 7px}
.rp-lbl2{margin-top:18px}
.rp-pw{display:flex;align-items:center;height:50px;border:1.5px solid var(--app-line);border-radius:12px;background:var(--app-bg);transition:border-color .2s,box-shadow .2s}
.rp-pw:focus-within{border-color:var(--app-ok);box-shadow:0 0 0 4px var(--app-ok-tint);background:var(--app-surface)}
.rp-pw input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;padding:0 14px;font:500 15.5px 'Inter',system-ui,sans-serif;color:var(--app-text)}
.rp-pw button{flex:none;border:0;background:none;padding:0 14px;height:100%;font:600 13px 'Inter',system-ui,sans-serif;color:var(--app-muted);cursor:pointer}
.rp-pw button:hover{color:var(--app-text)}
.rp-meter{display:flex;align-items:center;gap:10px;margin-top:10px;min-height:16px}
.rp-meter span{display:flex;gap:4px;flex:1}
.rp-meter span i{flex:1;height:5px;border-radius:99px;background:var(--app-line);transition:background .25s}
.rp-meter b{font-size:12px;font-weight:700;min-width:80px;text-align:right}
.rp-meter.l0 span i:nth-child(1){background:var(--app-bad)} .rp-meter.l0 b{color:var(--app-bad)}
.rp-meter.l1 span i:nth-child(1){background:#E89B2D} .rp-meter.l1 b{color:var(--app-warn-ink)}
.rp-meter.l2 span i:nth-child(-n+2){background:#3FAE6A} .rp-meter.l2 b{color:var(--app-ok)}
.rp-meter.l3 span i{background:var(--app-ok)} .rp-meter.l3 b{color:var(--app-ok)}
.rp-tip{margin:8px 0 0;font-size:12.5px;line-height:1.5;color:var(--app-muted)}
.rp-ok{margin:9px 0 0;font-size:13px;font-weight:600;color:var(--app-ok)}
.rp-err{margin:10px 0 0;font-size:13px;font-weight:600;color:var(--app-bad)}
.rp-reason{font-weight:500;font-size:12px;word-break:break-word}
.rp-muted{margin:0;font-size:14.5px;line-height:1.6;color:var(--app-muted)}
.rp-done{margin:0;font-size:15px;font-weight:600;color:var(--app-ok)}
.rp-btn{display:flex;align-items:center;justify-content:center;width:100%;height:52px;margin-top:22px;border:0;border-radius:12px;
  background:#E89B2D;color:#1B1305;font:700 15.5px 'Inter',system-ui,sans-serif;text-decoration:none;cursor:pointer;
  box-shadow:0 8px 20px rgba(232,155,45,.30);transition:background .2s,transform .1s}
.rp-btn:hover{background:#F0A945}.rp-btn:active{transform:translateY(1px)}
.rp-btn[disabled]{opacity:.7;cursor:progress}
.rp-btn:focus-visible,.rp-pw button:focus-visible,.rp-logo:focus-visible{outline:2.5px solid #E89B2D;outline-offset:3px}
.rp-foot{margin:0;font-size:12px;color:var(--app-muted)}
@media (prefers-reduced-motion:reduce){.rp-btn,.rp-meter span i,.rp-pw{transition:none}}
`;
