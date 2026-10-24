# The fee per won project

VoltMira is free for every installer: no subscription, and no limit on offers, people or features. Its one charge
is a fixed fee for each project the installer wins. The developers' bank pack and the monitoring fee stay in the
code, switched off, and are not advertised.

## The rules (`lib/jobFees.js`)

| | |
|---|---|
| Fee, by system size | up to 10 kW 390 lei; 10 to 30 kW 790 lei; 30 to 100 kW 1,590 lei; above 100 kW 2,990 lei (`FEE_TIERS_MDL`, the only place the prices live) |
| When it is due | the client signs online (`lib/acceptProposal.js`), or the installer marks the quote won (`markProjectWon`, `bulkUpdateStatus`, `cycleProjectStatus`); the same fee either way |
| Free | the company's first 3 won projects, counted by its IDNO across its workspaces |
| To pay | 14 days from the win; then the job's paperwork locks until it is paid. The client never sees it |
| Locked paperwork | contract, proforma invoice, grid application and submission, commissioning act, handover, technical annex, performance report, single-line diagram. Never locked: the offer, sending it, tracking, the client's page and its PDF |
| Size changes | an unpaid fee rises if the system grows into a larger band, never falls; a paid fee is frozen |
| Lost | an unpaid fee becomes void and the paperwork stays locked (no fee, no paperwork); won again, the same fee is due again with fresh 14 days; a free slot used is not given back |
| Cancelled after paying | the fee stays paid and becomes credit for the next won project; cash only by an admin's decision |
| Never locked | demo workspaces and sample projects (`projects.is_sample`, set only by the server), platform admins, and everything while `JOB_FEES` is off |

The signed system's kW is the accepted offer's frozen `snapshot.kw`, else the quote's.

## Where it lives

- Rules: `lib/jobFees.js`. Server: `lib/jobFeeServer.js` (create on win, void or credit on loss, `jobGate` in front
  of the paperwork; a won job with no fee gets one there, so no status path can skip it).
- Gates: `app/api/projects/[id]/racordare-pdf`, `grid-submission` (submit and resend), `invoice` (page, PDF,
  email) and `issueInvoice`, `app/api/studio/pdf` (by quote id or the Studio job's `projectId`), and the documents
  dialog on the quote (`LegalDocsModal.jsx`).
- The installer: the fee card on a won quote (`components/FeeCard.jsx`, with the paywall dialog); Settings, "Pay per
  job" (`app/(app)/settings/FeesPanel.jsx`, `lib/feeActions.js`): the rules, a calculator, the IDNO (fixed once a fee
  carries it), the won jobs, credit, VoltMira's invoices, one invoice a month from 3 paid fees on.
- Payment: `lib/paymentGateway.js` (the test gateway off production; Victoria Bank, a stub until its documentation
  and keys arrive), `lib/jobFeePay.js` (card payment, the bank's callback once per order and only for the amount
  asked, VoltMira's VMF invoices, the monthly statement), `app/api/job-fees/*`, the invoice page `/fees/invoice/[id]`.
- Reminders: `lib/feeReminders.js`, from the daily cron: the win, a week later, the last day, the lock. Nothing while
  `JOB_FEES` is off.
- Admin: `/traction`, "Fees per won project": month by month, income per paid job and per kW, the fees owed with
  "mark paid" for a transfer and "waive", both audited; `GET /api/admin/job-fees?format=csv`.
- AI cost: no credits; `lib/aiLimits.js` caps each workspace's AI calls per minute and per day.

## Data (`supabase/add-job-fees.sql`)

`companies.idno` and `fee_monthly_invoice` (server-only), `job_fees`, `job_fee_payments`, `job_fee_credits`,
`job_fee_invoices` with the `VMF-YYYY-NNNNNN` series (`next_job_fee_invoice_no()`, server-only), `job_fee_reminders`,
`projects.is_sample` (server-only, forced false on a user's insert). Every table is read by its own workspace and
written only by the server; changes are audited.

## Switches and settings

- `JOB_FEES=on` locks paperwork after the 14 days and sends reminders. Off: fees are recorded, nothing locks.
- `JOB_FEES_MOCK=on` allows the test card gateway in production (a staging site only).
- `VB_MERCHANT_ID`, `VB_TERMINAL_ID`, `VB_KEY`: placeholder names for Victoria Bank, to confirm with its documentation.
- `VOLTMIRA_LEGAL_NAME`, `VOLTMIRA_IDNO`, `VOLTMIRA_ADDRESS`, `VOLTMIRA_IBAN`, `VOLTMIRA_BANK`: VoltMira on its
  invoices. `VOLTMIRA_VAT_RATE`: 0 until VoltMira's VAT status is confirmed.

## Removed

Pro and Team plans, the yearly prices, credits and credit packs, the 5-offer limit, the upsell dialog, plan-gated
features (CRM webhook, custom templates: now everyone's), seat limits, the sidebar's plan and credits rows, the
subscription block on deleting an account, and subscription and credit handling in the Paddle webhook (the bank
pack stays). `credit_ledger` and `companies.plan` stay in the database, unused.

## Before switching on

1. Run `add-job-fees.sql`.
2. Victoria Bank merchant account, its documentation, the keys in Vercel; build the adapter against it.
3. VoltMira's company details for the invoices; an accountant on VAT; a lawyer on the terms and refund policy.
4. Set `JOB_FEES=on`.
