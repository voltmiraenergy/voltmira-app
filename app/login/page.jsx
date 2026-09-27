// app/login/page.jsx — the sign-in / create-account page, in the homepage's
// design language (landing v6): the same rooftop photograph and overlay, the
// same type (Manrope for the headline, Inter Tight for display, Inter for
// reading) and the amber call to action.
//
// Split in two. This SERVER component owns the static half: language choice,
// the stylesheet and the photo pane. The interactive half (Supabase auth,
// Turnstile, Google, the theme and language controls, the toast) lives in
// LoginForm.jsx. The photo is a normal file served through next/image, so a
// phone downloads a phone-sized copy; it used to be a 332 KB base64 string
// inlined into the page and the JS bundle.
import Image from "next/image";
import { cookies, headers } from "next/headers";
import LoginForm from "./LoginForm.jsx";
import { COPY, pickLoginLang } from "./copy.js";

function langFor(searchParams) {
  return pickLoginLang(
    searchParams?.lang,
    cookies().get("voltmira_lang")?.value,
    headers().get("accept-language"),
  );
}

export function generateMetadata({ searchParams }) {
  const c = COPY[langFor(searchParams)];
  return {
    title: c.meta_title,
    description: c.meta_desc,
    robots: { index: false, follow: true },
  };
}

