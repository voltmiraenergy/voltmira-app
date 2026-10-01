# Database changes

Every change to the Supabase database lives in this folder as a plain `.sql`
file. You run them by hand in Supabase > SQL Editor > New query: paste, Run.
Every file is written to be safe to run twice (`if not exists`, `drop ... if
exists` then `create`, `create or replace`), so running one again after a
doubt changes nothing.

## What to run next on production

| File | What it does | Status |
|---|---|---|
| `run-pending-2026-09.sql` | Studio in the cloud, inverter portals, lead and proposal assistants, Moldova defaults | Already run |
| `run-pending-2026-09-29.sql` | The four files below in one paste | **Not run yet** |
| `lock-down-2026-09-28.sql` | Fixes the Team page recursion error, and stops a user session from changing its own role or company, a workspace's plan, or a client's signature | in the file above |
| `add-lead-visits.sql` | A site visit date and time on each lead | in the file above |
| `add-ukrainian.sql` | Ukraine: the language, the UA market, the hryvnia and the outage plan (`projects.ua_plan`) | in the file above |
| `add-portfolios.sql` | Portfolios: quotes grouped as one investment, with finance assumptions, stress scenario, document register and E&S screening (`portfolios` table) | in the file above |

Do not run `fix-profiles-rls.sql` on its own. It removes the recursion but
leaves out the guard; `lock-down-2026-09-28.sql` does both and replaces it.

## Order for a new, empty database

1. `schema.sql` (tables, `my_company_id()`, the base policies)
2. `waitlist.sql`, `paddle.sql`
3. In the order they were added:
   - `add-battery-kwh.sql`, `add-company-templates.sql`, `add-leads-status.sql`,
     `add-profile-title.sql`, `add-project-notes.sql`, `add-project-referral.sql`,
     `add-enterprise-plan.sql`, `remove-germany.sql`
   - `add-install-progress.sql`, `add-followup-snooze.sql`, `add-quote-options.sql`
   - `add-products-catalog.sql`, `add-quote-bom.sql`, `add-leads-channel.sql`
   - `add-product-image.sql`, `add-activity-i18n.sql`, `backfill-product-images.sql`
   - `add-sample-flag.sql`, `add-profile-fields.sql`, `add-activity-actor.sql`
   - `add-company-invoicing.sql`, `add-invoice-sequence.sql`, `add-product-stock.sql`,
     `add-proposal-signature.sql`, `add-referrals.sql`
   - `add-product-cost.sql`, `add-production-readings.sql`, `add-project-coords.sql`
   - `add-lead-details.sql`, `add-site-design.sql`, `add-install-warranty.sql`,
     `add-proposal-nudges.sql`, `add-tariff-mode.sql`
   - `add-rbac.sql`, `add-crm-webhook.sql`, `add-custom-templates.sql`,
     `add-invoice-date.sql`, `add-storage-media.sql`, `add-referred-by-ondelete.sql`
4. `run-pending-2026-09.sql` (it already contains `add-studio-cloud.sql`,
   `add-inverter-portals.sql`, `add-lead-agent.sql`, `add-proposal-agent.sql`
   and `md-launch-defaults.sql`, which replaces `md-default-market.sql`)
5. `run-pending-2026-09-29.sql` (the lock-down, site visits, Ukraine and portfolios)

## Checking what a database already has

```sql
-- tables
select table_name from information_schema.tables where table_schema = 'public' order by 1;
-- a column a migration adds, for example add-site-design.sql
select column_name from information_schema.columns
 where table_name = 'projects' and column_name = 'site_design';
-- policies and the lock-down triggers
select tablename, policyname from pg_policies where schemaname = 'public' order by 1, 2;
select tgname from pg_trigger where tgname like '%_lock_%';
```

## Adding a change

1. New file `add-<what>.sql`, with a header saying why, and idempotent.
2. Run it on production in the SQL editor, then add a row to the table above.
3. Code that reads a new column should cope with it missing until then (the
   app does this in `lib/actions.js`: it retries a write without the newer
   columns), so a deploy never breaks while the SQL waits.

## Moving to the Supabase CLI later

When there is a second environment (staging) or a second developer, switch to
tracked migrations:

1. `npx supabase init`, then `npx supabase link --project-ref <ref>`
2. `npx supabase db pull` writes today's production schema as the first
   migration in `supabase/migrations/`
3. From then on: `npx supabase migration new <name>`, write the SQL, and
   `npx supabase db push` applies whatever has not run yet, and records it.

The files in this folder then stay as history and are not run again.
