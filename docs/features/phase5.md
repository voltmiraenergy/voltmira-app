# Phase 5: Service, after the handover

Every installed system has one home once it runs: how it produces against the offer the client signed, the client's
requests, its yearly check and its warranties. Monitoring stays free.

## What it is

| Part | Where |
|---|---|
| The rules: a system's health against its own quote (the year of the last complete month, from the month after it went live, with the rule-based causes of `lib/fleetHealth.js`), a request as typed and the statuses it can move to, the working days to answer, the next yearly check and its state, the warranties (set by hand first, else a verified catalog warranty, else the workspace's own workmanship years; never a guessed one) | `lib/service.js` |
| Sidebar "Service" (one new item) | `/service`, `app/(app)/service`, `lib/serviceActions.js loadService` |
| Systems | tiles (running, to look at, open requests, checks within 60 days); each system's production chip and likely cause, its share of the offer, last reading, portal, next check; "open a request" (pre-filled from the cause) and "copy the client's link"; the inverter portals, moved here from Studio (`InverterPortals.jsx`, linking a station to a job) |
| Requests | from the client's link or opened by you; open or all; a dialog with the description, contact, photos, history; move to planned, in progress, resolved (what was done, the client told by email) or closed; "Plan a visit" books a service visit in the crews' week and marks it planned; late when nobody answered within the working days set |
| Yearly checks | due within 60 days or all; plan the visit (a "maintenance" visit in the crews' week), mark done (the next one counts from it), checks off or on per job; the settings (working days to answer, months between checks, the client's reminder) |
| Warranties | what ends within 90 days across all systems; per system: panels (product and output), inverter, battery, workmanship, with serial numbers from the on-site record; change any of them |
| The client's link | `/s/[token]`, public by an unguessable link, never indexed, formal and in the client's language: what happened, a description, a phone, up to 4 photos (shrunk on the phone), bot check and rate limits; `POST /api/service/[token]`. It is on the client's own page once the system runs (`ClientAfter.jsx`) and on the handover document as a QR code |
| Reminders | `lib/serviceServer.js sendServiceReminders`, from the daily cron: the client's note 14 days before a yearly check (switchable); on Mondays the installer's digest of checks within 30 days and requests waiting; each once |
| The installer told | a client's request: email to the owner and a line in Activity |
| Texts | `lib/serviceText.js`, four languages; the visit kind "maintenance" in `lib/crewVisits.js` and `lib/jobText.js` |

Health alerts only suggest a request; nothing is opened by itself.

## Data (`supabase/add-service.sql`)

`companies.service_reply_days`, `maintenance_months`, `maintenance_client_reminder`; `projects.service_token`,
`maintenance_off`; `service_requests`, `service_request_events`, `service_photos` and the private bucket
`service-photos`; `maintenance_checks`; `warranties`; `service_reminders`; and the "maintenance" kind on
`crew_visits`. Each workspace reads its own rows; the server writes them.

Before the SQL runs: Systems shows each system's health and portals (they need nothing new); requests, checks,
warranties set by hand and the client's link say they need the database update.

## Checks

`lib/service.test.js` (health on/below the offer, no readings, too new; requests; late answers without weekends;
next checks; warranties never guessed), `lib/serviceServer.test.js` (a client's request and its history; moving it
only along its statuses; the client's link made once; the reminders once), `lib/serviceText.test.js`.

## Not done here

- Paid maintenance contracts.
- SMS: email only, until there is an SMS provider.
- Requests opened from inverter alarms: the portals' alarm interfaces are not documented well enough to rely on.
