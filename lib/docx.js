// lib/docx.js — a Word document (.docx) from a short block list, with no
// dependency: a .docx is a ZIP of XML parts (lib/zip.js already does the ZIP
// side for the Excel export, lib/xlsx.js). Pure; no I/O.
//
// A caller builds a document as an array of blocks: { h1 }, { h2 }, { p },
// { note } (an italic muted callout), { bullets }, { table }, { pageBreak },
// { hr } (a divider rule). A `p`, a bullet item, or a table cell is either a
// plain string or a styled run { text, bold, italic, color, mono }, or an
// array of such runs for mixed formatting on one line.
import { zip, unzip } from "./zip.js";

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function run(r) {
  const o = typeof r === "string" ? { text: r } : r;
  const props = [];
  if (o.bold) props.push("<w:b/>");
  if (o.italic) props.push("<w:i/>");
  if (o.color) props.push(`<w:color w:val="${o.color}"/>`);
  if (o.mono) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>');
  if (o.size) props.push(`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`);
  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(o.text)}</w:t></w:r>`;
}

function runs(content) {
  return (Array.isArray(content) ? content : [content]).map(run).join("");
}

/** @param {string|object|Array} content @param {object} [opts] */
function para(content, { before, after = 100, border, numId, indent, align } = {}) {
  const pPr = [];
  if (before != null || after != null) pPr.push(`<w:spacing${before != null ? ` w:before="${before}"` : ""}${after != null ? ` w:after="${after}"` : ""}/>`);
  if (border) pPr.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="BFBDAF"/></w:pBdr>');
  if (numId) pPr.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`);
  if (indent) pPr.push(`<w:ind w:left="${indent}" w:hanging="${Math.min(indent, 216)}"/>`);
  if (align) pPr.push(`<w:jc w:val="${align}"/>`);
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  return `<w:p>${pPrXml}${content != null ? runs(content) : ""}</w:p>`;
}

const TABLE_W = 9638; // usable width on A4 with 1134-twip margins each side

function table({ head, rows, mono }) {
  const n = head.length;
  const colW = Math.floor(TABLE_W / n);
  const cell = (content, { shade, bold } = {}) => {
    const tcPr = `<w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${shade ? `<w:shd w:val="clear" w:fill="${shade}"/>` : ""}</w:tcPr>`;
    const text = Array.isArray(content) ? content : [{ text: String(content), bold, mono }];
    return `<w:tc>${tcPr}${para(text, { after: 30 })}</w:tc>`;
  };
  const border = '<w:tblBorders>' + ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((e) => `<w:${e} w:val="single" w:sz="4" w:space="0" w:color="D8D6CC"/>`).join("") + "</w:tblBorders>";
  const grid = Array.from({ length: n }, () => `<w:gridCol w:w="${colW}"/>`).join("");
  const headRow = `<w:tr>${head.map((h) => cell(h, { shade: "F2F1EC", bold: true })).join("")}</w:tr>`;
  const bodyRows = rows.map((r) => `<w:tr>${r.map((c) => cell(c, { mono })).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${TABLE_W}" w:type="dxa"/>${border}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${headRow}${bodyRows}</w:tbl>`;
}

function blockXml(b) {
  if (b.h1 != null) return para({ text: b.h1, bold: true, size: 56 }, { before: 0, after: 200 });
  if (b.h2 != null) return para({ text: b.h2, bold: true, size: 26, color: "1E6B4E" }, { before: 320, after: 120, border: true });
  if (b.note != null) return para({ text: b.note, italic: true, color: "5B6A62" }, { after: 160 });
  if (b.table) return table(b.table);
  if (b.bullets) return b.bullets.map((t) => para(t, { numId: 1, indent: 360, after: 40 })).join("");
  if (b.pageBreak) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  if (b.hr) return para(null, { border: true, before: 160, after: 160 });
  return para(b.p, { after: 100 });
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W_NS}>
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style>
</w:styles>`;

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${W_NS}>
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="360" w:hanging="216"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

function coreProps({ title, subject, creator }, date) {
  const d = date.toISOString().replace(/\.\d+Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${esc(title || "")}</dc:title>
  ${subject ? `<dc:subject>${esc(subject)}</dc:subject>` : ""}
  <dc:creator>${esc(creator)}</dc:creator>
  <cp:lastModifiedBy>${esc(creator)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${d}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${d}</dcterms:modified>
</cp:coreProperties>`;
}

const APP_PROPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>VoltMira</Application></Properties>`;

/**
 * @param {Array<object>} blocks  see the file banner for the block shapes
 * @param {{title?:string, subject?:string, creator?:string, date?:Date}} [meta]
 * @returns {Uint8Array}
 */
export function buildDocx(blocks, { title = "", subject = "", creator = "VoltMira", date = new Date() } = {}) {
  const body = blocks.map(blockXml).join("") + "<w:p/>"
    + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W_NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`;
  return zip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "docProps/core.xml", data: coreProps({ title, subject, creator }, date) },
    { name: "docProps/app.xml", data: APP_PROPS },
    { name: "word/document.xml", data: document },
    { name: "word/styles.xml", data: STYLES_XML },
    { name: "word/numbering.xml", data: NUMBERING_XML },
    { name: "word/_rels/document.xml.rels", data: DOC_RELS },
  ], { date });
}

/** The visible text of a built .docx, one line per paragraph or table cell. For tests and sanity checks. */
export function docxText(bytes) {
  const file = unzip(bytes).find((f) => f.name === "word/document.xml");
  if (!file) return "";
  const xml = new TextDecoder().decode(file.data);
  const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const paras = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
  return paras.map((p) => {
    const ts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    return ts.map((t) => unesc(t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))).join("");
  }).join("\n");
}
