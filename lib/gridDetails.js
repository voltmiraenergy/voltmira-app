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

/**
 * A Moldovan IDNP or IDNO is 13 digits whose last is a control digit: the
 * first twelve weighted 7, 3, 1, 7, 3, 1 ... and summed, modulo 10 (the State
 * Register's rule; python-stdnum's md.idno uses the same). A typo almost
 * always breaks it, so it is caught here before the operator rejects the form.
 */
export function idnValid(idn) {
  const s = String(idn || "");
  if (!/^\d{13}$/.test(s)) return false;
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += w[i % 3] * Number(s[i]);
  return sum % 10 === Number(s[12]);
}

/**
 * What a client's earlier grid file can lend a new quote: who they are and
 * how to reach them always; the site's own numbers (cadastral number, NLC,
 * postcode) only when it is the same site.
 */
export function reuseApplicant(prev, siteAddress = "") {
  const d = cleanGridDetails(prev || {});
  const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const sameSite = !!siteAddress && norm(d.siteAddress) === norm(siteAddress);
  return {
    kind: d.kind, name: d.name, idn: d.idn, phone: d.phone, email: d.email, homeAddress: d.homeAddress,
    repName: d.repName, repPhone: d.repPhone, receive: d.receive,
    ...(sameSite ? { siteAddress: d.siteAddress, cadastral: d.cadastral, nlc: d.nlc, postcode: d.postcode, contractedKw: d.contractedKw } : {}),
  };
}

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
    // said on the grid file, else the quote's own client type, else a name like "Agro SRL"
    kind: details?.kind ? d.kind : (["sme", "company"].includes(project.client_kind) || /\b(S\.?R\.?L|S\.?A|Î\.?I|I\.?I|Î\.?C\.?S|G\.?Ț|SRL|SA)\b\.?/i.test(name) ? "company" : "person"),
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
  if (a.idn && !idnValid(a.idn)) miss.push("idn");
  if (!a.phone) miss.push("phone");
  if (!a.siteAddress) miss.push("siteAddress");
  if (!a.cadastral) miss.push("cadastral");
  if (a.receive === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email || "")) miss.push("email");
  return miss;
}