const CSS = `
:root{
  --paper:#F6F5F0; --paper-2:#FFFFFF; --paper-3:#EEECE4;
  --ink:#142A21; --ink-2:#2E473B; --muted:#66756C;
  --line:#E3E1D6; --line-2:#D3D0C3;
  --green:#1E6B4E; --green-tint:#E4EFE9;
  --amber:#E89B2D; --amber-hover:#F0A945; --amber-tint:#FBF0DD; --on-amber:#1B1305;
  --pess:#C4543B; --expc:#E89B2D; --opti:#2E9A5E;
  --f-d:'Inter Tight',Inter,system-ui,sans-serif;
  --f-b:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  --f-h:'Manrope','Inter Tight',Inter,system-ui,sans-serif;
  --ease:cubic-bezier(.22,.9,.28,1); --ease-out:cubic-bezier(.16,1,.3,1);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --paper:#0F1310; --paper-2:#161B16; --paper-3:#121712;
    --ink:#EEF1EA; --ink-2:#C7D0C8; --muted:#8E998F;
    --line:#26302A; --line-2:#34403A;
    --green:#4FB584; --green-tint:rgba(79,181,132,.14);
    --amber:#EBA542; --amber-hover:#F2B85F; --amber-tint:rgba(232,155,45,.14);
    --pess:#E0725A; --expc:#EBA542; --opti:#4FB584;
  }
}
:root[data-theme="dark"]{
  --paper:#0F1310; --paper-2:#161B16; --paper-3:#121712;
  --ink:#EEF1EA; --ink-2:#C7D0C8; --muted:#8E998F;
  --line:#26302A; --line-2:#34403A;
  --green:#4FB584; --green-tint:rgba(79,181,132,.14);
  --amber:#EBA542; --amber-hover:#F2B85F; --amber-tint:rgba(232,155,45,.14);
  --pess:#E0725A; --expc:#EBA542; --opti:#4FB584;
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:var(--f-b);color:var(--ink);background:var(--paper-2);-webkit-font-smoothing:antialiased}
::selection{background:var(--amber-tint)}
:focus-visible{outline:2.5px solid var(--amber);outline-offset:3px;border-radius:6px}

.auth{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);min-height:100dvh}

/* ---------------- the photo pane ---------------- */
.lp{position:relative;isolation:isolate;overflow:hidden;color:#fff;background:#0B1510;
  display:flex;flex-direction:column;padding:clamp(28px,4vw,48px) clamp(28px,4.4vw,64px)}
.lp-photo{position:absolute;inset:0;z-index:-1}
.lp-photo img{object-fit:cover;object-position:50% 30%}
.lp-photo::after{content:"";position:absolute;inset:0;background:
  linear-gradient(90deg,rgba(7,14,10,.74) 0%,rgba(7,14,10,.42) 55%,rgba(7,14,10,.2) 100%),
  linear-gradient(180deg,rgba(7,14,10,.34) 0%,rgba(7,14,10,0) 26%,rgba(7,14,10,.36) 62%,rgba(7,14,10,.9) 100%)}
.lp-logo{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#fff;
  font-family:var(--f-d);font-weight:800;font-size:20px;letter-spacing:-.02em;align-self:flex-start}
.lp-logo .m{color:#7FDCA4}
.lp-logo svg{border-radius:8px;box-shadow:0 0 0 1px rgba(255,255,255,.22)}
.lp-copy{margin:auto 0 0;padding-top:48px}
.lp-h{font-family:var(--f-h);font-weight:800;font-size:clamp(40px,4.3vw,64px);line-height:1.03;letter-spacing:-.03em;
  margin:0 0 20px;max-width:12ch;text-wrap:balance;text-shadow:0 2px 30px rgba(0,0,0,.25)}
.lang-ru .lp-h{font-size:clamp(36px,3.8vw,56px)}
.lp-h .hl{color:var(--amber)}
.lp-lead{font-family:var(--f-h);font-size:clamp(16px,1.25vw,18px);line-height:1.55;color:rgba(255,255,255,.86);max-width:44ch;margin:0}
/* desktop: the headline sits in the middle of the photo; the logo stays in its corner */
@media (min-width:901px){
  .lp{justify-content:center}
  .lp-logo{position:absolute;top:clamp(28px,4vw,48px);left:clamp(28px,4.4vw,64px)}
  .lp-copy{margin:0 auto;padding-top:0;text-align:center}
  .lp-h,.lp-lead{margin-inline:auto}
  .lp-photo::after{background:
    radial-gradient(ellipse 72% 48% at 50% 50%,rgba(7,14,10,.5) 0%,rgba(7,14,10,.18) 100%),
    linear-gradient(180deg,rgba(7,14,10,.42) 0%,rgba(7,14,10,.34) 50%,rgba(7,14,10,.62) 100%)}
}

/* ---------------- the form pane ---------------- */
.fp{position:relative;display:flex;flex-direction:column;background:var(--paper-2);padding:22px clamp(18px,4vw,56px) 28px}
.fp-bar{display:flex;align-items:center;gap:10px}
.fp-back{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:var(--muted);text-decoration:none;margin-right:auto;min-height:40px}
.fp-back:hover{color:var(--ink)}
.fp-back svg{width:16px;height:16px}
.langs{display:flex;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--paper)}
.langs a{min-width:36px;height:32px;display:grid;place-items:center;border-radius:8px;font-size:12px;font-weight:700;letter-spacing:.04em;
  color:var(--muted);text-decoration:none;transition:color .2s,background-color .2s}
.langs a:hover{color:var(--ink)}
.langs a[aria-current="true"]{background:var(--paper-2);color:var(--ink);box-shadow:0 1px 3px rgba(20,42,33,.14)}
.icon-btn{width:40px;height:40px;border-radius:10px;border:1px solid var(--line);background:var(--paper-2);color:var(--ink-2);
  display:grid;place-items:center;cursor:pointer;padding:0;transition:border-color .2s,color .2s}
.icon-btn:hover{border-color:var(--ink);color:var(--ink)}
.icon-btn svg{width:18px;height:18px}
.icon-btn .ic-sun{display:none}
:root[data-theme="dark"] .icon-btn .ic-sun{display:block}
:root[data-theme="dark"] .icon-btn .ic-moon{display:none}

.fp-main{flex:1;display:grid;place-items:center;padding:40px 0 24px}
.form{width:min(420px,100%)}
.form-h{font-family:var(--f-d);font-weight:800;font-size:clamp(30px,2.6vw,38px);line-height:1.05;letter-spacing:-.03em;margin:0 0 8px;text-wrap:balance}
.form-sub{font-size:15.5px;line-height:1.5;color:var(--muted);margin:0 0 26px}

.seg{position:relative;display:grid;grid-template-columns:1fr 1fr;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:4px;margin-bottom:24px}
.seg-thumb{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:9px;background:var(--ink);
  box-shadow:0 4px 12px rgba(20,42,33,.22);transition:transform .35s var(--ease)}
.seg.up .seg-thumb{transform:translateX(100%)}
.seg button{position:relative;z-index:1;border:0;background:transparent;min-height:40px;padding:0 8px;cursor:pointer;
  font:600 14.5px var(--f-b);color:var(--muted);border-radius:9px;transition:color .25s}
.seg button[aria-selected="true"]{color:var(--paper)}

.field{margin-bottom:16px}
.field label{display:block;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:7px}
.field input{width:100%;height:50px;padding:0 14px;border-radius:12px;font:500 15.5px var(--f-b);color:var(--ink);
  border:1.5px solid var(--line-2);background:var(--paper);outline:none;transition:border-color .2s,box-shadow .2s,background-color .2s}
.field input::placeholder{color:var(--muted);opacity:.7}
.field input:hover{border-color:var(--muted)}
.field input:focus{border-color:var(--green);background:var(--paper-2);box-shadow:0 0 0 4px var(--green-tint)}
.company-slot{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .4s var(--ease),opacity .3s}
.company-slot > div{overflow:hidden}
.company-slot.open{grid-template-rows:1fr;opacity:1}
.pw-wrap{position:relative}
.pw-wrap input{padding-right:96px}
.pw-toggle{position:absolute;right:7px;top:50%;transform:translateY(-50%);border:0;cursor:pointer;background:transparent;border-radius:8px;
  min-height:36px;padding:0 10px;font:700 12.5px var(--f-b);color:var(--muted)}
.pw-toggle:hover{color:var(--green);background:var(--green-tint)}
.pw-row{display:flex;justify-content:flex-end;margin-top:8px}
.link-btn{background:none;border:0;padding:4px 0;cursor:pointer;color:var(--green);font:600 13.5px var(--f-b)}
.link-btn:hover{text-decoration:underline;text-underline-offset:3px}
.strength{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:9px}
.strength i{height:4px;border-radius:99px;background:var(--line);display:block;transition:background-color .25s}
.strength.s1 i:nth-child(1){background:var(--pess)}
.strength.s2 i:nth-child(-n+2){background:var(--expc)}
.strength.s3 i{background:var(--opti)}

.btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 22px;border-radius:12px;
  font:700 16px var(--f-h);cursor:pointer;border:1px solid transparent;text-decoration:none;
  transition:transform .22s var(--ease),box-shadow .22s var(--ease),background-color .2s,border-color .2s}
.btn:active:not(:disabled){transform:translateY(1px) scale(.985)}
.btn:disabled{opacity:.6;cursor:default}
.btn-amber{margin-top:6px;background:var(--amber);color:var(--on-amber);box-shadow:0 1px 0 rgba(255,255,255,.35) inset}
.btn-amber:hover:not(:disabled){background:var(--amber-hover);transform:translateY(-1px);box-shadow:0 16px 32px -16px rgba(232,155,45,.7)}
.btn-line{background:transparent;color:var(--ink);border-color:var(--line-2);font-family:var(--f-b);font-weight:600;font-size:15px;min-height:50px}
.btn-line:hover{border-color:var(--ink);transform:translateY(-1px)}
.btn-line svg{width:18px;height:18px}

.or-row{display:flex;align-items:center;gap:12px;margin:20px 0 14px;color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.or-row::before,.or-row::after{content:"";flex:1;height:1px;background:var(--line)}
.switch-line{font-size:14.5px;color:var(--muted);margin:22px 0 0;text-align:center}
.switch-line .link-btn{font-size:14.5px;font-weight:700}
.fine{margin:14px 0 0;text-align:center;font-size:12.5px;line-height:1.5;color:var(--muted)}
.fine a{color:var(--muted);text-decoration:underline;text-underline-offset:2px}
.fine a:hover{color:var(--ink)}

.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,120px);background:#142A21;color:#fff;font-size:14px;font-weight:500;
  padding:13px 18px;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.28);z-index:600;transition:transform .32s var(--ease-out);
  max-width:calc(100vw - 32px);width:max-content}
.toast.show{transform:translate(-50%,0)}

@media (max-width:900px){
  .auth{grid-template-columns:minmax(0,1fr);min-height:0}
  .lp{padding:18px 16px 24px}
  .lp-copy{padding-top:52px}
  .lp-h{font-size:clamp(30px,8.4vw,40px);margin-bottom:0;max-width:14ch}
  .lang-ru .lp-h{font-size:clamp(28px,7.4vw,36px)}
  .lp-lead{display:none}
  .lp-photo::after{background:linear-gradient(180deg,rgba(7,14,10,.46) 0%,rgba(7,14,10,.6) 45%,rgba(7,14,10,.9) 100%)}
  .fp{padding:14px 16px 24px}
  .fp-main{padding:26px 0 8px;place-items:start center}
}
@media (max-width:420px){.fp-back span{display:none}}
/* finger-sized targets for the two small text controls, without moving them */
.link-btn,.fp-back{position:relative}
.link-btn::after,.fp-back::after{content:"";position:absolute;inset:-10px -8px}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
`;

