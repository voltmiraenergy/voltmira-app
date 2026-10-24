// lib/gridRules.js — what each grid operator asks for, as data a platform admin can change without a deploy
// (supabase/add-grid-connection.sql grid_requirements, /admin/grid). Pure, no I/O.
//
// A version per operator holds:
//   docs          the documents a file is sent with, per applicant kind (ids of lib/gridSubmission.js DOC, or of
//                 a document the admin added under `custom`)
//   custom        documents the admin added: { id: { name: { en, ro, ru, uk }, optional } }
//   maxAgeDays    a document that must be recent, and how many days old it may be on the day the file goes
//                 (the State Register extract: "no more than 3 months before filing")
//   expectedDays  how many days a file may sit in a status before the overview calls it overdue. A working rule
//                 for the installer, never presented as a legal term.
// The seed below is exactly what the code did before the table existed: the same lists, the extract's 3 months,
// and the existing chase rules (the approval chased after 10 days, the meter after 14).

export const GRID_OPERATORS = ["premier", "rednord"];
export const KNOWN_DOCS = ["application", "signed", "id_copy", "registry_extract", "property", "site_sketch", "owner_consent", "authorization"];
// the application is VoltMira's own filled form: always in the package
export const AUTO_DOCS = ["application"];
// statuses a file waits in (the last two are final)
export const WAIT_STATUSES = ["submitted", "docs_requested", "approved", "meter_installed"];

const base = () => ({
  docs: {
    person: ["application", "signed", "id_copy", "property", "authorization"],
    company: ["application", "signed", "registry_extract", "property", "site_sketch", "owner_consent", "authorization"],
  },
  custom: {},
  maxAgeDays: { registry_extract: 90 },
  expectedDays: { submitted: 10, docs_requested: 10, approved: 30, meter_installed: 14 },
});

/** Version 0 of each operator: the rules in code, used until the table has a version. */
export const GRID_RULES_SEED = GRID_OPERATORS.map((operator) => ({ operator, version: 0, ...base(), note: "", created_by: "" }));

/** The latest version for an operator among `rows` (the seed's when there is none). */
export function latestGridRules(rows, operator) {
  const mine = (rows || []).filter((r) => r && r.operator === operator);
  const best = mine.reduce((a, r) => (!a || Number(r.version) > Number(a.version) ? r : a), null);
  return normalize(best || GRID_RULES_SEED.find((r) => r.operator === operator) || { operator, version: 0, ...base() });
}

// a stored row may predate a field: fill it from the seed
function normalize(r) {
  const b = base();
  return {
    ...r,
    docs: { person: arr(r.docs?.person, b.docs.person), company: arr(r.docs?.company, b.docs.company) },
    custom: r.custom && typeof r.custom === "object" ? r.custom : {},
    maxAgeDays: r.maxAgeDays && typeof r.maxAgeDays === "object" ? r.maxAgeDays : r.max_age_days || b.maxAgeDays,
    expectedDays: { ...b.expectedDays, ...(r.expectedDays || r.expected_days || {}) },
  };
}
const arr = (v, d) => (Array.isArray(v) ? v.map(String) : d);

const intIn = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
const LANGS = ["en", "ro", "ru", "uk"];

/**
 * Check an admin's form. @returns {{ ok: true, row } | { ok: false, errors: string[] }}
 * row: { operator, docs, custom, max_age_days, expected_days, note } as stored
 */
export function validateGridRules(input) {
  const errors = [];
  const operator = String(input?.operator || "");
  if (!GRID_OPERATORS.includes(operator)) errors.push("operator");

  const custom = {};
  for (const [id, d] of Object.entries(input?.custom || {}).slice(0, 21)) {
    if (!/^[a-z][a-z0-9_]{1,29}$/.test(id) || KNOWN_DOCS.includes(id)) { errors.push("custom_id"); continue; }
    const name = {};
    for (const l of LANGS) {
      const s = String(d?.name?.[l] || "").trim();
      if (!s || s.length > 200) errors.push("custom_name");
      name[l] = s.slice(0, 200);
    }
    custom[id] = { name, optional: d?.optional === true };
  }
  if (Object.keys(input?.custom || {}).length > 20) errors.push("custom_count");
  const allowed = new Set([...KNOWN_DOCS, ...Object.keys(custom)]);

  const docs = {};
  for (const kind of ["person", "company"]) {
    const list = [...new Set(arr(input?.docs?.[kind], []))];
    if (list.some((id) => !allowed.has(id))) errors.push("docs_" + kind);
    // the filled application is what VoltMira sends: it is on every list
    docs[kind] = [...AUTO_DOCS, ...list.filter((id) => allowed.has(id) && !AUTO_DOCS.includes(id))];
  }

  const maxAge = {};
  for (const [id, v] of Object.entries(input?.maxAgeDays || {})) {
    if (v === "" || v == null) continue;
    const n = intIn(v, 1, 3650);
    if (!allowed.has(id) || n == null) errors.push("max_age");
    else maxAge[id] = n;
  }

  const expected = {};
  for (const s of WAIT_STATUSES) {
    const n = intIn(input?.expectedDays?.[s], 1, 365);
    if (n == null) errors.push("expected_" + s);
    else expected[s] = n;
  }

  const note = String(input?.note || "").trim();
  if (note.length > 1000) errors.push("note");
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, row: { operator, docs, custom, max_age_days: maxAge, expected_days: expected, note } };
}

/** What changed between two versions, as field names ("docs.person", "expected.submitted", "custom"...). */
export function diffGridRules(a, b) {
  if (!a) return ["all"];
  const x = normalize(a), y = normalize(b);
  const out = [];
  for (const k of ["person", "company"]) if (JSON.stringify(x.docs[k]) !== JSON.stringify(y.docs[k])) out.push("docs." + k);
  if (JSON.stringify(x.custom) !== JSON.stringify(y.custom)) out.push("custom");
  const ages = new Set([...Object.keys(x.maxAgeDays), ...Object.keys(y.maxAgeDays)]);
  for (const id of ages) if (x.maxAgeDays[id] !== y.maxAgeDays[id]) out.push("max_age." + id);
  for (const s of WAIT_STATUSES) if (x.expectedDays[s] !== y.expectedDays[s]) out.push("expected." + s);
  return out;
}

const DAY = 864e5;
const dayNum = (iso) => Math.floor(Date.parse(String(iso || "").slice(0, 10) + "T00:00:00Z") / DAY);

/**
 * A recent-only document's state on `today`: "missing" (no date), "future", "expired" or "ok".
 * @param {string} issued  YYYY-MM-DD the document was issued
 * @param {number} maxAgeDays
 * @param {string} today   YYYY-MM-DD
 */
export function docAge(issued, maxAgeDays, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(issued || ""))) return { state: "missing", age: null };
  const age = dayNum(today) - dayNum(issued);
  if (!Number.isFinite(age)) return { state: "missing", age: null };
  if (age < 0) return { state: "future", age };
  return { state: age > maxAgeDays ? "expired" : "ok", age };
}

/** Days between two dates (YYYY-MM-DD or ISO), never negative; null when either is missing. */
export function daysBetween(from, to) {
  const a = dayNum(from), b = dayNum(to);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, b - a) : null;
}

/** Is a file overdue in its status? { days, expected, overdue } (expected null for a final status). */
export function overdueOf(status, sinceIso, today, rules) {
  const days = daysBetween(sinceIso, today);
  const expected = WAIT_STATUSES.includes(status) ? Number(rules?.expectedDays?.[status]) || null : null;
  return { days, expected, overdue: expected != null && days != null && days > expected };
}
