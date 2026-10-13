// lib/creditsPreview.js — a local-only switch to SEE the free plan's credits
// UI (the sidebar row, the credits panel) from a workspace that is on a paid
// plan, such as the demo. NEXT_PUBLIC_CREDITS_PREVIEW=free in .env.local; it
// does nothing in a production build, and changes only what is drawn: no plan,
// limit or balance is touched.
// (read by literal name, so Next.js inlines them into the browser bundle too)
export const creditsPreview = () =>
  process.env.NODE_ENV !== "production" && String(process.env.NEXT_PUBLIC_CREDITS_PREVIEW || "").toLowerCase() === "free";
