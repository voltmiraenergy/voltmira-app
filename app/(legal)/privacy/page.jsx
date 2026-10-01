// app/(legal)/privacy/page.jsx
//
// Keep the provider list in step with the code: every service named here is
// one the app actually calls (lib/claudeClient.js, lib/telegram.js,
// lib/inverters/*, lib/ratelimit.js, components/SiteDesigner.jsx, ...). When a
// provider is added or dropped, update the table and the date in the same change.
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Privacy Policy | VoltMira",
  description:
    "What personal data VoltMira processes for solar installers, their clients and leads, which providers help us, how long we keep it and how to exercise your GDPR rights.",
  alternates: { canonical: "/privacy" },
};

const PROVIDERS = [
  ["Supabase", "Database, sign-in and file storage for all app data"],
  ["Vercel", "Hosting, application servers and cookieless website statistics"],
  ["Anthropic", "The AI features described in section 4"],
  ["Paddle", "Payments, invoicing and sales tax, as our merchant of record"],
  ["Resend", "Service emails: proposal alerts, invitations, password resets"],
  ["Cloudflare Turnstile", "Telling people from bots on the sign-in page"],
  ["Upstash", "Rate limiting, to stop abuse of public forms and the demo"],
  ["Sentry", "Error reports: what broke and on which page, when enabled"],
  ["Google", "Sign in with Google, if you choose it, and map imagery in the roof designer when enabled"],
  ["Esri (ArcGIS)", "Satellite imagery in the roof designer (map requests only)"],
  ["OpenStreetMap Nominatim", "Turning an address into map coordinates (the address text only)"],
  ["European Commission JRC (PVGIS)", "Solar irradiance data for a location (coordinates only)"],
];

const OPTIONAL = [
  ["Telegram", "Delivers the lead assistant's messages through the installer's own bot"],
  ["Huawei FusionSolar, Solarman, Growatt", "Production readings, using credentials the installer provides"],
  ["Make.com", "Automations the installer builds in their own Make.com scenario"],
];

