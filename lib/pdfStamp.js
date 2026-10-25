// lib/pdfStamp.js — SERVER only. "DEMO" across every page of a PDF made by filling a form (the grid application,
// lib/racordareFill.js), for a /demo workspace (lib/demoServer.js). The pages rendered from HTML get the same mark
// from lib/renderProposalPdf.js. Drawn into the page content, so it cannot be removed by flattening the form.
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

/** @returns {Promise<Uint8Array>} the PDF with the text drawn diagonally across each page and along its foot */
export async function stampPdf(bytes, text = "DEMO") {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const t = String(text).slice(0, 20);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) / 4;
    const w = font.widthOfTextAtSize(t, size);
    // centred on the page, turned 32 degrees: the text's own centre is moved onto the page's
    const a = (32 * Math.PI) / 180;
    const x = width / 2 - (w / 2) * Math.cos(a) + (size / 3) * Math.sin(a);
    const y = height / 2 - (w / 2) * Math.sin(a) - (size / 3) * Math.cos(a);
    page.drawText(t, { x, y, size, font, color: rgb(0.66, 0.26, 0.16), opacity: 0.16, rotate: degrees(32) });
    const foot = `${t} | VOLTMIRA DEMO | ${t}`;
    page.drawText(foot, { x: (width - font.widthOfTextAtSize(foot, 8)) / 2, y: 12, size: 8, font, color: rgb(0.66, 0.26, 0.16), opacity: 0.8 });
  }
  return doc.save();
}
