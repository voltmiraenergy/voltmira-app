// lib/loanStatus.js — the pipeline a loan application moves through
// (docs/FINANCING.md). Pure. A lender's webhook, its portal and the platform
// admin all go through nextStatus, so none of them can skip a step backwards.
//
//   submitted -> in_review -> approved -> funded
//        \            \           \
//         -> rejected  -> rejected  -> rejected
//   failed (the lender could not be reached) -> submitted (sent again)

export const LOAN_STATUSES = ["submitted", "in_review", "approved", "rejected", "funded", "failed"];

const NEXT = {
  submitted: ["in_review", "approved", "rejected", "failed"],
  in_review: ["approved", "rejected"],
  approved: ["funded", "rejected"],
  failed: ["submitted"],
  rejected: [],
  funded: [],
};

/** Where an application may go from its current status. */
export const allowedNext = (from) => NEXT[from] || [];

/**
 * @returns {{ ok: true, same?: true, from, to } | { ok: false, error: "unknown_status" | "bad_transition" }}
 */
export function nextStatus(from, to) {
  if (!LOAN_STATUSES.includes(to)) return { ok: false, error: "unknown_status" };
  if (from === to) return { ok: true, same: true, from, to };
  if (!allowedNext(from).includes(to)) return { ok: false, error: "bad_transition" };
  return { ok: true, from, to };
}

/** A closed application: nothing more will happen to it. */
export const isFinal = (s) => s === "funded" || s === "rejected";
