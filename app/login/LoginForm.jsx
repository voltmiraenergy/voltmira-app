"use client";
// app/login/LoginForm.jsx — the interactive half of /login: email+password and
// Google sign-in via Supabase Auth, the theme toggle and the toast.
//
// The markup here reproduces the supplied design. Everything it left as a
// placeholder ("wire it to your real Supabase auth") is wired to the real
// calls, and two controls the design did not draw are kept because they are
// not decoration:
//   * the Turnstile container, without which Supabase rejects every auth call
//     once CAPTCHA is enabled on the project;
//   * the signup password-strength meter, which the design's own stylesheet
//     still carries rules for (.strength).
//
// Bot protection: Cloudflare Turnstile, verified by Supabase Auth itself.
//   1. Cloudflare dashboard → Turnstile → add site → copy the SITE key into
//      NEXT_PUBLIC_TURNSTILE_SITE_KEY (Vercel env) — the widget appears
//      automatically; without the env var it is skipped (local dev just works).
//   2. Supabase dashboard → Authentication → Attack Protection → Enable
//      CAPTCHA → provider "Turnstile" → paste the SECRET key there.
//      Supabase then rejects any signup/sign-in without a valid token.
//
// Enumeration: every auth failure shows the same generic message per mode, so
// responses never reveal whether an email address has an account.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser, supabaseRecovery } from "../../lib/supabase-browser.js";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

const MSG = {
  signin: "Email or password is incorrect.",
  signup: "We couldn't create an account with these details. If you've signed up before, use Sign in instead.",
  captcha: "Please complete the verification below.",
  setup: "Your account is ready but workspace setup hit a snag — sign in to finish.",
  reset_need_email: "Type your email above first, then press Forgot password.",
  // Same message whether or not the account exists — never confirm an email to a stranger.
  reset_sent: "If an account exists for that email, a reset link is on its way. Check spam too.",
};

// The design dismisses the toast after 2.6s, which is comfortable for a short
// notice and too fast for a sentence like MSG.signup. Scale with the message
// and keep the floor at the designed timing.
const toastMs = (text) => Math.min(9000, Math.max(2600, text.length * 62));

