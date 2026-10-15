// instrumentation.js — Next.js's own server hook: register() loads Sentry's
// init file for the runtime it runs in (Node for pages, API routes and
// proxy.js; Edge only if a route opts into it). The browser side is
// instrumentation-client.js.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config.js");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config.js");
  }
}

// Server-side errors in pages and route handlers, reported with the request.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
