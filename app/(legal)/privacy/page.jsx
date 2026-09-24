// app/(legal)/privacy/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Privacy Policy · VoltMira",
  description: "How VoltMira processes personal data for solar installers and their clients. EU-hosted, no ad trackers.",
};

export default function Privacy() {
  return (
    <LegalShell title="Privacy Policy" updated="9 August 2026">
      <p className="note">
        This policy explains what we collect and why. We keep data in the EU, use no advertising
        trackers, and never sell your data or your clients&rsquo; data.
      </p>

      <h2>Who we are</h2>
      <p>
        VoltMira (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides quoting software for renewable-energy
        installers. For any privacy question or request, contact{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>
      <p><em>
        A registered legal entity name and address will be added here once the company is formally
        incorporated; until then this contact address is the point of reference.
      </em></p>

      <h2>Data we process</h2>
      <ul>
        <li>
          <b>Account data</b> (you, the installer): your name, email, company details, and billing
          information handled by Paddle. Legal basis: performance of our contract with you.
        </li>
        <li>
          <b>Client data you enter</b> (your customers): names, addresses, phone numbers, and energy
          consumption. <b>You are the data controller</b> for this information; we process it only to
          provide the service on your behalf. Legal basis: our contract with you.
        </li>
        <li>
          <b>Proposal analytics</b>: when your client opens a proposal link, we record the open
          count, time viewed, and interactions with the quote — tied to that proposal, never to
          advertising profiles. No third-party ad trackers, ever.
        </li>
        <li>
          <b>Technical data</b>: basic request logs and a truncated browser user-agent string, used
          for security and to make the &ldquo;proposal opened&rdquo; feature work.
        </li>
        <li>
          <b>Address lookups</b>: when an address is typed into the app, it is sent to
          OpenStreetMap&rsquo;s Nominatim service to find map coordinates; those coordinates are then
          sent to PVGIS, a public tool run by the European Commission&rsquo;s Joint Research Centre,
          to look up solar irradiance. Neither service receives a name or any other identifying
          detail — only the address text or coordinates needed to answer the lookup.
        </li>
      </ul>

      <h2>Where your data lives</h2>
      <p>
        All application data is stored in the EU (Stockholm, Sweden). Our sub-processors are Supabase
        (database and authentication), Vercel (hosting), Paddle (payments — merchant of record), and
        Resend (transactional email — proposal-opened alerts, team invitations, password resets).
        Address and solar-yield lookups go to OpenStreetMap Nominatim and the European
        Commission&rsquo;s PVGIS service (see above); neither stores anything on our behalf. Each
        sub-processor is bound by a data-processing agreement.
      </p>
      <p>
        Two features stay off until an installer deliberately turns them on: the AI proposal Q&amp;A
        widget and automated follow-up nudges (Settings; see docs/MAKE_AUTOMATIONS.md), which route
        real proposal data through Make.com and whichever AI provider that installer&rsquo;s own
        Make.com scenario is configured to call; and Cloudflare Turnstile bot-protection on the login
        page, which processes technical browser data to tell a human from a bot.
      </p>
      <p>
        We also use Sentry for error monitoring once it is configured — it would receive technical
        error details (what broke, which page, a truncated stack trace) to help us fix bugs. It is
        never used for advertising and does not track you across sites.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account data: for the life of your account, plus 30 days after closure.</li>
        <li>Proposal analytics: up to 24 months.</li>
        <li>Backups: a rolling 30-day window.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We don&rsquo;t use advertising or tracking cookies. The only cookies the app sets are
        strictly necessary ones — keeping you signed in (Supabase), completing a purchase (Paddle),
        and, if enabled, telling a human from a bot at login (Cloudflare Turnstile). Our analytics
        (Plausible, Vercel Analytics) work without setting any cookie at all. See our{" "}
        <a href="/cookies">Cookie Policy</a> for the full list.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the GDPR you have the right to access, rectify, erase, port, restrict, and object to
        the processing of your personal data. You can delete your own account and all its data at
        any time from <a href="/settings">Settings</a>, or email{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> for any other request
        (including deleting a specific client&rsquo;s data on your behalf) — we respond within 30
        days. You may also complain to your supervisory authority — ANSPDCP in Romania, or the
        CNPDCP in Moldova.
      </p>

      <h2>Security</h2>
      <p>
        We encrypt data in transit (TLS) and at rest, isolate each company&rsquo;s data with
        row-level security, use least-privilege service keys, and take daily backups. No system is
        perfectly secure, but security is a first-class concern in how VoltMira is built.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We&rsquo;ll email account owners at least 14 days before any material change to this policy.
      </p>
    </LegalShell>
  );
}