export default function Privacy() {
  return (
    <LegalShell title="Privacy Policy" updated="26 September 2026">
      <p className="note">
        This policy explains what personal data VoltMira processes, why, who helps us process it and
        what you can do about it. Our database and application servers are in the EU, we use no
        advertising trackers, and we never sell your data or your clients&rsquo; data.
      </p>

      <h2>1. Who we are</h2>
      <p>
        VoltMira is quoting and sales software for solar installers in Moldova and Romania. It is
        operated by its founder, Bogdan Toctarov, pending formal incorporation. The registered company
        name and address will be published here once incorporation completes. For any privacy question
        or request, write to <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>
      <p>
        We act in two roles. For installers&rsquo; own accounts and for visitors to voltmira.com,
        VoltMira is the <b>controller</b>. For the information installers enter about their clients
        and leads, <b>the installer is the controller</b> and VoltMira is their <b>processor</b>,
        acting only on their instructions.
      </p>

      <h2>2. What we process</h2>
      <ul>
        <li>
          <b>Installer accounts</b>: name, email, company details, logo and profile photo, team roles,
          and either your password (stored only as a hash by our sign-in provider) or the name and
          email of your Google account if you sign in with Google. Billing details are collected and
          held by Paddle; we never see full card numbers.
        </li>
        <li>
          <b>Installers&rsquo; clients</b>: names, phone numbers, email addresses, property addresses
          and map coordinates, electricity consumption and bills, roof and system details, prices,
          proposals, notes, site photos, and the name and signature a client gives when accepting a
          proposal.
        </li>
        <li>
          <b>People who use an installer&rsquo;s website widget or chat assistant</b>: what they type
          (address, monthly bill, name, phone or email, preferred survey times) and the conversation
          itself. Contact details go to the installer only after the person agrees to it in the chat.
        </li>
        <li>
          <b>Proposal activity</b>: when a client opens a proposal link, we record opens, time viewed,
          interactions with the quote (such as the battery or financing toggles), questions asked to
          the proposal assistant, any discount or option it recorded, and acceptance. This is shown to
          the installer who sent the proposal and is never used for advertising.
        </li>
        <li>
          <b>Connected inverter accounts</b>: if an installer connects a Huawei FusionSolar, Solarman
          or Growatt account, we store its login credentials encrypted with AES-256-GCM and use them
          only to fetch production readings for that installer&rsquo;s systems.
        </li>
        <li>
          <b>Technical data</b>: request logs, IP addresses (held briefly for rate limiting and abuse
          prevention) and a shortened browser user-agent string, used for security and for the
          &ldquo;proposal opened&rdquo; alert.
        </li>
        <li>
          <b>Visitors to voltmira.com</b>: aggregate page statistics collected without cookies. An
          address typed into the homepage roof check is used only to answer that check and is not
          saved.
        </li>
      </ul>

      <h2>3. Why we process it, and on what legal basis</h2>
      <p>
        We rely on the EU General Data Protection Regulation (GDPR) and, in Moldova, Law no. 133/2011
        on personal data protection.
      </p>
      <ul>
        <li><b>Providing the service you signed up for</b> (accounts, quotes, proposals, alerts and
          support): performance of our contract with you.</li>
        <li><b>Processing your clients&rsquo; and leads&rsquo; data on your instructions</b>: our
          contract with you as your processor (GDPR Article 28). The lawful basis for collecting that
          data is yours, as its controller.</li>
        <li><b>Keeping the service secure</b> (rate limiting, bot protection at sign-in, error
          monitoring): our legitimate interest in a safe, working service.</li>
        <li><b>Billing and tax records</b>: legal obligation.</li>
        <li><b>Measuring how the website is used</b>, in aggregate and without cookies: legitimate
          interest.</li>
        <li><b>Service emails</b> (proposal alerts, invitations, password resets): contract. We send
          no marketing email without your consent.</li>
      </ul>

      <h2>4. AI features</h2>
      <p>Some features use Claude, an AI model provided by Anthropic, through Anthropic&rsquo;s commercial API:</p>
      <ul>
        <li>
          <b>Bill reading</b>: a photo or PDF of an electricity bill is sent to Anthropic to read the
          consumption, meter number and supplier. VoltMira does not store the file, and the installer
          reviews the result before it is applied.
        </li>
        <li>
          <b>Parts list</b>: the installer&rsquo;s description of a system and their own catalog are
          sent to draft a bill of materials.
        </li>
        <li>
          <b>Proposal assistant</b>: a client&rsquo;s questions and the figures from that proposal are
          sent to answer them. If the installer turns on negotiation, the assistant may record a
          discount or one of the alternative options the installer attached, but only within limits
          the installer set, and our server checks every such offer against those limits.
        </li>
        <li>
          <b>Lead assistant</b>: messages on the installer&rsquo;s website chat or Telegram bot are sent
          to answer the homeowner and prepare an estimate.
        </li>
      </ul>
      <p>
        Under Anthropic&rsquo;s commercial terms, data sent through its API is not used to train its
        models. The assistants say they are AI, and none of them makes a decision with legal or
        similarly significant effect on anyone: prices, contracts and site surveys are confirmed by the
        installer.
      </p>

      <h2>5. Who helps us</h2>
      <p>These providers process personal data for us, each only to deliver its part of the service and under its own data processing terms:</p>
      <div className="legal-table">
        <table>
          <thead><tr><th scope="col">Provider</th><th scope="col">What for</th></tr></thead>
          <tbody>
            {PROVIDERS.map(([name, what]) => <tr key={name}><td>{name}</td><td>{what}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p>Only when an installer connects them:</p>
      <div className="legal-table">
        <table>
          <thead><tr><th scope="col">Provider</th><th scope="col">What for</th></tr></thead>
          <tbody>
            {OPTIONAL.map(([name, what]) => <tr key={name}><td>{name}</td><td>{what}</td></tr>)}
          </tbody>
        </table>
      </div>

      <h2>6. Where your data is, and transfers outside the EU</h2>
      <p>
        Our database (Supabase) and application servers (Vercel) are in the EU, in Stockholm, Sweden.
        Some providers are based outside the EU, notably Anthropic, Resend and Sentry in the United
        States and Paddle in the United Kingdom. Where personal data leaves the EU, the transfer relies
        on an adequacy decision of the European Commission (such as the one for the United Kingdom, or
        the EU-US Data Privacy Framework for certified companies) or on the Commission&rsquo;s Standard
        Contractual Clauses. Write to us for a copy of the safeguards that apply.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>Account and workspace data, including clients, leads and proposals: while the account is
          open, then deleted within 30 days of closing it.</li>
        <li>Proposal activity: up to 24 months, then deleted.</li>
        <li>Leads from the chat assistant, with the summary it prepared: in the installer&rsquo;s
          workspace until the installer deletes them or closes the account.</li>
        <li>Bill files sent for reading: not stored by VoltMira.</li>
        <li>Live demo workspaces: sample data only, deleted automatically after a short period.</li>
        <li>Rate-limit counters: expire automatically within a day at most.</li>
        <li>Billing records: as long as tax law requires; Paddle keeps them as merchant of record.</li>
        <li>Backups: a rolling 30-day window.</li>
      </ul>

      <h2>8. Cookies and local storage</h2>
      <p>
        We use no advertising or tracking cookies. The only cookies set are strictly necessary: keeping
        you signed in, completing a purchase with Paddle, and bot protection at sign-in. Your theme and
        language choices are remembered in your browser&rsquo;s local storage and never leave your
        device. See the <a href="/cookies">Cookie Policy</a> for the full list.
      </p>

      <h2>9. Your rights</h2>
      <p>
        You can ask to access, correct, delete or export your personal data, to restrict or object to
        its processing, and to withdraw any consent you gave. Account owners can delete their account
        and all its data at any time from Settings. For anything else, write to{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>; we reply within one
        month.
      </p>
      <p>
        If you are a client or lead of an installer who uses VoltMira, the installer controls your data,
        so please contact them first. We will help them answer you, and if you write to us directly we
        will pass your request on.
      </p>
      <p>
        You can also complain to a data protection authority: ANSPDCP in Romania, the National Center
        for Personal Data Protection (CNPDCP) in Moldova, or the authority where you live in the EU.
      </p>

      <h2>10. Security</h2>
      <p>
        Data is encrypted in transit (TLS) and at rest. Each company&rsquo;s data is isolated with
        row-level security, service keys follow least privilege, credentials for connected accounts are
        encrypted with AES-256-GCM, and backups run daily. No system is perfectly secure; if a breach
        puts your data at risk we will tell affected account owners and the competent authority as the
        law requires.
      </p>

      <h2>11. Children</h2>
      <p>VoltMira is a business tool and is not directed at children under 16.</p>

      <h2>12. Changes to this policy</h2>
      <p>
        We will email account owners at least 14 days before any material change. The date at the top
        of this page always shows the current version.
      </p>
    </LegalShell>
  );
}
