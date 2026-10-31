# Security and reliability hardening, 2026-10-30

Branch `security-hardening`. Billing (`JOB_FEES`) stays **off**. Nothing here was run against production.

## What was wrong, and what changed

### Confirmed and fixed

| # | Area | What could happen | Fix | Tests |
|---|---|---|---|---|
| 1 | Fees, gate | With `JOB_FEES=on`, a fee that could not be read or created left `jobAccess` returning "open" (`no_fee`): contracts, invoices, the grid file and the handover were handed out with no fee behind them | The gate fails closed: `fee_unavailable` (503, "try again"); `jobAccess` locks a signed job with no fee when billing is on. Off, demo, sample and admins pass as before | `lib/feeIntegrity.test.js` (6), `lib/jobFees.test.js` |
| 2 | Fees, free jobs | A failed count of the company's free jobs was taken as 0 (another free job); two jobs signed at once, or from two workspaces with one IDNO, could both take the last free slot | A failed read stops the fee (no guess). `add-fee-integrity.sql` adds `job_fees_free_guard`: counts under an advisory lock on the workspace and the IDNO, refuses a third; the app then writes the fee as due | 6 tests, incl. 5 jobs at once and 2 workspaces at once |
| 3 | Fees, paperwork | `recordPaperwork` ignored its write error: a document could be given with no record of it; a cancellation at the same moment could void the fee anyway | Recorded before the document is given, checked (`paperwork_not_recorded` otherwise); conditional on the fee not being void (`job_fee_record_paperwork`, or the same conditional update); a cancellation voids only while `docs_at is null` | 5 tests |
| 4 | Fees, credits | Two jobs signed at once could spend the same credit (pick, then mark used, unconditionally) | The credit is claimed with `used_on_fee_id is null` in the same update; the fee is marked paid only if still due, else the credit goes back | 2 tests |
| 5 | Fees, statements | A statement whose fee links failed left the fees outside the late-payment holds forever; a statement read "paid" even when some of its fees did not | Links checked, only fees on no statement, repaired by the next run; paid only when every fee is | 2 tests |
| 6 | Fees, IDNO | Setting the IDNO updated the fees before reconciling free jobs, every step unchecked | Reconcile first, then the fees, then the company, each checked | 2 tests |
| 7 | Roles | A failed profile read made a member an owner in `saveCompany` (IBAN, legal name, VAT, CRM webhook, engine), `getMyRole` and the profile title | `isOwnerRow`: owner only when read and `role = 'owner'` | `lib/rbac.test.js` |
| 8 | Roles (in-company) | A failed profile read let a Sales member see every quote when RBAC is on | `projectVisibility` falls back to own quotes on a read error | covered by code review |
| 9 | Cross-company | `bookCheck` and `moveRequestTo` linked any visit id, another company's included | Linked only if it is the workspace's own visit on the same system | `lib/service.test.js` |
| 10 | Signature | A signature whose job could not be marked won left a signed offer with no fee, outside the daily sweep | Retried; then audited (`proposal.signed_status_failed`) and alerted | `lib/acceptProposal.test.js` |
| 11 | Payments | A stage payment saved without its stage update could never be finished (the retry hit the duplicate key and said "already"); removing a payment left the stage paid | The stage's paid amount is the sum of its payments, recomputed and checked after every record or removal | `lib/milestoneServer.test.js` |
| 12 | Public links | Offer codes were 8 characters (about 40 bits, with a small modulo bias) | New codes are 12 characters (about 59 bits), unbiased; old links work | `lib/shortCode.test.js` |
| 13 | Rate limits | Without Upstash, production counted per serverless instance | A Postgres counter shared by every instance (`add-rate-limits.sql`); memory only as a logged last resort | `lib/ratelimitShared.test.js` |
| 14 | CI | Node 20 in CI, Node 24 declared; no lint step | Node 24, lint added | - |

### Hardening (no exploit shown, done because cheap)

- The automation key is compared in constant time (`lib/automationAuth.js`).
- `supabaseAdmin()` throws if it is ever called in a browser.
- `lib/opsAlert.js`: billing and signature failures become their own Sentry events (ids only, no names or emails).

### Reviewed, found sound

