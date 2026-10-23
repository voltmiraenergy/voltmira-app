import { test } from "node:test";
import assert from "node:assert/strict";
import { documentHashFor, newRequestId, verifySignatureResult, msignMockAdapter, msignAdapter, mockContainer, qsignAdapterFor } from "./qsign.js";
import { buildEfacturaInvoice, validateEfactura, sfsMockAdapter, sfsAdapter, efacturaAdapterFor, payloadHash } from "./efactura.js";
import { toCsv, toXml, cleanMapping, fmtDate, fmtMoney, inRange, DEFAULT_MAPPING, FIELDS } from "./export1c.js";
import { OPERATOR_CHECKLIST, checklistFor, docName, checkPackage, nextGridStatus, gridNext, STAGE_FOR, newGridReference, gridMockAdapter, gridEmailAdapter, gridAdapterFor } from "./gridSubmission.js";

// ---- qualified signature -------------------------------------------------

const DOC = { code: "ABC123", title: "Casa Popescu", client: "Ion Popescu", kw: 8.2, costEur: 7400.4, currency: "MDL", sentAt: "2026-10-18" };

test("the document hash is stable and changes with any signed figure", () => {
  const h = documentHashFor(DOC);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(documentHashFor({ ...DOC }), h);
  assert.notEqual(documentHashFor({ ...DOC, costEur: 7500 }), h);
  assert.notEqual(documentHashFor({ ...DOC, client: "Ana Popescu" }), h);
  assert.match(newRequestId(), /^QS-[0-9a-f]{24}$/);
  assert.notEqual(newRequestId(), newRequestId());
});

test("MSign mock: happy path, the signed result verifies as qualified and says simulated", async () => {
  const a = msignMockAdapter({ baseUrl: "https://app.test" });
  const s = await a.start({ requestId: "QS-1", returnUrl: "https://app.test/p/ABC123" });
  assert.equal(s.ok, true);
  assert.ok(s.redirectUrl.startsWith("https://app.test/sign/mock/QS-1?return="));
  const hash = documentHashFor(DOC);
  const container = mockContainer({ requestId: "QS-1", documentHash: hash, signer: "Ion Popescu", signedAt: "2026-10-18T10:00:00Z" });
  const row = { status: "signed", container, document_hash: hash, signer_name: "Ion Popescu", verification: { signer: "Ion Popescu", signedAt: "2026-10-18T10:00:00Z" } };
  const r = await a.result("QS-1", { row });
  const v = verifySignatureResult(r, hash);
  assert.equal(v.valid, true);
  assert.equal(v.level, "qualified");
  assert.equal(v.simulated, true, "a mock result is never passed off as real");
  assert.match(JSON.parse(Buffer.from(container, "base64").toString()).type, /SIMULATION/);
});

test("MSign mock: failure paths, declined, pending, a changed document", async () => {
  const a = msignMockAdapter({ baseUrl: "https://app.test" });
  assert.equal((await a.result("QS-1", { row: { status: "failed" } })).status, "failed");
  assert.equal((await a.result("QS-1", { row: { status: "pending" } })).status, "pending");
  assert.deepEqual(await a.result("QS-1", { row: null }), { ok: false, error: "not_found" });
  const hash = documentHashFor(DOC);
  const signed = { status: "signed", container: "x", signer: "Ion", documentHash: hash };
  assert.equal(verifySignatureResult(signed, documentHashFor({ ...DOC, kw: 9 })).reason, "document_changed");
  assert.equal(verifySignatureResult({ ...signed, container: "" }, hash).reason, "no_container");
  assert.equal(verifySignatureResult({ ...signed, signer: "" }, hash).reason, "no_signer");
  assert.equal(verifySignatureResult({ status: "pending" }, hash).valid, false);
});

test("real MSign without credentials answers not_configured, and is only chosen when enabled", async () => {
  assert.deepEqual(await msignAdapter({}).start({}), { ok: false, error: "not_configured" });
  assert.equal(qsignAdapterFor({ baseUrl: "x", env: {} }).id, "msign_mock");
  assert.equal(qsignAdapterFor({ baseUrl: "x", env: { MSIGN_ENABLED: "on" } }).id, "msign");
});

// ---- e-Factura -----------------------------------------------------------

