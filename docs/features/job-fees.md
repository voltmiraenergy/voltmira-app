# The fee for signed jobs

VoltMira is free for every installer: no subscription, and no limit on offers, people or features. Its one charge
is a fee for each job a client signs, billed once a month. The developers' bank pack stays in the code, switched
off, and is not advertised. Monitoring is not charged.

## The rules (`lib/jobFees.js`)

| | |
|---|---|
| Fee | 59 lei for each kW of the signed system, rounded to the lei, at most 1,990 lei a job (`FEE_PER_KW_MINOR`, `FEE_CAP_MINOR`: the only place the prices live; `feeFor` is the only formula). 5 kW is 295 lei, 10 kW 590, 20 kW 1,180, 30 kW 1,770; from about 33.73 kW, 1,990. A signed job with no system size gets no fee and no paperwork until the size is set (`needs_kw`), so it never takes a free job |
| Price changes | prospective: a fee keeps the amount recorded when the job was signed. Paid, waived, free and void fees are never touched; an unpaid fee recorded at an earlier price (200 lei a kW, at most 8,000, until 2026-10-30) is frozen at that amount (`pricedNow`), billed as recorded and never repriced; issued statements keep their totals |
| Billing start | `JOB_FEES_FROM` (YYYY-MM-DD, midnight in Chisinau). Only jobs signed on or after it are invoiced or can lock (`feeBillable`); jobs signed before it (the free beta) stay on record, keep the free jobs they used, and are never billed and never need an IDNO. Unset: `monthlyStatements` issues nothing |
| When it is due | the client signs online (`lib/acceptProposal.js`), or the installer marks the quote signed (`markProjectWon`, `bulkUpdateStatus`, `cycleProjectStatus`, the "mark signed" dialog before an invoice); the same fee either way |
| Free | the company's first 2 signed jobs, counted by its IDNO across its workspaces |
| Billing | the fees of the jobs signed in a month go on one statement (VoltMira's invoice to the company) issued on the 1st of the next month, paid by bank transfer by the 15th, with the statement's reference |
| Locked paperwork | only for a fee still due once its statement's date has passed: contract, proforma invoice, grid application and submission, commissioning act, handover, technical annex, performance report, single-line diagram. Never locked: the offer, sending it, tracking, the client's page and its PDF |
| The client gives up | before any paperwork for the job (contract, invoice, grid file, handover: docs/features/fee-lockdown.md), the installer presses "Client gave up" on the job (or marks it lost): an unpaid fee becomes void and nothing is owed, also when it is already on a statement (the statement then asks only for the rest); after the first paperwork, the fee stays and the installer asks VoltMira to waive it; signed again later, the fee is due again in that month; a free job used is not given back |
| Cancelled after paying | the fee stays paid and becomes credit for the next signed job; cash only by an admin's decision |
| Size changes | an unpaid fee rises if the system grows, up to the cap; it never falls; a paid fee is frozen |
| Never locked | demo workspaces and sample projects (`projects.is_sample`, set only by the server), platform admins, and everything while `JOB_FEES` is off |

The signed system's kW is the accepted offer's frozen `snapshot.kw`, else the quote's. A month is the Chișinău
calendar month the job was signed in.

## Where it lives

- Rules: `lib/jobFees.js`. Server: `lib/jobFeeServer.js` (create on signing, void or credit when the client gives
  up, `jobGate` in front of the paperwork; a signed job with no fee gets one there, so no status path can skip it;
  `feePreview` for a quote not signed yet).
- Gates: `app/api/projects/[id]/racordare-pdf`, `grid-submission`, `invoice` (page, PDF, email) and `issueInvoice`,
  `app/api/studio/pdf`, `app/api/projects/[id]/handover-pdf`, and the documents dialog (`LegalDocsModal.jsx`).
- The job: `components/FeeCard.jsx`. Before signing, a small card with what it will cost (or that it is one of the
  free ones). Signed: the amount or "Free", capped or free note, when and how it was signed, the statement it goes
  on, "Client gave up" (`clientGaveUp` in `lib/feeActions.js`), "How the fee works". Gave up: a small card saying
  nothing is owed. The locked dialog points to the unpaid statement. On a quote not signed yet, "Invoice" first asks
  to mark it signed, showing the fee.
- Settings, "Pay per job" (`app/(app)/settings/FeesPanel.jsx`, `lib/feeActions.js`, `lib/feeOverview.js`): the four
  rules, a calculator, "This month" (signed jobs, fees, the green "To pay" tile), the month's jobs (signed online or
  marked signed, free, capped, "Client gave up" struck through), earlier months with their statement and its state
  (paid, open, late, coming, nothing to pay), how to pay, the IDNO.
- Statements: `lib/jobFeePay.js` `monthlyStatements` (every workspace, last month's due fees, one per workspace and
  month, safe to run again; from the daily cron while `JOB_FEES` is on), `markStatementPaid`; the printable
  statement `/fees/invoice/[id]` (each job, VAT from the setting, jobs given up since taken off, what is left).
- Reminders: `lib/feeReminders.js`, per statement: issued, a week before, the day before, the day it locks; only
  what is still owed; nothing while `JOB_FEES` is off.
- Admin: `/traction`, "VoltMira revenue": who pays what, month pills, the month's tiles (signed, fees, paid,
  owed), statements by installer with totals, "Mark paid" (with the transfer's reference) and "Waive a job's fee"
  (with a reason), both audited; `GET /api/admin/job-fees?format=csv` (`lib/feeRevenue.js`, `lib/feeAdmin.js`).
- AI cost: no credits; `lib/aiLimits.js` caps each workspace's AI calls per minute and per day.

## Data (`supabase/add-job-fees.sql`)

`companies.idno` (server-only), `job_fees`, `job_fee_credits`, `job_fee_invoices` (the statements, the
`VMF-YYYY-NNNNNN` series from `next_job_fee_invoice_no()`, server-only; `month`, `paid_at`, one per workspace and
month), `job_fee_statement_reminders`, `projects.is_sample` (server-only, forced false on a user's insert). Every
table is read by its own workspace and written only by the server; changes are audited. Demo statements are
numbered `EXEMPLU-...` and carry example seller details, outside VoltMira's series.

## Switches and settings

- `JOB_FEES=on`: statements and reminders go out, and an unpaid statement locks its jobs' paperwork from the 15th.
  Off: fees are recorded, nothing is sent or locked.
- `VOLTMIRA_LEGAL_NAME`, `VOLTMIRA_IDNO`, `VOLTMIRA_ADDRESS`, `VOLTMIRA_IBAN`, `VOLTMIRA_BANK`: VoltMira on its
  statements; none is issued until they are set. `VOLTMIRA_VAT_RATE`: 0 until VoltMira's VAT status is confirmed.

## Removed

The size tiers, card payment (the Victoria Bank stub, the test gateway, the payment and callback routes,
`job_fee_payments`), the 14 days per fee, the opt-in monthly invoice, and the monitoring bill (Settings card,
`/api/monitoring/bill`, `lib/monitoringPricing.js`, the /traction column). Earlier: plans, credits, the 5-offer
limit, upsells, seat limits.

## Before switching on

1. Run `add-job-fees.sql`.
2. VoltMira's company details and IBAN in Vercel; an accountant on VAT and on a correction when a client gives up
   after a statement; a lawyer on the terms and the refund policy.
3. Set `JOB_FEES=on`. The first statements go out on the next 1st.
