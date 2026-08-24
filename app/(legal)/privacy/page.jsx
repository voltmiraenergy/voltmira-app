// app/(legal)/privacy/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Privacy Policy — VoltMira",
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
      </ul>

      <h2>Where your data lives</h2>
      <p>
        All application data is stored in the EU (Stockholm, Sweden). Our sub-processors are Supabase
        (database and authentication), Vercel (hosting), and Paddle (payments — merchant of record). A transactional
        email provider will be added when email notifications launch. Each sub-processor is bound by
        a data-processing agreement.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account data: for the life of your account, plus 30 days after closure.</li>
        <li>Proposal analytics: up to 24 months.</li>
        <li>Backups: a rolling 30-day window.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Under the GDPR you have the right to access, rectify, erase, port, restrict, and object to
        the processing of your personal data. Email{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> and we will respond
        within 30 days. You may also complain to your supervisory authority — ANSPDCP in Romania, or
        the CNPDCP in Moldova.
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
