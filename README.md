# VoltMira — Professional Product Scaffold

Solar quoting SaaS: honest three-band payback estimates, real PVGIS solar data,
tracked client proposals, embeddable lead widget, Stripe billing.

## What's in this repo

| Path | What it is | Status |
|---|---|---|
| `engine/` | Pure calculation engine + PVGIS module | **26 tests passing** (`npm test` inside) |
| `supabase/schema.sql` | Full multi-tenant Postgres schema with RLS | Parse-validated; run in Supabase SQL editor |
| `app/`, `lib/`, `middleware.js`, `next.config.mjs` | Next.js 14 app: auth, dashboard, public proposal pages, tracking API, PVGIS API, widget-lead API, Stripe checkout + webhook | All files compile; needs your Supabase/Stripe keys |
| `docs/` | Deployment, GDPR checklist, privacy policy template, security, onboarding, roadmap | Ready |
| `prototype/` | The original single-file demo (still perfect for sales demos) | Working |

## The engine is the source of truth
Every number a client sees is computed by `engine/engine.js` — identical math on
the server (proposal API) and in the app. The test suite asserts against
**hand-calculated** references, so refactors can't silently change customers'
quotes. Run: `cd engine && npm test`

## Quick start (local)
1. Create a Supabase project (free tier is fine) → SQL editor → paste `supabase/schema.sql` → run.
2. `cp .env.example .env.local` → fill the Supabase URL + keys.
3. `npm install && npm run dev` → open http://localhost:3000/login → create an account.
4. (Later) add Stripe keys + create two Prices (€49, €99) → paste their ids.

Full production guide: `docs/DEPLOYMENT.md`.

## The killer feature, now real
`POST/GET /api/proposal/[code]` + `/p/[code]` give you what the prototype only
simulated: a link the installer sends to a client's phone. Opens, seconds
viewed, battery toggles, "Request" and "Accept" all write to Postgres and
appear in the installer's activity feed. Snapshots are frozen at send time —
later edits never change what the client saw.
