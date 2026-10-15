// lib/cnedInstallers.js — "Instalator calificat CNED": installers listed in
// CNED's "Registrul electronic al instalatorilor de sisteme SER" (the register
// of qualified renewable-system installers kept by CNED's qualification
// commission). A workspace whose IDNO is on the list shows the badge on its
// client offers (app/p/[code]).
//
// The list is EMPTY on purpose. It is filled only from the register CNED
// itself supplies, with the date of that copy, never typed from memory or a
// website screenshot: a qualification badge that is wrong is a false claim on
// a client document. Until then nobody shows the badge. Shown only while
// CNED_DATA is on, like the rest of CNED's data (lib/cnedData.js).
//
// Each entry: { idno: "13 digits", name: "as in the register", until: "YYYY-MM-DD" | null }

export const CNED_REGISTER_COPY = { date: null, source: null };
export const CNED_QUALIFIED = [];

const idnoOf = (v) => String(v || "").replace(/\D/g, "");

/** Whether a workspace with this IDNO is on CNED's register today. */
export function isCnedQualified(regNo, today = new Date().toISOString().slice(0, 10), list = CNED_QUALIFIED) {
  const id = idnoOf(regNo);
  if (id.length !== 13) return false;
  return list.some((e) => idnoOf(e.idno) === id && (!e.until || e.until >= today));
}
