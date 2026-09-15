// app/login/page.jsx — the sign-in / create-account page.
//
// Split deliberately in two. This file is a SERVER component and owns the
// static half: the stylesheet and the brand pane, including the inlined
// photograph. The interactive half — the form, its Supabase calls, Turnstile,
// the theme toggle and the toast — lives in LoginForm.jsx as a client
// component. Keeping the photo on this side of the boundary is the whole point
// of the split: importing hero-photo.js from the client component would send
// its ~332 KB down a second time inside the JS bundle.
//
// The markup and CSS below reproduce the supplied design as given.
import BrandPhoto from "./BrandPhoto.jsx";
import LoginForm from "./LoginForm.jsx";

export const metadata = {
  title: "Sign in — VoltMira",
  description: "Sign in to VoltMira, or create a free workspace for your solar business.",
  robots: { index: false, follow: true },
};

const CSS = `
:root{
  --paper:#F6F5F0; --paper2:#FFFFFF; --ink:#142A21; --ink-soft:#2B4438;
  --green:#1E6B4E; --green-deep:#0E4633; --green-tint:#E4EFE9; --mint:#7FDCA4;
  --amber:#E89B2D; --amber-deep:#C97F14; --amber-tint:#FBF0DD;
  --red:#C4543B; --muted:#66756C; --line:#E3E1D6;
  --d:'Inter Tight','Inter',system-ui,sans-serif; --b:'Inter',system-ui,sans-serif;
  --ease:cubic-bezier(.22,.9,.28,1); --spring:cubic-bezier(.34,1.56,.64,1);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --paper:#0F1310; --paper2:#171B16; --ink:#EEF1EA; --ink-soft:#C7D0C8;
    --green:#4FB584; --green-deep:#3FAE6A; --green-tint:rgba(79,181,132,.16); --mint:#7FDCA4;
    --amber:#EBA542; --amber-deep:#F2B85F; --amber-tint:rgba(232,155,45,.15);
    --red:#E0725A; --muted:#8E998F; --line:#28302A;
  }
}
:root[data-theme="dark"]{
  --paper:#0F1310; --paper2:#171B16; --ink:#EEF1EA; --ink-soft:#C7D0C8;
  --green:#4FB584; --green-deep:#3FAE6A; --green-tint:rgba(79,181,132,.16); --mint:#7FDCA4;
  --amber:#EBA542; --amber-deep:#F2B85F; --amber-tint:rgba(232,155,45,.15);
  --red:#E0725A; --muted:#8E998F; --line:#28302A;
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--b);color:var(--ink);background:var(--paper)}
::selection{background:var(--amber-tint)}
:focus-visible{outline:2px solid var(--amber);outline-offset:2px}

.auth-shell{display:grid;grid-template-columns:minmax(440px,48%) 1fr;min-height:100vh}

/* ---------------- left: brand pane ---------------- */
.brand-pane{position:relative;overflow:hidden;color:#F4F3EE;display:flex;flex-direction:column;justify-content:space-between;padding:60px 64px}
.bp-photo{position:absolute;inset:0;z-index:0}
.bp-photo img{width:100%;height:100%;object-fit:cover}
.bp-photo::after{content:"";position:absolute;inset:0;background:
  linear-gradient(175deg, rgba(9,21,16,.30) 0%, rgba(9,21,16,.87) 60%, rgba(9,21,16,.97) 100%),
  radial-gradient(120% 70% at 8% 0%, rgba(232,155,45,.20), transparent 46%)}
:root[data-theme="dark"] .bp-photo::after{background:
  linear-gradient(175deg, rgba(5,11,8,.42) 0%, rgba(5,11,8,.92) 60%, rgba(5,11,8,.98) 100%),
  radial-gradient(120% 70% at 8% 0%, rgba(232,155,45,.14), transparent 46%)}
.brand-pane::before{content:"";position:absolute;top:-240px;right:-240px;width:660px;height:660px;border-radius:50%;
  border:1px solid rgba(232,155,45,.20);pointer-events:none;z-index:1;
  box-shadow:0 0 160px rgba(232,155,45,.10),inset 0 0 130px rgba(232,155,45,.05)}
.brand-pane::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;z-index:1;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .045 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
.bp-top,.bp-mid,.bp-foot{position:relative;z-index:2}
.bp-logo{display:flex;align-items:center;gap:10px;font-family:var(--d);font-weight:800;font-size:20px;color:#fff}
.bp-mid{margin:auto 0;animation:bpIn .75s var(--ease) both}
@keyframes bpIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.bp-eyebrow{font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:rgba(244,243,238,.65);display:inline-flex;align-items:center;gap:12px;margin-bottom:28px;font-weight:700}
.bp-eyebrow::before{content:"";width:28px;height:1px;background:rgba(244,243,238,.5)}
.bp-h{font-family:var(--d);font-weight:800;font-size:clamp(38px,4.4vw,58px);line-height:1.02;letter-spacing:-.035em;margin:0;max-width:13ch}
.bp-h em{font-style:normal;color:var(--mint)}
.bp-sub{margin:26px 0 0;max-width:400px;font-size:15.5px;line-height:1.68;color:rgba(244,243,238,.72)}
.bp-sub b{color:#fff;font-weight:600}
.bp-foot{display:flex;flex-direction:column;gap:16px}
.bp-rule{width:54px;height:2px;border-radius:99px;background:linear-gradient(90deg,var(--amber),transparent)}
.bp-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11.5px;letter-spacing:.06em;color:rgba(244,243,238,.6)}
.bp-meta .dot{width:3px;height:3px;border-radius:50%;background:rgba(244,243,238,.4)}

/* ---------------- right: form pane ---------------- */
.form-pane{position:relative;display:grid;place-items:center;background:var(--paper);padding:40px 24px}
.form-pane::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.4;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .035 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
.top-bar{position:absolute;top:24px;right:30px;z-index:3;display:flex;align-items:center;gap:14px}
.back-link{font-size:13px;font-weight:600;color:var(--muted);text-decoration:none}
.back-link:hover{color:var(--ink)}
.theme-toggle{border:1px solid var(--line);background:var(--paper2);border-radius:9px;width:32px;height:32px;
  display:grid;place-items:center;cursor:pointer;color:var(--ink-soft);padding:0}
.theme-toggle:hover{color:var(--ink)}
.theme-toggle svg{width:16px;height:16px}
.theme-toggle .ic-sun{display:none}
:root[data-theme="dark"] .theme-toggle .ic-sun{display:block}
:root[data-theme="dark"] .theme-toggle .ic-moon{display:none}

.card-wrap{position:relative;z-index:2;width:min(432px,100%)}
.mobile-brand{display:none;margin-bottom:22px}
.card{position:relative;background:var(--paper2);border:1px solid var(--line);border-radius:24px;
  padding:30px 30px 26px;box-shadow:0 30px 70px -26px rgba(20,42,33,.28);overflow:hidden}
.card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,var(--green),var(--amber) 70%,var(--amber-deep))}
.card-h{font-family:var(--d);font-weight:800;font-size:24px;letter-spacing:-.025em;margin:0 0 5px}
.card-sub{color:var(--muted);font-size:13.5px;margin:0 0 22px;line-height:1.5}

.seg{position:relative;display:grid;grid-template-columns:1fr 1fr;background:var(--paper);border:1px solid var(--line);border-radius:13px;padding:4px;margin-bottom:22px}
.seg-thumb{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:10px;background:#142A21;box-shadow:0 4px 12px rgba(20,42,33,.28);transition:transform .38s var(--spring)}
:root[data-theme="dark"] .seg-thumb{background:#080B09}
.seg.signup .seg-thumb{transform:translateX(100%)}
.seg button{position:relative;z-index:2;border:none;background:transparent;padding:11px 6px;cursor:pointer;font-weight:600;font-size:14px;color:var(--muted);border-radius:10px;transition:color .25s;font-family:inherit}
.seg button.on{color:#F6F5F0}

.field{margin-bottom:15px}
.field label{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:7px}
.field input{width:100%;padding:14px;border-radius:13px;font-size:15px;font-family:var(--b);color:var(--ink);border:1.5px solid var(--line);background:var(--paper);transition:border-color .25s,box-shadow .25s,background .25s;outline:none}
.field input::placeholder{color:#A9B1AA}
.field input:hover{border-color:#CBC7B6}
.field input:focus{border-color:var(--green);background:var(--paper2);box-shadow:0 0 0 4px rgba(30,107,78,.14)}
.company-slot{overflow:hidden;max-height:0;opacity:0;transition:max-height .42s var(--ease),opacity .3s}
.company-slot.open{max-height:120px;opacity:1}
.pw-wrap{position:relative}
.pw-wrap input{padding-right:76px}
.pw-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;cursor:pointer;background:var(--paper);border-radius:9px;padding:7px 11px;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.06em}
.pw-toggle:hover{color:var(--green-deep);background:var(--green-tint)}
.forgot-btn{background:none;border:none;padding:6px 0 0;cursor:pointer;color:var(--green);font-size:12.5px;font-weight:600;text-align:left;font-family:inherit}
.strength{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:9px}
.strength i{height:4px;border-radius:99px;background:var(--line);display:block}
.strength.s1 i:nth-child(1){background:var(--red)}
.strength.s2 i:nth-child(-n+2){background:var(--amber)}
.strength.s3 i{background:#3FAE6A}

.btn-solar{position:relative;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:8px;padding:15px;border:none;border-radius:13px;cursor:pointer;overflow:hidden;
  background:linear-gradient(135deg,#0E4633,#142A21);color:#F6F5F0;font-weight:700;font-size:15.5px;letter-spacing:-.01em;box-shadow:0 6px 20px -4px rgba(14,70,51,.45);transition:transform .3s var(--spring),box-shadow .25s,opacity .2s}
.btn-solar::after{content:"";position:absolute;top:0;left:-60%;width:45%;height:100%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transition:left .55s var(--ease)}
.btn-solar:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 34px -8px rgba(14,70,51,.55)}
.btn-solar:hover:not(:disabled)::after{left:130%}
.btn-solar:active:not(:disabled){transform:scale(.985)}
.btn-solar:disabled{opacity:.65;cursor:default}
.btn-solar .arr{transition:transform .3s var(--ease)}
.btn-solar:hover:not(:disabled) .arr{transform:translateX(4px)}

.or-row{display:flex;align-items:center;gap:12px;margin:18px 0 13px;color:var(--muted);font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
.or-row::before,.or-row::after{content:"";flex:1;height:1px;background:var(--line)}
.g-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:13px;border:1.5px solid var(--line);border-radius:13px;background:var(--paper2);cursor:pointer;font-weight:600;font-size:14px;color:var(--ink-soft);transition:border-color .25s,box-shadow .25s,transform .2s}
.g-btn:hover{border-color:#CBC7B6;box-shadow:0 8px 20px -10px rgba(20,42,33,.25);transform:translateY(-1px)}

.switch-line{font-size:13.5px;color:var(--muted);margin:20px 0 0;text-align:center}
.switch-line button{background:none;border:none;color:var(--green);font-weight:700;cursor:pointer;font-size:13.5px;font-family:inherit;text-decoration:underline;text-underline-offset:3px}
.fine{margin:15px 0 0;text-align:center;font-size:11px;color:var(--muted);opacity:.85}
.fine a{color:var(--muted)}

.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,90px);background:#142A21;color:#fff;font-size:13.5px;font-weight:500;padding:13px 18px;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.28);z-index:600;transition:transform .32s cubic-bezier(.2,.9,.3,1.2);max-width:calc(100vw - 36px)}
.toast.show{transform:translate(-50%,0)}

@media (max-width:900px){
  .auth-shell{grid-template-columns:1fr}
  .brand-pane{display:none}
  .mobile-brand{display:flex;justify-content:center}
  .top-bar{position:static;justify-content:center;margin-top:18px}
  .form-pane{align-content:center;padding:32px 18px}
}
@media (prefers-reduced-motion:reduce){
  .bp-mid,.card{animation:none}
  .btn-solar::after{display:none}
}
`;

export default function LoginPage() {
  return (
    <>
      {/* dangerouslySetInnerHTML, not <style>{CSS}</style>: React escapes text
          children, so the served CSS came out with &#x27; and &quot; inside
          font-family and url(...). A <style> element is raw text, so those
          entities stayed literal — breaking those declarations and tripping a
          hydration mismatch. Same pattern the root layout uses for THEME_VARS. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="auth-shell">

        {/* ---------- left: brand pane (static, server-rendered) ---------- */}
        <aside className="brand-pane" aria-hidden="true">
          <BrandPhoto />

          <div className="bp-top">
            <div className="bp-logo">
              <svg width="32" height="32" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                <rect width="34" height="34" rx="8" fill="#142A21" />
                <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
                <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
                <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
                <circle cx="20.5" cy="9" r="2.1" fill="#E89B2D" />
              </svg>
              <span>VoltMira</span>
            </div>
          </div>

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

        {/* ---------- right: the form, and everything interactive ---------- */}
        <LoginForm />
      </main>
    </>
  );
}
