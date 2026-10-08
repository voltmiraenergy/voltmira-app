// lib/plantPermits.js — the papers a utility plant needs before a bank lends
// and before it is built, kept the way the EVO single-window portal is
// announced to work (Ministry of Energy, Moldova Business Week 2026): every
// item has a status, a responsible person, a reference and dates, and items
// that do not depend on one another run in parallel. EVO's own list of stages
// and its data exchange are not published yet; when they are, each item here
// maps onto its EVO application, and nothing in the record has to change.
//
// The list is what lenders usually ask to see for a wind or solar plant. It is
// a checklist, not legal advice: which permits a given plant needs depends on
// its size, site and connection, and the user marks an item "not needed".
// Pure; no I/O.

export const PERMITS = [
  { id: "land", doc: "land", deps: [] },
  { id: "urbanism", doc: "permit", deps: ["land"] },
  { id: "eia", doc: "es", deps: ["land"] },
  { id: "grid", doc: "grid", deps: ["land"] },
  { id: "yield", doc: "design", deps: [] },
  { id: "design", doc: "design", deps: ["urbanism", "grid"] },
  { id: "building", doc: "permit", deps: ["urbanism", "eia", "design"] },
  { id: "licence", doc: "permit", deps: [] },
  { id: "contract", doc: "offtake", deps: [] },
  { id: "epc", doc: "design", deps: ["design"] },
  { id: "om", doc: null, deps: [] },
  { id: "insurance", doc: null, deps: ["epc"] },
];
export const STATUSES = ["todo", "in_progress", "done", "na"];
/**
 * The grid connection's own steps, in order: the request to the operator, the
 * connection approval (the operator's conditions and point), the connection
 * contract, the design and works, and the energisation. Once any step has a
 * record, the grid item's status follows them.
 */
export const GRID_STEPS = ["request", "approval", "contract", "works", "energised"];

const ITEM = { status: "todo", by: "", ref: "", submitted: "", due: "" };
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

function cleanItem(x0) {
  const x = x0 && typeof x0 === "object" ? x0 : {};
  return {
    ...ITEM,
    status: STATUSES.includes(x.status) ? x.status : "todo",
    by: String(x.by || "").slice(0, 120),
    ref: String(x.ref || "").slice(0, 80),
    submitted: isDate(x.submitted) ? x.submitted : "",
    due: isDate(x.due) ? x.due : "",
  };
}

const closed = (s) => s === "done" || s === "na";

/** The grid connection's steps, every field present; null until any step has a record. */
export function gridSteps(permits) {
  const st = permits?.grid?.steps;
  if (!st || typeof st !== "object" || !GRID_STEPS.some((k) => st[k] && typeof st[k] === "object")) return null;
  return GRID_STEPS.map((id) => ({ id, ...cleanItem(st[id]) }));
}

/** One item's record, every field present. The grid item's status follows its steps once they exist. */
export function permitItem(permits, id) {
  const x = permits && typeof permits === "object" && permits[id] && typeof permits[id] === "object" ? permits[id] : {};
  const it = cleanItem(x);
  if (id === "grid" && it.status !== "na") {
    const steps = gridSteps(permits);
    if (steps) {
      const needed = steps.filter((s) => s.status !== "na");
      it.status = needed.length && needed.every((s) => s.status === "done") ? "done"
        : steps.some((s) => s.status === "done" || s.status === "in_progress") ? "in_progress" : "todo";
    }
  }
  return it;
}

/**
 * The lender's document slots (lib/portfolio.js DOC_KEYS: land, grid, permit,
 * design, offtake, es) read from the checklist: done when every item behind
 * the slot is done or not needed, draft when one has started or is done,
 * missing otherwise.
 */
export function plantDocs(permits) {
  const out = {};
  for (const key of ["land", "grid", "permit", "design", "offtake", "es"]) {
    const items = PERMITS.filter((p) => p.doc === key).map((p) => permitItem(permits, p.id).status);
    if (!items.length) { out[key] = "missing"; continue; }
    out[key] = items.every(closed) ? "done" : items.some((s) => s === "done" || s === "in_progress") ? "draft" : "missing";
  }
  return out;
}

/**
 * Where the paperwork stands: done, in progress, waiting on another item, and
 * which items can start now, side by side (EVO runs independent procedures in
 * parallel). An item past its due date and not done is overdue.
 * @param {object} permits
 * @param {string} todayKey  "YYYY-MM-DD"
 */
export function permitProgress(permits, todayKey) {
  const rows = PERMITS.map((p) => {
    const it = permitItem(permits, p.id);
    const blockedBy = p.deps.filter((d) => !closed(permitItem(permits, d).status));
    const state = closed(it.status) ? it.status
      : it.status === "in_progress" ? "in_progress"
        : blockedBy.length ? "waiting" : "ready";
    const overdue = !closed(it.status) && it.due && todayKey && it.due < todayKey;
    // the grid item carries its steps, each with its own lateness
    const steps = p.id === "grid" ? gridSteps(permits) : null;
    return { id: p.id, ...it, state, blockedBy, overdue: !!overdue,
      ...(steps ? { steps: steps.map((s) => ({ ...s, overdue: !closed(s.status) && !!s.due && !!todayKey && s.due < todayKey })) } : {}) };
  });
  const needed = rows.filter((r) => r.status !== "na");
  return {
    rows,
    done: needed.filter((r) => r.status === "done").length,
    total: needed.length,
    ready: rows.filter((r) => r.state === "ready").map((r) => r.id),
    overdue: rows.filter((r) => r.overdue).map((r) => r.id),
  };
}
