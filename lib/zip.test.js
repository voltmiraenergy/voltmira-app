import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, zip, unzip } from "./zip.js";
import { buildXlsx, colName, cellRef } from "./xlsx.js";

const dec = (u) => new TextDecoder().decode(u);

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("zip round-trips text, binary, empty files and non-ASCII names", () => {
  const bin = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256);
  const files = [
    { name: "readme.txt", data: "hello" },
    { name: "docs/звіт.csv", data: "a,b\n1,2\n" },
    { name: "empty.txt", data: "" },
    { name: "data.bin", data: bin },
  ];
  const back = unzip(zip(files, { date: new Date(2026, 8, 29, 12, 0, 0) }));
  assert.deepEqual(back.map((f) => f.name), files.map((f) => f.name));
  assert.equal(dec(back[0].data), "hello");
  assert.equal(dec(back[1].data), "a,b\n1,2\n");
  assert.equal(back[2].data.length, 0);
  assert.deepEqual([...back[3].data], [...bin]);
});

test("a damaged archive is refused, not half-read", () => {
  const z = zip([{ name: "a.txt", data: "important" }]);
  z[40] ^= 0xff;                         // flip a byte inside the stored data
  assert.throws(() => unzip(z), /crc/);
  assert.throws(() => unzip(new Uint8Array(10)), /not a zip/);
});

test("column letters and cell references", () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52, 701, 702].map(colName), ["A", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  assert.equal(cellRef(0, 0), "A1");
  assert.equal(cellRef(9, 27), "AB10");
});

test("xlsx has the parts Excel needs, escapes text, and carries formulas with cached values", () => {
  const x = buildXlsx([
    { name: "Summary", rows: [["Total", { f: "SUM(B2:B3)", v: 7, s: "eur" }], [null, 3], [null, 4]], widths: [20, 12], freeze: { row: 1 } },
    { name: "A/B: bad*name?", rows: [["<tag> & \"quote\" \u0001", true, { v: "text", f: 'IF(1=1,"text","")' }]] },
  ]);
  const files = Object.fromEntries(unzip(x).map((f) => [f.name, dec(f.data)]));
  for (const n of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
    assert.ok(files[n], n);
  }
  assert.match(files["xl/workbook.xml"], /fullCalcOnLoad="1"/);
  assert.match(files["xl/workbook.xml"], /name="A B  bad name"/, "illegal sheet-name characters are replaced");
  assert.match(files["xl/worksheets/sheet1.xml"], /<f>SUM\(B2:B3\)<\/f><v>7<\/v>/);
  assert.match(files["xl/worksheets/sheet1.xml"], /ySplit="1"/);
  assert.doesNotMatch(files["xl/worksheets/sheet1.xml"], /xSplit/);
  assert.match(files["xl/worksheets/sheet2.xml"], /&lt;tag&gt; &amp; &quot;quote&quot; </, "text is escaped and control characters dropped");
  assert.match(files["xl/worksheets/sheet2.xml"], /t="b"><v>1<\/v>/);
  assert.match(files["xl/worksheets/sheet2.xml"], /t="str"><f>IF\(1=1,&quot;text&quot;,&quot;&quot;\)<\/f><v>text<\/v>/);
  // every worksheet is declared in the content types and the workbook relationships
  assert.equal((files["[Content_Types].xml"].match(/worksheets\/sheet/g) || []).length, 2);
  assert.equal((files["xl/_rels/workbook.xml.rels"].match(/worksheets\/sheet/g) || []).length, 2);
});

test("non-finite numbers are left blank, never written as NaN", () => {
  const x = buildXlsx([{ name: "S", rows: [[NaN, Infinity, 5]] }]);
  const sheet = dec(unzip(x).find((f) => f.name === "xl/worksheets/sheet1.xml").data);
  assert.doesNotMatch(sheet, /NaN|Infinity/);
  assert.match(sheet, /<c r="C1"><v>5<\/v><\/c>/);
});
