// lib/teamValidation.js — the one place that knows what a valid
// profiles.title is (app/api/team/route.js's POST and PATCH handlers used
// to each hand-roll their own copy of this check).
export const VALID_TITLES = ["sales", "engineer", "manager"];

/**
 * Normalizes a raw title value from a request body.
 *   - a recognized title ("sales"/"engineer"/"manager") → itself
 *   - "" (an explicit clear, PATCH's "back to plain member") → ""
 *   - anything else (a typo, a number, undefined, null, "ceo"…) → null,
 *     meaning "not a valid value" — callers decide what that means for them
 *     (POST silently falls back to "" so an invite never fails over this;
 *     PATCH rejects the request outright since an owner deliberately chose
 *     a title and a null here means the request itself is malformed).
 */
export function normalizeTitle(raw) {
  if (VALID_TITLES.includes(raw)) return raw;
  if (raw === "") return "";
  return null;
}
