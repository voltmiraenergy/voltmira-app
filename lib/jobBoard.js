// lib/jobBoard.js — the board of signed jobs (/jobs, "Lucrări"): its columns are the install steps a quote already
// ticks (install_progress, InstallChecklist.jsx), so the board and the checklist can never disagree. A card stands in
// the column of the furthest step done; moving it ticks every step up to that column (keeping the dates already
// there, today for the rest) and clears the ones after it. Pure, no I/O.

export const JOB_STEPS = ["deposit", "permit", "order", "install", "grid", "commission"];
// "signed": won, nothing done yet; then one column per step, the last one being the system handed over and running
export const BOARD_COLUMNS = ["signed", ...JOB_STEPS];

/** The column a job stands in: the furthest step done, in the steps' order. */
export function columnOf(prog) {
  const p = prog || {};
  let col = "signed";
  for (const s of JOB_STEPS) if (p[s]) col = s;
  return col;
}

/** install_progress after moving a job to `column`: steps up to it done (dates kept), the ones after it cleared. */
export function moveTo(prog, column, today) {
  const at = BOARD_COLUMNS.indexOf(column);
  if (at < 0) return { ...(prog || {}) };
  const out = { ...(prog || {}) };
  JOB_STEPS.forEach((s, i) => {
    if (i < at) { if (!out[s]) out[s] = today; }
    else delete out[s];
  });
  return out;
}

/** The day a job reached its column (the step's date, or when it was won), for "days in this column". */
export function sinceOf(prog, wonDay) {
  const col = columnOf(prog);
  return col === "signed" ? wonDay || null : prog[col];
}

/**
 * The board: every won job in its column, the longest waiting first, with its next crew visit.
 * @param {object[]} projects  won projects ({ id, title, client_name, kw, install_progress, wonDay })
 * @param {object[]} visits    crew visits still to come ({ project_id, starts_at, crew })
 * @returns {Record<string, object[]>}
 */
export function boardOf(projects, visits = []) {
  const next = new Map();
  for (const v of [...visits].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))) {
    if (!next.has(v.project_id)) next.set(v.project_id, v);
  }
  const cols = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, []]));
  for (const p of projects) {
    const prog = p.install_progress || {};
    const col = columnOf(prog);
    cols[col].push({ ...p, column: col, since: sinceOf(prog, p.wonDay), nextVisit: next.get(p.id) || null });
  }
  for (const c of BOARD_COLUMNS) cols[c].sort((a, b) => String(a.since || "9999").localeCompare(String(b.since || "9999")));
  return cols;
}
