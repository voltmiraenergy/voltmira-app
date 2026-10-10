// lib/docx.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocx, docxText } from "./docx.js";
import { unzip } from "./zip.js";

test("a built .docx is a well-formed OOXML package: the required parts, with real text, no Type3 bitmap fonts", () => {
  const bytes = buildDocx([
    { h1: "Southern hybrid park" },
    { p: "Prepared by SolarTech Chișinău" },
    { note: "Sample data." },
    { h2: "Contents" },
    { table: { head: ["File", "Description"], rows: [["01-credit-summary-ro.pdf", "Credit summary"]] } },
    { bullets: ["Name the borrower", "Grid connection: In progress"] },
    { pageBreak: true },
    { hr: true },
  ], { title: "Southern hybrid park", creator: "VoltMira" });
  const files = unzip(bytes);
  const names = files.map((f) => f.name);
  for (const n of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/numbering.xml", "docProps/core.xml"]) {
    assert.ok(names.includes(n), `has ${n}`);
  }
  // this app embeds no fonts in a .docx (Word provides them), so there is
  // nothing here that could repeat the Type3-bitmap-font bug a PDF can have
  const doc = new TextDecoder().decode(files.find((f) => f.name === "word/document.xml").data);
  assert.ok(doc.includes("<?xml"), "a declared XML document");
  assert.ok(!/Type3/.test(doc));
  const text = docxText(bytes);
  assert.match(text, /Southern hybrid park/);
  assert.match(text, /Prepared by SolarTech Chișinău/);
  assert.match(text, /Sample data\./);
  assert.match(text, /Name the borrower/);
  assert.match(text, /01-credit-summary-ro\.pdf/);
  assert.match(text, /Credit summary/);
});

test("a run can be bold, italic, coloured or monospaced without corrupting the XML", () => {
  const bytes = buildDocx([{ p: [{ text: "SHA-256 ", bold: true }, { text: "abc123", mono: true, color: "5B6A62" }] }]);
  const files = unzip(bytes);
  const doc = new TextDecoder().decode(files.find((f) => f.name === "word/document.xml").data);
  assert.match(doc, /<w:b\/>/);
  assert.match(doc, /Consolas/);
  assert.match(doc, /w:val="5B6A62"/);
  assert.equal(docxText(bytes).trim(), "SHA-256 abc123");
});

test("text with XML-special characters round-trips through docxText", () => {
  const bytes = buildDocx([{ p: "Risk < reward & \"quoted\" > stated" }]);
  assert.match(docxText(bytes), /Risk < reward & "quoted" > stated/);
});
