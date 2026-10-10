// lib/mdGrid.js — Moldova's grid-connection file for a prosumer: which
// distribution operator a roof belongs to, the stages the file goes through,
// and when a stage has waited long enough that the installer should call.
//
// Two operators cover the country (source: rednord.md, "Distribuția energiei
// electrice"): RED Nord serves the municipality of Bălți and the districts
// listed below; Premier Energy Distribution serves everywhere else. The
// suggestion is only a starting point: a village's address often doesn't
// name its district, so the installer can always switch.
// Pure; no I/O.

export const OPERATORS = {
  premier: { id: "premier", name: "Premier Energy Distribution", short: "Premier Energy" },
  rednord: { id: "rednord", name: "S.A. „RED Nord”", short: "RED Nord" },
};

// Bălți plus RED Nord's districts, spelled without diacritics and in the old
// î/i forms addresses still use ("Rîșcani", "Sîngerei").
const RED_NORD_AREAS = [
  "balti", "briceni", "drochia", "donduseni", "edinet", "falesti", "floresti", "glodeni",
  "ocnita", "rezina", "riscani", "rascani", "singerei", "sangerei", "soroca", "ungheni",
];

const plain = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[ţț]/g, "t").replace(/[şș]/g, "s");

/** "rednord" when the address names a RED Nord town or district, else "premier". */
export function suggestOperator(address) {
  const words = plain(address).split(/[^a-z]+/).filter(Boolean);
  return words.some((w) => RED_NORD_AREAS.includes(w)) ? "rednord" : "premier";
}

/**
 * Split a Moldovan address into the parts the operators' forms ask for.
 * Best effort: anything it can't place is left out rather than guessed.
 * "str. Alexandru cel Bun 15, s. Horești, r-nul Ialoveni"
 *   -> { street: "str. Alexandru cel Bun", nr: "15", locality: "s. Horești", district: "Ialoveni" }
 */
export function splitMdAddress(address) {
  const out = { street: "", nr: "", locality: "", district: "" };
  const parts = String(address || "").split(",").map((s) => s.trim()).filter(Boolean);
  const rest = [];
  for (const p of parts) {
    const low = plain(p);
    if (!out.district && /^(r-?nul|raionul|raion|r\.)\s*/.test(low)) { out.district = p.replace(/^(r-?nul|raionul|raion|r\.)\s*/i, "").trim(); continue; }
    if (!out.street && /^(str|strada|bd|bul|bulevardul|sos|soseaua|str-la|stradela|pr|prospectul)\b\.?/.test(low)) {
      const m = p.match(/^(.*?)[\s,]+(nr\.?\s*)?(\d+[A-Za-z/-]*\d*)\s*$/);
      if (m) { out.street = m[1].trim(); out.nr = m[3]; } else out.street = p;
      continue;
    }
    if (/^(mun|or|s|com|sat|oras|municipiul)\b\.?/.test(low) && !out.locality) { out.locality = p; continue; }
    rest.push(p);
  }
  // A bare town name ("Chișinău", "Ialoveni") is the locality; a postcode is not.
  if (!out.locality) out.locality = rest.find((p) => !/^(md-?)?\d{4}$/i.test(p)) || "";
  return out;
}

/**
 * The stages of a prosumer's connection file, in order, the same for both
 * operators. `chaseAfter` is how many days after the previous stage it is
 * worth calling: a working rule of thumb for the installer, not a legal term.
 */
export const GRID_STAGES = [
  { id: "applied", chaseAfter: null },   // application for the connection approval handed in
  { id: "approval", chaseAfter: 10 },    // connection approval (aviz de racordare) received
  { id: "installed", chaseAfter: null }, // system installed, per the approval
  { id: "meter", chaseAfter: 14 },       // operator fitted the two-way meter
  { id: "contract", chaseAfter: 14 },    // prosumer contract signed with the supplier
];

const DAY = 864e5;
const dayNum = (iso) => Math.floor(Date.parse(String(iso || "").slice(0, 10) + "T00:00:00Z") / DAY);

/**
 * Where a file stands.
 * @param {{ stages?: Record<string, string> }} file  stage id -> "YYYY-MM-DD" it was done
 * @param {string} today  "YYYY-MM-DD" in the app's timezone
 * @param {Array<{id:string, chaseAfter:number|null}>} [stages]  the market's stages (Moldova's by default; Ukraine's in lib/uaGrid.js)
 * @returns {{ done: number, total: number, next: string|null, since: string|null,
 *            waitingDays: number|null, chase: boolean, complete: boolean }}
 */
export function gridFileStatus(file, today, stages = GRID_STAGES) {
  const st = (file && file.stages) || {};
  const total = stages.length;
  const done = stages.filter((s) => st[s.id]).length;
  const idx = stages.findIndex((s) => !st[s.id]);
  if (idx === -1) return { done, total, next: null, since: null, waitingDays: null, chase: false, complete: true };
  const next = stages[idx];
  // Waiting is counted from the most recent stage done before this one.
  const prev = [...stages.slice(0, idx)].reverse().find((s) => st[s.id]);
  const since = prev ? st[prev.id] : null;
  const waitingDays = since && Number.isFinite(dayNum(since)) ? Math.max(0, dayNum(today) - dayNum(since)) : null;
  const chase = Boolean(next.chaseAfter && waitingDays != null && waitingDays >= next.chaseAfter);
  return { done, total, next: next.id, since, waitingDays, chase, complete: false };
}
