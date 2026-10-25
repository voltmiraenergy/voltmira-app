# The fee cannot be dodged

Every way an installer could use VoltMira for a signed job without paying its fee (docs/features/job-fees.md), and
what shuts each one. All of it is off while `JOB_FEES` is off, like the fee itself. Tests: `lib/feeLockdown.test.js`
(one test per way), `lib/jobFeeServer.test.js`, `lib/feeReminders.test.js`. Database: `supabase/add-fee-lockdown.sql`
(after `add-job-fees.sql`).

## The rules decided (2026-10-25)

- **Cancelling** is free only before any paperwork. The first contract, invoice, grid file, grid submission,
  commissioning act, handover or diagram made for a job is recorded on its fee (`job_fees.docs_at`,
  `docs_kinds`). After that the client giving up marks the job lost but the fee stays; the installer writes why and
  VoltMira decides (a waiver request, shown in /traction, waived there with the existing "Waive").
- **Not paying** is held step by step, each step announced by email 5 days before and on the day:
  1. from the statement's date to pay (the 15th): the paperwork of every job is locked (as before);
  2. 30 days late: no new offer and no change to a sent one (offers already sent stay open to the client);
  3. 60 days late: read-only. Nothing is deleted; nothing can be changed until the transfer arrives.
- **The demo** is for looking only: nothing it makes reaches a real person, its offers cannot be signed, and every
  document it makes says DEMO on every page.

## The ways tried, and what stops them

| The installer tries | What stops it | Where |
|---|---|---|
| Never marking the job signed, and making the paperwork anyway | Every document needs a signed job (`not_signed`); the documents window shows "mark signed" instead of the document | `lib/jobFeeServer.js` `jobGate`, `LegalDocsModal.jsx` |
| Making a contract or diagram in Studio with no job attached | The contract, commissioning act and diagram must name their job, then pass the same gate | `app/api/studio/pdf` |
| Running the job in VoltMira without marking it signed: install steps, crews sent to install or service | Both need a signed job; a survey visit can come before | `signedWorkOnly`: `setInstallStep`, `saveVisit` |
| Signing, taking the documents, then "the client gave up" | The fee stays once paperwork exists; a waiver is asked of VoltMira | `lib/jobFees.js` `feeOnLost`, `FeeCard.jsx` |
| Shrinking the system before marking it signed, growing it after | The fee is on the larger of the signed offer and the quote, priced again upward at each document and again before each statement | `signedKw`, `repriceForStatement` |
| Deleting the job | The fee stays, with the job's name and client | `job_fees.project_id` on delete set null |
| Deleting the account | Refused while a fee is owed; once paid, the fees outlive the workspace, so its free jobs stay counted on its tax id | `app/api/account`, `job_fees.company_id` on delete set null |
| A new workspace with an invented tax id, for two more free jobs | The IDNO check digit (7, 3, 1 weights), in the app and in the database | `idnoValid`, `idno_ok()` |
| A new workspace that signs jobs before giving its tax id, then gives one already used | Its free jobs past the company's 2 become due the moment it gives the IDNO | `reconcileFreeSlots` |
| Changing the tax id once fees exist | Refused (`idno_locked`); the column is server-only | `setCompanyIdno`, `lock_columns('idno')` |
| Writing the job's status straight to the database | The database stamps `projects.won_at`; the daily check gives every signed job without a fee its fee | `sweepWonWithoutFee`, trigger `projects_stamp_won` |
| Writing a fee, a statement or the IDNO directly | Workspaces can only read those rows | RLS in `add-job-fees.sql` |
| A statement run missed, or a fee that became due later | Every older fee still due goes on the next statement | `monthlyStatements` |
| Not paying the statement | The steps above, in the app (`lib/feeHold.js`, the banner on every page) and in the database itself (`fee_hold_level()` and restrictive row rules on offers and quotes) | `add-fee-lockdown.sql` |
| Doing real jobs in the demo | No email, invoice, grid file, visit or team invite is sent; signing refused on the offer page and in the API; no cron reminder; DEMO on every PDF | `lib/demoServer.js`, `lib/pdfStamp.js`, `renderPdf({ watermark })` |

## What no software can stop

An installer can still quote in VoltMira and do the whole job outside it: sign on paper, write the contract in Word,
never mark the quote signed. Nothing above can see a job that never comes back into the app. What makes this
unattractive: an offer the client signs online always creates its fee; every document, step, visit, client payment
and the grid file need the job signed; and the terms (section 11) ask the installer to mark a job signed when the client signs it.
Worth watching in /traction: workspaces with many offers opened by clients and few signed jobs.
