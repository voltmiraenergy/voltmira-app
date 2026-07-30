# GDPR Checklist for VoltMira

You are a **data processor** for your installers' client data (names, addresses,
phones, energy bills) and a **controller** for installer account data. Both
roles carry obligations. This is a working checklist, not legal advice —
have an EU privacy lawyer review before scale (€500–1000, worth it).

## Infrastructure
- [ ] Supabase project in EU region (eu-central-1)
- [ ] Vercel functions pinned to EU (fra1)
- [ ] Sign Supabase's and Vercel's Data Processing Agreements (both are self-serve)
- [ ] Stripe DPA (automatic on signup, keep a copy)

## Legal documents (templates in this folder)
- [ ] Privacy Policy published at /privacy (PRIVACY_POLICY.md as base)
- [ ] Terms of Service including a Data Processing Addendum for installers
- [ ] Cookie notice — you only need functional cookies (auth); avoid analytics
      cookies by using Plausible (cookieless) and you skip the banner entirely

## Rights implementation (build these — they're small)
- [ ] Export my data: extend `/api/export` to dump all company rows as JSON
- [ ] Delete my account: cascade delete company (schema already cascades) +
      Stripe customer deletion + auth.users deletion
- [ ] Data retention: cron to purge proposal_events older than 24 months

## Operational
- [ ] Records of processing activities (one page: what data, why, where, how long)
- [ ] Breach response plan: who emails users, within 72h notification to DPA
- [ ] Sub-processor list published (Supabase, Vercel, Stripe, Resend)
- [ ] The public proposal page shows only what the installer chose to share

## Moldova note
Moldova's Law 133/2011 largely mirrors GDPR; EU-grade compliance covers you.
Register with CNPDCP if you establish a Moldovan legal entity.
