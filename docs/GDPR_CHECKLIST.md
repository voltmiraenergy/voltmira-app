# GDPR Checklist for VoltMira

You are a **data processor** for your installers' client data (names, addresses,
phones, energy bills) and a **controller** for installer account data. Both
roles carry obligations. This is a working checklist, not legal advice —
have an EU privacy lawyer review before scale (€500–1000, worth it).

## Infrastructure
- [ ] Supabase project in EU region (eu-central-1)
- [ ] Vercel functions pinned to EU (fra1)
- [ ] Sign Supabase's and Vercel's Data Processing Agreements (both are self-serve)
- [ ] Paddle DPA (Paddle is the actual merchant of record in use — automatic
      on signup as a Paddle seller, keep a copy; this checklist previously
      said "Stripe," which isn't what's live)

## Legal documents (templates in this folder)
- [x] Privacy Policy published at /privacy (real live page, not just this
      template — lists actual sub-processors: Supabase, Vercel, Paddle,
      Resend, Nominatim, PVGIS, and conditionally Make.com/its AI provider
      and Turnstile only when those features are turned on)
- [x] Terms of Service published at /terms
- [x] Cookie notice published at /cookies — no banner needed (verified: only
      strictly-necessary cookies are set — Supabase auth, Paddle checkout,
      optional Turnstile — and analytics stays cookie-less via Plausible +
      Vercel Analytics), but the disclosure page exists for transparency

## Rights implementation
- [ ] Export my data: extend `/api/export` to dump all company rows as JSON
- [x] Delete my account: Settings → Danger zone, owner-only, type-to-confirm
      the real company name (app/api/account/route.js). Cascades through
      every company_id-bearing table (verified against schema.sql) and
      deletes the owner's auth.users row. Refuses on an active paid plan —
      Paddle is the merchant of record and there's no server-side Paddle API
      key wired up to cancel a subscription automatically, so this tells the
      owner to cancel via Paddle's own portal first rather than risk leaving
      them billed with no account to check it from.
- [ ] Data retention: cron to purge proposal_events older than 24 months

## Operational
- [ ] Records of processing activities (one page: what data, why, where, how long)
- [ ] Breach response plan: who emails users, within 72h notification to DPA
- [x] Sub-processor list published at /privacy (Supabase, Vercel, Paddle,
      Resend, Nominatim, PVGIS; Make.com/its AI provider and Turnstile called
      out as conditional on those features being turned on)
- [ ] If Make.com automations are enabled (`docs/MAKE_AUTOMATIONS.md`): name
      the SPECIFIC AI provider your Make.com scenario calls (Anthropic/
      OpenAI/Google/etc.) in /privacy — it currently says "the AI provider
      configured in your Make.com scenario" because this codebase has no way
      to know which one you picked; and enable EU-region processing in
      Make.com if available on your plan
- [ ] The public proposal page shows only what the installer chose to share

## Moldova note
Moldova's Law 133/2011 largely mirrors GDPR; EU-grade compliance covers you.
Register with CNPDCP if you establish a Moldovan legal entity.
