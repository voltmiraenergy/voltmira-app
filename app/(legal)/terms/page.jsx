// app/(legal)/terms/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Terms of Service — VoltMira",
  description: "The terms governing use of VoltMira quoting software for solar installers.",
};

export default function Terms() {
  return (
    <LegalShell title="Terms of Service" updated="9 August 2026">
      <p className="note">
        Plain-language summary: use VoltMira for lawful quoting work, you own the data you put in,
        the payback figures are estimates (not guarantees), and either of us can end the
        arrangement. The full terms are below.
      </p>

      <h2>1. Agreement</h2>
      <p>
        These terms govern your use of VoltMira (&ldquo;the Service&rdquo;). By creating an account
        or using the Service, you agree to them. If you use VoltMira on behalf of a company, you
        confirm you&rsquo;re authorised to accept these terms for it.
      </p>

      <h2>2. The Service</h2>
      <p>
        VoltMira is a quoting tool for renewable-energy installers. It computes payback and savings
        estimates from your inputs and public solar-irradiance data (PVGIS), and lets you share
        tracked proposals with your clients.
      </p>

      <h2>3. Estimates are not guarantees</h2>
      <p>
        <b>All financial figures the Service produces — payback periods, savings, ROI, and the
        pessimistic / expected / optimistic bands — are estimates based on your inputs and modelling
        assumptions.</b> They depend on weather, energy prices, tariff schemes, installation
        quality, and other factors outside our control. They are not financial advice and not a
        guarantee of results. You are responsible for the quotes you send to your clients.
      </p>

      <h2>4. Your account</h2>
      <p>
        Keep your login credentials secure; you&rsquo;re responsible for activity under your
        account. Tell us promptly at{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> if you suspect
        unauthorised use.
      </p>

      <h2>5. Your data and your clients&rsquo; data</h2>
      <p>
        You own the data you enter. For personal data about your clients, you are the controller and
        we are your processor — see our <a href="/privacy">Privacy Policy</a>. You confirm you have a
        lawful basis to enter your clients&rsquo; information and to share proposals with them.
      </p>

      <h2>6. Acceptable use</h2>
      <ul>
        <li>Don&rsquo;t use the Service for anything unlawful, or to send anyone content that is
          deceptive or harmful.</li>
        <li>Don&rsquo;t attempt to breach security, access other companies&rsquo; data, or disrupt
          the Service.</li>
        <li>Don&rsquo;t resell or white-label the Service beyond the branding features we provide,
          without our written agreement.</li>
      </ul>

      <h2>7. Plans and payment</h2>
      <p>
        Paid plans are billed in advance through Paddle (our merchant of record) on the cycle shown at checkout. Founder /
        pilot pricing, where offered, applies for as long as your subscription remains active and
        uninterrupted. You can cancel at any time; access continues to the end of the paid period.
        Fees already paid are non-refundable except where required by law.
      </p>

      <h2>8. Availability</h2>
      <p>
        We work to keep the Service available and reliable, but it&rsquo;s provided &ldquo;as
        is&rdquo; without warranties of uninterrupted or error-free operation. We may update, change,
        or occasionally take the Service offline for maintenance.
      </p>

      <h2>9. Liability</h2>
      <p>
        To the fullest extent permitted by law, VoltMira is not liable for indirect or consequential
        losses, lost profits, or losses arising from your reliance on estimates produced by the
        Service. Nothing in these terms limits liability that cannot be limited by law. Where we are
        liable, our total liability is limited to the fees you paid in the 12 months before the
        claim.
      </p>

      <h2>10. Termination</h2>
      <p>
        You may close your account at any time. We may suspend or end access if these terms are
        breached. On termination you can request an export of your data; after the retention period
        in our Privacy Policy, we delete it.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update these terms; we&rsquo;ll notify account owners of material changes and, where
        required, ask for renewed consent. Continued use after changes take effect means you accept
        them.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of the <b>Republic of Moldova</b>, and the courts of
        Chișinău have jurisdiction, without prejudice to any mandatory consumer-protection rights you
        have in your country of residence. VoltMira is operated from Moldova and serves installers
        across Moldova, Romania and the wider EU.
      </p>

      <h2>13. Who operates VoltMira</h2>
      <p>
        VoltMira is operated by its founder, Bogdan Toctarov, pending formal incorporation. A
        registered company name and address will be published here once incorporation completes;
        until then, the contact point for all legal and commercial matters is{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