const COMPANY = { legal_name: "SolarTech SRL", reg_no: "1012600012345", vat_no: "0612345", legal_address: "Chișinău", iban: "MD24 AG00 0225 1000 1310 4168" };
const AMOUNTS = { gross: 120000, net: 100000, vat: 20000, rate: 20 };
const invoice = (over = {}) => buildEfacturaInvoice({ company: COMPANY, buyer: { name: "Ion Popescu", kind: "person" }, amounts: AMOUNTS, currency: "MDL", invoiceNo: "VM-0042", date: "2026-10-18", description: "Sistem solar 8 kW", ...over });

test("the e-Factura invoice is in minor units and balances", () => {
  const inv = invoice();
  assert.equal(inv.totals.grossMinor, 12000000);
  assert.equal(inv.totals.netMinor + inv.totals.vatMinor, inv.totals.grossMinor);
  assert.equal(inv.seller.iban, "MD24AG000225100013104168");
  assert.deepEqual(validateEfactura(inv), []);
  assert.equal(payloadHash(inv), payloadHash(invoice()));
});

test("validation names what SFS would refuse", () => {
  assert.ok(validateEfactura(invoice({ company: { ...COMPANY, reg_no: "123" } })).includes("seller_idno"));
  assert.ok(validateEfactura(invoice({ company: { ...COMPANY, vat_no: "" } })).includes("seller_vat_no"));
  assert.deepEqual(validateEfactura(invoice({ company: { ...COMPANY, vat_no: "" }, amounts: { gross: 1000, net: 1000, vat: 0, rate: 0 } })), [], "no VAT, no VAT number needed");
  assert.ok(validateEfactura(invoice({ currency: "EUR" })).includes("currency_not_mdl"));
  assert.ok(validateEfactura(invoice({ buyer: { name: "Firma SRL", kind: "company", idno: "12" } })).includes("buyer_idno"));
  assert.ok(validateEfactura(invoice({ amounts: { gross: 120000, net: 100000, vat: 19999, rate: 20 } })).includes("totals"));
  assert.ok(validateEfactura(invoice({ amounts: { gross: 0, net: 0, vat: 0, rate: 0 } })).includes("no_amount"));
});

test("SFS mock: accepts a valid invoice with a fiscal number, rejects a bad one, same answer each time", async () => {
  const a = sfsMockAdapter();
  const ok = await a.submit(invoice());
  assert.equal(ok.status, "accepted");
  assert.equal(ok.fiscalNumber, "EF2026000042");
  assert.match(ok.sfsRef, /^MOCK-SFS-[0-9A-F]{10}$/);
  assert.deepEqual(await a.submit(invoice()), ok, "deterministic");
  const bad = await a.submit(invoice({ company: { ...COMPANY, reg_no: "" } }));
  assert.equal(bad.status, "rejected");
  assert.equal(bad.code, "seller_idno");
});

test("real SFS without credentials answers not_configured, and is only chosen when enabled", async () => {
  assert.deepEqual(await sfsAdapter({}).submit(invoice()), { ok: false, error: "not_configured" });
  assert.equal(efacturaAdapterFor({}).id, "sfs_mock");
  assert.equal(efacturaAdapterFor({ SFS_ENABLED: "on" }).id, "sfs");
  // live: no made-up "accepted" unless the simulation is switched on on purpose
  assert.equal(efacturaAdapterFor({ VERCEL_ENV: "production" }).id, "sfs");
  assert.equal(efacturaAdapterFor({ NODE_ENV: "production" }).id, "sfs");
  assert.equal(efacturaAdapterFor({ VERCEL_ENV: "production", EFACTURA_SIMULATION: "on" }).id, "sfs_mock");
  assert.equal(efacturaAdapterFor({ VERCEL_ENV: "preview" }).id, "sfs_mock");
});

// ---- 1C export -----------------------------------------------------------

