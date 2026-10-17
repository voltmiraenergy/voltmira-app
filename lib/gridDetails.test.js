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

test("the IDNP or IDNO control digit catches a typo", async () => {
  const { idnValid } = await import("./gridDetails.js");
  assert.equal(idnValid("1008600038413"), true);     // python-stdnum's published example
  assert.equal(idnValid("1008600038412"), false);
  assert.equal(idnValid("100860003841"), false);
  assert.deepEqual(gridMissing(gridApplicant({ idn: "1008600038412", phone: "069", cadastral: "1", receive: "office" }, { client_name: "Ion", address: "x" })), ["idn"]);
});

test("a client's earlier details fill a new quote; the site's numbers only for the same site", async () => {
  const { reuseApplicant } = await import("./gridDetails.js");
  const prev = { idn: "1008600038413", phone: "069111222", cadastral: "0100.1", nlc: "77", siteAddress: "Str. Mare 5, Ialoveni", email: "a@b.md" };
  const other = reuseApplicant(prev, "Str. Mică 1, Ialoveni");
  assert.equal(other.idn, "1008600038413");
  assert.equal(other.phone, "069111222");
  assert.equal("cadastral" in other, false);
  const same = reuseApplicant(prev, "str. mare 5,  Ialoveni");
  assert.equal(same.cadastral, "0100.1");
  assert.equal(same.nlc, "77");
});
