# Phase 3: the jobs board, crews and the on-site record

After the client signs, the work has one home: a board of every signed job by install step, the crews' week, and
on each won quote the record the crew keeps on site, ending in a handover document for the client.

## What it is

| Part | Where |
|---|---|
| The board: one column per install step (Signed, Deposit, Permit, Equipment, Installation, Grid, Running); a card stands at its furthest step done; drag it (computer) or "Move to" (anywhere) and the quote's install checklist follows (steps up to it ticked, dates kept; later ones cleared) | `/jobs`, sidebar "Lucrări" (`app/(app)/jobs`, `lib/jobBoard.js`) |
| The crews' week: each crew's visits by day; a visit (survey, installation, service) planned or moved in a dialog; a crew already booked then is said, and saved only on "Save anyway" | `/jobs?view=week` (`lib/crewVisits.js`) |
| The client's email when a visit is planned or its time changes, in the client's language, with the day, the time window and the crew; a switch per visit; the owner is the reply-to | `lib/visitMail.js` |
| Crews: name, people, colour, retired without losing their history | `/jobs?view=week` |
| On site, on a won quote: the checklist, serial numbers (panels, inverter, battery, meter, beside the quote's counts), photos by place, the client's signature | `SiteRecord.jsx`, `lib/siteRecord.js` |
| No signal: every change kept on the phone with the version it started from; saved later and merged item by item with a teammate's changes meanwhile (where both changed the same thing, the later stands and the person is told; a tick beats an untick) | `lib/jobActions.js saveSite`, `lib/offlineReplay.js siteRecord` |
| Photos: full size (2048 px JPEG) in a private bucket under the workspace's folder; kept on the phone until sent; recorded once by the phone's own id | `lib/sitePhotos.js`, `registerPhoto` |
| The handover document: system, equipment, serials, work checked, up to 8 photos, warranty, the client's signature, in the client's language; waits on the fee per won project like the rest of the paperwork | `GET /api/projects/[id]/handover-pdf` |

## Data (`supabase/add-jobs-board.sql`)

`crews`, `crew_visits`, `job_site` (the record and its version), `job_photos`, and the private bucket `job-photos`
(8 MB per photo, JPEG, PNG or WebP) with policies keeping each workspace to its own folder. Each table is read and
written by its own workspace only (row security on `my_company_id()`).

Before the SQL runs: the board works (it reads the install ticks the quote already has); the week and the on-site
card say they need the database update.

## Checks

`lib/jobBoard.test.js` (columns, moving, the board, weeks, double bookings, a visit on the Chișinău clock, crews,
serials, the three-way merge of a record and its conflicts), `lib/jobText.test.js` (four languages, every column,
kind, item and slot has words, formal client copy), `lib/pdfRoutes.test.js` (the handover route gets Chromium on Vercel).

## Not done here

- An SMS to the client about a visit: the email only, until there is an SMS provider.
- Dragging cards on a phone: the "Move to" menu does it there.
- Studio's own week and crews (sample data) are left as they are; the real ones are on /jobs.
