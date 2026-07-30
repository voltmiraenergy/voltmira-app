// app/(legal)/refunds/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Refund Policy — VoltMira",
  description: "Refund terms for VoltMira subscriptions. 14-day EU right of withdrawal, handled through Paddle, our merchant of record.",
};

export default function Refunds() {
  return (
    <LegalShell title="Refund Policy" updated="13 July 2026">
      <p className="note">
        Payments for VoltMira are processed by <b>Paddle</b>, our merchant of record. Refund
        requests are handled by Paddle on our behalf under the terms below.
      </p>

      <h2>14-day right of withdrawal (EU consumers)</h2>
      <p>
        If you are a consumer in the European Union, you have the right to withdraw from a
        subscription within <b>14 days</b> of your first payment, without giving any reason. Where
        you have started using the paid features during that period, you accept that the right of
        withdrawal is limited to the unused portion of the service. To exercise this right,
        contact us at <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> or
        Paddle support (details on your receipt) within 14 days of purchase.
      </p>

      <h2>What is refundable</h2>
      <ul>
        <li>
          <b>First payment within 14 days</b> — full refund on request, no questions asked, provided
          the account has not been used to generate paid-tier proposals (tracked links, PDF exports
          with your branding, or team seats).
        </li>
        <li>
          <b>Duplicate or accidental charges</b> — refunded in full at any time.
        </li>
        <li>
          <b>Service outage attributable to us</b> — pro-rated credit or refund for the affected
          period, on request, once the outage is confirmed.
        </li>
        <li>
          <b>Downgrades and cancellations</b> — you can cancel at any time; access continues to
          the end of the paid period. Fees already paid for the current period are not refunded
          outside the 14-day window, unless required by law.
        </li>
      </ul>

      <h2>What is not refundable</h2>
      <ul>
        <li>Subscription periods that have already elapsed before the request.</li>
        <li>Requests made more than 14 days after the initial payment, except in the cases above.</li>
        <li>
          Charges disputed after you continued to use the service for the whole billing period
          without contacting us.
        </li>
      </ul>

      <h2>How to request a refund</h2>
      <ul>
        <li>
          Email <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> from the
          address on your account, with your Paddle receipt or transaction ID.
        </li>
        <li>
          You can also use the <b>manage-subscription</b> link at the bottom of any Paddle receipt
          email to contact Paddle support directly.
        </li>
        <li>
          We respond within <b>2 business days</b>. Approved refunds are processed by Paddle and
          typically appear on the original payment method within <b>5–10 business days</b>,
          depending on your bank.
        </li>
      </ul>

      <h2>Chargebacks</h2>
      <p>
        Please contact us <em>before</em> filing a chargeback with your bank — most disputes can
        be resolved directly and faster. Filing a chargeback while a refund request is being
        processed may delay resolution and can result in your account being suspended until the
        chargeback is closed.
      </p>

      <h2>Contact</h2>
      <p>
        For any refund question:{" "}
        <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a>. This policy is in
        addition to any rights you have under applicable consumer-protection law, which are not
        limited by this document.
      </p>
    </LegalShell>
  );
}
