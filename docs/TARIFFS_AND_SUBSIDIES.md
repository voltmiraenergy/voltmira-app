# Tariff rules and support programmes (Phase 1)

Savings depend on rules that change: Moldova's net-billing buy-back price is republished every month, and support programmes open, change and close. Since Phase 1, both are **versioned data**, not constants in code. Every offer stores the versions it was issued under.

## Data model (`supabase/add-tariffs-subsidies.sql`)

All money and rates are **integers with an explicit currency**:

- Rates are in minor units per MWh: 2.51 lei/kWh is stored as `251000` (bani per MWh).
- Amounts are in minor units: 120,000 lei is `12000000` bani.

### `tariff_rules`

The rule for one market and grid operator, from a date.

| Column | Meaning |
|---|---|
| `market`, `operator` | `MD`; `premier` or `rednord` |
| `version` | 1, 2, 3, ... per market and operator; set by the server |
| `effective_from`, `effective_to` | The days it applies (end is optional) |
| `retail_day/night/flat_minor_per_mwh` | The operator's published retail rates (reference) |
| `export_monthly` | The buy-back price per month, January first (12 integers or nulls) |
| `export_flat_minor_per_mwh` | A single buy-back price, when there is no monthly table |
| `prosumer_max_kw` | The prosumer size limit, when known |
| `source_title`, `source_url`, `note`, `created_by` | Where it came from, and who published it |

### `subsidy_programs`

A support programme, versioned by `code`.

| Column | Meaning |
|---|---|
| `name` | `{ en, ro, ru, uk }`, stored in the database because admins add programmes without a deploy |
| `kind` | `tax`, `duty`, `grant`, `guarantee` or `loan` |
| `eligibility` | `{ clientKinds, requiresBattery, vatPayer, netMetering, loan, minKw, maxKw }` |
| `estimate` | See below |
| `required_documents` | `[{ id, name: { en, ro, ru, uk } }]` |
| `valid_from`, `valid_to`, `active`, `source_url` | When it applies, whether it is shown, and its source |

The forms `estimate` takes:

- `{ type: "pct_of", base: "battery" \| "system" \| "loan", pct, upTo?, capMinor?, currency? }`
- `{ type: "fixed", amountMinor }`
- `{ type: "vat_in_battery" }`
- `{ type: "info", fromPct?, toPct? }`

### `audit_log` and `projects.client_profile`

- **`audit_log`** is append-only. Each row records the actor, the action, the entity, and the row before and after. Phase 1 writes `tariff.publish` and `subsidy.publish`; later phases add signatures, payments, submissions and loan states.
- **`projects.client_profile`** holds the homeowner's answers for the eligibility check: `{ vatPayer, netMetering, loanMdl, documentsHave }`.

### Row-level security

- **Tariff rules and programmes** are the same for every workspace. Every signed-in user can read them; only the platform admin can write them, through the server with the service role.
- **Audit log:** each workspace reads only its own rows.
- **Append-only:** a trigger refuses `UPDATE` and `DELETE` on all three tables. A published version never changes; a correction is a new version.

## How a version is chosen and frozen

1. **Pick the rule.** `lib/tariffRules.js` `pickRule(rules, { market, operator, date })` picks, among the versions in force on the date, the one that took effect last. On a tie, the higher version wins.
2. **The job's operator.** It comes from `lib/workflow.js` `operatorFor`: the grid file's chosen operator, otherwise the one the address suggests.
3. **Live screens.** The editor, dashboard, lists, exports and portfolio models price Moldovan exports with the rule in force today. `companyEngine()` puts the rules on `E.tariffRules`, and `lib/quoteInput.js` `mdFeedFor` / `rowToQuoteInput(row, E)` read them.
4. **Sending an offer.** `buildProposalSnapshot` freezes `snapshot.tariff`: rule id, operator, version, start date, source and export price. It also freezes `snapshot.support`: the eligibility results with each programme's version, and amounts in bani.
5. **Opening an offer.** The offer API rebuilds the engine input with `lib/offerInput.js`, using the frozen export price. An offer sent before Phase 1 has no `snapshot.tariff` and computes exactly as before.
6. **The tests that hold this.** `lib/tariffSnapshot.test.js` checks three things:
   - old offers are unchanged;
   - a new offer equals the editor on the day it is sent;
   - a newer version changes new offers only.

## Eligibility

`lib/eligibility.js` `checkEligibility(programs, quote, profile)` returns, per programme:

- `eligible`, `conditional` or `not_eligible`, with reasons;
- the estimate in minor units;
- the documents still missing.

A condition the homeowner has not answered yet makes a programme conditional, never eligible. `supportTotals` sums only money the client receives (tax back, grants), never a guarantee.

**Where it shows:**

- **The installer's quote:** `components/SupportCard.jsx`, with the homeowner's answers.
- **The client's offer:** a "Support you may get" section, `app/p/[code]/SupportOffer.jsx`.
- **The Financing section and the PDF:** one line each.

Every amount is worded as an estimate; the programme decides.

## Publishing a new version (no deploy)

Platform admins are the emails listed in `PLATFORM_ADMIN_EMAILS`.

- **`/admin/tariffs`** lists every version per operator and shows the one in force today. The form for the next version comes prefilled from the latest one, with prices in lei/kWh. Before you publish, it shows a diff against the latest version, field by field and month by month.
- **`/admin/subsidies`** lists the programmes. You can publish a new version of one, or a new programme.
- **What the server does:** it checks and converts the form (`lib/adminValidate.js`), sets the version number itself, and returns the latest version if nothing changed. It also writes an `audit_log` row and refreshes the one-minute cache (`lib/tariffStore.js`).

## Before the SQL runs

The app uses the same version 1 from code: `lib/tariffSeed.js` and `lib/subsidySeed.js`. `lib/tariffSeed.test.js` checks they equal the SQL seed, and that version 1 prices exports exactly as the app did before.

The admin screens say which file to run, and the homeowner's answers say they are not saved yet.

## Environment variables

There are no new ones. `PLATFORM_ADMIN_EMAILS` (already used by `/traction`) decides who sees the admin screens.

## Open points (need a decision or a source)

- **RED Nord's buy-back table.** VoltMira has never had it. Version 1 for RED Nord records what the app did before: Premier's table. Publish RED Nord's own table as version 2 when you have the source.
- **Required documents.** The documents in version 1 follow from each programme's stated conditions: VAT registration, the battery invoice, the net-metering contract, the loan agreement. A programme's official list may ask for more; publish a new version when you have it.
- **The prosumer kW limit** is left empty. No source was given.
- **Legal wording.** Showing VAT recovery and FACEM amounts to a homeowner, even as estimates, is a decision for you.

## Later phases

- **Phase 2:** financing offers will add the net monthly cost after support. `supportTotals` already gives the amount.
- **Phases 3 to 5:** signatures, payments, submissions and loan states write to the same `audit_log`.
