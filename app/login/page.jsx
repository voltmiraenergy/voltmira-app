"use client";
// app/login/page.jsx — email+password and Google sign-in via Supabase Auth.
// On first sign-in, bootstrap_company() creates the tenant + owner profile.
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

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser.js";
import Logo from "../../lib/Logo.jsx";

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

const CSS = `
  :root{
    --paper:#F6F5F0; --paper2:#FFFFFF; --ink:#142A21; --ink-soft:#2B4438;
    --green:#1E6B4E; --green-deep:#0E4633; --green-tint:#E4EFE9; --mint:#7FDCA4;
    --amber:#E89B2D; --amber-deep:#C97F14; --amber-tint:#FBF0DD;
    --red:#C4543B; --muted:#66756C; --line:#E3E1D6;
    --d:'Inter',system-ui,sans-serif; --b:'Inter',system-ui,sans-serif;
    --ease:cubic-bezier(.22,.9,.28,1); --spring:cubic-bezier(.34,1.56,.64,1);
  }
  html[data-theme="dark"]{
    --paper:#0F1310; --paper2:#171B16; --ink:#EEF1EA; --ink-soft:#C7D0C8;
    --green:#4FB584; --green-deep:#3FAE6A; --green-tint:rgba(79,181,132,.16); --mint:#7FDCA4;
    --amber:#EBA542; --amber-deep:#F2B85F; --amber-tint:rgba(232,155,45,.15);
    --red:#E0725A; --muted:#8E998F; --line:#28302A;
  }
  *{box-sizing:border-box}
  .auth-shell{display:grid;grid-template-columns:minmax(440px,48%) 1fr;min-height:100vh;
    font-family:var(--b);color:var(--ink);background:var(--paper)}

  /* ---------------- left: brand pane — minimal editorial ---------------- */
  .brand-pane{position:relative;overflow:hidden;color:#F4F3EE;
    display:flex;flex-direction:column;justify-content:space-between;padding:60px 64px;
    background:
      radial-gradient(115% 80% at 6% 0%, rgba(232,155,45,.15), transparent 44%),
      radial-gradient(120% 115% at 104% 108%, rgba(63,174,106,.17), transparent 52%),
      linear-gradient(160deg,#153021 0%,#0E241B 52%,#091510 100%)}
  html[data-theme="dark"] .brand-pane{background:
      radial-gradient(115% 80% at 6% 0%, rgba(232,155,45,.11), transparent 44%),
      radial-gradient(120% 115% at 104% 108%, rgba(63,174,106,.13), transparent 52%),
      linear-gradient(160deg,#0C1610 0%,#070F0B 58%,#050B08 100%)}
  /* one editorial mark: an oversized faint sun ring, off-canvas top-right */
  .brand-pane::before{content:"";position:absolute;top:-240px;right:-240px;width:660px;height:660px;border-radius:50%;
    border:1px solid rgba(232,155,45,.20);pointer-events:none;
    box-shadow:0 0 160px rgba(232,155,45,.10),inset 0 0 130px rgba(232,155,45,.05)}
  /* fine film grain for a printed, non-flat feel */
  .brand-pane::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .045 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
  .bp-top,.bp-mid,.bp-foot{position:relative;z-index:2}
  .bp-mid{margin:auto 0;animation:bpIn .75s var(--ease) both}
  @keyframes bpIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .bp-eyebrow{font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:rgba(244,243,238,.5);
    display:inline-flex;align-items:center;gap:12px;margin-bottom:30px;font-weight:600}
  .bp-eyebrow::before{content:"";width:28px;height:1px;background:rgba(244,243,238,.4)}
  .bp-h{font-weight:700;font-size:clamp(40px,4.7vw,62px);line-height:1.01;letter-spacing:-.042em;margin:0;max-width:13ch}
  .bp-h em{font-style:normal;color:var(--mint)}
  .bp-sub{margin:28px 0 0;max-width:400px;font-size:15.5px;line-height:1.68;color:rgba(244,243,238,.6)}
  .bp-sub b{color:#fff;font-weight:600}

  .bp-foot{display:flex;flex-direction:column;gap:16px}
  .bp-rule{width:54px;height:2px;border-radius:99px;background:linear-gradient(90deg,var(--amber),transparent)}
  .bp-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11.5px;
    letter-spacing:.06em;color:rgba(244,243,238,.5)}
  .bp-meta svg{opacity:.7}
  .bp-meta .dot{width:3px;height:3px;border-radius:50%;background:rgba(244,243,238,.32)}

  /* ---------------- right: form pane ---------------- */
  .form-pane{position:relative;display:grid;place-items:center;background:var(--paper);padding:40px 24px}
  .form-pane::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.4;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .035 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
  .back-link{position:absolute;top:24px;right:30px;z-index:3;font-size:13px;font-weight:600;color:var(--muted);
    text-decoration:none;transition:color .2s}
  .back-link:hover{color:var(--ink)}
  .card-wrap{position:relative;z-index:2;width:min(432px,100%)}
  .mobile-brand{display:none;margin-bottom:22px}
  .card{position:relative;background:var(--paper2);border:1px solid var(--line);border-radius:24px;
    padding:30px 30px 26px;box-shadow:0 30px 70px -26px rgba(20,42,33,.28);overflow:hidden;
    animation:cardUp .6s var(--ease) both}
  /* hairline brand accent along the very top of the card */
  .card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;
    background:linear-gradient(90deg,var(--green),var(--amber) 70%,var(--amber-deep))}
  @keyframes cardUp{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
  .card-h{font-weight:700;font-size:24px;letter-spacing:-.025em;margin:0 0 5px}
  .card-sub{color:var(--muted);font-size:13.5px;margin:0 0 22px;line-height:1.5}

  .seg{position:relative;display:grid;grid-template-columns:1fr 1fr;background:var(--paper);
    border:1px solid var(--line);border-radius:13px;padding:4px;margin-bottom:22px}
  .seg-thumb{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:10px;
    background:var(--ink);box-shadow:0 4px 12px rgba(20,42,33,.28);transition:transform .38s var(--spring)}
  .seg.signup .seg-thumb{transform:translateX(100%)}
  .seg button{position:relative;z-index:2;border:none;background:transparent;padding:11px 6px;cursor:pointer;
    font-weight:600;font-size:14px;color:var(--muted);border-radius:10px;transition:color .25s}
  .seg button.on{color:var(--paper)}

  .field{margin-bottom:15px}
  .field label{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
    color:var(--muted);margin-bottom:7px}
  .field input{width:100%;padding:14px;border-radius:13px;font-size:15px;font-family:var(--b);color:var(--ink);
    border:1.5px solid var(--line);background:var(--paper);transition:border-color .25s,box-shadow .25s,background .25s;outline:none}
  .field input::placeholder{color:#A9B1AA}
  .field input:hover{border-color:#CBC7B6}
  .field input:focus{border-color:var(--green);background:var(--paper2);box-shadow:0 0 0 4px rgba(30,107,78,.14)}
  .field input:-webkit-autofill{-webkit-box-shadow:0 0 0 40px var(--paper2) inset;-webkit-text-fill-color:var(--ink)}
  .company-slot{overflow:hidden;max-height:0;opacity:0;transition:max-height .42s var(--ease),opacity .3s}
  .company-slot.open{max-height:120px;opacity:1}
  .pw-wrap{position:relative}
  .pw-wrap input{padding-right:76px}
  .pw-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;cursor:pointer;
    background:var(--paper);border-radius:9px;padding:7px 11px;font-size:11px;font-weight:700;color:var(--muted);
    letter-spacing:.06em;transition:color .2s,background .2s}
  .pw-toggle:hover{color:var(--green-deep);background:var(--green-tint)}
  .strength{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:9px}
  .strength i{height:4px;border-radius:99px;background:var(--line);transition:background .3s}
  .strength.s1 i:nth-child(1){background:var(--red)}
  .strength.s2 i:nth-child(-n+2){background:var(--amber)}
  .strength.s3 i{background:#3FAE6A}

  .btn-solar{position:relative;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px;
    margin-top:8px;padding:15px;border:none;border-radius:13px;cursor:pointer;overflow:hidden;
    background:linear-gradient(135deg,var(--green-deep),var(--ink));color:var(--paper);
    font-weight:700;font-size:15.5px;letter-spacing:-.01em;
    box-shadow:0 6px 20px -4px rgba(14,70,51,.45);
    transition:transform .3s var(--spring),box-shadow .25s,opacity .2s}
  /* moving sheen on hover */
  .btn-solar::after{content:"";position:absolute;top:0;left:-60%;width:45%;height:100%;transform:skewX(-20deg);
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transition:left .55s var(--ease)}
  .btn-solar:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 34px -8px rgba(14,70,51,.55)}
  .btn-solar:hover:not(:disabled)::after{left:130%}
  .btn-solar:active:not(:disabled){transform:scale(.985)}
  .btn-solar:disabled{opacity:.6;cursor:default}
  .btn-solar .arr{transition:transform .3s var(--ease)}
  .btn-solar:hover:not(:disabled) .arr{transform:translateX(4px)}

  .or-row{display:flex;align-items:center;gap:12px;margin:18px 0 13px;color:var(--muted);font-size:11px;
    letter-spacing:.12em;text-transform:uppercase;font-weight:600}
  .or-row::before,.or-row::after{content:"";flex:1;height:1px;background:var(--line)}
  .g-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:13px;
    border:1.5px solid var(--line);border-radius:13px;background:var(--paper2);cursor:pointer;
    font-weight:600;font-size:14px;color:var(--ink-soft);
    transition:border-color .25s,box-shadow .25s,transform .2s}
  .g-btn:hover{border-color:#CBC7B6;box-shadow:0 8px 20px -10px rgba(20,42,33,.25);transform:translateY(-1px)}

  .err{display:flex;align-items:flex-start;gap:9px;margin:15px 0 0;padding:12px 13px;border-radius:12px;
    background:var(--amber-tint);border:1px solid rgba(196,84,59,.32);color:#8E3B28;font-size:13px;line-height:1.45;
    animation:errIn .3s var(--ease)}
  html[data-theme="dark"] .err{background:rgba(224,114,90,.14);color:#F0A794}
  @keyframes errIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  .err b{flex:none;width:18px;height:18px;border-radius:50%;background:var(--red);color:#fff;
    display:grid;place-items:center;font-size:11px;font-weight:700;margin-top:1px}

  .switch-line{font-size:13.5px;color:var(--muted);margin:20px 0 0;text-align:center}
  .switch-line a{color:var(--green);font-weight:600;text-decoration:none}
  .switch-line a:hover{text-decoration:underline;text-underline-offset:3px}
  .fine{margin:15px 0 0;text-align:center;font-size:11px;color:var(--muted);opacity:.85}
  .fine a{color:var(--muted);text-underline-offset:2px}

  @media (max-width:900px){
    .auth-shell{grid-template-columns:1fr}
    .brand-pane{display:none}
    .mobile-brand{display:flex;justify-content:center}
    .back-link{position:static;display:block;text-align:center;margin-top:18px}
    .form-pane{align-content:center;padding:32px 18px}
  }
  @media (prefers-reduced-motion:reduce){
    .bp-mid,.card{animation:none}
    .btn-solar::after{display:none}
  }
`;

