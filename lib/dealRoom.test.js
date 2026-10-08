import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ITEM_IDS, fileType, checkUpload, safeName, docPath, isToken, linkState, expiryFrom, cleanBank, cleanQuestion,
  docsByItem, docCounts, questionsByItem, isAnswered, itemFolder, packPaths, viewSummary, sizeText, ALLOWED_TYPES, MAX_FILE_BYTES,
} from "./dealRoom.js";
import { PERMITS } from "./plantPermits.js";

test("every checklist item can hold documents, and so can 'other'", () => {
  assert.deepEqual(ITEM_IDS, [...PERMITS.map((p) => p.id), "other"]);
});

test("file types: papers, scans, sheets and site files; nothing executable", () => {
  assert.equal(fileType("Aviz.PDF").mime, "application/pdf");
  assert.equal(fileType("plan.kmz").ext, "kmz");
  assert.equal(fileType("setup.exe"), null);
  assert.equal(fileType("noext"), null);
  assert.ok(ALLOWED_TYPES.includes("application/pdf"));
  assert.deepEqual(checkUpload({ name: "a.pdf", size: 10 }), { ok: true, mime: "application/pdf" });
  assert.equal(checkUpload({ name: "a.exe", size: 10 }).error, "type");
  assert.equal(checkUpload({ name: "a.pdf", size: 0 }).error, "empty");
  assert.equal(checkUpload({ name: "a.pdf", size: MAX_FILE_BYTES + 1 }).error, "size");
});

test("names are made Storage-safe, the extension kept", () => {
  assert.equal(safeName("Autorizație de construire nr. 12.pdf"), "Autorizatie-de-construire-nr.-12.pdf");
  assert.equal(safeName("Încheiere ANRE (ș, ț).docx"), "Incheiere-ANRE-s-t.docx");
  assert.equal(safeName("Договор аренды.pdf"), "document.pdf");
  assert.equal(safeName(""), "document");
  assert.equal(safeName("sample_hybrid_ab12", "plant"), "sample_hybrid_ab12");
});

test("a document's path starts with the company, as the Storage policies require", () => {
  const p = docPath({ companyId: "c1", portfolioId: "p1", plantId: "pl_x", itemId: "grid", fileName: "Aviz tehnic.pdf", nonce: "ab12cd" });
  assert.equal(p, "c1/p1/pl_x/grid/ab12cd-Aviz-tehnic.pdf");
  assert.throws(() => docPath({ companyId: "c1", portfolioId: "p1", plantId: "x", itemId: "../x", fileName: "a.pdf", nonce: "1" }));
});

test("a link is open until it expires or is revoked", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  assert.equal(linkState({ expires_at: "2026-10-05T00:00:00Z" }, now), "active");
  assert.equal(linkState({ expires_at: "2026-10-04T11:59:59Z" }, now), "expired");
  assert.equal(linkState({ expires_at: "2026-11-01T00:00:00Z", revoked_at: "2026-10-04T10:00:00Z" }, now), "revoked");
  assert.equal(linkState(null, now), "missing");
  assert.equal(expiryFrom(14, now), "2026-10-18T12:00:00.000Z");
  assert.equal(expiryFrom(999, now), "2026-11-03T12:00:00.000Z");
  assert.ok(isToken("a".repeat(32)));
  assert.ok(!isToken("short"));
  assert.ok(!isToken("a".repeat(31) + "/"));
  assert.equal(cleanBank("  OTP   Bank \n"), "OTP Bank");
});

test("a bank's question names its item and has text", () => {
  assert.deepEqual(cleanQuestion({ item: "grid", name: " Ana  Pop ", body: "  Când e avizul?\r\n" }), { ok: true, item: "grid", name: "Ana Pop", body: "Când e avizul?" });
  assert.equal(cleanQuestion({ item: "nope", body: "x" }).error, "item");
  assert.equal(cleanQuestion({ item: "grid", body: "  " }).error, "empty");
  assert.equal(cleanQuestion({ item: "grid", body: "x".repeat(2001) }).error, "long");
});

test("documents and questions grouped by item; the counts mark the checklist", () => {
  const docs = [
    { item_id: "grid", name: "b.pdf", created_at: "2026-10-02" },
    { item_id: "grid", name: "a.pdf", created_at: "2026-10-01" },
    { item_id: "land", name: "c.pdf", created_at: "2026-10-03" },
    { item_id: "bogus", name: "x.pdf", created_at: "2026-10-03" },
  ];
  const g = docsByItem(docs);
  assert.deepEqual(g.grid.map((d) => d.name), ["a.pdf", "b.pdf"]);
  assert.deepEqual(docCounts(docs), { grid: 2, land: 1 });
  const qs = [
    { item_id: "grid", body: "1", answer: "", created_at: "2026-10-01" },
    { item_id: "grid", body: "2", answer: "da", created_at: "2026-10-02" },
    { item_id: "land", body: "3", answer: "", answer_doc_id: "d1", created_at: "2026-10-03" },
  ];
  const q = questionsByItem(qs);
  assert.deepEqual(q.byItem.grid.map((x) => x.body), ["2", "1"]);
  assert.equal(q.open, 1);
  assert.ok(isAnswered(qs[2]));
});

test("in the pack each item is a numbered folder, and a repeated name gets a number", () => {
  assert.equal(itemFolder("land"), "05-documents/01-land-rights-ownership-or-lease");
  assert.equal(itemFolder("other"), "05-documents/13-other-documents");
  const paths = packPaths([
    { item_id: "grid", name: "Aviz.pdf" }, { item_id: "grid", name: "aviz.pdf" }, { item_id: "grid", name: "Aviz.pdf" }, { item_id: "zzz", name: "n.txt" },
  ]);
  assert.equal(paths[0], `${itemFolder("grid")}/Aviz.pdf`);
  assert.equal(paths[1], `${itemFolder("grid")}/aviz (2).pdf`);
  assert.equal(paths[2], `${itemFolder("grid")}/Aviz (3).pdf`);
  assert.ok(paths[3].startsWith(itemFolder("other")));
});

test("the access log per link: visits a day, first and last, what was opened", () => {
  const v = [
    { link_id: "L", what: "open", visitor: "a", at: "2026-10-01T09:00:00Z" },
    { link_id: "L", what: "document", visitor: "a", at: "2026-10-01T09:05:00Z" },
    { link_id: "L", what: "open", visitor: "a", at: "2026-10-02T10:00:00Z" },
    { link_id: "L", what: "pack", visitor: "b", at: "2026-10-02T11:00:00Z" },
  ];
  const s = viewSummary(v).L;
  assert.equal(s.opens, 2);
  assert.equal(s.documents, 1);
  assert.equal(s.packs, 1);
  assert.equal(s.visits, 3);
  assert.equal(s.first, "2026-10-01T09:00:00Z");
  assert.equal(s.last, "2026-10-02T11:00:00Z");
  assert.equal(sizeText(820 * 1024), "820 KB");
  assert.equal(sizeText(3.44 * 1024 * 1024, "ro"), "3,4 MB");
});
