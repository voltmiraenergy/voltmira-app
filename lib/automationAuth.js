// lib/automationAuth.js — shared-secret auth for endpoints an EXTERNAL
// automation tool (Make.com) calls into, not our own frontend. Same trust
// model as app/api/cron/reap-demo/route.js's CRON_SECRET check (Vercel Cron
// sends `Authorization: Bearer $CRON_SECRET`) — factored out here because
// it's now used by two routes (app/api/automation/nudges/*) instead of one,
// with room for a third without copy-pasting the check again.
//
// This is a caller-we-configure model, not a public webhook receiver: the
// secret lives only in this app's env and in the Make.com scenario the user
// pastes it into. That's why a plain constant-string compare is enough here
// (unlike Paddle's HMAC-signature verification in app/api/paddle/webhook —
// that route must prove a payload's AUTHENTICITY after the fact from an
// untrusted public sender; this one just gates who's allowed to call at all).

/** True if the request carries the correct `Authorization: Bearer <secret>`
 *  header. False (never throws) if AUTOMATION_API_KEY isn't configured —
 *  refuse outright rather than expose an unauthenticated automation surface. */
export function verifyAutomationBearer(req) {
  const secret = process.env.AUTOMATION_API_KEY;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
