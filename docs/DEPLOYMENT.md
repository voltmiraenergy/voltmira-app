# Deployment Guide

## 0. Accounts you need (all have free tiers)
- Supabase (database + auth) — EU region (Frankfurt) for GDPR
- Vercel (hosting Next.js) — set EU as primary region
- Paddle (billing, merchant of record, so it handles EU VAT)
- Resend (the emails: proposal opened, follow-ups, invites)
- Anthropic (the AI features), Sentry (errors), Upstash (rate limits), Cloudflare Turnstile (bot check)

## 1. Supabase
1. New project → region **eu-central-1**.
2. SQL editor → run the files in the order `supabase/MIGRATIONS.md` gives.
3. Auth → Providers → enable Email; enable Google (paste OAuth credentials).
4. Auth → URL configuration → add your domain + `http://localhost:3000`.
5. Copy Project URL, anon key, service_role key into `.env.local`.

## 2. Vercel
1. Push this repo to GitHub → import in Vercel → root dir = repo root (leave empty).
2. Add every variable from `.env.example` in Project → Settings → Env Vars.
3. Set `NEXT_PUBLIC_APP_URL` to your production URL.
4. Domains → add `app.voltmira.com` → follow DNS instructions.

## 3. Paddle
1. Catalog → create the Pro, Team and Enterprise prices → copy the price ids
   into `NEXT_PUBLIC_PADDLE_PRICE_*`.
2. Developer tools → Authentication → client token → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
3. Notifications → new destination `https://voltmira.com/api/paddle/webhook`
   → copy the signing secret to `PADDLE_WEBHOOK_SECRET`.
4. `NEXT_PUBLIC_PADDLE_ENV=sandbox` while testing, `production` when live.

## 4. Proposal PDF
Rendered server-side from the live proposal page (`lib/renderProposalPdf.js`,
`@sparticuz/chromium` + `puppeteer-core` in a Vercel function). Nothing to
set up.

## 5. Emails and daily jobs
- `RESEND_API_KEY` + `RESEND_FROM` (a verified domain). Without them every
  email is skipped silently and the app still works.
- `CRON_SECRET`: Vercel's crons (`vercel.json`) run the demo clean-up, the
  inverter sync and the proposal follow-ups (day 3, 7, 14) every morning.

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

## 8. Make.com automations (optional)
The follow-up emails no longer need Make.com: the daily cron sends them for
every installer who turns them on in Settings. Make.com is only needed for
an AI-phrased first line in those emails. See `docs/MAKE_AUTOMATIONS.md`.
