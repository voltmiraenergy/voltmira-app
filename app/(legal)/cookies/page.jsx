// app/(legal)/cookies/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Cookie Policy · VoltMira",
  description: "The cookies VoltMira sets, and why. No advertising or tracking cookies — only what's strictly necessary to run the app.",
};

export default function Cookies() {
  return (
    <LegalShell title="Cookie Policy" updated="19 September 2026">
      <p className="note">
        We don&rsquo;t use advertising or cross-site tracking cookies, and we don&rsquo;t show a
        cookie banner — every cookie below is <b>strictly necessary</b> to run the service, which
        is exempt from consent requirements under the GDPR and the ePrivacy Directive. This page
        exists so you can still see exactly what&rsquo;s set and why.
      </p>

      <h2>Cookies we set</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--app-line)" }}>
            <th style={{ padding: "8px 12px 8px 0" }}>Cookie</th>
            <th style={{ padding: "8px 12px" }}>Set by</th>
            <th style={{ padding: "8px 12px" }}>Purpose</th>
            <th style={{ padding: "8px 0" }}>Expires</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid var(--app-line)" }}>
            <td style={{ padding: "10px 12px 10px 0" }}><code>sb-*-auth-token</code></td>
            <td style={{ padding: "10px 12px" }}>Supabase (us)</td>
            <td style={{ padding: "10px 12px" }}>Keeps you signed in to your account</td>
            <td style={{ padding: "10px 0" }}>~1 week, refreshed while active</td>
          </tr>
          <tr style={{ borderBottom: "1px solid var(--app-line)" }}>
            <td style={{ padding: "10px 12px 10px 0" }}>Paddle checkout cookies</td>
            <td style={{ padding: "10px 12px" }}>Paddle</td>
            <td style={{ padding: "10px 12px" }}>Completing a subscription purchase (fraud prevention, session state)</td>
            <td style={{ padding: "10px 0" }}>Session / short-lived</td>
          </tr>
          <tr>
            <td style={{ padding: "10px 12px 10px 0" }}>Turnstile cookie</td>
            <td style={{ padding: "10px 12px" }}>Cloudflare</td>
            <td style={{ padding: "10px 12px" }}>Only if bot-protection is enabled on the login page — tells a human from a bot</td>
            <td style={{ padding: "10px 0" }}>Session</td>
          </tr>
        </tbody>
      </table>

      <h2>What we don&rsquo;t use</h2>
      <p>
        No Google Analytics, no Meta/Facebook Pixel, no advertising or retargeting cookies, no
        cross-site tracking of any kind. Our product analytics — Plausible and Vercel Analytics —
        are both built to work without setting a cookie or fingerprinting your device, so they
        aren&rsquo;t listed above.
      </p>

      <h2>If that changes</h2>
      <p>
        If we ever add a cookie that isn&rsquo;t strictly necessary (for example, a marketing or
        advertising cookie), we&rsquo;ll add a consent banner and ask before setting it — not after.
      </p>

      <h2>Questions</h2>
      <p>
        See our <a href="/privacy">Privacy Policy</a> for the full picture of what data we process,
        or email <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
