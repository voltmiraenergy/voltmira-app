# Local integrations (Phase 3)

Four integrations that give a Moldovan installer's paperwork legal weight:
a qualified e-signature on the offer, the invoice in SFS e-Factura, an export
1C imports, and the grid file sent to the operator. Each provider sits behind
an adapter with a mock, so every flow works end to end without credentials.
The mock is always labelled as a simulation where people see it.

Database: `supabase/add-integrations.sql` (runs on its own; the audit log
comes from `add-tariffs-subsidies.sql`). Until it runs, every screen says so
and nothing breaks.

## 1. Qualified signature: MSign with MPass

| | |
|---|---|
| Where | The offer page (`/p/[code]`), under "Acceptați și semnați" |
| Code | `lib/qsign.js` (adapters, hash, verification), `lib/qsignFlow.js` (start, simulated decision, finish), `lib/acceptProposal.js` (accepting an offer, both levels) |
| Routes | `POST /api/proposal/[code]/qsign` (start), `GET /api/qsign/return?r=` (back from MSign), `POST /api/qsign/mock` and `/sign/mock/[id]` (the simulation only) |
| Tables | `qualified_signatures` (request, document hash, container, verification), `proposals.signature_level` (`simple` or `qualified`) |

Flow: the server hashes what the client signs (code, title, client, size,
price at the frozen settings, currency, the day it was sent), stores a
pending request and sends the client to MSign. On return it reads the
result, checks the signed hash is the offer's, stores the container and the
verification, and accepts the offer at the qualified level. Reloading the
return URL answers the same and signs nothing twice.

The legal level shows on the offer after signing, on its PDF, on the
installer's contract card (with the document fingerprint and the container
to download), in the owner's email and in `audit_log` (`proposal.signed`
with `level`).

**Mock:** offered outside production, or with `QSIGN_MOCK=on`. Its page says
it is a test and creates no real signature; the stored verification says
`simulated: true`, and every place that shows the level says "simulated, no
legal value". It is never shown as a real qualified signature.

**Real:** `msignAdapter` answers `not_configured` until MSign onboarding is
done. Needs, from AGE (Agenția de Guvernare Electronică): a service
agreement for MSign, the service certificate and key, and the endpoint.
Env: `MSIGN_ENABLED=on`, `MSIGN_ENDPOINT`, `MSIGN_CERT_PEM`, `MSIGN_KEY_PEM`.
The adapter's `start`/`result` calls are then written against MSign's SOAP
interface (`PostSignRequest`, `GetSignResponse`) and its CAdES/XAdES result.

## 2. SFS e-Factura

| | |
|---|---|
| Where | A quote's billing page, `/projects/[id]/billing` (from the invoice dialog and the proforma) |
| Code | `lib/efactura.js` (invoice, validation, adapters), `lib/billingFlow.js` (submit, refresh), `lib/invoiceServer.js` (amounts recomputed on the server) |
| Route | `POST /api/projects/[id]/efactura` `{ action: "submit" | "refresh", buyerIdno? }` |
| Table | `efactura_submissions`: one row per attempt, `unique(project_id, attempt)` |

