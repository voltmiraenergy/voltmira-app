// lib/racordareRedNordPdf.js — fills RED Nord's REAL application for the
// connection approval of a power plant and/or storage (the prosumer route in
// northern Moldova), from a project's real data.
//
// Source: https://rednord.md/files/supply/cerere_producere.pdf, linked from
// rednord.md/racordarea-la-retea as "Cerere pentru eliberarea avizului de
// racordare a centralelor electrice și/sau instalațiilor de stocare". Kept
// unmodified at public/legal/cerere-racordare-producere-red-nord.pdf.
//
// Unlike Premier Energy's form (lib/racordarePdf.js, text drawn at measured
// coordinates), this PDF has real AcroForm fields, so the values go into the
// fields themselves and the document stays fillable: whatever the app doesn't
// know (IDNO, cadastral number, contracted power, how to receive the approval,
// the attachments) the installer or client completes in any PDF viewer.
// Field names were read from the PDF with PyMuPDF and matched to their labels
// by position; they are the PDF's own ("Text101", "Check Box14", ...).
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { splitMdAddress } from "./mdGrid.js";

const PDF_PATH = path.join(process.cwd(), "public/legal/cerere-racordare-producere-red-nord.pdf");
const FONT_PATH = path.join(process.cwd(), "assets/fonts/Inter-Regular-diacritics.ttf");

// label -> the PDF's own field name
const F = {
  personPhysical: "Check Box1", personLegal: "Check Box2",
  holderName: "Text1",
  mobile: "Text16",
  siteDistrict: "Text101", siteLocality: "Text102", siteStreet: "Text103", siteNr: "Text104",
  selfConsumption: "Check Box12",
  photovoltaic: "Check Box14", storage: "Check Box101",
  v230: "Check Box100", v400: "Check Box103",
  maxProductionKw: "Text107", storageKwh: "Text109",
  newObject: "Check Box105",
  byEmail: "Check Box109", email: "Text111",
  sentOn: "Text112", applicant: "Text113",
};

const LEGAL = /\b(S\.?R\.?L|S\.?A|Î\.?I|I\.?I|Î\.?C\.?S|G\.?Ț|SRL|SA)\b\.?/i;
const fmtDate = (d) => new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
const kw = (v) => (Number(v) > 0 ? Number(v).toFixed(1) : "");

/**
 * What goes into which field. Pure, so the mapping is testable without a PDF.
 * @param {object} p
 * @param {string} [p.clientName]
 * @param {string} [p.clientPhone]
 * @param {string} [p.clientEmail]
 * @param {string} [p.siteAddress]   the installation's address
 * @param {number} [p.productionKw]  the inverter's AC power when known, else the system size
 * @param {boolean} [p.hasBattery]
 * @param {number} [p.battKwh]
 * @param {1|3|null} [p.phases]      only when the chosen inverter is known
 * @param {Date} [p.today]
 * @returns {{ text: Record<string,string>, check: string[] }}
 */
export function redNordValues({ clientName = "", clientPhone = "", clientEmail = "", siteAddress = "", productionKw, hasBattery = false, battKwh, phases = null, today = new Date() } = {}) {
  const a = splitMdAddress(siteAddress);
  const name = String(clientName || "").trim();
  const text = {
    [F.holderName]: name,
    [F.siteDistrict]: a.district,
    [F.siteLocality]: a.locality,
    // the form prints "str." itself
    [F.siteStreet]: a.street.replace(/^(str\.?|strada)\s+/i, ""),
    [F.siteNr]: a.nr,
    [F.maxProductionKw]: kw(productionKw),
    [F.storageKwh]: hasBattery ? kw(battKwh) : "",
    [F.mobile]: String(clientPhone || "").trim(),
    [F.email]: String(clientEmail || "").trim(),
    [F.sentOn]: fmtDate(today),
    [F.applicant]: name,
  };
  const check = [
    name && LEGAL.test(name) ? F.personLegal : F.personPhysical,
    F.selfConsumption,          // a prosumer produces for their own use
    F.photovoltaic,
    F.newObject,
  ];
  if (hasBattery && Number(battKwh) > 0) check.push(F.storage);
  if (phases === 1) check.push(F.v230);
  if (phases === 3) check.push(F.v400);
  if (text[F.email]) check.push(F.byEmail);
  return { text: Object.fromEntries(Object.entries(text).filter(([, v]) => v)), check };
}

/** @returns {Promise<Uint8Array>} the filled PDF, still fillable */
export async function fillRedNordPdf(data) {
  const [pdfBytes, fontBytes] = await Promise.all([readFile(PDF_PATH), readFile(FONT_PATH)]);
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  // Romanian diacritics: the form's own Helvetica has no ș/ț, so field
  // appearances are drawn with the embedded Inter subset.
  const font = await doc.embedFont(fontBytes, { subset: true });
  const form = doc.getForm();
  const { text, check } = redNordValues(data);
  for (const [name, value] of Object.entries(text)) {
    try { form.getTextField(name).setText(value); } catch { /* a field the PDF no longer has */ }
  }
  for (const name of check) {
    try { form.getCheckBox(name).check(); } catch { /* ditto */ }
  }
  form.updateFieldAppearances(font);
  return doc.save();
}
