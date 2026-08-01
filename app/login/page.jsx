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
  /* brand pane uses var(--ink) as background — keep it dark when the theme flips */
  html[data-theme="dark"] .brand-pane{background:#080B09}
  *{box-sizing:border-box}
  .auth-shell{display:grid;grid-template-columns:minmax(400px,44%) 1fr;min-height:100vh;font-family:var(--b);color:var(--ink)}

  /* ---------------- left: brand pane ---------------- */
  .brand-pane{position:relative;overflow:hidden;background:var(--ink);color:var(--paper);
    display:flex;flex-direction:column;justify-content:space-between;padding:44px 48px}
  .brand-pane::before{content:"";position:absolute;right:-160px;top:-200px;width:560px;height:560px;border-radius:50%;
    background:radial-gradient(circle,rgba(232,155,45,.26),rgba(232,155,45,.06) 48%,transparent 70%);
    animation:drift 14s ease-in-out infinite alternate;pointer-events:none}
  @keyframes drift{from{transform:translate(0,0)}to{transform:translate(-34px,22px) scale(1.05)}}
  .brand-pane::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
  .bp-mid{position:relative;z-index:2;max-width:420px}
  .bp-top,.bp-foot{position:relative;z-index:2}
  .bp-kicker{font-family:var(--d);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--amber);
    display:inline-flex;align-items:center;gap:10px;margin-bottom:18px}
  .bp-kicker::before{content:"";width:24px;height:2px;background:var(--amber);border-radius:99px}
  .bp-h{font-family:var(--d);font-weight:700;font-size:clamp(30px,3vw,40px);line-height:1.06;letter-spacing:-.03em;margin:0 0 12px}
  .bp-h em{font-style:normal;color:var(--mint)}
  .bp-sub{color:rgba(246,245,240,.66);font-size:15px;line-height:1.6;margin:0 0 34px;max-width:380px}

  .bands{display:grid;gap:12px;max-width:380px}
  .band{display:grid;grid-template-columns:74px 1fr 52px;align-items:center;gap:12px;
    font-family:var(--d);font-size:12.5px;letter-spacing:.04em}
  .band .lbl{color:rgba(246,245,240,.55);text-transform:uppercase;font-size:10.5px;letter-spacing:.12em}
  .band .bar{height:10px;border-radius:99px;background:rgba(246,245,240,.08);overflow:hidden}
  .band .fill{height:100%;border-radius:99px;transform-origin:left;transform:scaleX(0);
    animation:grow 1s var(--ease) forwards}
  .band.p .fill{background:var(--red);width:94%;animation-delay:.25s}
  .band.e .fill{background:var(--amber);width:85%;animation-delay:.45s}
  .band.o .fill{background:#3FAE6A;width:79%;animation-delay:.65s}
  .band .val{font-weight:700;font-size:15px;text-align:right}
  .band.p .val{color:#E88D77}.band.e .val{color:var(--amber)}.band.o .val{color:var(--mint)}
  @keyframes grow{to{transform:scaleX(1)}}
  .bands-cap{display:flex;align-items:center;gap:8px;margin-top:16px;font-size:12px;color:rgba(246,245,240,.5)}
  .live-dot{width:7px;height:7px;border-radius:50%;background:#3FAE6A;flex:none;
    box-shadow:0 0 0 0 rgba(63,174,106,.5);animation:pulse 2s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(63,174,106,.45)}70%{box-shadow:0 0 0 8px rgba(63,174,106,0)}100%{box-shadow:0 0 0 0 rgba(63,174,106,0)}}

  .bp-quote{border-left:3px solid var(--amber);padding-left:14px;font-size:13.5px;line-height:1.55;
    color:rgba(246,245,240,.62);max-width:360px;margin:0 0 18px}
  .bp-meta{font-size:11.5px;letter-spacing:.08em;color:rgba(246,245,240,.4);text-transform:uppercase;font-family:var(--d)}

  /* ---------------- right: form pane ---------------- */
  .form-pane{position:relative;display:grid;place-items:center;background:var(--paper);padding:40px 24px}
  .form-pane::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.45;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .04 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
  .back-link{position:absolute;top:22px;right:28px;z-index:3;font-size:13px;font-weight:600;color:var(--muted);
    text-decoration:none;transition:color .2s}
  .back-link:hover{color:var(--ink)}
  .card-wrap{position:relative;z-index:2;width:min(430px,100%)}
  .mobile-brand{display:none;margin-bottom:22px}
  .card{background:var(--paper2);border:1px solid var(--line);border-radius:20px;padding:28px 28px 24px;
    box-shadow:0 24px 60px -22px rgba(20,42,33,.25);
    animation:cardUp .6s var(--ease) both}
  @keyframes cardUp{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
  .card-h{font-family:var(--d);font-weight:700;font-size:23px;letter-spacing:-.02em;margin:0 0 4px}
  .card-sub{color:var(--muted);font-size:13.5px;margin:0 0 20px}

  .seg{position:relative;display:grid;grid-template-columns:1fr 1fr;background:var(--paper);
    border:1px solid var(--line);border-radius:12px;padding:4px;margin-bottom:22px}
  .seg-thumb{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:9px;
    background:var(--ink);box-shadow:0 3px 10px rgba(20,42,33,.25);transition:transform .35s var(--spring)}
  .seg.signup .seg-thumb{transform:translateX(100%)}
  .seg button{position:relative;z-index:2;border:none;background:transparent;padding:10px 6px;cursor:pointer;
    font-family:var(--d);font-weight:600;font-size:14px;color:var(--muted);border-radius:9px;transition:color .25s}
  .seg button.on{color:var(--paper)}

  .field{margin-bottom:14px}
  .field label{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
    color:var(--muted);margin-bottom:7px;font-family:var(--d)}
  .field input{width:100%;padding:13px 14px;border-radius:12px;font-size:15px;font-family:var(--b);color:var(--ink);
    border:1.5px solid var(--line);background:var(--paper2);transition:border-color .25s,box-shadow .25s;outline:none}
  .field input:hover{border-color:#CBC7B6}
  .field input:focus{border-color:var(--green);box-shadow:0 0 0 4px rgba(30,107,78,.13)}
  .field input:-webkit-autofill{-webkit-box-shadow:0 0 0 40px #fff inset}
  .company-slot{overflow:hidden;max-height:0;opacity:0;transition:max-height .4s var(--ease),opacity .3s}
  .company-slot.open{max-height:110px;opacity:1}
  .pw-wrap{position:relative}
  .pw-wrap input{padding-right:74px}
  .pw-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;cursor:pointer;
    background:var(--paper);border-radius:8px;padding:6px 10px;font-size:11.5px;font-weight:600;color:var(--muted);
    font-family:var(--d);letter-spacing:.05em;transition:color .2s,background .2s}
  .pw-toggle:hover{color:var(--ink);background:var(--green-tint)}
  .strength{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px}
  .strength i{height:4px;border-radius:99px;background:var(--line);transition:background .3s}
  .strength.s1 i:nth-child(1){background:var(--red)}
  .strength.s2 i:nth-child(-n+2){background:var(--amber)}
  .strength.s3 i{background:#3FAE6A}

  .btn-solar{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:6px;
    padding:14px;border:none;border-radius:12px;background:var(--ink);color:var(--paper);cursor:pointer;
    font-family:var(--d);font-weight:700;font-size:15.5px;letter-spacing:-.01em;
    box-shadow:0 4px 18px rgba(20,42,33,.22);
    transition:transform .3s var(--spring),background .25s,box-shadow .25s,opacity .2s}
  .btn-solar:hover:not(:disabled){transform:translateY(-2px);background:var(--green-deep);box-shadow:0 10px 28px rgba(20,42,33,.3)}
  .btn-solar:active:not(:disabled){transform:scale(.98)}
  .btn-solar:disabled{opacity:.65;cursor:default}
  .btn-solar .arr{transition:transform .3s var(--ease)}
  .btn-solar:hover:not(:disabled) .arr{transform:translateX(4px)}

  .or-row{display:flex;align-items:center;gap:12px;margin:16px 0 12px;color:var(--muted);font-size:11.5px;
    font-family:var(--d);letter-spacing:.12em;text-transform:uppercase}
  .or-row::before,.or-row::after{content:"";flex:1;height:1px;background:var(--line)}
  .g-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:12px;
    border:1.5px solid var(--line);border-radius:12px;background:var(--paper2);cursor:pointer;
    font-family:var(--b);font-weight:600;font-size:14px;color:var(--ink-soft);
    transition:border-color .25s,box-shadow .25s,transform .2s}
  .g-btn:hover{border-color:#CBC7B6;box-shadow:0 6px 18px -8px rgba(20,42,33,.2);transform:translateY(-1px)}

  .err{display:flex;align-items:flex-start;gap:9px;margin:14px 0 0;padding:11px 13px;border-radius:11px;
    background:#FBEAE5;border:1px solid rgba(196,84,59,.35);color:#8E3B28;font-size:13px;line-height:1.45;
    animation:errIn .3s var(--ease)}
  @keyframes errIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  .err b{flex:none;width:17px;height:17px;border-radius:50%;background:var(--red);color:#fff;
    display:grid;place-items:center;font-size:11px;font-weight:700;margin-top:1px}

  .switch-line{font-size:13.5px;color:var(--muted);margin:18px 0 0;text-align:center}
  .switch-line a{color:var(--green);font-weight:600;text-decoration:none}
  .switch-line a:hover{text-decoration:underline;text-underline-offset:3px}
  .fine{margin:16px 0 0;text-align:center;font-size:11px;color:#9AA5A0}
  .fine a{color:var(--muted)}

  @media (max-width:900px){
    .auth-shell{grid-template-columns:1fr}
    .brand-pane{display:none}
    .mobile-brand{display:flex;justify-content:center}
    .back-link{position:static;display:block;text-align:center;margin-top:18px}
    .form-pane{align-content:center;padding:32px 18px}
  }
  @media (prefers-reduced-motion:reduce){
    .brand-pane::before,.live-dot{animation:none}
    .band .fill{animation-duration:.01ms}
    .card{animation:none}
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

        {/* ---------- left: the honesty engine ---------- */}
        <aside className="brand-pane" aria-hidden="true">
          <div className="bp-top"><Logo dark size={32} /></div>

          <div className="bp-mid">
            <span className="bp-kicker">The honesty engine</span>
            <h1 className="bp-h">Quotes your clients can <em>fact-check.</em></h1>
            <p className="bp-sub">One flattering number is a sales pitch. Three honest scenarios,
              computed from real PVGIS sun data, close roofs.</p>

            <div className="bands">
              <div className="band p"><span className="lbl">Pessim.</span><span className="bar"><span className="fill" /></span><span className="val">6.6 yr</span></div>
              <div className="band e"><span className="lbl">Expected</span><span className="bar"><span className="fill" /></span><span className="val">6.0 yr</span></div>
              <div className="band o"><span className="lbl">Optim.</span><span className="bar"><span className="fill" /></span><span className="val">5.7 yr</span></div>
            </div>
            <div className="bands-cap"><span className="live-dot" />Payback · București rooftop · live math</div>
          </div>

          <div className="bp-foot">
            <p className="bp-quote">"When your worst case still beats their electricity bill,
              the deal defends itself."</p>
            <span className="bp-meta">EU-hosted · GDPR · RO · MD · EU</span>
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
