// app/(legal)/refunds/page.jsx
import LegalShell from "../LegalShell.jsx";

export const metadata = {
  title: "Refund Policy | VoltMira",
  description:
    "Refunds for VoltMira's fee for signed jobs: nothing owed when a client gives up, credit for a job already paid, duplicate payments, and how to ask.",
  alternates: { canonical: "/refunds" },
};

export default function Refunds() {
  return (
    <LegalShell title="Refund Policy" updated="30 October 2026">
      <p className="note">
        VoltMira is free to use. Its one charge is a fee for each job your client signs, 99 lei a kW
        and at most 2,990 lei a job, billed on one statement a month and paid by bank transfer. Developers&apos; bank
        packs, where offered, are paid through <b>Paddle</b>, our merchant of record, so their receipts
        and refunds go through Paddle.
      </p>

      <h2>Nothing is charged until a client signs</h2>
      <p>
        Quotes, offers, clients and every feature cost nothing. A fee is due only for a job your client
        signed online or that you marked as signed, and your company&apos;s first 2 signed jobs are free.
        If the client gives up the job before you paid, you owe nothing for it, also when it is already
        on a statement: the statement then asks only for the rest.
      </p>

      <h2>A job cancelled after you paid</h2>
      <p>
        If a job you already paid the fee for is later cancelled (the client gives up), the fee becomes
        a credit of the same amount, used on your next signed job. A refund in money instead is at our
        discretion, on request, for example if you stop using VoltMira. This is in addition to any right
        you have under the law of your country, which this policy never limits.
      </p>

      <h2>Other refunds</h2>
      <ul>
        <li><b>Duplicate or mistaken payments</b>: refunded in full, at any time.</li>
        <li><b>A fee charged for a job that was never signed</b> (for example, marked signed by mistake
          and corrected at once): write to us and we refund it or turn it into credit.</li>
        <li><b>Bank packs</b>: refunded through Paddle under the terms shown at checkout.</li>
      </ul>

      <h2>How to ask for a refund</h2>
      <ul>
        <li>
          Email <a href="mailto:voltmiraenergy@gmail.com">voltmiraenergy@gmail.com</a> from the
          address on your account, with the statement number (VMF-...) or the transfer reference.
        </li>
        <li>
          We reply within <b>2 business days</b>. Approved refunds are sent by bank transfer to your
          company&apos;s account and usually arrive within 5 to 10 business days, depending on your bank.
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
