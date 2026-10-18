import { test } from "node:test";
import assert from "node:assert/strict";
import { isPdfUrl, isStandalone, openPdfInApp } from "./openPdf.js";

const O = "https://voltmira.com";

test("the app's PDF addresses are recognised", () => {
  assert.ok(isPdfUrl("/api/proposal/qdns8d3g/pdf", O));
  assert.ok(isPdfUrl("/api/projects/abc/racordare-pdf?op=premier", O));
  assert.ok(isPdfUrl("/files/offer.pdf", O));
  assert.ok(isPdfUrl("https://voltmira.com/api/proposal/x/pdf", O));
});

test("everything else is left alone", () => {
  assert.ok(!isPdfUrl("/api/portfolios/x/model", O), "the Excel model");
  assert.ok(!isPdfUrl("/api/portfolios/x/dataroom", O), "the data room zip");
  assert.ok(!isPdfUrl("/projects/abc", O));
  assert.ok(!isPdfUrl("/p/qdns8d3g", O));
  assert.ok(!isPdfUrl("https://example.com/a.pdf", O), "another site");
  assert.ok(!isPdfUrl("::nonsense::", "not an origin"));
});

test("outside a browser: not installed, and nothing is opened", () => {
  assert.equal(isStandalone(), false);
  assert.equal(openPdfInApp("/api/proposal/x/pdf"), false);
});