test("money and dates in the mapping's form", () => {
  assert.equal(fmtMoney(123456), "1234,56");
  assert.equal(fmtMoney(123456, "."), "1234.56");
  assert.equal(fmtMoney(-5), "-0,05");
  assert.equal(fmtMoney(7), "0,07");
  assert.equal(fmtDate("2026-10-18", "DD.MM.YYYY"), "18.10.2026");
  assert.equal(fmtDate("2026-10-18T09:00:00Z", "YYYY-MM-DD"), "2026-10-18");
  assert.equal(fmtDate("2026-10-18", "DD/MM/YYYY"), "18/10/2026");
  assert.equal(fmtDate("", "DD.MM.YYYY"), "");
  assert.equal(inRange("2026-10-18", "2026-10-01", "2026-10-31"), true);
  assert.equal(inRange("2026-11-01", "2026-10-01", "2026-10-31"), false);
  // the day is the one on the Chișinău clock (UTC+2 after the clocks go back), as the invoice prints it
  assert.equal(inRange("2026-10-31T21:30:00Z", "2026-10-01", "2026-10-31"), true, "the end day is included");
  assert.equal(inRange("2026-10-31T22:30:00Z", "2026-10-01", "2026-10-31"), false, "00:30 on 1 November is November's");
});

test("a mapping from the browser is cleaned: no clash between delimiter and decimal, headers kept short", () => {
  const m = cleanMapping({ delimiter: ",", decimal: ",", dateFormat: "nope", headers: { invoices: { number: "Номер\nдок" } } });
  assert.equal(m.delimiter, ",");
  assert.equal(m.decimal, ".");
  assert.equal(m.dateFormat, "DD.MM.YYYY");
  assert.equal(m.headers.invoices.number, "Номер док");
  assert.equal(m.headers.invoices.date, DEFAULT_MAPPING.headers.invoices.date);
  assert.equal(cleanMapping({ delimiter: "|" }).delimiter, ";");
});

test("CSV for 1C: headers from the mapping, BOM, quoting, formula cells defused", () => {
  const csv = toCsv("customers", [{ code: "C1", name: "Popescu; Ion", kind: "person", idno: "", address: "str. \"Mare\" 1", phone: "+37369000000", email: "=HYPERLINK(1)" }]);
  assert.ok(csv.startsWith("﻿Cod;Denumire;"));
  const line = csv.split("\r\n")[1];
  assert.ok(line.includes("\"Popescu; Ion\""));
  assert.ok(line.includes("\"str. \"\"Mare\"\" 1\""));
  assert.ok(line.includes(";+37369000000;"), "a phone number stays a phone number");
  assert.ok(toCsv("customers", [{ name: "+cmd|' /C calc'!A0" }]).includes("'+cmd"), "a formula behind a + is defused");
  assert.ok(line.includes("'=HYPERLINK(1)"));
  const inv = toCsv("invoices", [{ number: "VM-1", date: "2026-10-18", customer_code: "C1", customer: "Ion", net: 10000000, vat_rate: 20, vat: 2000000, gross: 12000000, currency: "MDL", fiscal_number: "" }], { delimiter: "\t", decimal: ".", dateFormat: "YYYY-MM-DD", bom: false });
  assert.equal(inv.split("\r\n")[1], "VM-1\t2026-10-18\tC1\tIon\t100000.00\t20\t20000.00\t120000.00\tMDL\t");
  assert.equal(FIELDS.invoices.length, inv.split("\r\n")[0].split("\t").length);
});

test("XML for 1C: one document, escaped, money with a dot", () => {
  const xml = toXml({ customers: [{ code: "C1", name: "A & B <SRL>" }], invoices: [], payments: [{ date: "2026-10-18", invoice_number: "VM-1", customer_code: "C1", amount: 500000, currency: "MDL", method: "bank", reference: "OP 12" }] }, { from: "2026-10-01", to: "2026-10-31", company: "SolarTech" });
  assert.ok(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
  assert.ok(xml.includes("name=\"A &amp; B &lt;SRL&gt;\""));
  assert.ok(xml.includes("amount=\"5000.00\""));
  assert.ok(xml.includes("from=\"2026-10-01\" to=\"2026-10-31\""));
});

// ---- grid operator ---------------------------------------------------------

test("each operator has a checklist with the filled form made by VoltMira, in 4 languages", () => {
  for (const [op, kind] of [["premier", "person"], ["rednord", "person"], ["premier", "company"], ["rednord", "company"]]) {
    const list = checklistFor(op, kind);
    assert.ok(list.find((d) => d.id === "application" && d.auto));
    for (const d of list) for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(d.name[l], `${op}.${d.id}.${l}`);
      assert.doesNotMatch(d.name[l], /[—–·✓✔]/);
    }
    for (const d of list) assert.doesNotMatch(d.name.uk, /[ыэъё]/i, `${op}.${d.id} uk`);
  }
});