export default function LoginForm() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [dark, setDark] = useState(false);
  const sb = supabaseBrowser();

  // ---- toast ----
  const toastTimer = useRef(null);
  const toast = useCallback((text) => {
    if (!text) return;
    setMsg(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMsg(""), toastMs(text));
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ---- theme ----
  // The root layout already ran the no-flash script and stamped data-theme
  // before paint, so this only has to read what it decided.
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setDark(next === "dark");
    try { localStorage.setItem("voltmira_theme", next); } catch {}
  }

  // ---- Turnstile widget ----
  const tsRef = useRef(null);          // container div
  const tsWidget = useRef(null);       // widget id for reset()
  const tsToken = useRef("");          // latest token

  // Referral capture: if the visitor arrived via …/login?ref=CODE, remember it in
  // a 30-day cookie. After they create their workspace, the dashboard attributes
  // the signup to that referrer. Survives the Google OAuth round-trip (same domain).
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[a-z0-9]{4,16}$/i.test(ref)) {
        document.cookie = `vm_ref=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      }
    } catch {}
  }, []);

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
        theme: "light",
      });
    }
    if (window.turnstile) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
    return () => { tsWidget.current = null; };
  }, []);

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

    if (TURNSTILE_SITE_KEY && !tsToken.current) return toast(MSG.captcha);
    const captchaToken = tsToken.current || undefined;
    setBusy(true);

    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({
          email, password, options: { captchaToken },
        });
        if (error) { resetCaptcha(); return toast(MSG.signup); }
        const { error: e2 } = await sb.rpc("bootstrap_company", {
          company_name: company, user_name: "",
        });
        if (e2) return toast(MSG.setup);
        location.href = "/dashboard";
      } else {
        const { error } = await sb.auth.signInWithPassword({
          email, password, options: { captchaToken },
        });
        if (error) { resetCaptcha(); return toast(MSG.signin); }
        location.href = "/dashboard";
      }
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (busy) return;
    const addr = (email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return toast(MSG.reset_need_email);
    // Supabase enforces the CAPTCHA on password recovery too (not just sign-in),
    // so once Turnstile is enabled the reset request must carry a token or it
    // silently fails with "captcha protection: request disallowed".
    if (TURNSTILE_SITE_KEY && !tsToken.current) return toast(MSG.captcha);
    setBusy(true);
    try {
      // Asked for over the IMPLICIT flow on purpose: PKCE would tie the link to
      // this browser's code_verifier, so opening the mail on a phone after
      // requesting it on a laptop dead-ended at /login?error=auth. Implicit puts
      // the session in the URL hash, which /reset-password adopts on any device.
      await supabaseRecovery().auth.resetPasswordForEmail(addr, {
        captchaToken: tsToken.current || undefined,
        redirectTo: `${location.origin}/reset-password`,
      });
    } catch { /* ignore — same message either way */ } finally {
      resetCaptcha();   // Turnstile tokens are single-use — clear it for the next action
      setBusy(false);
      // Always the same message — a different reply for unknown emails would
      // let anyone probe which addresses have accounts.
      toast(MSG.reset_sent);
    }
  }

  async function google() {
    // Land on /auth/callback so the PKCE code is exchanged for a session before
    // hitting /dashboard (otherwise the OAuth round-trip just bounces to /login).
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

  // cosmetic only: 0–3 password strength for the signup meter
  const pwScore = !password ? 0
    : (password.length >= 8 ? 1 : 0)
    + (password.length >= 12 ? 1 : 0)
    + (/[A-Z]/.test(password) && /[0-9]/.test(password) ? 1 : 0);

  const isUp = mode === "signup";

  return (
    <>
      <section className="form-pane">
        <div className="top-bar">
          <a className="back-link" href="https://voltmira.com">← voltmira.com</a>
          <button className="theme-toggle" type="button" onClick={toggleTheme}
                  aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
            <svg className="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
            <svg className="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
            </svg>
          </button>
        </div>

        <div className="card-wrap">
          <div className="mobile-brand">
            <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <rect width="34" height="34" rx="8" fill="#142A21" />
              <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="20.5" cy="9" r="2.1" fill="#E89B2D" />
            </svg>
          </div>

          <form className="card" onSubmit={submit}>
            <h2 className="card-h">{isUp ? "Create your workspace" : "Welcome back"}</h2>
            <p className="card-sub">
              {isUp ? "Free early access — no card, honest math from minute one."
                    : "Sign in to your quotes, clients and pipeline."}
            </p>

            <div className={`seg ${isUp ? "signup" : ""}`} role="tablist" aria-label="Sign in or create account">
              <span className="seg-thumb" aria-hidden="true" />
              <button type="button" role="tab" aria-selected={!isUp} className={!isUp ? "on" : ""}
                      onClick={() => switchMode("signin")}>Sign in</button>
              <button type="button" role="tab" aria-selected={isUp} className={isUp ? "on" : ""}
                      onClick={() => switchMode("signup")}>Create account</button>
            </div>

            <div className={`company-slot ${isUp ? "open" : ""}`}>
              <div className="field">
                <label htmlFor="company">Company name</label>
                <input id="company" placeholder="SolarTech SRL" value={company}
                       onChange={e => setCompany(e.target.value)}
                       required={isUp} disabled={!isUp} tabIndex={isUp ? 0 : -1} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" placeholder="you@yourcompany.ro" value={email}
                     onChange={e => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="pw-wrap">
                {/* autoComplete follows the mode so password managers offer to save a
                    new credential on signup instead of autofilling the old one. */}
                <input id="password" type={showPw ? "text" : "password"} placeholder="••••••••"
                       value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                       autoComplete={isUp ? "new-password" : "current-password"} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}
                        aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? "HIDE" : "SHOW"}
                </button>
              </div>
              {!isUp && (
                <button type="button" className="forgot-btn" onClick={forgotPassword} disabled={busy}>
                  Forgot password?
                </button>
              )}
              {isUp && password && (
                <div className={`strength s${pwScore}`} aria-hidden="true"><i /><i /><i /></div>
              )}
            </div>

            {TURNSTILE_SITE_KEY && (
              <div ref={tsRef} style={{ marginBottom: 12, minHeight: 65 }} />
            )}

            <button className="btn-solar" type="submit" disabled={busy}>
              {busy ? "One moment…" : isUp ? "Create account" : "Sign in"}
              {!busy && <span className="arr">→</span>}
            </button>

            <div className="or-row">or</div>

            <button type="button" className="g-btn" onClick={google}>
              <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              Continue with Google
            </button>

            <p className="switch-line">
              {isUp ? "Already have an account? " : "New to VoltMira? "}
              <button type="button" onClick={() => switchMode(isUp ? "signin" : "signup")}>
                {isUp ? "Sign in" : "Create one — it's free"}
              </button>
            </p>

            <p className="fine">
              By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
            </p>
          </form>
        </div>
      </section>

      {/* Announced as well as shown: the toast is the only place auth errors surface. */}
      <div className={`toast ${msg ? "show" : ""}`} role="alert" aria-live="assertive">{msg}</div>
    </>
  );
}
