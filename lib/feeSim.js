// lib/feeSim.js — the walk-through of one signed job's fee, day by day, for Settings › Pay per job
// (components/FeeSimulator.jsx). Nothing is read or written: it runs the real rules (lib/jobFees.js prices, dates
// and holds, lib/feeReminders.js emails) on an example job, so what it shows is what the app does.
import { atLocal } from "./tz.js";
import { feeFor, feeMonth, nextMonth, statementDue, holdLevel, HOLD_OFFERS_DAYS, HOLD_READONLY_DAYS } from "./jobFees.js";
import { reminderStep, REMINDER_STEPS } from "./feeReminders.js";

const DAY = 864e5;

/** The example's dates: signed on the 12th of the month ("2026-10", or the month of a time), the statement on the
 *  1st after, and each step. */
export function simDates(when = Date.now()) {
  const month = /^\d{4}-\d{2}$/.test(String(when)) ? String(when) : feeMonth(new Date(when).toISOString());
  const signed = Date.parse(atLocal(`${month}-12`, "11:00").toISOString());
  const issued = Date.parse(atLocal(`${nextMonth(month)}-01`, "09:00").toISOString());
  const due = Date.parse(statementDue(month));   // the 15th at 00:00: the 14th is the last day to pay
  return {
    month, signed, issued, due,
    week: due - 7 * DAY, lastDay: due - DAY,
    warn30: due + (HOLD_OFFERS_DAYS - 5) * DAY, hold30: due + HOLD_OFFERS_DAYS * DAY,
    warn60: due + (HOLD_READONLY_DAYS - 5) * DAY, hold60: due + HOLD_READONLY_DAYS * DAY,
    end: due + (HOLD_READONLY_DAYS + 12) * DAY,
  };
}

/**
 * Where the example job stands at `at`.
 * @param {object} a
 * @param {object} a.d        simDates()
 * @param {number} a.at       the day looked at (ms)
 * @param {number} a.kw       the signed system
 * @param {boolean} a.free    one of the company's first free jobs
 * @param {boolean} a.papers  a contract, invoice or grid file was made for it (lib/jobFees.js feeOnLost)
 * @param {number|null} a.paidAt    when the transfer arrived (only on a statement: there is nothing to pay before)
 * @param {number|null} a.gaveUpAt  when the client gave up
 * @returns {{ amountMinor: number, status: "free"|"month"|"open"|"late"|"paid"|"void"|"kept", owed: boolean,
 *             level: 0|1|2|3, daysLate: number, emails: Array<{ step: string, at: number }>, canPay: boolean, canGiveUp: boolean }}
 */
export function simState({ d, at, kw, free = false, papers = true, paidAt = null, gaveUpAt = null }) {
  const amountMinor = free ? 0 : feeFor(kw).minorMdl;
  const paid = paidAt != null && paidAt <= at;
  const gaveUp = gaveUpAt != null && gaveUpAt <= at;
  // the client giving up cancels the fee only before any paperwork; after it, the fee stays (a waiver is asked)
  const voided = gaveUp && !papers;
  const owed = amountMinor > 0 && !paid && !voided;
  let status;
  if (free) status = "free";
  else if (paid) status = "paid";
  else if (voided) status = "void";
  else if (at < d.issued) status = gaveUp ? "kept" : "month";
  else if (at < d.due) status = gaveUp ? "kept" : "open";
  else status = gaveUp ? "kept" : "late";
  const h = owed ? holdLevel([{ due_at: new Date(d.due).toISOString(), paid_at: null, owed_minor: amountMinor }], at) : { level: 0, daysLate: 0 };
  // the emails the owner has had by then: each reminder step on the day it starts, while something is still owed
  const emails = [];
  if (amountMinor > 0) {
    const inv = { issued_at: new Date(d.issued).toISOString(), due_at: new Date(d.due).toISOString(), paid_at: null };
    const startOf = { issued: d.issued, week: d.week, last_day: d.lastDay, locked: d.due, warn30: d.warn30, hold30: d.hold30, warn60: d.warn60, hold60: d.hold60 };
    for (const step of REMINDER_STEPS) {
      const t = startOf[step];
      if (t == null || t > at || reminderStep(inv, t) !== step) continue;
      if (paidAt != null && paidAt <= t) continue;
      if (gaveUpAt != null && !papers && gaveUpAt <= t) continue;
      emails.push({ step, at: t });
    }
  }
  return {
    amountMinor, status, owed, level: h.level, daysLate: h.daysLate, emails,
    canPay: owed && at >= d.issued,
    canGiveUp: !free && !paid && !gaveUp,
  };
}