test("the package is complete only with the details and every required document", () => {
  const all = ["signed", "id_copy", "property"];
  assert.equal(checkPackage({ operator: "premier", attached: all }).complete, true);
  const noDetails = checkPackage({ operator: "premier", attached: all, missingDetails: ["applicant_idnp"] });
  assert.equal(noDetails.complete, false);
  assert.deepEqual(noDetails.missingDetails, ["applicant_idnp"]);
  const rep = checkPackage({ operator: "premier", attached: all, representative: true });
  assert.deepEqual(rep.missingDocs, ["authorization"], "a representative needs the power of attorney");
  assert.equal(checkPackage({ operator: "nobody", attached: all }).complete, false);
});

test("what is asked depends on who applies: a person the identity card, a company the register extract under 3 months old, the site sketch", () => {
  const ids = (op, kind) => checklistFor(op, kind).map((d) => d.id);
  assert.deepEqual(ids("rednord", "person"), ["application", "signed", "id_copy", "property", "authorization"]);
  assert.deepEqual(ids("premier", "company"), ["application", "signed", "registry_extract", "property", "site_sketch", "owner_consent", "authorization"]);
  // a single-line diagram and data sheets are not asked of a small plant, for either operator
  for (const op of ["premier", "rednord"]) for (const kind of ["person", "company"]) {
    assert.ok(!ids(op, kind).includes("single_line") && !ids(op, kind).includes("equipment"));
  }
  const co = checkPackage({ operator: "rednord", kind: "company", attached: ["signed", "property"] });
  assert.deepEqual(co.missingDocs, ["registry_extract", "site_sketch"]);
  // the owner's consent is only for an applicant who is not the owner: never required on its own
  assert.ok(!checkPackage({ operator: "rednord", kind: "company", attached: ["signed", "registry_extract", "property", "site_sketch"] }).missingDocs.length);
  // a package already sent under an earlier list can still be named
  assert.ok(docName("single_line", "ro"));
});

test("installed power above the contracted power, the household ceiling or 200 kW stops the file", () => {
  const ok = ["signed", "id_copy", "property"];
  assert.equal(checkPackage({ operator: "premier", attached: ok, installedKw: 8, contractedKw: 10, ceilingKw: 10.8 }).complete, true);
  const over = checkPackage({ operator: "premier", attached: ok, installedKw: 12, contractedKw: 10, ceilingKw: 10.8 });
  assert.equal(over.complete, false);
  assert.deepEqual(over.powerBlocks, ["over_contracted", "over_household_ceiling"]);
  assert.deepEqual(checkPackage({ operator: "premier", attached: ok, installedKw: 8 }).powerWarns, ["contracted_missing"]);
});

test("grid statuses move only forward, and docs requested goes back to submitted", () => {
  assert.deepEqual(nextGridStatus("submitted", "approved"), { ok: true });
  assert.deepEqual(nextGridStatus("submitted", "docs_requested"), { ok: true });
  assert.deepEqual(nextGridStatus("docs_requested", "submitted"), { ok: true });
  assert.deepEqual(nextGridStatus("approved", "connected"), { ok: true });
  assert.deepEqual(nextGridStatus("connected", "submitted"), { ok: false, error: "bad_transition" });
  assert.deepEqual(nextGridStatus("submitted", "connected"), { ok: false, error: "bad_transition" });
  assert.deepEqual(nextGridStatus("submitted", "lost"), { ok: false, error: "unknown_status" });
  assert.deepEqual(nextGridStatus("approved", "approved"), { ok: true, same: true });
  assert.deepEqual(gridNext("rejected"), []);
  assert.equal(STAGE_FOR.connected, "meter");
});

test("the tracked reference names the operator and the day", () => {
  const r = newGridReference("rednord", new Date("2026-10-18T12:00:00Z"));
  assert.match(r, /^VM-R-261018-[0-9A-F]{4}$/);
  assert.match(newGridReference("premier"), /^VM-P-\d{6}-[0-9A-F]{4}$/);
  assert.ok(r.length >= 6 && r.length <= 40, "fits the column check");
});

