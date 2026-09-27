"use client";
// app/login/LoginForm.jsx — the interactive half of /login: email+password and
// Google sign-in via Supabase Auth, the language and theme controls, the toast.
// Strings arrive as `c` from the server page (app/login/copy.js), already in
// the visitor's language; switching language reloads the page in the new one.
//
// Bot protection: Cloudflare Turnstile, verified by Supabase Auth itself.
//   1. Cloudflare dashboard → Turnstile → add site → copy the SITE key into
//      NEXT_PUBLIC_TURNSTILE_SITE_KEY (Vercel env). The widget then appears
//      automatically; without the env var it is skipped (local dev just works).
//   2. Supabase dashboard → Authentication → Attack Protection → Enable
//      CAPTCHA → provider "Turnstile" → paste the SECRET key there.
//      Supabase then rejects any signup/sign-in without a valid token.
//
// Enumeration: every auth failure shows the same generic message per mode, so
// responses never reveal whether an email address has an account.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser.js";
import { LOGIN_LANGS, SITE_PATH } from "./copy.js";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

// Short notices read in 2.6 s; a sentence like the signup error needs longer.
const toastMs = (text) => Math.min(9000, Math.max(2600, text.length * 62));

// The language a visitor picked is remembered for the server (cookie, so the
// next /login renders in it straight away) and for the app (localStorage,
// which the error pages and Studio read).
function rememberLang(l) {
  try { localStorage.setItem("voltmira_lang", l); } catch {}
  document.cookie = `voltmira_lang=${l}; path=/; max-age=31536000; samesite=lax`;
}

