# Phase 2: grid connection

Every connection file an installer sends to Premier Energy or RED Nord is checked against what that operator asks
for today, followed step by step, and flagged when it waits longer than usual. Built on the grid submission work in
`docs/INTEGRATIONS.md` (`lib/gridSubmission.js`, `lib/gridFlow.js`, `GridSubmit.jsx`).

## What it is

| Part | Where | Who |
|---|---|---|
| Each operator's rules: documents per applicant kind, an operator's own extra documents, how recent a document must be, usual days per step; published as versions, never edited in place | `/admin/grid` (`GridRulesAdmin.jsx`, `POST /api/admin/grid-rules`, `lib/gridRules.js`, `lib/gridRulesStore.js`) | platform admins (`PLATFORM_ADMIN_EMAILS`) |
| The checklist follows the operator's rules; a document that must be recent asks for its issue date and blocks the file when too old | grid card on a quote (`GridSubmit.jsx`, `checkPackage` with `rules`, `docDates`, `today`) | everyone on the quote |
| Send with an exception: a missing or too old document, or a failed power check, goes with a written reason (10+ characters), kept on the submission, in its history and in the audit log (`grid.override`) | grid card, "Send anyway, with a reason" | owner, or a member with the manager title (`canOverrideGrid` in `lib/rbac.js`), whether or not access control is on |
| The "meter installed" step between approved and connected (it may be skipped) | grid card, overview | everyone |
| How long the file has been in its step, against the operator's usual days | grid card | everyone |
| The client's language for their emails and text messages; set from the estimate page's language for a lead from it, changeable on the card | grid card (`projects.client_lang`, `leads.lang`) | everyone |
| A text message per step in the client's language, ready for an SMS service (none connected); copy and send from a phone until then | grid card (`lib/gridText.js` `gridSmsText`, each at most 160 characters) | everyone |
| Overview: open files, overdue first, days in step against the usual, average days from signed offer to connection over the last 12 months, files closed in the last 90 days | `/grid`, sidebar "Racordări" (Moldovan workspaces) (`lib/gridOverview.js`) | everyone; a Sales title sees only its own quotes when access control is on |

The usual days are working rules, shown as such, never as legal deadlines. Version 1 is exactly what the code used
before: the same document lists, the register extract at most 90 days old, and the chase rules already on the grid
file (approval after 10 days, meter after 14), plus 10 days for documents asked and 30 from approval to the meter.

## Data model (`supabase/add-grid-connection.sql`)

- `grid_requirements` (new): `operator`, `version`, `docs`, `custom`, `max_age_days`, `expected_days`, `note`,
  `created_by`. Read by any signed-in user, written only by the server (service role), append-only by trigger.
  Seeded with version 1 for both operators.
- `grid_submissions`: `overrides` (jsonb list of `{ codes, reason, by, at }`), `doc_dates` (`{ doc id: YYYY-MM-DD }`),
  `rules_version`, and the status `meter_installed`.
- `projects.client_lang`, `leads.lang` (en, ro, ru, uk or empty).

Before the SQL runs: the rules come from code (the admin page says so and cannot publish), a complete file is sent
as before, a file with an exception waits ("needs the database update"), "meter installed" answers the same, the
client's language cannot be saved and messages stay in the workspace's language.

## Checks

`lib/gridRules.test.js`, `lib/gridOverview.test.js`, `lib/gridText.test.js` and `lib/gridFlow.test.js` cover the seed
matching the old rules, validation, version differences, document age, the exception (refused without the right or
a reason, then stored, logged and audited), the meter step, the client's language in the email, the overview's days,
order and average, and every text message fitting 160 characters in four languages.

## Not done here

- No SMS provider: the texts are ready, sending them needs a provider and its key.
- No operator channel posts statuses back yet: the installer records each answer (the history marks the source).
- The operators' real deadlines were not given; the usual days are working rules the admin can change.
