// lib/deadlines.js — what is late or due soon across every plant of a company:
// the checklist items (lib/plantPermits.js) and the grid connection's steps
// that have a due date and are not done. Pure; no I/O. Used by the
// "Permits and deadlines" page and the weekly email (lib/deadlineRun.js).
import { normalizePlant } from "./plantFinance.js";
import { permitProgress } from "./plantPermits.js";
import { PLANTS_KEY } from "./portfolioModel.js";

/** How far ahead the page and the weekly email look, days. */
export const SOON_DAYS = 30;

const closed = (s) => s === "done" || s === "na";
const DAY = 86400000;

/** Whole days from one "YYYY-MM-DD" to another (negative when `to` is before `from`). */
export function daysBetween(fromKey, toKey) {
  const a = Date.parse(`${fromKey}T00:00:00Z`), b = Date.parse(`${toKey}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY) : null;
}

/**
 * One plant's dated, unfinished work, plus how many open items have no date.
 * The grid item is listed by its steps once it has them; a grid item without
 * steps is listed as itself.
 * @param {object} plant  a stored plant
 * @param {string} todayKey
 * @returns {{ rows: object[], undated: number }}
 */
export function plantDeadlines(plant, todayKey, { soonDays = SOON_DAYS } = {}) {
  const pl = normalizePlant(plant);
  const prog = permitProgress(pl.permits, todayKey);
  const rows = [];
  let undated = 0;
  const push = (item, step, r) => {
    const days = daysBetween(todayKey, r.due);
    if (days == null || days > soonDays) return;
    rows.push({ item, step, status: r.status, by: r.by, ref: r.ref, due: r.due, days, overdue: days < 0 });
  };
  for (const r of prog.rows) {
    if (closed(r.status)) continue;
    if (r.steps) {
      const open = r.steps.filter((s) => !closed(s.status));
      for (const s of open) { if (s.due) push("grid", s.id, s); else undated++; }
      continue;
    }
    if (r.due) push(r.id, null, r); else undated++;
  }
  return { rows, undated };
}

/**
 * Every plant of every portfolio, flattened and sorted: the latest-running
 * first, then by due date.
 * @param {{id:string, name:string, assets:object}[]} portfolios
 * @returns {{ rows: object[], late: number, soon: number, undated: number }}
 */
export function collectDeadlines(portfolios, todayKey, opts = {}) {
  const rows = [];
  let undated = 0;
  for (const p of portfolios || []) {
    const plants = Array.isArray(p?.assets?.[PLANTS_KEY]) ? p.assets[PLANTS_KEY].filter((x) => x && typeof x === "object" && x.id) : [];
    for (const raw of plants) {
      const d = plantDeadlines(raw, todayKey, opts);
      undated += d.undated;
      const name = normalizePlant(raw).name;
      for (const r of d.rows) rows.push({ ...r, portfolioId: p.id, portfolioName: p.name || "", plantId: raw.id, plantName: name });
    }
  }
  rows.sort((a, b) => a.due.localeCompare(b.due) || a.plantName.localeCompare(b.plantName));
  const late = rows.filter((r) => r.overdue).length;
  return { rows, late, soon: rows.length - late, undated };
}
