// instrumentation-client.js — Next.js loads this in the browser before the
// app starts (Next 15+, with or without Turbopack). It replaced
// sentry.client.config.js, which only Sentry's webpack plugin injected.
// Inert with no NEXT_PUBLIC_SENTRY_DSN, like the server/edge configs.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  // Session Replay is opt-in and off here on purpose: a replay can capture a
  // client's real name/address typed into the editor before it's redacted,
  // and turning that on deserves its own deliberate privacy review, not a
  // default flipped on by an error-monitoring setup task.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

// Lets Sentry name page navigations in its performance data.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
