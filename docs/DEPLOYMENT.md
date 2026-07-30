# Deployment Guide

## 0. Accounts you need (all have free tiers)
- Supabase (database + auth) — EU region (Frankfurt) for GDPR
- Vercel (hosting Next.js) — set EU as primary region
- Stripe (billing) — activate Stripe Tax for EU VAT
- A transactional email provider for notifications (Resend or Postmark)

## 1. Supabase
1. New project → region **eu-central-1**.
2. SQL editor → run `supabase/schema.sql`.
3. Auth → Providers → enable Email; enable Google (paste OAuth credentials).
4. Auth → URL configuration → add your domain + `http://localhost:3000`.
5. Copy Project URL, anon key, service_role key into `.env.local`.

## 2. Vercel
1. Push this repo to GitHub → import in Vercel → root dir = repo root (leave empty).
2. Add every variable from `.env.example` in Project → Settings → Env Vars.
3. Set `NEXT_PUBLIC_APP_URL` to your production URL.
4. Domains → add `app.voltmira.com` → follow DNS instructions.

## 3. Stripe
1. Products → create "VoltMira Pro" €49/mo and "VoltMira Team" €99/mo → copy price ids.
2. Enable **Stripe Tax** (Settings → Tax) — handles EU VAT + reverse charge for B2B.
3. Developers → Webhooks → endpoint `https://app.voltmira.com/api/stripe/webhook`
   → events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copy signing secret to env.
4. Test locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## 4. Branded PDF (server-side)
Two good options, pick one:
- **Managed (fastest)**: DocRaptor or PDFMonkey — POST the proposal HTML, get a PDF. ~$15/mo.
- **Self-hosted**: `@sparticuz/chromium` + `puppeteer-core` in a Vercel function
  rendering `/p/[code]?print=1`. Works on the Pro plan's 1024MB functions.
Gate behind `assertPlanAllows("branded_pdf")` (already in `lib/actions.js`).

## 5. Notifications (proposal opened → email the installer)
Add a Supabase Database Webhook on `proposal_events` (INSERT, kind='open')
→ an Edge Function that emails via Resend: "Ion opened Casa Popescu — 2nd time."
This 30-line function is the single biggest retention feature you can ship.

## 6. Monitoring (day one, not later)
- Sentry: `npx @sentry/wizard@latest -i nextjs` — 10 minutes.
- Plausible or PostHog script in `app/layout.jsx`.
- Supabase → Database → Backups: verify daily backups are ON; do one test restore.

## 7. Widget embed (installers paste on their sites)
```html
<iframe src="https://app.voltmira.com/widget?c=COMPANY_ID"
        width="380" height="560" style="border:none"></iframe>
```
The widget POSTs to `/api/widget-lead` (rate-limited, honeypot-protected).

## Porting the prototype UI
The single-file prototype's editor (sliders, bands, Sales Mode) is vanilla JS
around the same engine. Port screen-by-screen into `app/(app)/projects/`,
swapping `S`/`save()` for Supabase queries. The engine import stays identical:
`import { quote } from "@voltmira/engine"`. Dashboard is already done as a
reference implementation of the pattern (server component + RLS).
