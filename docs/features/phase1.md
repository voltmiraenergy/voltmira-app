# Phase 1: quote in 10 minutes

A qualified lead gets a priced proposal the same day, without a site visit.

## What it is

| Part | Where | Switch |
|---|---|---|
| The installer's public estimate page, embeddable | `/estimate/<address or company id>` (`app/estimate/[slug]`) | `ESTIMATE_PAGE=on` |
| A lead request from it (Moldovan phone, consent, Turnstile, limits) | `POST /api/estimate-lead` | `ESTIMATE_PAGE=on` |
| Settings: page address and colour, embed code, score weights, served districts, follow-up days | Settings, "Estimate page" (`EstimateSettings.jsx`, `lib/leadSettings.js`) | always |
| Lead score 0 to 100, badge, order, filter 70+ | Leads (`lib/leadScore.js`) | always |
| "Create quote from estimate": sized, equipment from the installer's catalog, a smaller option and one with a battery | `createProjectFromLead` (`lib/quoteOptions.js`) | always |
| The offer in plain words | offer page, "In short" | always |
| Proof from nearby systems | offer page, energy section (`lib/nearbyProof.js`, `lib/nearbyServer.js`) | `OFFER_NEARBY=on` |
| Reading time per section and the option looked at, with notice and refusal | offer page (`SectionTracker.jsx`), shown to the installer in the link window (`OfferInsights.jsx`) | `OFFER_TRACKING=on` |
| Follow-up days per workspace, switch per offer | `lib/nudgeTiers.js`, `lib/nudgeRun.js` | follow-ups on in Notifications |
| Median time from lead to quote, last 90 days | Dashboard numbers (`lib/leadToQuote.js`) | always |

## Data model (`supabase/add-quote-fast.sql`)

No new table, so the existing row security (each workspace sees its own rows) covers every column.

- `companies`: `public_slug` (unique, 3 to 40 of a-z, 0-9, -), `brand_color` (#rrggbb), `lead_score_weights` (jsonb), `service_districts` (text[] of `lib/mdRaions.js` ids), `nudge_days` (int[], up to 3 days, 1 to 60).
- `leads`: `timeline` (now, soon, later), `wants_financing`, `district`, `estimate` (jsonb: kW, price, currency, payback, production, consumption, place).
- `proposals`: `nudges_off`.
- `proposal_events.kind` gains `section` and `option` (meta `{ s }` or `{ o }` only, no personal data).

Before the SQL runs: the page opens at the company id (not at an address), the Settings tab says it needs the database update, leads save without the new fields, follow-ups keep 3, 7 and 14 days, reading events are refused by the database (nothing else breaks).

## Flows

1. Visitor on `/estimate/<address>`: address plus bill or monthly kWh, `/api/estimate` (the engine), then the request. The server checks Turnstile, validates (`lib/estimateLead.js`), works the estimate out again from the address and bill (the browser's numbers are not trusted), finds the district, saves the lead (`lib/leadCapture.js`, channel `estimate`), and emails the installer with the score (the same switch as call requests).
2. Leads: the score is computed when the list is shown from the lead's fields and the workspace's weights, never stored, so a change of weights rescores everything at once.
3. "Create quote from estimate": geocode and PVGIS yield, size from the bill, equipment from the installer's catalog (panel with the most watts, the smallest inverter that covers the size, a mount), and the options beside it.
4. The offer: "In short"; nearby proof from systems with 12 full months of readings in the same district (median kWh per kWp, 3+ systems from 2+ installers; a demo's own sample systems may show); the reading tracker sends seconds per section every 20 s and on leaving, only while the section is on screen and the tab in front.

## Consent and retention

- The estimate page asks for explicit consent to be contacted and to keep the details for the proposal, with a link to the privacy policy.
- Reading time: a one-line notice on the offer with "Don't record my reading" (kept in the browser), Do Not Track and Global Privacy Control respected, the installer's own views dropped, no personal data in the events. Reading events are deleted after 12 months by the daily follow-up job.

## Environment

No new secrets. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` already exist; without the secret the check lets requests through (the rate limits still apply). Three switches, all off by default: `ESTIMATE_PAGE`, `OFFER_NEARBY`, `OFFER_TRACKING`.

## Removed in this phase

Reading bill photos (the editor, the web chat, the Telegram assistant): the bill is typed.

## Not built, on purpose

- A script-tag embed: the iframe covers the installer's site and Facebook page links.
- The nearby block in the demo: the demo has one system with a full year in its district, and inventing monitored systems for it would show made-up proof.
