// sentry.server.config.js — loaded by instrumentation.js's register() for
// the Node runtime (every page/API route that isn't middleware). With no
// NEXT_PUBLIC_SENTRY_DSN set, Sentry.init() is a documented no-op: nothing
// is captured, nothing is sent, nothing throws. Real error visibility starts
// the moment an installer creates a free Sentry project and that env var is
// set — see .env.example.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 10%: enough to catch real slow endpoints without paying to trace every
  // request on a free/low-tier Sentry plan. Errors are always captured in
  // full regardless of this — it only governs performance tracing.
  tracesSampleRate: 0.1,
  // Real server errors include real client PII in their context (a project's
  // client name/address can appear in a stack trace's local variables) —
  // sendDefaultPii off keeps that scoped to what's explicitly attached, not
  // vacuumed up automatically.
  sendDefaultPii: false,
});
