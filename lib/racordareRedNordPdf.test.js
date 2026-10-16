import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { redNordValues, fillRedNordPdf } from "./racordareRedNordPdf.js";

const TODAY = new Date("2026-09-27T09:00:00Z");

test("a household with a battery: the fields the app knows, nothing it doesn't", () => {
  const v = redNordValues({
    clientName: "Ion Rusu", clientPhone: "069 123 456", siteAddress: "str. Independenței 12, mun. Bălți",
    productionKw: 5, hasBattery: true, battKwh: 10, phases: 1, today: TODAY,
  });
  assert.equal(v.text.Text1, "Ion Rusu");
  assert.equal(v.text.Text103, "Independenței");
  assert.equal(v.text.Text104, "12");
  assert.equal(v.text.Text102, "mun. Bălți");
  assert.equal(v.text.Text107, "5.0");
  assert.equal(v.text.Text109, "10.0");
  assert.equal(v.text.Text16, "69 123 456");       // after the form's own "(0"
  assert.equal(v.text.Text112, "27.09.2026");
  assert.equal(v.text.Text113, "Ion Rusu");
  assert.equal("Text111" in v.text, false);        // no email known: left blank
  assert.equal("Text106" in v.text, false);        // contracted power: never guessed
  for (const c of ["Check Box1", "Check Box12", "Check Box14", "Check Box105", "Check Box101", "Check Box100"]) assert.ok(v.check.includes(c), c);
  assert.ok(!v.check.includes("Check Box103"));
});

test("a company applies as a legal person; unknown phases leave the voltage to the installer", () => {
  const v = redNordValues({ clientName: "AgroNord SRL", productionKw: 30, clientEmail: "office@agronord.md", today: TODAY });
  assert.ok(v.check.includes("Check Box2"));
  assert.ok(!v.check.includes("Check Box1"));
  assert.ok(!v.check.includes("Check Box100") && !v.check.includes("Check Box103"));
  assert.ok(v.check.includes("Check Box109"));
  assert.equal(v.text.Text111, "office@agronord.md");
  assert.ok(!v.check.includes("Check Box101"));   // no battery, no storage box
});

test("the real RED Nord PDF is filled and stays fillable", async () => {
  const bytes = await fillRedNordPdf({ clientName: "Ana Țurcanu", siteAddress: "str. Ștefan cel Mare 3, or. Soroca", productionKw: 6, today: TODAY });
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  assert.equal(form.getTextField("Text1").getText(), "Ana Țurcanu");
  assert.equal(form.getTextField("Text102").getText(), "or. Soroca");
  assert.equal(form.getTextField("Text107").getText(), "6.0");
  assert.equal(form.getCheckBox("Check Box14").isChecked(), true);
  assert.equal(form.getTextField("Text105").getText() || "", "");   // cadastral number: blank
  assert.ok(form.getFields().length >= 50);
});

test("the applicant's saved details fill IDNO, phone, cadastral number, home address and the receiving box", () => {
  const { text, check } = redNordValues({
    clientName: "Ion Rusu", siteAddress: "Bălți, str. Ștefan cel Mare 1",
    applicant: { kind: "company", name: "Agro Nord SRL", idn: "1003600012345", phone: "069123456", cadastral: "0300108.123", homeAddress: "Chișinău, str. Mihai Eminescu 5", siteAddress: "Bălți, str. Ștefan cel Mare 1", contractedKw: 15, repName: "Ion Rusu", receive: "office", email: "a@b.md" },
  });
  assert.equal(text["Text1"], "Agro Nord SRL");
  assert.equal(text["Text18"], "1003600012345");
  // the form prints "mobil (0" itself
  assert.equal(text["Text16"], "69123456");
  assert.equal(redNordValues({ applicant: { phone: "+373 69 123 456" } }).text["Text16"], "69 123 456");
  assert.equal(text["Text105"], "0300108.123");
  assert.equal(text["Text106"], "15.0");
  assert.equal(text["Text100"], "Ion Rusu");
  assert.ok(check.includes("Check Box2"));     // a company
  assert.ok(check.includes("Check Box111"));   // the State Register extract
  assert.ok(check.includes("Check Box106"));   // collected at the office
  assert.ok(!check.includes("Check Box109"));  // so not by email
});
