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
 * A workspace's own follow-up days (companies.nudge_days, set in Settings): up to three different whole days from
 * 1 to 60, in order. Anything else (nothing set, nonsense) is the standard 3, 7 and 14.
 */
export function cleanNudgeDays(raw) {
  const days = [...new Set((Array.isArray(raw) ? raw : []).map((d) => Math.round(Number(d))).filter((d) => d >= 1 && d <= 60))]
    .sort((a, b) => a - b).slice(0, NUDGE_TIERS_DAYS.length);
  return days.length ? days : [...NUDGE_TIERS_DAYS];
}

/**
 * Which tier (0-based index into NUDGE_TIERS_DAYS) is due for this proposal
 * today, or null if none is. A proposal already at nudge_count === N has had
 * tiers [0..N-1] sent; the next one due is tier N, once enough days have
 * passed. Returns null once every tier has been sent (nudge_count >=
 * NUDGE_TIERS_DAYS.length) — this cadence never repeats.
 *
 * An offer whose follow-ups the installer switched off (proposals.nudges_off) is never due.
 *
 * @param {{created_at: string, nudge_count?: number, nudges_off?: boolean}} proposal
 * @param {number[]} [days]  the workspace's follow-up days (cleanNudgeDays)
 * @param {number} [now]
 * @returns {number|null}
 */
export function nextNudgeTier(proposal, days = NUDGE_TIERS_DAYS, now = Date.now()) {
  if (proposal?.nudges_off === true) return null;
  const tiers = cleanNudgeDays(days);
  const count = Math.max(0, Number(proposal?.nudge_count) || 0);
  if (count >= tiers.length) return null;
  const createdAt = proposal?.created_at ? new Date(proposal.created_at).getTime() : NaN;
  if (!Number.isFinite(createdAt)) return null;
  const daysSince = (now - createdAt) / 86_400_000;
  return daysSince >= tiers[count] ? count : null;
}
