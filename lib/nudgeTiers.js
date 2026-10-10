// lib/nudgeTiers.js — single source of truth for the follow-up nudge
// cadence, shared by both app/api/automation/nudges/* routes so "which tier
// is due" can never be computed two different ways in two places.
//
// Tiers are days-since-the-proposal-was-created (proposals.created_at is the
// closest thing this schema has to "sent at" — the link exists from the
// moment createProposal() inserts the row). 3/7/14 is a standard nurture
// cadence, not a tuned number — easy to change here without touching either
// route.
export const NUDGE_TIERS_DAYS = [3, 7, 14];

/**
 * Which tier (0-based index into NUDGE_TIERS_DAYS) is due for this proposal
 * today, or null if none is. A proposal already at nudge_count === N has had
 * tiers [0..N-1] sent; the next one due is tier N, once enough days have
 * passed. Returns null once every tier has been sent (nudge_count >=
 * NUDGE_TIERS_DAYS.length) — this cadence never repeats.
 *
 * @param {{created_at: string, nudge_count?: number}} proposal
 * @returns {number|null}
 */
export function nextNudgeTier(proposal) {
  const count = Math.max(0, Number(proposal?.nudge_count) || 0);
  if (count >= NUDGE_TIERS_DAYS.length) return null;
  const createdAt = proposal?.created_at ? new Date(proposal.created_at).getTime() : NaN;
  if (!Number.isFinite(createdAt)) return null;
  const daysSince = (Date.now() - createdAt) / 86_400_000;
  return daysSince >= NUDGE_TIERS_DAYS[count] ? count : null;
}
