// lib/proposalFileName.js — the name a downloaded proposal PDF is saved under. A paid plan is
// white-labelled (lib/actions.js assertPlanAllows "branded_pdf"), so its offers carry the installer's
// own name, not VoltMira's; the free plan keeps VoltMira's. ASCII only, so every phone and mail client
// shows it. Pure.
const BRANDED = ["pro", "team"];

/** "SolarTech Chișinău SRL" -> "SolarTech-Chisinau-SRL" */
export function slugName(name) {
  return String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function proposalFileName({ companyName, plan, code }) {
  const safeCode = String(code || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  const slug = BRANDED.includes(plan) ? slugName(companyName) : "";
  return `${slug || "VoltMira"}-proposal-${safeCode}.pdf`;
}
