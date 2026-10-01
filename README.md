# VoltMira

The operating system for solar installers, launching in Moldova. One
workspace for the whole job: the lead comes in, the quote is designed on the
roof, the client gets a live proposal on their phone and signs it, the grid
file and invoices go out, and the finished system is monitored for years.

Live at [voltmira.com](https://voltmira.com). Try it without an account at
[voltmira.com/demo](https://voltmira.com/demo): a disposable workspace for a
Chișinău installer, filled with a realistic pipeline.

## What an installer does in it

| Step | Where | What it does |
|---|---|---|
| Leads | `/leads`, `/widget` | Every lead with where it came from (website, Viber, Telegram, referral...). A lead form and an AI chat to embed on the installer's own site. |
| Quote | `/projects/[id]` | Hourly yield from PVGIS for the exact address, string design, panel layout on satellite imagery, battery sizing, bill of materials from the installer's own catalog and prices, Moldovan net billing in lei. |
| Proposal | `/p/[code]` | A live page for the client: savings, payback, options side by side, a Q&A assistant, e-signature. The installer sees every open. Follow-ups go out on day 3, 7 and 14 by themselves. |
| Paperwork | `/documents` | Premier Energy / RED Nord grid application, contract, commissioning act, invoices. |
| Install and after | `/studio` | The job from site survey to handover, payments, and monitoring through the inverter portals (Huawei, Deye, Growatt...) with a health check on every system. |

## How it is built

- **Next.js 16 (App Router) on Vercel**, React 19, plain CSS.
- **Supabase**: Postgres with row-level security, so each workspace only ever
  sees its own rows; auth; storage. Server code that must cross that line
  (the public proposal page, webhooks, crons) uses the service role and
  scopes every query itself.
- **`engine/`**: the calculation engine, one pure module used by the editor,
  the proposal page and the PDF alike, so the client and the installer always
  see the same number. Tested against hand-calculated references.
- **Anthropic API** for reading electricity bills, building a bill of
  materials, the proposal Q&A and the lead assistant. Each works from the
  engine's real numbers and never makes a figure up.
- **Paddle** for billing, **Resend** for email, **Sentry** for errors,
  **Upstash** for rate limits, **Cloudflare Turnstile** against bots.

```
app/(app)/      the installer's app (dashboard, leads, projects, studio, settings...)
app/p/[code]/   the client's live proposal
app/widget/     the embeddable lead form and chat
app/api/        API routes, incl. cron/ (daily jobs) and automation/ (Make.com)
app/_landing/   the landing page (EN html + RO/RU strings), served by lib/landing.js
engine/         the calculation engine (@voltmira/engine)
lib/            shared logic, each with its *.test.js next to it
supabase/       the database, one SQL file per change; see MIGRATIONS.md
docs/           deployment, security, GDPR, Make.com, roadmap
```

## Run it locally

1. A Supabase project: run the SQL files in the order
   [`supabase/MIGRATIONS.md`](supabase/MIGRATIONS.md) gives.
2. `cp .env.example .env.local` and fill in at least the three Supabase
   values. Everything else is optional, and each feature says so on screen
   when its key is missing.
3. `npm install`, then `npm run dev`, and open http://localhost:3000/demo.

## Checks

```
npm test        # every lib/*.test.js and engine/*.test.js, Node's own runner
npm run lint    # Next.js lint rules
```

The tests cover the engine math, bill parsing, fleet health, invoicing,
permissions, the lead and proposal assistants' guardrails, and more.

## Deploy

Push to `main`; Vercel builds and deploys. The step-by-step for a new
environment is [`DEPLOY_STEP_BY_STEP.md`](DEPLOY_STEP_BY_STEP.md), and every
setting is in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). The daily jobs are
in `vercel.json` and need `CRON_SECRET`.
