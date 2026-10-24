// app/(legal)/refunds/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Refund Policy | VoltMira",
  description:
    "Refunds for VoltMira's fee per won project: credit for a cancelled project, duplicate charges, and how to ask.",
  alternates: { canonical: "/refunds" },
};

export default function Refunds() {
  return (
    <LegalShell title="Refund Policy" updated="24 October 2026">
      <p className="note">
        VoltMira is free to use. Its one charge is a fixed fee for each project you win, paid by card
        through our bank&apos;s payment page or by bank transfer against our invoice. Developers&apos; bank
        packs, where offered, are paid through <b>Paddle</b>, our merchant of record, so their receipts
        and refunds go through Paddle.
      </p>

      <h2>Nothing is charged until you win</h2>
      <p>
        Quotes, offers, clients and every feature cost nothing. A fee is due only for a project your
        client signed online or that you marked as won, and your company&apos;s first 3 won projects are
        free.
      </p>

      <h2>A project cancelled after you paid</h2>
      <p>
        If a project you paid the fee for is later cancelled (you mark it lost), the fee becomes a
        credit of the same amount, used on your next won project. A refund in money instead is at our
        discretion, on request, for example if you stop using VoltMira. This is in addition to any right
        you have under the law of your country, which this policy never limits.
      </p>

      <h2>Other refunds</h2>
      <ul>
        <li><b>Duplicate or mistaken charges</b>: refunded in full, at any time.</li>
        <li><b>A fee charged for a project that was never won</b> (for example, marked won by mistake
          and corrected at once): write to us and we refund it or turn it into credit.</li>
        <li><b>Bank packs</b>: refunded through Paddle under the terms shown at checkout.</li>
      </ul>

      <h2>How to ask for a refund</h2>
      <ul>
        <li>
          Email <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> from the
          address on your account, with the invoice number (VMF-...) or the payment reference.
        </li>
        <li>
          We reply within <b>2 business days</b>. Approved refunds usually reach your card or account
          within 5 to 10 business days, depending on your bank.
        </li>
      </ul>

      <h2>Chargebacks</h2>
      <p>
        Please write to us <em>before</em> disputing a charge with your bank: most problems are solved
        faster directly. A chargeback filed while a refund request is open can delay it, and the
        account may be paused until the dispute is closed.
      </p>

      <h2>Contact</h2>
      <p>
        Any refund question:{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
