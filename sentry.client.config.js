// sentry.client.config.js — auto-injected into the browser bundle by
// Sentry's webpack plugin (withSentryConfig in next.config.mjs), NOT loaded
// via instrumentation.js (that hook only covers the two server runtimes).
// Same inert-with-no-DSN behavior as the server/edge configs.
//
// Sentry's build output nudges toward renaming this to
// instrumentation-client.ts (its warning: "When using Turbopack
// sentry.client.config.js will no longer work"). This repo's dev/build
// scripts don't pass --turbo, so this file works as-is — left alone rather
// than moved to a convention that would need confirming Next 14.2 actually
// recognizes instrumentation-client.js before trusting it over this.
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