export default function Login() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const sb = supabaseBrowser();

  // ---- Turnstile widget ----
  const tsRef = useRef(null);          // container div
  const tsWidget = useRef(null);       // widget id for reset()
  const tsToken = useRef("");          // latest token

  useEffect(() => { document.title = "Sign in — VoltMira"; }, []);

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

    if (TURNSTILE_SITE_KEY && !tsToken.current) return setMsg(MSG.captcha);
    const captchaToken = tsToken.current || undefined;
    setBusy(true);

    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({
          email, password, options: { captchaToken },
        });
        if (error) { resetCaptcha(); return setMsg(MSG.signup); }
        const { error: e2 } = await sb.rpc("bootstrap_company", {
          company_name: company, user_name: "",
        });
        if (e2) return setMsg(MSG.setup);
        location.href = "/dashboard";
      } else {
        const { error } = await sb.auth.signInWithPassword({
          email, password, options: { captchaToken },
        });
        if (error) { resetCaptcha(); return setMsg(MSG.signin); }
        location.href = "/dashboard";
      }
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (busy) return;
    const addr = (email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return setMsg(MSG.reset_need_email);
    // Supabase enforces the CAPTCHA on password recovery too (not just sign-in),
    // so once Turnstile is enabled the reset request must carry a token or it
    // silently fails with "captcha protection: request disallowed".
    if (TURNSTILE_SITE_KEY && !tsToken.current) return setMsg(MSG.captcha);
    setBusy(true);
    try {
      // Same browser sets the PKCE verifier cookie; the email link lands on
      // /auth/callback which exchanges the code for a recovery session, then
      // forwards to /reset-password where updateUser({password}) works.
      await sb.auth.resetPasswordForEmail(addr, {
        captchaToken: tsToken.current || undefined,
        redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
      });
    } catch { /* ignore — same message either way */ } finally {
      resetCaptcha();   // Turnstile tokens are single-use — clear it for the next action
      setBusy(false);
      // Always the same message — a different reply for unknown emails would
      // let anyone probe which addresses have accounts.
      setMsg(MSG.reset_sent);
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
      <style>{CSS}</style>
      <main className="auth-shell">

        {/* ---------- left: minimal editorial brand pane ---------- */}
        <aside className="brand-pane" aria-hidden="true">
          <div className="bp-top"><Logo dark size={32} /></div>

          <div className="bp-mid">
            <span className="bp-eyebrow">The solar sales workspace</span>
            <h1 className="bp-h">Solar sales,<br />minus the <em>guesswork.</em></h1>
            <p className="bp-sub">Quote in minutes. Send proposals your clients trust. Watch every
              deal move from <b>lead</b> to <b>won</b> — all in one place.</p>
          </div>

          <div className="bp-foot">
            <span className="bp-rule" />
            <span className="bp-meta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              EU-hosted <span className="dot" /> GDPR-ready <span className="dot" /> RO · MD · EU
            </span>
          </div>
        </aside>

        {/* ---------- right: the form ---------- */}
        <section className="form-pane">
          <a className="back-link" href="https://voltmira.com">← voltmira.com</a>

          <div className="card-wrap">
            <div className="mobile-brand"><Logo size={30} /></div>

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
                  <input id="password" type={showPw ? "text" : "password"} placeholder="••••••••"
                         value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                         autoComplete={isUp ? "new-password" : "current-password"} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}
                          aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? "HIDE" : "SHOW"}
                  </button>
                </div>
                {!isUp && (
                  <button type="button" onClick={forgotPassword} disabled={busy}
                    style={{ background: "none", border: "none", padding: "6px 0 0", cursor: "pointer",
                      color: "#1E6B4E", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>
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

              <button className="btn-solar" disabled={busy}>
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

              {msg && <p role="alert" className="err"><b>!</b>{msg}</p>}

              <p className="switch-line">
                {isUp ? "Already have an account? " : "New to VoltMira? "}
                <a href="#" onClick={e => { e.preventDefault(); switchMode(isUp ? "signin" : "signup"); }}>
                  {isUp ? "Sign in" : "Create one — it's free"}
                </a>
              </p>

              <p className="fine">
                By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
              </p>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