- Project, payment, e-Factura and grid routes: `billingGuard` reads the project through the user's session, checks the company and the role's visibility.
- Service and Cash actions: every project, request, check and milestone is scoped to the caller's company before the service role is used.
- Team route: owner-only, with company scoping, and the caller's own profile failing closed.
- Admin API routes: each handler checks `isPlatformAdmin`.
- Public routes: automation (bearer), reading-alert links (HMAC, constant time), the website chat (signed lead reference), the signature simulation (off in production unless `QSIGN_MOCK=on`).
- Private buckets `job-photos` and `deal-docs`: per-company folder policies; `pay-proofs` and `service-photos`: no user policy (server only).
- Secrets in the browser: only `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (public by design; restrict the Maps key by HTTP referrer in Google Cloud).

## Database: deploy order (staging first)

1. **Read-only check**: run `supabase/check-security.sql`. Note every `ok = false`. Do not trust `MIGRATIONS.md` for what production has.
2. If `job_fees` is missing: run `add-job-fees.sql`, then `add-fee-lockdown.sql` (they are in `run-pending-2026-10-25.sql` too).
3. Run `supabase/check-fee-data.sql` (read-only). Every row must be `ok = true`. In particular, "no company has more than 2 free jobs": if one has, fix it by hand before step 4, or the guard refuses that company's next change to those rows.
4. Run `supabase/add-fee-integrity.sql` (trigger and function; changes no data).
5. Run `supabase/add-rate-limits.sql` (new table and function; changes no other table). Skip if Upstash is set.
6. Run `check-security.sql` again: the `job_fees_free_guard` trigger and the two new functions must read ok.

### Staging test of the free-job guard (two sessions, by hand)

In two SQL Editor tabs, with a staging company that has used 1 free job (IDs from staging):

- Tab A: `begin; insert into job_fees (company_id, project_id, idno, kw, tier, amount_minor, status, trigger, free_slot, won_at, grace_ends_at) values ('<company>', '<project A>', '<idno>', 6, 0, 0, 'free', 'manual', 2, now(), now() + interval '20 days');` (do not commit yet).
- Tab B: the same insert for `<project B>`: it waits (the advisory lock).
- Tab A: `commit;`. Tab B then fails with `free_jobs_used`. `rollback;` in tab B.
- Clean up: `delete from job_fees where project_id in ('<project A>');` (staging only).

### Rollback

- `add-fee-integrity.sql`: `drop trigger if exists job_fees_free_guard on public.job_fees; drop function if exists public.job_fees_free_guard(); drop function if exists public.job_fee_record_paperwork(uuid, text);` The app keeps working (it falls back to its own conditional update; the free-job race returns).
- `add-rate-limits.sql`: `drop function if exists public.rate_limit_hit(text, int, int); drop table if exists public.rate_limits;` (the app counts per instance again, logged).
- The code: revert the branch's commits; no data migration depends on them.

## Before turning on JOB_FEES

1. All of the database steps above on production, `check-security.sql` and `check-fee-data.sql` all ok.
2. `VOLTMIRA_LEGAL_NAME`, `VOLTMIRA_IDNO`, `VOLTMIRA_ADDRESS`, `VOLTMIRA_IBAN` (and `VOLTMIRA_VAT_RATE`) set, or no statement is issued.
3. `NEXT_PUBLIC_SENTRY_DSN` set, with alert rules on these events (tag `ops_event`):
   `billing.gate_closed_unavailable`, `billing.paperwork_not_recorded`, `billing.fee_not_made_at_signing`,
   `billing.fee_status_mismatch`, `signature.project_not_won`. Any one of them: someone looks the same day.
4. `UPSTASH_REDIS_REST_URL`/`TOKEN`, or `add-rate-limits.sql` run.
5. A staging run of a whole month: sign jobs, make documents, cancel one, issue the statement (cron), mark it paid.

## Remaining risks (not fixed in this session)

- **SQL not executed here**: there is no PostgreSQL in this environment. The SQL files were written and reviewed, not run; the free-job race is proved for the app's logic against a stand-in for the trigger, and must be proved on staging with the two-tab test above.
- **No end-to-end authorization tests** with two real signed-in companies: the cross-company review is by code reading and unit tests of the extracted rules.
- **A fee paid by credit, then cancelled**: its cancellation credit and the rest of the credit it used share `source_fee_id` (unique), so in that rare case one of the two credits is not kept. Needs a design decision (credit ledger) rather than a patch.
- **Rate limit with Upstash down** falls back to per-instance counting (logged), not to the Postgres counter.
- **The offer page's 8-character codes already sent** stay valid (and as guessable as before) until those offers expire.
- `x-forwarded-for` is trusted as Vercel sets it; behind any other proxy it could be spoofed.
