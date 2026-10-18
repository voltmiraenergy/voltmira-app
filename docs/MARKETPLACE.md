# Homeowner app and installer marketplace (Phase 5)

Five parts that turn a signed offer into a lasting relationship, and bring
new homeowners to verified installers. Database: `supabase/add-marketplace.sql`
(runs on its own; the audit log comes from `add-tariffs-subsidies.sql`). Until
it runs, every screen says so and no account or row is created.

## 1. The homeowner's account (`/home`)

| | |
|---|---|
| Who | A separate role: the Supabase account carries `app_metadata.role = "homeowner"`, which only the server can set |
| Sign-in | A one-time link by email (`/home/enter`), no password. `/home/login` asks for it; the answer is the same whether or not the address has a system |
| Getting one | The client claims it from their signed offer (only with the email the quote holds), or the installer invites them from the quote ("The client's account") |
| Code | `lib/homeownerFlow.js`, `lib/homeServer.js`, `lib/homeGuard.js`, `lib/homeData.js`, `app/home/*` |
| Tables | `homeowner_links` (the systems an account may see) |

The roles never cross: `proxy.js` sends a homeowner away from every installer
path and an installer away from `/home`; `lib/session.js` never creates a
workspace for a homeowner; an email that belongs to an installer is refused.

What the page shows, all read on the server after checking the link:
the offer's own after-signing view (installation steps, production against the
offer, the installer's contact, the referral link), invoices and payments
(with the e-Factura number once accepted), documents (the signed offer, its
PDF, the signature level, the grid file and its reference), loan applications,
warranties (the installer's own, and each maker's verified published warranty
from the supplier catalogue, counted from commissioning), maintenance requests
and, once commissioned, a rating.

## 2. The public funnel (`/solar`, `/ro/solar`, `/ru/solar`, `/uk/solar`)

Address, then a monthly bill, a yearly kWh figure or (with
`NEXT_PUBLIC_VOLTMIRA_AI=on`) a bill photo. The estimate geocodes the address,
takes PVGIS's yield for that roof, and prices with Moldova's tariff rule in
force today (Phase 1): solar is valued at the day rate, a bill is read at the
average of day and night, exports at the rule's buy-back price. The district
comes from the coordinates (`lib/data/mdRaionShapes.js`); an address outside
Moldova gets a clear "Moldova only".

The request for offers is checked, the estimate made again on the server, the
consent recorded (`consent_version`, time, IP), and the request routed. The
homeowner gets a status link (`/solar/status/[token]`, only the token's hash is
stored) and emails at each step. Indexed on voltmira.com, in the sitemap with
hreflang alternates.

Code: `lib/solarFunnel.js`, `lib/marketplace.js` (`cleanRequestInput`),
`app/solar/*`, `app/api/solar/*`.

## 3. Lead routing

| | |
|---|---|
| Who gets a request | Verified installers (licence and insurance in date), published and taking requests, working in the district, with a size range that holds the system |
| Order | A score out of 100: rating 50 (shrunk toward 4 while there are few), answering in time 35 (a newcomer counts as 80 %), free capacity 15 |
| How many | Three at once; a decline or a missed deadline passes the request to the next in line, until three are live or nobody is left ("unmatched") |
| Deadline | The installer's own answer time (`sla_hours`, 2 to 168, default 24) |
| Accepting | The request becomes a lead in the installer's workspace (source `marketplace`); only then is the contact shown |
| Code | `lib/marketplace.js` (rules), `lib/marketFlow.js` (create, respond, sweep), `lib/marketServer.js` (emails, Activity) |
| Tables | `quote_requests` (server only, no policy), `lead_offers`, append-only `lead_offer_events` |

Overdue offers are swept whenever a request is made, an installer answers, the
marketplace page or a status page opens, and once a day (`/api/cron/nudges`).
Every change is an event and an audit row (`request.create`, `request.accept`,
`request.decline`).

## 4. Verification and the public profile

The installer fills their profile on `/marketplace`: districts, size range,
answer time, licence number and date, insurer and date, and uploads both
documents (private bucket `verify-docs`, the server only). "Ask VoltMira to
check it" works once everything is given. The platform admin opens each
document by a one-minute link on `/admin/installers` and verifies or rejects
with a note; the installer is emailed. A later change to a checked field sends
the profile back for a new check; an expired document stops requests until a
new one is checked.

`/i/[slug]` shows a verified, published installer: districts and sizes,
systems commissioned through VoltMira, measured production against the
offers (only with at least 2 monitored systems and 6 months of readings), and
owners' ratings. Ratings come only from a homeowner linked to a commissioned
system, one per system (`reviews`); `hidden` is the platform's moderation.

## 5. Maintenance

A ticket opens from the homeowner's form, the installer's quote, or the
nightly monitoring check (`lib/monitorTickets.js`, after the inverter sync):
a monitored system clearly below its offer this month, or one whose readings
stopped, opens one ticket a month per problem; snow is weather, not a fault.
The installer books a visit (the homeowner gets a calendar file), logs what
was done, and closes it; the homeowner can reopen a resolved one. Each change
is an append-only `ticket_events` row and an audit row, and the side that did
not make it is told (installer: Activity, CRM webhook `ticket.status`, email;
homeowner: email).

## Environment

No new variables. Uses `RESEND_API_KEY` (emails), `NEXT_PUBLIC_APP_URL` (links),
`PLATFORM_ADMIN_EMAILS` (who verifies), `CRON_SECRET`, and, only for the bill
photo, `NEXT_PUBLIC_VOLTMIRA_AI=on` with `ANTHROPIC_API_KEY`.