export default function LoginForm({ lang, c, error = "" }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [sb] = useState(() => supabaseBrowser());
  const M = c.msg;

  // ---- toast ----
  const toastTimer = useRef(null);
  const toast = useCallback((text) => {
    if (!text) return;
    setMsg(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMsg(""), toastMs(text));
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Back from a Google round trip that didn't complete (/auth/callback sends ?error=auth).
  useEffect(() => { if (error && M[error]) toast(M[error]); }, [error, M, toast]);

  // The root layout renders <html lang="en">; screen readers should hear this page's language.
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // ---- theme ---- (the root layout's no-flash script already stamped data-theme)
  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("voltmira_theme", next); } catch {}
  }

  // ---- Turnstile widget ----
  const tsRef = useRef(null);          // container div
  const tsWidget = useRef(null);       // widget id for reset()
  const tsToken = useRef("");          // latest token

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    function render() {
      if (!tsRef.current || tsWidget.current !== null) return;
      tsWidget.current = window.turnstile.render(tsRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => { tsToken.current = token; },
        "expired-callback": () => { tsToken.current = ""; },
        "error-callback": () => { tsToken.current = ""; },
        appearance: "always",
        theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
        language: lang,
      });
    }
    if (window.turnstile) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
    return () => { tsWidget.current = null; };
  }, [lang]);

  function resetCaptcha() {
    tsToken.current = "";
    if (TURNSTILE_SITE_KEY && window.turnstile && tsWidget.current !== null) {
      try { window.turnstile.reset(tsWidget.current); } catch {}
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setMsg("");

    if (TURNSTILE_SITE_KEY && !tsToken.current) return toast(M.captcha);
    const captchaToken = tsToken.current || undefined;
    setBusy(true);

    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({
          email, password, options: { captchaToken },
        });
        if (error) { resetCaptcha(); return toast(M.signup); }
        const { error: e2 } = await sb.rpc("bootstrap_company", {
          company_name: company, user_name: "",
        });
        if (e2) return toast(M.setup);
        location.href = "/dashboard";
      } else {
        const { error } = await sb.auth.signInWithPassword({
          email, password, options: { captchaToken },
        });
        if (error) { resetCaptcha(); return toast(M.signin); }
        location.href = "/dashboard";
      }
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (busy) return;
    const addr = (email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return toast(M.reset_need_email);
    // Supabase enforces the CAPTCHA on password recovery too (not just sign-in),
    // so once Turnstile is enabled the reset request must carry a token or it
    // silently fails with "captcha protection: request disallowed".
    if (TURNSTILE_SITE_KEY && !tsToken.current) return toast(M.captcha);
    setBusy(true);
    try {
      // We mint and send the reset email ourselves via /api/forgot-password so
      // it's branded and comes from "VoltMira Support" instead of Supabase's
      // bare default template. The server uses an admin recovery link, which
      // /reset-password adopts on any device.
      await fetch("/api/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr, token: tsToken.current || undefined }),
      });
    } catch { /* ignore: same message either way */ } finally {
      resetCaptcha();   // Turnstile tokens are single-use
      setBusy(false);
      // Always the same message: a different reply for unknown emails would
      // let anyone probe which addresses have accounts.
      toast(M.reset_sent);
    }
  }

  async function google() {
    // Land on /auth/callback so the PKCE code is exchanged for a session before
    // hitting /dashboard (otherwise the OAuth round trip bounces to /login).
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
  }

  function switchMode(next) {
    if (next === mode) return;
    setMsg("");
    setMode(next);
  }

  // cosmetic only: 0-3 password strength, drawn in the three scenario colours
  const pwScore = !password ? 0
    : (password.length >= 8 ? 1 : 0)
    + (password.length >= 12 ? 1 : 0)
    + (/[A-Z]/.test(password) && /[0-9]/.test(password) ? 1 : 0);

  const isUp = mode === "signup";

  return (
    <>
      <section className="fp">
        <div className="fp-bar">
          <a className="fp-back" href={SITE_PATH[lang]}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            <span>{c.back}</span>
          </a>
          <nav className="langs" aria-label={c.lang}>
            {LOGIN_LANGS.map((l) => (
              <a key={l} href={`/login?lang=${l}`} hrefLang={l} lang={l} aria-current={l === lang ? "true" : undefined}
                 onClick={() => rememberLang(l)}>{l.toUpperCase()}</a>
            ))}
          </nav>
          <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={c.theme} title={c.theme}>
            <svg className="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
            </svg>
            <svg className="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
            </svg>
          </button>
        </div>

        <div className="fp-main">
          <form className="form" onSubmit={submit}>
            <h2 className="form-h">{isUp ? c.signup_h : c.signin_h}</h2>
            <p className="form-sub">{isUp ? c.signup_sub : c.signin_sub}</p>

            <div className={`seg ${isUp ? "up" : ""}`} role="tablist" aria-label={c.tabs_label}>
              <span className="seg-thumb" aria-hidden="true" />
              <button type="button" role="tab" aria-selected={!isUp} onClick={() => switchMode("signin")}>{c.tab_in}</button>
              <button type="button" role="tab" aria-selected={isUp} onClick={() => switchMode("signup")}>{c.tab_up}</button>
            </div>

            <div className={`company-slot ${isUp ? "open" : ""}`} aria-hidden={!isUp}>
              <div>
                <div className="field">
                  <label htmlFor="company">{c.company}</label>
                  <input id="company" placeholder={c.company_ph} value={company} autoComplete="organization"
                         onChange={e => setCompany(e.target.value)}
                         required={isUp} disabled={!isUp} tabIndex={isUp ? 0 : -1} />
                </div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="email">{c.email}</label>
              <input id="email" type="email" placeholder={c.email_ph} value={email}
                     onChange={e => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
            </div>

            <div className="field">
              <label htmlFor="password">{c.password}</label>
              <div className="pw-wrap">
                {/* autoComplete follows the mode so password managers offer to save a
                    new credential on signup instead of autofilling the old one. */}
                <input id="password" type={showPw ? "text" : "password"} placeholder="••••••••"
                       value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                       autoComplete={isUp ? "new-password" : "current-password"} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}
                        aria-label={showPw ? c.hide_label : c.show_label} aria-pressed={showPw}>
                  {showPw ? c.hide : c.show}
                </button>
              </div>
              {isUp && password && (
                <div className={`strength s${pwScore}`} aria-hidden="true"><i /><i /><i /></div>
              )}
              {!isUp && (
                <div className="pw-row">
                  <button type="button" className="link-btn" onClick={forgotPassword} disabled={busy}>{c.forgot}</button>
                </div>
              )}
            </div>

            {TURNSTILE_SITE_KEY && (
              <div ref={tsRef} style={{ marginBottom: 12, minHeight: 65 }} />
            )}

            <button className="btn btn-amber" type="submit" disabled={busy}>
              {busy ? c.busy : isUp ? c.submit_up : c.submit_in}
            </button>

            <div className="or-row">{c.or}</div>

            <button type="button" className="btn btn-line" onClick={google}>
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              {c.google}
            </button>

            <p className="switch-line">
              {isUp ? c.have_q : c.new_q}{" "}
              <button type="button" className="link-btn" onClick={() => switchMode(isUp ? "signin" : "signup")}>
                {isUp ? c.have_a : c.new_a}
              </button>
            </p>

            <p className="fine" dangerouslySetInnerHTML={{ __html: c.fine }} />
          </form>
        </div>
      </section>

      {/* Announced as well as shown: the toast is the only place auth errors surface. */}
      <div className={`toast ${msg ? "show" : ""}`} role="alert" aria-live="assertive">{msg}</div>
    </>
  );
}
