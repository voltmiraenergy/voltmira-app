// lib/featureFlags.js — switches for whole features that are built but not
// offered yet.
//
// AI AND WIDGETS (decided 2026-10-16): the proposal assistant, the lead
// assistant (website chat, Telegram), the website lead form, the Studio
// calculator-widget page, AI bill reading, AI BOM generation and the study
// reader are hidden until VoltMira has clients to use them. The code stays;
// NEXT_PUBLIC_VOLTMIRA_AI=on brings every one of them back. Off, their pages
// and routes answer 404 (proxy.js, AI_PATHS) and their buttons are not drawn.
//
// Read by literal name, so Next.js inlines it into the browser bundle too.
export const aiOn = () => String(process.env.NEXT_PUBLIC_VOLTMIRA_AI || "").toLowerCase() === "on";

/** The pages and API routes that exist only for AI and widgets. */
export const AI_PATHS = [
  /^\/widget(\/|$)/,
  /^\/api\/agent(\/|$)/,
  /^\/api\/widget-lead(\/|$)/,
  /^\/api\/generate-bom(\/|$)/,
  /^\/api\/plant-study(\/|$)/,
  /^\/api\/proposal\/[^/]+\/qa(\/|$)/,
  /^\/studio\/lead-widget(\/|$)/,
];

export const isAiPath = (path) => AI_PATHS.some((re) => re.test(path));
