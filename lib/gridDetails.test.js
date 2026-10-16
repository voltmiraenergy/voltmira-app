import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanGridDetails, gridApplicant, gridMissing } from "./gridDetails.js";

test("only known fields are kept, trimmed and bounded", () => {
  const d = cleanGridDetails({ kind: "x", name: "  Ion   Rusu ", idn: "2002-0000-12345", phone: "+373 69 <b>12 34 56", receive: "fax", contractedKw: "6.5", evil: "drop" });
  assert.equal(d.kind, "person");
  assert.equal(d.name, "Ion Rusu");
  assert.equal(d.idn, "2002000012345");
  assert.equal(d.phone, "+373 69 12 34 56");
  assert.equal(d.receive, "email");
  assert.equal(d.contractedKw, 6.5);
  assert.equal("evil" in d, false);
});

test("the quote fills what was not typed, and a company name makes a company", () => {
  const a = gridApplicant(null, { client_name: "Agro Nord SRL", client_email: "a@b.md", address: "Bălți, str. Ștefan cel Mare 1" });
  assert.equal(a.kind, "company");
  assert.equal(a.siteAddress, "Bălți, str. Ștefan cel Mare 1");
  assert.equal(a.homeAddress, a.siteAddress);
  assert.equal(a.email, "a@b.md");
  const typed = gridApplicant({ kind: "person", homeAddress: "Chișinău, str. A 2" }, { client_name: "Agro Nord SRL", address: "Bălți" });
  assert.equal(typed.kind, "person");
  assert.equal(typed.homeAddress, "Chișinău, str. A 2");
});

test("missing fields are named, so the card can say what the operator will ask for", () => {
  assert.deepEqual(gridMissing(gridApplicant({ idn: "123" }, { client_name: "Ion", address: "x" })), ["idn", "phone", "cadastral", "email"]);
  assert.deepEqual(gridMissing(gridApplicant({ phone: "069", cadastral: "0100", receive: "office" }, { client_name: "Ion", address: "x" })), []);
});
