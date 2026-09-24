// lib/safeRedirect.js — validating a caller-supplied redirect target on an
// endpoint that ends in a real sign-in (app/demo/route.js's `next=` param).
//
// Get this wrong and the endpoint becomes an open redirect: a link like
// /demo?next=https://evil.example signs a visitor into a real session and
// then bounces them off-site — exactly the shape of a phishing setup. Pure and
// dependency-free on purpose, so it can be tested without pulling in Next.js's
// own server runtime (next/server isn't resolvable outside it).

/**
 * Only a same-origin, root-relative path is allowed through — never a scheme,
 * never a protocol-relative "//host" (both are the classic open-redirect
 * vectors), and never a backslash variant a browser might still normalize to
 * "//". Anything else returns null so the caller falls back to a safe default.
 */
export function safeNext(raw) {
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  return raw;
}
