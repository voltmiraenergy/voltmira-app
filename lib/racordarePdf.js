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
// What is filled: the applicant (person or company, its box ticked), the home
// or legal address, phone, mobile and email, the representative, the reason
// (a new production point), photovoltaic, the installed and storage capacity,
// low voltage, the prosumer box with its NLC, the installation address with
// postcode and cadastral number, how the approval is received, and the date.
// The details come from the quote's grid file (lib/gridDetails.js); anything
// not given stays as blank as the operator's form leaves it. The signature is
// always the client's.
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { splitMdAddress } from "./mdGrid.js";

const PDF_PATH = path.join(process.cwd(), "public/legal/cerere-ar-prosumator-premier-energy.pdf");
const FONT_PATH = path.join(process.cwd(), "assets/fonts/Inter-Regular-diacritics.ttf");

const INK = rgb(0.05, 0.05, 0.45);
const BLACK = rgb(0, 0, 0);

// Coordinates below are in the SAME top-left-origin space PyMuPDF's
// get_text("words")/get_drawings() reported them in (verified against a
// rendered preview of the real PDF, not guessed) — flipY() converts to
// pdf-lib's bottom-left-origin PDF space at draw time.
// text baselines sit 8 pt below each printed line's top
const FIELDS = {
  fizicaCheckbox: [160.5, 134.7, 171.7, 145.9],
  juridicaCheckbox: [382.5, 134.7, 393.7, 145.9],
  name: { x: 178, y: 147, size: 9 },
  nameLegal: { x: 400, y: 147, size: 8.5 },
  // the applicant's home or legal address
  homeDistrict: { x: 198, y: 164, size: 7.5 },
  homeLocality: { x: 346, y: 164, size: 7.5 },
  homeStreet: { x: 48, y: 179.5, size: 7.5 },
  homeNr: { x: 204, y: 179.5, size: 7.5 },
  homePostcode: { x: 372, y: 179.5, size: 7.5 },
  mobile: { x: 156, y: 195.5, size: 8 },
  email: { x: 342, y: 195.5, size: 8 },
  repName: { x: 178, y: 240, size: 7.5 },
  repMobile: { x: 478, y: 240, size: 7.5 },
  newProductionCheckbox: [37.46, 263.56, 48.69, 274.77],
  fotovoltaicCheckbox: [37.46, 396.52, 48.69, 407.77],
  capacityKw: { x: 270, y: 435, size: 9 },
  storageKwh: { x: 257, y: 461, size: 9 },
  lowVoltageCheckbox: [41.23, 493.59, 52.42, 504.80],
  // the prosumer at the place of consumption, and where the plant stands
  onSiteCheckbox: [37.5, 532.8, 48.7, 544.1],
  nlc: { x: 360, y: 544.5, size: 8 },
  siteDistrict: { x: 160, y: 557.5, size: 7.5 },
  siteLocality: { x: 313, y: 557.5, size: 7.5 },
  siteStreet: { x: 440, y: 557.5, size: 7.5 },
  siteNr: { x: 73, y: 570.7, size: 7.5 },
  sitePostcode: { x: 264, y: 570.7, size: 7.5 },
  cadastral: { x: 388, y: 570.7, size: 7.5 },
  byEmailCheckbox: [242.9, 634.5, 254.1, 645.7],
  atOfficeCheckbox: [384.2, 634.5, 395.4, 645.7],
  date: { x: 463, y: 746, size: 9 },
};

function fmtDateRo(d) {
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/**
 * @param {object} p
 * @param {object} p.applicant     lib/gridDetails.js gridApplicant(): kind, name, phone, email,
 *                                 homeAddress, siteAddress, postcode, cadastral, nlc, repName, repPhone, receive
 * @param {number} [p.systemKw]
 * @param {boolean} [p.hasBattery]
 * @param {number} [p.battKwh]
 * @returns {Promise<Uint8Array>} the filled PDF's bytes
 */
export async function fillRacordarePdf({ applicant = {}, systemKw, hasBattery, battKwh } = {}) {
  const [pdfBytes, fontBytes] = await Promise.all([readFile(PDF_PATH), readFile(FONT_PATH)]);

  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  // the Inter subset carries Romanian letters but not "@" or "+": plain ASCII
  // (emails, phones) is drawn in Helvetica, which has them
  const ascii = await doc.embedFont(StandardFonts.Helvetica);

  const page = doc.getPages()[0];
  const H = page.getHeight();
  const flipY = (y) => H - y;

  const markX = ([x0, y0, x1, y1]) => {
    page.drawLine({ start: { x: x0 + 1, y: flipY(y0 + 1) }, end: { x: x1 - 1, y: flipY(y1 - 1) }, thickness: 1, color: BLACK });
    page.drawLine({ start: { x: x0 + 1, y: flipY(y1 - 1) }, end: { x: x1 - 1, y: flipY(y0 + 1) }, thickness: 1, color: BLACK });
  };
  const put = (field, text) => {
    if (!text) return;
    const str = String(text);
    page.drawText(str, { x: field.x, y: flipY(field.y), size: field.size, font: /^[ -~]*$/.test(str) ? ascii : font, color: INK });
  };

  const a = applicant;
  const company = a.kind === "company";
  markX(company ? FIELDS.juridicaCheckbox : FIELDS.fizicaCheckbox);
  put(company ? FIELDS.nameLegal : FIELDS.name, a.name);

  // the form asks "town or raion" then "village": a city goes in the first,
  // a village ("s.", "com.") in the second, with its raion before it; a town
  // inside a municipality keeps both ("Durlești, mun. Chișinău")
  const place = (adr) => {
    const village = /^(s|sat|satul|com|comuna)(\.|\s)/i.test(adr.locality);
    if (village) return { town: adr.district, village: adr.locality };
    return { town: [adr.locality, adr.district].filter(Boolean).join(", "), village: "" };
  };
  const home = splitMdAddress(a.homeAddress || a.siteAddress || "");
  const hp = place(home);
  put(FIELDS.homeDistrict, hp.town);
  put(FIELDS.homeLocality, hp.village);
  put(FIELDS.homeStreet, home.street.replace(/^(str\.?|strada)\s+/i, ""));
  put(FIELDS.homeNr, home.nr);
  put(FIELDS.homePostcode, a.postcode);
  put(FIELDS.mobile, a.phone);
  put(FIELDS.email, a.email);
  put(FIELDS.repName, a.repName);
  put(FIELDS.repMobile, a.repPhone);

  markX(FIELDS.newProductionCheckbox);
  markX(FIELDS.fotovoltaicCheckbox);
  if (Number(systemKw) > 0) put(FIELDS.capacityKw, Number(systemKw).toFixed(1));
  if (hasBattery && Number(battKwh) > 0) put(FIELDS.storageKwh, Number(battKwh).toFixed(1));
  markX(FIELDS.lowVoltageCheckbox);

  const site = splitMdAddress(a.siteAddress || "");
  markX(FIELDS.onSiteCheckbox);
  put(FIELDS.nlc, a.nlc);
  const sp = place(site);
  put(FIELDS.siteDistrict, sp.town);
  put(FIELDS.siteLocality, sp.village);
  put(FIELDS.siteStreet, site.street.replace(/^(str\.?|strada)\s+/i, ""));
  put(FIELDS.siteNr, site.nr);
  put(FIELDS.sitePostcode, a.postcode);
  put(FIELDS.cadastral, a.cadastral);

  markX(a.receive === "office" ? FIELDS.atOfficeCheckbox : FIELDS.byEmailCheckbox);
  put(FIELDS.date, fmtDateRo(new Date()));

  return doc.save();
}
