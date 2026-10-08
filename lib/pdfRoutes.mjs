// lib/pdfRoutes.mjs — every route that launches headless Chromium
// (lib/renderProposalPdf.js). next.config.mjs bundles the Chromium binary into
// exactly these functions on Vercel; a route missing here deploys without the
// binary and answers {"error":"pdf_failed"} in production only. The test in
// lib/pdfRoutes.test.js fails if an importer of the renderer is not listed.
export const CHROMIUM_ROUTES = [
  "/api/proposal/[code]/pdf",
  "/api/proposal/[code]/email",
  "/api/proposal/warm",
  "/api/projects/[id]/invoice",
  "/api/studio/pdf",
  "/api/portfolios/[id]/report",
  "/api/portfolios/[id]/dataroom",
  "/api/portfolios/[id]/teaser",
  "/api/portfolios/[id]/bankpack",
  "/api/deal/[token]/pack",
];

/**
 * The outputFileTracingIncludes key for a route. The keys are globs and the
 * Turbopack build matches no key with a "[param]" segment, so each dynamic
 * segment is written as "*": "/api/proposal/[code]/pdf" -> "/api/proposal/*\/pdf".
 */
export function traceKey(route) {
  return route.replace(/\[[^\]/]+\]/g, "*");
}
