// lib/crewVisits.js — crews' visits to a job (a site survey, the installation, a service call): the week they fall
// in, whether a crew is booked twice at once, and a visit as typed checked before it is saved. Times are typed on
// the Chișinău clock. Pure, no I/O.
import { atLocal, dayKeyOf } from "./tz.js";

export const VISIT_KINDS = ["survey", "install", "service", "other"];
const DAY = 864e5;

const dayNum = (key) => Math.floor(Date.parse(key + "T00:00:00Z") / DAY);
const keyOfNum = (n) => new Date(n * DAY).toISOString().slice(0, 10);

/** The Monday of the week a day falls in (YYYY-MM-DD). */
export function mondayOf(dayKey) {
  const n = dayNum(dayKey);
  const dow = (new Date(n * DAY).getUTCDay() + 6) % 7;   // Monday 0
  return keyOfNum(n - dow);
}

/** The seven days from a Monday. */
export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => keyOfNum(dayNum(monday) + i));

/** Two visits of the same crew whose times cross. */
export function overlaps(a, b) {
  if (!a || !b || a.id === b.id || !a.crew_id || a.crew_id !== b.crew_id) return false;
  return Date.parse(a.starts_at) < Date.parse(b.ends_at) && Date.parse(b.starts_at) < Date.parse(a.ends_at);
}

/** The visits a visit would clash with. */
export const clashesWith = (visit, visits) => (visits || []).filter((v) => overlaps(visit, v));

/**
 * A visit as typed: { project_id, crew_id, kind, day: "YYYY-MM-DD", from: "HH:MM", to: "HH:MM", note, notify_client }.
 * @returns {{ ok: true, row } | { ok: false, errors: string[] }}  row: what the database stores (ISO times)
 */
export function cleanVisit(v) {
  const errors = [];
  const id = (x) => (/^[0-9a-f-]{36}$/i.test(String(x || "")) ? String(x) : null);
  const project_id = id(v?.project_id), crew_id = id(v?.crew_id);
  if (!project_id) errors.push("project");
  if (!crew_id) errors.push("crew");
  const kind = VISIT_KINDS.includes(v?.kind) ? v.kind : null;
  if (!kind) errors.push("kind");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(v?.day || "")) ? v.day : null;
  const hhmm = (s) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || "")) ? s : null);
  const from = hhmm(v?.from), to = hhmm(v?.to);
  if (!day) errors.push("day");
  if (!from || !to || to <= from) errors.push("time");
  const note = String(v?.note || "").trim();
  if (note.length > 500) errors.push("note");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    row: {
      project_id, crew_id, kind, note, notify_client: v?.notify_client !== false,
      starts_at: atLocal(day, from).toISOString(), ends_at: atLocal(day, to).toISOString(),
    },
  };
}

/** The visits of a week, by day (Chișinău), each day in time order. */
export function visitsByDay(visits, monday) {
  const days = weekDays(monday);
  const out = Object.fromEntries(days.map((d) => [d, []]));
  for (const v of visits || []) {
    const d = dayKeyOf(v.starts_at);
    if (out[d]) out[d].push(v);
  }
  for (const d of days) out[d].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  return out;
}

/** A crew as typed: { name, members, color }. */
export function cleanCrew(c) {
  const name = String(c?.name || "").trim();
  const members = String(c?.members || "").trim();
  const color = /^#[0-9a-f]{6}$/i.test(String(c?.color || "")) ? c.color.toLowerCase() : "#1e6b4e";
  const errors = [];
  if (!name || name.length > 60) errors.push("name");
  if (members.length > 200) errors.push("members");
  return errors.length ? { ok: false, errors } : { ok: true, row: { name, members, color } };
}
