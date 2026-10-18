# Green financing (Phase 2)

A homeowner reading their offer can compare partner banks' loans, see the monthly payment against what the system saves, and apply in a few taps. The bank moves the application through its statuses (by webhook or by its portal), the installer sees each step, and VoltMira records the commission the bank owes when a loan is funded.

## Data model (`supabase/add-financing.sql`, after `add-tariffs-subsidies.sql`)

Money is stored as integers in minor units (bani), with a currency. Rates are in basis points: 9.5% is `950`.

| Table | What it holds | Who reads it |
|---|---|---|
| `lenders` | The partner banks: their channel (`mock` or `email`), contact email, commission terms (`percent` in bps, or `flat` in minor units) and the SHA-256 of the portal token | The server only (no RLS policy) |
| `financing_offers` | Each bank's products: name in 4 languages, rate, term range, fees, minimum and maximum amount, and eligibility (`markets`, `clientKinds`, `requiresBattery`) | Every signed-in user |
| `loan_applications` | One per homeowner application. It freezes the amount, term, rate, monthly payment, fee and support. It also stores the applicant (name, phone, email, locality), the consent (text version, time, IP, browser), the status, the channel, the lender's reference and an idempotency key | Its own workspace |
| `loan_status_events` | Every status change, with its source (`adapter`, `webhook`, `portal` or `admin`) and an `event_id`, unique per application. Append-only | Its own workspace |
| `commission_ledger` | One accrual per funded loan: the lender, the amount, the basis and the period (`YYYY-MM`). Append-only | The server only |

The seeds are three **sample** lenders and offers (MAIB, Moldindconbank, OTP), marked `is_sample`. Their rates and limits are illustrative. Homeowners see sample offers only in demo workspaces, or locally with `FINANCING_SAMPLES=on`. A real client never sees one.

## The flow

1. **The offer page.** `lib/financeServer.js` `offerFinancing` lists the offers that fit the quote, cheapest rate first. The calculator's three numbers come from the offer's frozen snapshot (`lib/offerFinance.js`): the price, the sure support and the monthly savings.
2. **The calculator.** It is `app/p/[code]/LoanCalculator.jsx`, using `lib/loanMath.js`:
   - the amount is the price minus the sure support;
   - the annuity payment is rounded up to the next ban;
   - it also shows the fee, the total and the net monthly cost against the savings.
3. **Applying.** The page sends `POST /api/proposal/[code]/loan` with the offer, the term, the details, an explicit consent tick and an idempotency key. The endpoint is rate-limited to 5 per hour per address. `lib/loanFlow.js` `createApplication` then:
   - recomputes the amount on the server;
   - checks the offer, the term and the limits;
   - stores the consent;
   - writes `loan.consent` to the audit log;
   - sends the application through the lender's adapter;
   - records the result: `submitted` with the reference, or `failed`.

   The installer gets an Activity line, the CRM webhook `loan.created`, and an email (under the call-request switch).
4. **Status updates.** `applyStatus` moves an application through `submitted → in_review → approved → funded`, or to `rejected`, and never backwards.
   - Every change is an event row plus a `loan.status` audit row.
   - A repeated `event_id` is a no-op.
   - On `funded`, `lib/commission.js` books the commission once.
   - The installer is told each time (`lib/loanNotify.js`).
5. **What the installer sees:**
   - a "Cereri de credit" card on the dashboard;
   - a status chip on the quote;
   - Activity lines and emails.

## Reaching a lender: the adapter interface

`lib/lenderAdapters.js`:

```
adapter.submit(application, { lender, document }) ->
  { ok: true, ref, channel } | { ok: false, error, retryable }
```

- **`mock`** accepts every application with a `MOCK-` reference. The sample lenders use it, so the whole flow works with no partner.
- **`email`** emails the lender's `contact_email` with the application as a PDF (`lib/loanDocument.js`, rendered by Chromium with Cyrillic and Romanian letters). This is the fallback for a lender with no API.
- **A real API adapter** is a new object with the same `submit()`, picked in `adapterFor(lender)`. Its keys come from environment variables.

An application that could not be delivered stays `failed`. The admin can send it again from `/admin/lenders`.

## What a lender does

**Webhook:** `POST /api/lenders/webhook/<code>`, with body `{ "event_id", "application_id", "status", "lender_ref"?, "note"? }`.

- **Signature header:** `x-voltmira-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`, using `LENDER_WEBHOOK_SECRET_<CODE>`.
- **Five-minute window:** older signatures are refused, so a captured request cannot be replayed later.
- **Responses:**
  - `401` for a bad, stale or missing signature, or when no secret is set;
  - `404` for an unknown application, or one belonging to another lender;
  - `409` for a step backwards;
  - `200` with `duplicate: true` for a repeated event.

**Portal:** `/l/<token>` lists that lender's applications, with a status control on each. The admin creates the link at `/admin/lenders`. It is shown once, only its hash is stored, and a new link replaces the old one.

## Admin (`/admin/lenders`, `PLATFORM_ADMIN_EMAILS`)

- **Lenders:** channel, commission terms, the webhook address, and whether its secret is set.
- **Portal links:** the "new portal link" button.
- **Undelivered applications**, with "Send again".
- **Payout report:** commission owed per lender per month, with a CSV download (`GET /api/admin/lenders?format=csv`).

## Environment variables

| Variable | Needed for |
|---|---|
| `LENDER_WEBHOOK_SECRET_<CODE>` (for example `LENDER_WEBHOOK_SECRET_MAIB`) | One per real lender that sends webhooks. Agree the secret with the bank. Without it every webhook from that lender is refused |
| `FINANCING_SAMPLES=on` | Local testing only: show sample offers outside demo workspaces. Never set it in production |
| `RESEND_API_KEY`, `RESEND_FROM` (already used) | The email adapter and the installer's emails |

## From mock to a real lender

1. Agree the terms with the bank:
   - the products: rate, terms, fees and limits;
   - the commission;
   - how it receives applications (email address or API);
   - the webhook secret.
2. Insert or update the lender row:
   - `adapter` set to `email` with its `contact_email`, or a new adapter;
   - its commission terms;
   - `is_sample = false`.
3. Insert its `financing_offers` with `is_sample = false`.
4. Set `LENDER_WEBHOOK_SECRET_<CODE>` in Vercel, and give the bank the webhook address. Or create its portal link at `/admin/lenders`.
5. Deactivate the sample offers: `active = false` (rows are never deleted, applications reference them).

## Decisions only you can make

- **Credit intermediation.** Collecting applications and earning a commission from lenders may require registration or a licence as a credit intermediary with the National Bank of Moldova. Check this with a lawyer before real lenders go live.
- **Consent text.** The consent is versioned `loan-consent-2026-10`. Have it reviewed, and add the lenders to the privacy page's processor list (Phase 6).
- **Commission terms** come from each lender contract; the seeded ones are placeholders.
- **Sample rates and limits** are illustrations, not the banks' products.

## Left out on purpose

- **No lender API adapters** exist yet: no bank has an API agreement.
- **No admin screen for editing offers.** Offers change through SQL until there are real ones.
- **Repayment schedules, credit scoring and document upload** stay with the bank.