The invoice is the proforma's: same engine price, live rate, VAT split
(`lib/invoiceMath.js`), in minor units. Before sending, the page lists what
SFS would refuse (seller IDNO, VAT code when there is VAT, a company
client's IDNO, lei only, totals that add up). A rejection keeps its reason
in words; "Send again" is a new attempt. A double click is "in progress",
never two submissions. Accepted, the fiscal number prints on the proforma
(real SFS only). Every attempt is audited (`efactura.submit`,
`efactura.status`).

**Mock:** `sfsMockAdapter` validates exactly like the list above and accepts
with a deterministic fiscal number, or rejects with the first reason. The
page says "test mode". Its fiscal numbers are not printed on invoices.

**Real:** `sfsAdapter` answers `not_configured` until SFS access exists.
Needs: e-Factura API access for the installer (or VoltMira as an authorised
intermediary), an EVOSign or MSign signing certificate, and the API
endpoint. Env: `SFS_ENABLED=on`, `SFS_API_URL`, `SFS_CERT_PEM`,
`SFS_KEY_PEM`.

## 3. Payments

On the same billing page: amount (typed as people write it, "1 500,50"),
currency, the day, method, reference. Stored as `amount_minor` with the
currency; the browser sends an idempotency key per payment, so a double tap
records one (`unique(company_id, idempotency_key)`). Paid and still due are
shown against the invoice in its currency. Removing a payment keeps it in
the audit log (`payment.remove` with the row before).

## 4. 1C export

| | |
|---|---|
| Where | `/documents/export` (linked from Documents and Settings) |
| Code | `lib/export1c.js` |
| Route | `GET /api/export-1c?from&to&format=csv|xml`, `POST /api/export-1c` (save the mapping) |
| Table | `export_mappings`, one per workspace |

CSV: a ZIP with `clienti.csv`, `facturi.csv`, `plati.csv`, for 1C's standard
"load data from a spreadsheet" processing. The mapping sets each column's
header, the separator (`;` `,` tab), the decimal mark, the date format and
the UTF-8 BOM. Cells that look like formulas are defused; phone numbers are
left as they are.

XML, for a 1C programmer's own import processing:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<VoltMiraExport version="1" company="..." from="YYYY-MM-DD" to="YYYY-MM-DD">
  <Customers>
    <Customer code="" name="" kind="person|company" idno="" address="" phone="" email=""/>
  </Customers>
  <Invoices>
    <Invoice number="" date="YYYY-MM-DD" customer_code="" customer="" net="0.00" vat_rate="20" vat="0.00" gross="0.00" currency="MDL" fiscal_number=""/>
  </Invoices>
  <Payments>
    <Payment date="YYYY-MM-DD" invoice_number="" customer_code="" amount="0.00" currency="MDL" method="bank|cash|card" reference=""/>
  </Payments>
</VoltMiraExport>
```

Money has a dot and two decimals; dates are ISO. A customer's code is
stable: from the client's email when there is one (`VM-C...`), else from the
quote (`VM-P...`). An invoice is in the range by the day its number was
drawn; a payment by the day it was paid.

## 5. Grid operator: Premier Energy, RED Nord

| | |
|---|---|
| Where | The grid card on a Moldovan quote, "Trimite la operator" |
| Code | `lib/gridSubmission.js` (checklist, statuses, reference, adapters), `lib/gridFlow.js` (submit, status, resend), `lib/gridServer.js` (package, notifications), `lib/racordareFill.js` (the filled form) |
| Route | `POST /api/projects/[id]/grid-submission` `{ action: "submit" | "status" | "resend" }` |
| Tables | `grid_submissions`, append-only `grid_submission_events` (`unique(submission_id, event_id)`) |

The checklist per operator follows the documents their own application
forms list: the filled application (made by VoltMira), the ID or company
registration, proof of the right to the property, the single-line diagram,
the equipment data sheets, the site plan (RED Nord), and a power of attorney
when a representative applies. **Confirm it with each operator**: they may
ask for more for a given site, and the list is one edit in
`OPERATOR_CHECKLIST`.

The package is complete when the applicant details the form needs are filled
(`lib/gridDetails.js gridMissing`) and every required document is ticked.
It goes out with a reference like `VM-P-261018-7F3A` in the subject and the
letter, so a reply can be matched.

Statuses: submitted, documents requested (then sent again), approved,
connected, rejected. Each change is an event, ticks the grid file's stage
(applied, approval, meter), is audited (`grid.submit`, `grid.status`) and
notifies: the installer through Activity and the CRM webhook (`grid.status`),
plus an email when the change did not come from them; the homeowner by email
when the quote has their address, in the formal voice of the offer.

**Mock:** with no operator address set, the submission is recorded but
nothing leaves VoltMira; the card says so.

**Email channel:** env `GRID_EMAIL_PREMIER`, `GRID_EMAIL_REDNORD`, the
address each operator takes prosumer applications at (confirm with them).
Needs Resend configured. The operators have no public API; when one offers
a portal or API, it becomes a third adapter, and its replies can post status
changes with `source: "operator"`.

## Environment variables

| Name | What | Needed for |
|---|---|---|
| `QSIGN_MOCK` | `on` shows the simulated MSign in production (keep off for real clients) | Demos |
| `MSIGN_ENABLED`, `MSIGN_ENDPOINT`, `MSIGN_CERT_PEM`, `MSIGN_KEY_PEM` | MSign service access | Real qualified signatures |
| `SFS_ENABLED`, `SFS_API_URL`, `SFS_CERT_PEM`, `SFS_KEY_PEM` | e-Factura API access | Real e-Factura |
| `GRID_EMAIL_PREMIER`, `GRID_EMAIL_REDNORD` | Operators' application addresses | Sending the grid file |

None are needed for the mocks. Secrets go in Vercel's environment settings,
never in the code.
