// lib/plans.js — one definition of what each plan actually grants.
//
// THE BUG THIS FIXES. Seat limits were written inline in two places:
//
//   app/(app)/team/page.jsx   seatCap = plan === "enterprise" ? null     : 5
//   app/api/team/route.js     seatCap = plan === "enterprise" ? Infinity : 5
//
// Both gated only on "enterprise", so every other plan got 5 seats — including
// Pro. The Team tier is sold at €119/mo on the strength of "5 seats with
// project owners", and Pro already granted exactly that for €25. The paid
// differentiator did not exist in code, and the UI cheerfully showed a Pro
// workspace a 4/5 seat meter.
//
// Seats now come from here and nowhere else.
export const PLAN_SEATS = {
  free: 1,
  pro: 1,          // "For the installer who sells" — a solo operator
  team: 5,         // the tier that is actually sold on seat count
  enterprise: Infinity,
};

/**
 * Seats a workspace may use.
 *
 * GRANDFATHERING IS NOT OPTIONAL. Every existing account sits on `pro` because
 * add-enterprise-plan.sql lifted the whole beta to it, and at least one already
 * has a colleague in the workspace. Applying a 1-seat Pro cap literally would
 * lock a real teammate out of an account they use today — a pricing change must
 * never remove access someone already has. So the cap can only ever bind
 * upward: it never drops below the number of people already seated.
 *
 * @param {string} plan          companies.plan
 * @param {number} currentSeats  members already in the workspace
 */
export function seatCap(plan, currentSeats = 0) {
  const base = PLAN_SEATS[plan] ?? PLAN_SEATS.free;
  if (base === Infinity) return Infinity;
  return Math.max(base, Number(currentSeats) || 0);
}

/** True when the workspace has room for one more person. */
export function canInvite(plan, currentSeats = 0) {
  return currentSeats < seatCap(plan, currentSeats) || seatCap(plan, currentSeats) === Infinity;
}

/** Seats left, or null for unlimited — for the Team page's meter. */
export function seatsOpen(plan, currentSeats = 0) {
  const cap = seatCap(plan, currentSeats);
  return cap === Infinity ? null : Math.max(0, cap - currentSeats);
}
