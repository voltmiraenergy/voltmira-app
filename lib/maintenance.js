// lib/maintenance.js — maintenance tickets (docs/MARKETPLACE.md): opened by a
// monitoring alert, by the homeowner, or by the installer; a visit scheduled;
// the outcome logged. Pure; no I/O.
//
// A monitoring alert opens at most one ticket per system and problem a month
// (alert_key), so the nightly check never piles up duplicates.

export const TICKET_STATUSES = ["open", "scheduled", "resolved", "closed"];
const NEXT = { open: ["scheduled", "resolved", "closed"], scheduled: ["scheduled", "resolved", "open", "closed"], resolved: ["closed", "open"], closed: [] };

export function nextTicketStatus(from, to) {
  if (!TICKET_STATUSES.includes(to)) return { ok: false, error: "unknown_status" };
  // a visit can be moved: scheduled -> scheduled is a new date, not a no-op
  if (from === to && to !== "scheduled") return { ok: true, same: true };
  return NEXT[from]?.includes(to) ? { ok: true } : { ok: false, error: "bad_transition" };
}

export const TICKET_KINDS = ["underproduction", "no_data", "fault", "cleaning", "damage", "other"];
/** What a homeowner can pick on the form. */
export const HOMEOWNER_KINDS = ["fault", "underproduction", "cleaning", "damage", "other"];

/**
 * A ticket from a monitoring assessment (lib/fleetHealth.js assessSystem), or
 * null when the system is fine or too new.
 * @param {object} a     the assessment
 * @param {string} month "YYYY-MM" of the month judged
 */
export function ticketFromAssessment(a, month) {
  if (!a) return null;
  if (a.cause === "no_reading" && (a.status === "critical" || a.status === "nodata")) {
    return { kind: "no_data", alert_key: `no_data-${month}`, severity: a.status };
  }
  if (a.status === "critical" || a.status === "warn") {
    // snow is the weather, not a fault: no visit for it
    if (a.cause === "snow") return null;
    return { kind: "underproduction", alert_key: `under-${month}`, severity: a.status, ratio: a.last?.ratio ?? null, cause: a.cause };
  }
  return null;
}

/** Clean a homeowner's or installer's request. */
export function cleanTicketInput({ kind, title, detail }) {
  const k = TICKET_KINDS.includes(kind) ? kind : "other";
  const t = String(title || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const d = String(detail || "").trim().slice(0, 2000);
  if (t.length < 2) return { ok: false, error: "title" };
  return { ok: true, value: { kind: k, title: t, detail: d } };
}

/** A visit time the installer picks: in the future, within a year. */
export function visitOk(iso, now = Date.now()) {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > now - 3600e3 && t < now + 366 * 864e5;
}
