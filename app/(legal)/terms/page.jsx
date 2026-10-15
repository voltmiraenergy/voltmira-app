// app/(legal)/terms/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Terms of Service | VoltMira",
  description:
    "The terms for using VoltMira, the quoting and sales software for solar installers: estimates, AI assistants, client acceptance, integrations, plans and liability.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <LegalShell title="Terms of Service" updated="26 September 2026">
      <p className="note">
        In short: use VoltMira for lawful quoting and sales work, you own the data you put in, payback
        figures are estimates rather than guarantees, the AI assistants act only within the limits you
        set, and either of us can end the arrangement. The full terms follow.
      </p>

      <h2>1. Agreement</h2>
      <p>
        These terms govern your use of VoltMira (&ldquo;the Service&rdquo;). By creating an account or
        using the Service you agree to them. If you use VoltMira for a company, you confirm you are
        authorised to accept these terms for it. The Service is for businesses and people acting in a
        professional capacity who are at least 18 years old.
      </p>

      <h2>2. Who operates VoltMira</h2>
      <p>
        VoltMira is operated by its founder, Bogdan Toctarov, pending formal incorporation. A registered
        company name and address will be published here once incorporation completes. Until then, the
        contact point for all legal and commercial matters is{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>

      <h2>3. The Service</h2>
      <p>
        VoltMira helps renewable-energy installers quote and sell. It calculates production, savings
        and payback estimates from your inputs and public solar data (PVGIS); produces tracked
        proposals, PDFs, proforma invoices and grid-connection paperwork; keeps your leads, clients and
        pipeline; offers a lead widget and AI assistants; and can read production data from connected
        inverter portals. Features differ by plan and may change as the product develops.
      </p>
      <p>
        The live demo creates a temporary workspace filled with fictional sample data. It is deleted
        automatically, so please do not enter real personal data in it.
      </p>

      <h2>4. Estimates are not guarantees</h2>
      <p>
        <b>Every financial and technical figure the Service produces, including production, savings,
        payback periods, the pessimistic, expected and optimistic scenarios, battery and backup
        sizing, and structural or electrical checks, is an estimate based on your inputs and modelling
        assumptions.</b> Real results depend on weather, energy prices, tariff rules, installation
        quality and other factors outside our control. The figures are not financial, legal or
        engineering advice and do not replace a site survey or a qualified professional&rsquo;s
        judgement. You are responsible for the quotes and designs you send to your clients.
      </p>

      <h2>5. Your account and your team</h2>
      <p>
        Keep your sign-in details secure. You are responsible for activity under your account and for
        the people you invite to your workspace. Tell us promptly at{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> if you suspect
        unauthorised use.
      </p>

      <h2>6. Your data and your clients&rsquo; data</h2>
      <p>
        You own the data you enter. For personal data about your clients and leads you are the
        controller and we are your processor. These terms, together with our{" "}
        <a href="/privacy">Privacy Policy</a>, are our data processing agreement under Article 28 of
        the GDPR: we process that data only on your instructions and to provide the Service, keep it
        confidential, use the providers listed in the Privacy Policy, help you answer data-subject
        requests, and delete it when your account closes. You confirm you have a lawful basis to enter
        your clients&rsquo; information and to send them proposals, and that your own privacy notice
        tells them you use software such as VoltMira.
      </p>

      <h2>7. AI features</h2>
      <p>
        Some features use AI: reading bills, drafting parts lists, and the assistants that answer
        clients on a proposal and leads on your website chat or Telegram bot. AI output can be wrong.
        Review what it produces before you rely on it, and do not present the assistants to anyone as a
        human.
      </p>
      <p>
        <b>Negotiation.</b> If you turn on negotiation for a proposal, the proposal assistant may offer
        your client a discount or one of the alternative configurations you attached, but only within
        the limits you set, and our server refuses anything beyond them. Offers the assistant records
        are made on your behalf, and you should honour them as you would an offer made by your own
        staff. You can change the limits or switch negotiation off at any time; changes apply to offers
        made after that.
      </p>
      <p>
        The lead assistant passes a person&rsquo;s contact details to you only after they agree to it
        in the conversation. Anything it tells a homeowner about savings is an estimate, and the site
        survey and your quote are what count.
      </p>

      <h2>8. Client acceptance, signatures and invoices</h2>
      <p>
        When a client accepts a proposal, VoltMira records their name, their drawn signature and the
        time. This is a simple electronic signature. Whether it forms a binding contract depends on
        your own contract terms and the law that applies to it, and you remain responsible for your
        contract with your client. Proforma invoices from VoltMira are not fiscal invoices: you remain
        responsible for your own invoicing and tax obligations, including e-invoicing where it is
        mandatory.
      </p>

      <h2>9. Connected services</h2>
      <p>
        You can connect third-party services such as Google sign-in, a Telegram bot, inverter portals
        (Huawei FusionSolar, Solarman, Growatt) or your own Make.com scenario. Their own terms apply to
        your use of them. You confirm you are authorised to connect each account. We are not
        responsible for their availability, or for the accuracy of data they provide.
      </p>

      <h2>10. Acceptable use</h2>
      <ul>
        <li>Do not use the Service for anything unlawful, or to send anyone deceptive, harmful or
          unsolicited content.</li>
        <li>Do not try to breach security, reach other companies&rsquo; data, disrupt the Service,
          or push an AI assistant past the limits set for it.</li>
        <li>Do not scrape, copy or reverse engineer the Service, or use it to build a competing
          product.</li>
        <li>Do not resell or white-label the Service beyond the branding features we provide without
          our written agreement.</li>
      </ul>

      <h2>11. Plans and payment</h2>
      <p>
        Free plans and beta access may have limits, which we can change with 30 days&rsquo; notice.
        Paid plans are billed in advance through Paddle, our merchant of record, on the cycle and at
        the price shown at checkout, including any VAT. Where a free trial is offered at checkout, its
        length and the date of the first charge are shown before you confirm, and you are not charged
        if you cancel before it ends. We give at least 30 days&rsquo; notice of a price change, which
        applies from your next billing period. Founder or pilot pricing, where offered, lasts as long
        as your subscription stays active without interruption. You can cancel at any time and keep
        access until the end of the paid period. Refunds follow our{" "}
        <a href="/refunds">Refund Policy</a>.
      </p>

      <h2>12. Intellectual property</h2>
      <p>
        We own the Service, including its software, design and brand. You keep all rights in your
        content and give us a licence to host and process it only as needed to run the Service for
        you. If you send us feedback, we may use it without obligation to you.
      </p>

      <h2>13. Availability</h2>
      <p>
        We work to keep the Service available and reliable, but it is provided &ldquo;as is&rdquo;,
        without a warranty of uninterrupted or error-free operation. We may update or change the
        Service, and occasionally take it offline for maintenance.
      </p>

      <h2>14. Liability</h2>
      <p>
        To the fullest extent the law allows, VoltMira is not liable for indirect or consequential
        losses, lost profits, or losses arising from reliance on estimates or AI output produced by the
        Service. Where we are liable, our total liability is limited to the fees you paid in the 12
        months before the claim. Nothing in these terms limits liability that cannot be limited by
        law. You are responsible for claims your clients bring about quotes, offers or work you
        provided to them.
      </p>

      <h2>15. Suspension and termination</h2>
      <p>
        You can close your account at any time from Settings. We may suspend or end access if these
        terms are seriously breached, with notice where that is reasonable. Before closing, you can
        ask us for an export of your data. After closing, we delete it as described in the Privacy
        Policy.
      </p>

      <h2>16. Changes to these terms</h2>
      <p>
        We will email account owners at least 14 days before a material change takes effect. If you
        keep using the Service after that, the new terms apply; if you do not agree, you can close
        your account before then.
      </p>

      <h2>17. Governing law</h2>
      <p>
        These terms are governed by the laws of the <b>Republic of Moldova</b>, and the courts of
        Chișinău have jurisdiction, without affecting any mandatory rights you have in your own
        country. VoltMira is operated from Moldova and serves installers in Moldova, Romania and the
        wider EU.
      </p>

      <h2>18. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
