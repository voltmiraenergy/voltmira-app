// sentry.edge.config.js — loaded by instrumentation.js's register() for the
// Edge runtime (middleware.js). Same inert-with-no-DSN behavior as
// sentry.server.config.js.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
