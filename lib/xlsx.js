// lib/xlsx.js — a real Excel workbook (.xlsx) from plain data, with formulas.
//
// A bank's analyst wants to see HOW a number was reached, not be handed it, so
// a cell can carry a formula (with its computed value cached, so a viewer that
// does not recalculate still shows numbers) and the workbook asks Excel to
// recalculate everything when it opens. Strings are written inline, which
// every reader accepts. No dependency; the ZIP comes from lib/zip.js.
//
// A cell is a string, a number, null, or an object:
//   { v: value, f: "SUM(A1:A3)", s: "pct" }
// `s` picks a style: "bold", "head" (bold with a fill), "int", "num", "pct",
// "eur" (#,##0), "x" (0.00"x"), "note" (grey, italic), "wrap".
import { zip } from "./zip.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // characters XML 1.0 forbids
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** 0 -> A, 25 -> Z, 26 -> AA */
export function colName(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export const cellRef = (row, col) => colName(col) + (row + 1);

// style ids, in the order styles.xml declares them
const STYLE = { default: 0, bold: 1, head: 2, int: 3, num: 4, pct: 5, eur: 6, x: 7, note: 8, wrap: 9 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="0.00&quot;x&quot;"/><numFmt numFmtId="165" formatCode="#,##0;[Red]\\-#,##0"/></numFmts>
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE4EFE9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cellXml(ref, c) {
  if (c == null || c === "") return "";
  const o = typeof c === "object" && !Array.isArray(c) ? c : { v: c };
  // an empty styled cell is nothing (never the text "null")
  if (!o.f && (o.v == null || o.v === "")) return "";
  const s = o.s && STYLE[o.s] ? ` s="${STYLE[o.s]}"` : "";
  if (o.f) {
    const v = o.v;
    const cached = typeof v === "number" && Number.isFinite(v) ? `<v>${v}</v>` : typeof v === "string" ? `<v>${esc(v)}</v>` : "";
    const t = typeof v === "string" ? ' t="str"' : "";
    return `<c r="${ref}"${s}${t}><f>${esc(o.f)}</f>${cached}</c>`;
  }
  const v = o.v;
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>` : "";
  if (typeof v === "boolean") return `<c r="${ref}"${s} t="b"><v>${v ? 1 : 0}</v></c>`;
  const text = String(v);
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}

function sheetXml(sheet) {
  const rows = sheet.rows || [];
  const widths = sheet.widths || [];
  let maxCol = 0;
  const body = rows.map((row, r) => {
    const cells = (row || []).map((c, i) => { maxCol = Math.max(maxCol, i + 1); return cellXml(cellRef(r, i), c); }).join("");
    return cells ? `<row r="${r + 1}">${cells}</row>` : "";
  }).join("");
  const cols = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  let freeze = "";
  if (sheet.freeze && (sheet.freeze.row || sheet.freeze.col)) {
    const fr = sheet.freeze.row || 0, fc = sheet.freeze.col || 0;
    const pane = fr && fc ? "bottomRight" : fr ? "bottomLeft" : "topRight";
    const attrs = (fc ? ` xSplit="${fc}"` : "") + (fr ? ` ySplit="${fr}"` : "");
    freeze = `<sheetViews><sheetView workbookViewId="0"><pane${attrs} topLeftCell="${cellRef(fr, fc)}" activePane="${pane}" state="frozen"/></sheetView></sheetViews>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${body}</sheetData></worksheet>`;
}

const safeName = (n, i) => String(n || "Sheet" + (i + 1)).replace(/[\[\]:*?/\\]/g, " ").slice(0, 31).trim() || "Sheet" + (i + 1);

/**
 * @param {Array<{name:string, rows:Array<Array<any>>, widths?:number[], freeze?:{row?:number,col?:number}}>} sheets
 * @returns {Uint8Array}
 */
export function buildXlsx(sheets, opts = {}) {
  const list = sheets.map((s, i) => ({ ...s, name: safeName(s.name, i) }));
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: STYLES_XML },
    ...list.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ];
  return zip(files, opts);
}
