// lib/clientProfile.js — the homeowner's answers that decide support
// eligibility (lib/eligibility.js), stored on the quote as
// projects.client_profile and frozen into the next offer it sends:
//   vatPayer       true | false | absent (not asked yet)
//   netMetering    true | false | absent
//   loanMdl        the loan for the battery, whole lei (0 = none)
//   documentsHave  the ids of the required documents the client already has
// Pure: cleans whatever the browser sent into exactly this shape.

const tri = (v) => (v === true || v === "yes" ? true : v === false || v === "no" ? false : undefined);

export function cleanClientProfile(input = {}) {
  const out = {};
  const vat = tri(input?.vatPayer);
  const net = tri(input?.netMetering);
  if (vat !== undefined) out.vatPayer = vat;
  if (net !== undefined) out.netMetering = net;
  const loan = Math.round(Number(String(input?.loanMdl ?? "").replace(/[^\d.]/g, "")) || 0);
  if (loan > 0) out.loanMdl = Math.min(loan, 1_000_000_000);
  const docs = Array.isArray(input?.documentsHave) ? input.documentsHave : [];
  const ids = [...new Set(docs.map((d) => String(d || "").toLowerCase()).filter((d) => /^[a-z0-9_]{2,40}$/.test(d)))].slice(0, 30);
  if (ids.length) out.documentsHave = ids;
  return out;
}
