// lib/gridDetails.js — the applicant's details on a Moldovan grid-connection
// file: what the operator's form asks for that a quote does not hold (who
// applies, IDNP or IDNO, phone, the home or legal address apart from the
// site, the cadastral number, the NLC, the contracted power, a representative,
// how the approval is received). Entered once on the quote's grid file
// (app/(app)/projects/[id]/GridFile.jsx), stored in
// install_progress.gridFile.details (no migration), and printed on both forms
// (lib/racordarePdf.js, lib/racordareRedNordPdf.js). Pure; no I/O.

export const RECEIVE = ["email", "office"];

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const digits = (v) => String(v ?? "").replace(/\D/g, "");

/** Clean what the installer typed: known keys only, trimmed and bounded. */
export function cleanGridDetails(d = {}) {
  const out = {
    kind: d.kind === "company" ? "company" : "person",
    name: clip(d.name, 120),
    idn: digits(d.idn).slice(0, 13),
    phone: clip(d.phone, 30).replace(/[^\d+()\s-]/g, ""),
    email: clip(d.email, 120),
    homeAddress: clip(d.homeAddress, 200),
    siteAddress: clip(d.siteAddress, 200),
    postcode: digits(d.postcode).slice(0, 6),
    cadastral: clip(d.cadastral, 40),
    nlc: clip(d.nlc, 30),
    contractedKw: Number(d.contractedKw) > 0 ? Math.round(Number(d.contractedKw) * 100) / 100 : null,
    repName: clip(d.repName, 120),
    repPhone: clip(d.repPhone, 30).replace(/[^\d+()\s-]/g, ""),
    receive: RECEIVE.includes(d.receive) ? d.receive : "email",
  };
  return out;
}

/** The details a form prints: the saved ones, else what the quote already knows. */
export function gridApplicant(details, project = {}) {
  const d = cleanGridDetails(details || {});
  const name = d.name || clip(project.client_name, 120);
  return {
    ...d,
    name,
    // a name like "Agro SRL" is a company even before anyone says so
    kind: details?.kind ? d.kind : (/\b(S\.?R\.?L|S\.?A|Î\.?I|I\.?I|Î\.?C\.?S|G\.?Ț|SRL|SA)\b\.?/i.test(name) ? "company" : "person"),
    email: d.email || clip(project.client_email, 120),
    siteAddress: d.siteAddress || clip(project.address, 200),
    homeAddress: d.homeAddress || clip(project.address, 200),
  };
}

/**
 * What still blocks a complete application, by field: the operator rejects a
 * form without these. IDNP (people) and IDNO (companies) are 13 digits.
 * @returns {string[]} keys of the missing or malformed fields
 */
export function gridMissing(a) {
  const miss = [];
  if (!a.name) miss.push("name");
  if (a.idn && a.idn.length !== 13) miss.push("idn");
  if (!a.phone) miss.push("phone");
  if (!a.siteAddress) miss.push("siteAddress");
  if (!a.cadastral) miss.push("cadastral");
  if (a.receive === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email || "")) miss.push("email");
  return miss;
}
