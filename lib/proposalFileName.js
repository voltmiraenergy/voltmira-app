// lib/proposalFileName.js — the name a downloaded proposal PDF is saved under: the installer's own name, so the
// client sees whom the offer is from (VoltMira's credit is in the offer's footer, on every offer). No plans since
// 2026-10-24, so the same for every workspace. ASCII only, so every phone and mail client shows it. Pure.

/** "SolarTech Chișinău SRL" -> "SolarTech-Chisinau-SRL" */
export function slugName(name) {
  return String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function proposalFileName({ companyName, code }) {
  const safeCode = String(code || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  const slug = slugName(companyName);
  return `${slug || "VoltMira"}-proposal-${safeCode}.pdf`;
}
