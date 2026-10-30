// lib/opsAlert.js — a failure someone must look at, sent to Sentry as its own event (so an alert rule can match it)
// and written to the server log. For billing and signature failures: the paperwork gate closed because billing was
// unavailable, a document not put on record, a fee not made at signing, a signed offer whose job stayed unsigned.
// Only ids and short codes go in, never names, emails or addresses. Without NEXT_PUBLIC_SENTRY_DSN (local, tests)
// it only logs.
export async function opsAlert(event, details = {}) {
  const safe = Object.fromEntries(Object.entries(details).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 200) : v]));
  console.error(`[ops] ${event}`, JSON.stringify(safe));
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(`ops:${event}`, { level: "error", tags: { ops_event: event }, extra: safe });
  } catch { /* the log line above is still there */ }
}
