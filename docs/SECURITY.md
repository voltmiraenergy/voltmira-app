# Security Posture

## Implemented in this scaffold
- **Tenant isolation**: Postgres RLS on every table; `my_company_id()` scoping.
  The anonymous public NEVER reads tables directly — only via server routes
  that filter by capability code.
- **Capability URLs**: proposal codes are random (31-char alphabet, 8 chars ≈
  1.1e12 space), unguessable at rate-limited request speeds.
- **Rate limiting**: proposal API 60/min, widget 5/min per IP (in-memory; swap
  for Upstash Redis at scale — interface is 6 lines).
- **Honeypot** on the public widget form.
- **Server-side plan gating** (`assertPlanAllows`) — the client is never trusted.
- **Frozen snapshots**: clients see immutable data; no TOCTOU on proposals.
- **Input limits**: every public string is length-capped and escaped on write.
- **Secrets hygiene**: service-role key is server-only; `.env.example` documents
  the boundary.

## Before launch (do these)
- [ ] Enable Supabase Auth: leaked-password protection + minimum length 8
- [ ] Turn on 2FA for your own Supabase/Vercel/Stripe accounts
- [ ] Set Vercel firewall: block non-EU traffic to /api/stripe/webhook except Stripe IPs (optional)
- [ ] `npm audit` in CI; Dependabot on
- [ ] Sentry with PII scrubbing enabled
- [ ] Test restore from a Supabase backup (an untested backup is not a backup)

## Reporting
security@voltmira.com — acknowledge within 48h. No bug bounty yet; credit given.
