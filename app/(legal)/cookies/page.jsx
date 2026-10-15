// app/(legal)/cookies/page.jsx
//
// The sign-in cookie's lifetime comes from middleware.js / app/demo/route.js
// (cookieOptions.maxAge, 400 days); voltmira_lang is set by the language
// switchers (landing, /login) and the app layout. If either changes, change
// the table too.
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Cookie Policy | VoltMira",
  description:
    "The cookies VoltMira sets and why. Only strictly necessary cookies, no advertising or cross-site tracking, and cookieless website statistics.",
  alternates: { canonical: "/cookies" },
};

const COOKIES = [
  ["sb-…-auth-token", "Supabase, for VoltMira", "Keeps you signed in to your account or the live demo", "Up to 400 days, or until you sign out"],
  ["Paddle checkout cookies", "Paddle", "Completing a subscription purchase: session state and fraud prevention", "Session or short-lived"],
  ["Turnstile cookies, if any", "Cloudflare", "Telling a person from a bot on the sign-in page", "Session"],
  ["voltmira_lang", "VoltMira", "Remembers the language you picked, so the sign-in page opens in it", "1 year"],
];

const STORAGE = [
  ["voltmira_theme", "Your light or dark theme choice"],
  ["voltmira_lang", "The language you chose, for pages that run in your browser"],
];

export default function Cookies() {
  return (
    <LegalShell title="Cookie Policy" updated="26 September 2026">
      <p className="note">
        We use no advertising or cross-site tracking cookies, so there is no cookie banner: every
        cookie below is either <b>strictly necessary</b> to run the service or remembers a choice you
        made yourself, both of which the ePrivacy rules exempt from consent. This page lists exactly
        what is set and why.
      </p>

      <h2>Cookies</h2>
      <div className="legal-table">
        <table>
          <thead>
            <tr><th scope="col">Cookie</th><th scope="col">Set by</th><th scope="col">Purpose</th><th scope="col">Expires</th></tr>
          </thead>
          <tbody>
            {COOKIES.map(([name, by, why, exp]) => (
              <tr key={name}><td>{/\s/.test(name) ? name : <code>{name}</code>}</td><td>{by}</td><td>{why}</td><td>{exp}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Local storage</h2>
      <p>
        A few preferences are kept in your browser&rsquo;s local storage. They are read only by our own
        pages, never sent to us or anyone else, and you can clear them from your browser at any time.
      </p>
      <div className="legal-table">
        <table>
          <thead><tr><th scope="col">Key</th><th scope="col">What it remembers</th></tr></thead>
          <tbody>
            {STORAGE.map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>)}
          </tbody>
        </table>
      </div>

      <h2>What we don&rsquo;t use</h2>
      <p>
        No Google Analytics, no Meta Pixel, no advertising or retargeting cookies and no cross-site
        tracking. Our website statistics (Vercel Web Analytics) are aggregate and work without setting
        a cookie, so they are not listed above.
      </p>

      <h2>If that changes</h2>
      <p>
        If we ever add a cookie that is not strictly necessary, we will ask for your consent before
        setting it, not after, and update this page.
      </p>

      <h2>Questions</h2>
      <p>
        Our <a href="/privacy">Privacy Policy</a> covers all the data we process. Anything else:{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