export default function LoginPage({ searchParams }) {
  const lang = langFor(searchParams);
  const c = COPY[lang];

  return (
    <>
      {/* dangerouslySetInnerHTML, not <style>{CSS}</style>: React escapes text
          children, which turned the quotes inside font-family into entities and
          broke those declarations (and tripped a hydration mismatch). */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@700;800&family=Manrope:wght@500;700;800&display=swap"
      />

      <main className={`auth lang-${lang}`}>
        <section className="lp" aria-label="VoltMira">
          <div className="lp-photo">
            <Image src="/landing/hero-tile-roof.jpg" alt="" fill priority sizes="(max-width: 900px) 100vw, 55vw" />
          </div>

          <a className="lp-logo" href={lang === "en" ? "/" : `/${lang}`}>
            <svg width="32" height="32" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <rect width="34" height="34" rx="8" fill="#142A21" />
              <path d="M8 25 L14 12" stroke="#C4543B" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M14.5 25 L20.5 9" stroke="#E89B2D" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M21 25 L27 6.5" stroke="#3FAE6A" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="20.5" cy="9" r="2.1" fill="#E89B2D" />
            </svg>
            <span>Volt<span className="m">Mira</span></span>
          </a>

          <div className="lp-copy">
            <h1 className="lp-h" dangerouslySetInnerHTML={{ __html: c.h1 }} />
            <p className="lp-lead">{c.lead}</p>
          </div>
        </section>

        <LoginForm lang={lang} c={c} error={searchParams?.error === "auth" ? "oauth" : ""} />
      </main>
    </>
  );
}
