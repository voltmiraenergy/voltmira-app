// lib/racordareFill.js — the operator's own connection application, filled
// from a quote: Premier Energy's (lib/racordarePdf.js) or RED Nord's
// (lib/racordareRedNordPdf.js). Shared by the download
// (app/api/projects/[id]/racordare-pdf) and the submission to the operator
// (app/api/projects/[id]/grid-submission), so both send the same form.
import { fillRacordarePdf } from "./racordarePdf.js";
import { fillRedNordPdf } from "./racordareRedNordPdf.js";
import { gridApplicant } from "./gridDetails.js";
import { productionPower } from "./gridPower.js";

export const applicationFileName = (op) => (op === "rednord" ? "cerere-racordare-red-nord.pdf" : "cerere-racordare-premier-energy.pdf");

/** @returns {Promise<Uint8Array>} the filled PDF */
export async function fillApplication(project, op) {
  // the applicant's saved details (GridDetails.jsx), with the quote filling the rest
  const applicant = gridApplicant(project.install_progress?.gridFile?.details, project);
  // One power on both forms: the chosen inverter's AC power when the bill of materials names one, else
  // the system size. RED Nord's form printed the inverter's power and Premier's the panels', so the same
  // job stated two powers to the two operators.
  const power = productionPower(project);
  if (op === "rednord") {
    return fillRedNordPdf({
      applicant,
      clientName: project.client_name, clientEmail: project.client_email || "",
      siteAddress: project.address,
      productionKw: power.kw,
      hasBattery: !!project.batt, battKwh: project.batt_kwh,
      phases: power.phases,
    });
  }
  return fillRacordarePdf({ applicant, systemKw: power.kw, hasBattery: !!project.batt, battKwh: project.batt_kwh });
}
