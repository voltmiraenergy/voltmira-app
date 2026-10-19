# Pay per signed job (local preview)

VoltMira is free for installers: unlimited offers, designs, grid files, documents and seats. VoltMira earns when a client signs a job, from the monitoring of installed systems, and from the banks' commission on funded loans. No credits, no offer limit, no paid plan.

The model is a **local preview**. It shows only in a development build with the switch on, so nobody is charged and production does not change.

## The rules (`lib/successFees.js`)

| Who pays | For what | Price |
|---|---|---|
| Installer | Each job the client signs | 200 lei per kW, at most 8,000 lei a job. The first 2 signed jobs that go ahead are free. No fee if the client cancels |
| Installer | Monitoring of each installed system | 1.50 EUR a system a month, the first 10 free (`lib/monitoringPricing.js`), on the same statement, in lei at the BNM rate |
| Bank | Each loan funded from an offer | As agreed per bank (`lenders.commission_*`, `lib/commission.js`). Never added to the client's price |

A job is **signed** when:

- the client signed the offer online (`proposals.accepted_at`), or
- the installer marked it won (its `won` activity row), or
- failing both, its status is won. The date is then its last change, and the statement says so.

A signed job that is now **lost** was cancelled. Sample rows never count. A job belongs to the month it was signed in, Chișinău time. Nothing new is stored: the fees are worked out from what the app already records.

## See it on your computer

1. In `.env.local`, add:

   ```
   NEXT_PUBLIC_SUCCESS_FEES=on
   # optional: jobs signed before this day never count
   SUCCESS_FEES_FROM=2026-11-01
   ```

2. Run `npm run dev` and sign in.
3. Look at these places:
   - **Settings > Plan**: the rules, a calculator, this month's statement and the months before.
   - **A quote**: the fee card shows the fee before signing, the fee once signed, and a "Client cancelled" button. The invoice button asks you to mark the job signed first.
   - **The sidebar**: this month's amount, or the free jobs left.
   - **`/admin/revenue`**: every installer's statement for a month, the banks' commission, the total, a CSV to invoice from, and a simulator. This page needs your address in `PLATFORM_ADMIN_EMAILS`.

With the switch on, other things also change:

- credits never charge;
- every plan feature is open, and seats are unlimited;
- monitoring is billed;
- an invoice, e-Factura or payment needs a signed job. The pages and API routes answer `not_signed` otherwise.

With it off, everything is as before.

## Before it goes live

- Remove the development-only guard in `feesOnFor` (`lib/successFees.js`) and set the variable on Vercel.
- Freeze each fee when the job is signed, in its own table, so an edit after signing cannot change an invoiced amount.
- Decide the start day (`SUCCESS_FEES_FROM`). Then tell every installer the price, and update the terms and the pricing on the website.
- Send invoices for the monthly statements. Today the CSV on `/admin/revenue` is for invoicing by hand, like monitoring. Check VAT on the fee with an accountant.
- Sign the bank commission contract. Credit intermediation is supervised by the BNM, so have a lawyer read it.
