// lib/safe.js — XSS prevention helpers.
// The activity feed renders stored text as HTML (for the <b> emphasis), so
// EVERY user-controlled value interpolated into that text must be escaped
// at insert time. escapeHtml is also used at render time as defense in depth.

const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;" };

/** Escape a string for safe insertion into HTML. Handles null/undefined. */
export function escapeHtml(input) {
  return String(input == null ? "" : input).replace(/[&<>"'/]/g, (c) => MAP[c]);
}

/** Escape and hard-cap length in one step (for DB text fields). */
export function safeText(input, max = 200) {
  return escapeHtml(String(input == null ? "" : input).slice(0, max));
}

/** Strip all tags — for contexts that must be plain text, not HTML. */
export function stripTags(input) {
  return String(input == null ? "" : input).replace(/<[^>]*>/g, "");
}
