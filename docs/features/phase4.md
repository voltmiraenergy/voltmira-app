# Phase 4: the client's payments in stages

A signed job is paid in stages, each tied to a step of the work: by default 50% when the client signs, 40% at
installation and 10% at grid connection. Each stage becomes an invoice from the installer's own series the moment
its step is reached; the client pays it by bank transfer from a link, and is reminded before and after its due day.

## What it is

| Part | Where |
|---|---|
| The rules: plans (1 to 5 stages, whole percentages adding up to 100, each step once, 1 to 60 days to pay), the split in whole lei with the last stage taking the rounding, a job's own plan for the stages not invoiced yet, when a step is reached, the due day on the Chișinău calendar, a stage's state, the reminder it is at, the tiles and the months | `lib/milestones.js` |
| The stages in the database: created when a job is signed (from the price its invoice prints), issued as their steps are reached, void when the client gives up and back when they sign again, payments against them | `lib/milestoneServer.js` `syncMilestones`, called from signing online (`lib/acceptIo.js`), "mark signed", bulk and chip status changes (`lib/actions.js`), an install step ticked (`setInstallStep`), a card moved on the board (`lib/jobActions.js moveJob`) and "Client gave up" (`lib/feeActions.js`) |
| Invoice numbers | the installer's own series and prefix (`PF-2026-0043`), drawn by the server (`next_invoice_no_srv`, as `next_invoice_no` answers only a signed-in member); the transfer reference is the number without its dashes |
| "Încasări", the third tab of Lucrări (no new sidebar item) | `/jobs?view=cash`, `app/(app)/jobs/CashView.jsx`, `lib/cashActions.js loadCash`: overdue, due within 7 days, the next 30 days (with what the stages to come add), received this month (green); the invoices, to collect or all, with their state; mark received (all, or part, on a day), copy the pay link, see the client's proof, pause or resume a job's reminders; the months: invoiced and received |
| Plans | Settings, Documents and invoices: the default plan (the owner's); a job's billing page: that job's plan, the stages already invoiced listed and fixed, the rest editable (`components/PayPlan.jsx`) |
| The client's pay page | `/pay/[token]`, public by an unguessable link, never indexed: the invoice in the client's language, the amount and due day, the stage and its share of the job, the beneficiary, IBAN and reference with copy buttons, the proof of transfer (image or PDF, 8 MB, private bucket `pay-proofs`, `POST /api/pay/[token]/proof`, rate-limited), print |
| Reminders | `lib/payReminders.js`, from the daily cron: when issued, 3 days before, on the day, 3 and 10 days late; to the client's email with the pay link, the installer as the reply-to; at 3 days late the installer is told by email and in Activity; once per step; none while a job's reminders are paused |
| Texts | `lib/payText.js`: four languages; the installer's screens say "tu", the client's page and emails are formal |

A proof of transfer is not a payment: the installer marks a stage received once the money is in the account.

## Data (`supabase/add-milestones.sql`)

`companies.pay_schedule`, `projects.pay_schedule`, `pay_milestones` (one row per stage: trigger, share, amount
and currency, planned/issued/paid/void, days to pay, invoice number, issued, due day, paid amount and day, pay
token, reminders paused, proof), `payments.milestone_id`, `pay_milestone_reminders`, `next_invoice_no_srv()`
(service role only), and the private bucket `pay-proofs`. Each workspace reads its own stages; the server writes.

Before the SQL runs: the tab and the plan say they need the database update; nothing else changes.

## Checks

`lib/milestones.test.js` (plans, the split, a job's own plan, steps reached, due days, states, reminder steps, the
tiles and months), `lib/milestoneServer.test.js` (signed: planned and the first issued, once; a step issues its
stage; part and full payments; the client gives up and signs again; a job's own plan), `lib/payReminders.test.js`
(each step once, the client's language, the installer at 3 days late; paused, paid, no email), `lib/payText.test.js`.

## Not done here

- Card payment on the pay page through the installer's bank (MAIB, Paynet, Victoria Bank): `lib/payAdapters.js`
  is a placeholder until a bank's merchant documentation is in hand; nothing calls a bank.
- Matching a bank statement to the stages by their references: the installer marks them received.
- The client's reminders by SMS: email only, until there is an SMS provider.
