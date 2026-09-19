// lib/racordarePdf.js — fills Premier Energy Distribution's REAL prosumer
// connection-request PDF with a project's real data, instead of retyping
// its text as a VoltMira-authored template. The source PDF has no fillable
// AcroForm fields (checked: none), so this overlays text/checkmarks at the
// real form's own coordinates, extracted directly from the PDF's own word
// bounding boxes (public/legal/cerere-ar-prosumator-premier-energy.pdf, from
// https://www.premierenergydistribution.md/ro/racordare-la-retea-prosumator)
// — never re-typed, never re-worded.
//
// Font: assets/fonts/Inter-Regular-diacritics.ttf, a real static (non-
// variable — pdf-lib's fontkit subsetter can't embed a variable font,
// verified by trying) Inter weight from Google Fonts, subset to the
// Romanian alphabet + digits + common punctuation, so client names/
// addresses with ă/â/î/ș/ț render correctly (Standard-14 PDF fonts use
// WinAnsi encoding, which has no Romanian comma-below letters at all).
//
// Only the fields this app actually has real data for are filled in:
// client name, address, system size, battery capacity, today's date, and
// three checkboxes that are always true for a VoltMira quote (Fotovoltaic,
// a new production point, low voltage — the common case for a residential/
// small-commercial rooftop array). Everything else (NLC number, phone,
// email, cadastral number, signature) is left exactly as blank as the real
// form leaves it, for the installer/client to complete by hand before
// submitting.
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const PDF_PATH = path.join(process.cwd(), "public/legal/cerere-ar-prosumator-premier-energy.pdf");
const FONT_PATH = path.join(process.cwd(), "assets/fonts/Inter-Regular-diacritics.ttf");

const INK = rgb(0.05, 0.05, 0.45);
const BLACK = rgb(0, 0, 0);

// Coordinates below are in the SAME top-left-origin space PyMuPDF's
// get_text("words")/get_drawings() reported them in (verified against a
// rendered preview of the real PDF, not guessed) — flipY() converts to
// pdf-lib's bottom-left-origin PDF space at draw time.
const FIELDS = {
  fizicaCheckbox: [160.5, 134.7, 171.7, 145.9],
  name: { x: 178, y: 147, size: 9 },
  address: { x: 200, y: 164, size: 7.5 },
  newProductionCheckbox: [37.46, 263.56, 48.69, 274.77],
  fotovoltaicCheckbox: [37.46, 396.52, 48.69, 407.77],
  capacityKw: { x: 270, y: 435, size: 9 },
  storageKwh: { x: 257, y: 461, size: 9 },
  lowVoltageCheckbox: [41.23, 493.59, 52.42, 504.80],
  date: { x: 463, y: 746, size: 9 },
};

function fmtDateRo(d) {
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/**
 * @param {object} p
 * @param {string} [p.clientName]
 * @param {string} [p.clientAddress]
 * @param {number} [p.systemKw]
 * @param {boolean} [p.hasBattery]
 * @param {number} [p.battKwh]
 * @returns {Promise<Uint8Array>} the filled PDF's bytes
 */
export async function fillRacordarePdf({ clientName, clientAddress, systemKw, hasBattery, battKwh } = {}) {
  const [pdfBytes, fontBytes] = await Promise.all([readFile(PDF_PATH), readFile(FONT_PATH)]);

  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });

  const page = doc.getPages()[0];
  const H = page.getHeight();
  const flipY = (y) => H - y;

  const markX = ([x0, y0, x1, y1]) => {
    page.drawLine({ start: { x: x0 + 1, y: flipY(y0 + 1) }, end: { x: x1 - 1, y: flipY(y1 - 1) }, thickness: 1, color: BLACK });
    page.drawLine({ start: { x: x0 + 1, y: flipY(y1 - 1) }, end: { x: x1 - 1, y: flipY(y0 + 1) }, thickness: 1, color: BLACK });
  };
  const put = (field, text) => {
    if (!text) return;
    page.drawText(String(text), { x: field.x, y: flipY(field.y), size: field.size, font, color: INK });
  };

  markX(FIELDS.fizicaCheckbox);
  put(FIELDS.name, clientName);
  put(FIELDS.address, clientAddress);

  markX(FIELDS.newProductionCheckbox);
  markX(FIELDS.fotovoltaicCheckbox);

  if (Number(systemKw) > 0) put(FIELDS.capacityKw, Number(systemKw).toFixed(1));
  if (hasBattery && Number(battKwh) > 0) put(FIELDS.storageKwh, Number(battKwh).toFixed(1));

  markX(FIELDS.lowVoltageCheckbox);
  put(FIELDS.date, fmtDateRo(new Date()));

  return doc.save();
}