test("grid adapters: mock records only; email sends the package, and fails clearly", async () => {
  assert.deepEqual(await gridMockAdapter().submit({}), { ok: true, channel: "mock" });
  const sent = [];
  const io = { sendEmail: async (m) => { sent.push(m); return { sent: true }; }, emailConfigured: () => true };
  const a = gridEmailAdapter({ ...io, to: "racordare@op.test" });
  assert.deepEqual(await a.submit({ subject: "VM-P-1", html: "<p>x</p>", attachments: [] }), { ok: true, channel: "email" });
  assert.equal(sent[0].to, "racordare@op.test");
  assert.equal(sent[0].subject, "VM-P-1");
  const down = gridEmailAdapter({ sendEmail: async () => ({ sent: false, error: "smtp" }), emailConfigured: () => true, to: "x@y.z" });
  assert.deepEqual(await down.submit({}), { ok: false, error: "smtp", retryable: true });
  assert.equal((await gridEmailAdapter({ ...io, emailConfigured: () => false, to: "x@y.z" }).submit({})).error, "email_not_configured");
  assert.equal(gridAdapterFor("premier", io, {}).id, "mock");
  assert.equal(gridAdapterFor("rednord", io, { GRID_EMAIL_REDNORD: "r@x.md" }).id, "email");
  assert.equal(gridAdapterFor("premier", io, { GRID_EMAIL_REDNORD: "r@x.md" }).id, "mock");
});

test("the export's rows: invoices and payments inside the range, each customer once", async () => {
  const { buildExportRows, customerCode } = await import("./export1c.js");
  const projects = [
    { id: "aaaaaaaa-1111-2222-3333-444444444444", invoice_no: "PF-2026-0001", invoiced_at: "2026-10-02T10:00:00Z", client_name: "Ion Popescu", client_email: "Ion@x.md", address: "Ialoveni" },
    { id: "bbbbbbbb-1111-2222-3333-444444444444", invoice_no: "PF-2026-0002", invoiced_at: "2026-11-02T10:00:00Z", client_name: "Ion Popescu", client_email: "ion@x.md" },
    { id: "cccccccc-1111-2222-3333-444444444444", invoice_no: "PF-2026-0003", invoiced_at: "2026-10-20T10:00:00Z", client_name: "Agro SRL", client_kind: "sme", client_profile: { buyerIdno: "1003600012345" } },
  ];
  const amounts = new Map(projects.map((p) => [p.id, { net: 100000, vat: 20000, gross: 120000, rate: 20, cur: "MDL" }]));
  const payments = [
    { project_id: projects[0].id, paid_at: "2026-10-05", amount_minor: 3600000, currency: "MDL", method: "bank", reference: "OP 1" },
    { project_id: projects[1].id, paid_at: "2026-10-30", amount_minor: 100000, currency: "MDL", method: "cash" },
    { project_id: "someone-else", paid_at: "2026-10-06", amount_minor: 1, currency: "MDL", method: "cash" },
  ];
  const r = buildExportRows({ projects, amounts, payments, fiscal: new Map([[projects[0].id, "EF2026000001"]]), from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(r.invoices.map((i) => [i.number, i.gross, i.fiscal_number]), [["PF-2026-0001", 12000000, "EF2026000001"], ["PF-2026-0003", 12000000, ""]]);
  assert.deepEqual(r.payments.map((m) => m.invoice_number), ["PF-2026-0001", "PF-2026-0002"], "a payment in range on an invoice outside it is still exported");
  assert.equal(customerCode(projects[0]), customerCode(projects[1]), "the same client email is one customer");
  assert.equal(r.customers.length, 2);
  assert.deepEqual(r.customers.find((c) => c.kind === "company"), { code: customerCode(projects[2]), name: "Agro SRL", kind: "company", idno: "1003600012345", address: "", phone: "", email: "" });
  const csv = toCsv("invoices", r.invoices);
  assert.ok(csv.includes("PF-2026-0001;02.10.2026;"));
  assert.ok(csv.includes(";100000,00;20;20000,00;120000,00;MDL;EF2026000001"));
});

test("the export's date range", async () => {
  const { rangeOk } = await import("./export1c.js");
  assert.equal(rangeOk("2026-10-01", "2026-10-31"), true);
  assert.equal(rangeOk("2026-10-31", "2026-10-01"), false);
  assert.equal(rangeOk("2025-01-01", "2026-10-31"), false, "more than a year");
  assert.equal(rangeOk("2026-13-01", "2026-13-02"), false);
  assert.equal(rangeOk("", "2026-10-01"), false);
});
