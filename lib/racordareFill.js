// lib/racordareFill.js — the operator's own connection application, filled
// from a quote: Premier Energy's (lib/racordarePdf.js) or RED Nord's
// (lib/racordareRedNordPdf.js). Shared by the download
// (app/api/projects/[id]/racordare-pdf) and the submission to the operator
// (app/api/projects/[id]/grid-submission), so both send the same form.
import { fillRacordarePdf } from "./racordarePdf.js";
import { fillRedNordPdf } from "./racordareRedNordPdf.js";
import { gridApplicant } from "./gridDetails.js";
import { designCheck } from "./designCheck.js";

export const applicationFileName = (op) => (op === "rednord" ? "cerere-racordare-red-nord.pdf" : "cerere-racordare-premier-energy.pdf");

/** @returns {Promise<Uint8Array>} the filled PDF */
export async function fillApplication(project, op) {
  // the applicant's saved details (GridDetails.jsx), with the quote filling the rest
  const applicant = gridApplicant(project.install_progress?.gridFile?.details, project);
  if (op === "rednord") {
    // The chosen inverter's AC power and phases, when the bill of materials
    // names one; otherwise the system size, and the voltage left to the installer.
    const bom = Array.isArray(project.bom) ? project.bom : [];
    const dc = designCheck({ bom, kw: Number(project.kw) || 0, battKwh: project.batt ? Number(project.batt_kwh) || 0 : 0, market: "MD" });
    const known = Boolean(dc.fromBom?.inverter);
    return fillRedNordPdf({
      applicant,
      clientName: project.client_name, clientEmail: project.client_email || "",
      siteAddress: project.address,
      productionKw: known ? dc.acKw : project.kw,
      hasBattery: !!project.batt, battKwh: project.batt_kwh,
      phases: known ? dc.ph : null,
    });
  }
  return fillRacordarePdf({ applicant, systemKw: project.kw, hasBattery: !!project.batt, battKwh: project.batt_kwh });
}
