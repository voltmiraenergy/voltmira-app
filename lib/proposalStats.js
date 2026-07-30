// lib/proposalStats.js — per-project proposal intelligence, shared by the
// dashboard, projects table, editor and CSV export.
//
// One proposal row exists per project once a share link is created
// (createProposal in lib/actions.js is idempotent). It already tracks the
// signals installers care about: how many times the client opened it (`opens`),
// when they last did (`last_open`), when it was sent (`created_at`), and whether
// they accepted (`accepted_at`). We surface those as aging + engagement.
import { t } from "./i18n.js";

/**
 * Build a Map: project_id → { opens, lastOpen, sentAt, acceptedAt }.
 * RLS scopes `proposals` to the caller's company, so this is safe with the
 * user-session client. Pass a supabaseServer() instance.
 */
export async function proposalStatsByProject(sb) {
  const { data } = await sb.from("proposals")
    .select("project_id, opens, last_open, accepted_at, created_at");
  const map = new Map();
  for (const r of data || []) {
    // keep the earliest-sent / richest row per project (there's normally one)
    const prev = map.get(r.project_id);
    const cur = {
      opens: r.opens || 0,
      lastOpen: r.last_open || null,
      sentAt: r.created_at || null,
      acceptedAt: r.accepted_at || null,
    };
    if (!prev || (cur.sentAt && prev.sentAt && new Date(cur.sentAt) < new Date(prev.sentAt))) {
      map.set(r.project_id, cur);
    } else if (!prev) {
      map.set(r.project_id, cur);
    }
  }
  return map;
}

/** Whole days elapsed since an ISO timestamp (0 if null/future). */
export function daysSince(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

/** "Sent 14d ago" / "Sent today" — for a sent quote, `sentAt` proxied by the
 *  proposal's created_at (falls back to the project's updated_at upstream). */
export function agingLabel(iso, lang) {
  const d = daysSince(iso);
  if (d <= 0) return t("aged_today", lang);
  return t("aged_days", lang, { n: d });
}

/** Urgency tier for a sent quote's age: "" | "warn" (>7d) | "bad" (>14d). */
export function agingTier(iso) {
  const d = daysSince(iso);
  return d > 14 ? "bad" : d > 7 ? "warn" : "";
}

/** A quote is stale once it's older than the company's validity window. */
export function isStale(sentAt, validityDays) {
  if (!sentAt || !validityDays) return false;
  return daysSince(sentAt) > validityDays;
}

/** ISO date the quote is valid until = sentAt + validityDays (or null). */
export function validUntil(sentAt, validityDays) {
  if (!sentAt || !validityDays) return null;
  return new Date(new Date(sentAt).getTime() + validityDays * 86400000);
}

/** A cold quote worth chasing: sent >7d ago and either never opened or not
 *  opened in the last 7 days. Powers the dashboard "Needs follow-up" strip. */
export function needsFollowUp(stats) {
  if (!stats || !stats.sentAt) return false;
  const age = daysSince(stats.sentAt);
  if (age <= 7) return false;
  const sinceOpen = stats.lastOpen ? daysSince(stats.lastOpen) : Infinity;
  return sinceOpen > 7;
}
