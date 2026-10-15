// app/(legal)/refunds/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Refund Policy | VoltMira",
  description:
    "Refunds for VoltMira subscriptions: the 14-day window, duplicate charges, outages and cancellations, handled with Paddle, our merchant of record.",
  alternates: { canonical: "/refunds" },
};

export default function Refunds() {
  return (
    <LegalShell title="Refund Policy" updated="26 September 2026">
      <p className="note">
        Payments for VoltMira are processed by <b>Paddle</b>, our merchant of record, so your receipt
        comes from Paddle and refunds are paid back through Paddle to the card or account you paid
        with.
      </p>

      <h2>Free plans and trials</h2>
      <p>
        Nothing is charged on a free plan or during beta access. Where a free trial is offered at
        checkout, you are not charged if you cancel before the trial ends, and the date of the first
        charge is shown before you confirm.
      </p>

      <h2>14-day refund on your first payment</h2>
      <p>
        If you ask within <b>14 days</b> of your first payment for a plan, we refund it in full,
        provided the workspace has not yet been used for paid-plan features during that period (such
        as tracked proposal links, branded PDF exports or extra team seats). If you have used them, we
        refund the unused part of the period. This is in addition to any right of withdrawal you have
        as a consumer under the law of your country, which this policy never limits.
      </p>

      <h2>Other refunds</h2>
      <ul>
        <li><b>Duplicate or mistaken charges</b>: refunded in full, at any time.</li>
        <li><b>An outage caused by us</b>: a pro-rated credit or refund for the affected period, on
          request, once the outage is confirmed.</li>
        <li><b>Cancelling</b>: you can cancel at any time and keep access until the end of the period
          you paid for. Outside the 14-day window, payments for the current period are not refunded
          unless the law requires it.</li>
      </ul>

      <h2>What is not refunded</h2>
      <ul>
        <li>Billing periods that ended before you asked.</li>
        <li>Requests more than 14 days after the first payment, except in the cases above.</li>
      </ul>

      <h2>How to ask for a refund</h2>
      <ul>
        <li>
          Email <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> from the
          address on your account, with your Paddle receipt or transaction ID.
        </li>
        <li>
          Or use the link at the bottom of any Paddle receipt email to contact Paddle directly.
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
