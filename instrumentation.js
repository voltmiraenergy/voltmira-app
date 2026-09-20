// instrumentation.js — Next.js's own hook (register(), enabled via
// experimental.instrumentationHook in next.config.mjs — required on Next
// 14.x, stable-by-default only from Next 15) that loads Sentry's per-runtime
// init file. NEXT_RUNTIME distinguishes the two server runtimes this app
// actually uses (Node for pages/API routes, Edge for middleware.js); no
// "browser" case here — sentry.client.config.js is loaded by Sentry's own
// webpack plugin (see next.config.mjs) into the client bundle directly.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config.js");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config.js");
  }
}
