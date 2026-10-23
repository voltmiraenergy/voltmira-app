"use client";
// lib/sendOffer.js — the browser's way to create (or reopen) an offer link:
// ask first whether the workspace may send one more (lib/actions.js
// offerStatus), and if it has used its free offers and has no credits, go to
// the plan page where it can buy credits or upgrade, instead of failing
// silently. Where nothing is limited (CREDITS_PAYWALL off, a paid plan, a link
// already sent) it is exactly createProposal.
import { createProposal, offerStatus } from "./actions.js";

export const PLAN_NEEDED_URL = "/settings?tab=plan&need=offers";

// One call in flight per quote: a double tap on "Generate proposal" or "Download PDF" joins the first
// instead of starting a second (two links for one quote, two credits spent).
const inFlight = new Map();

export function sendOffer(projectId) {
  if (inFlight.has(projectId)) return inFlight.get(projectId);
  const run = (async () => {
    const s = await offerStatus(projectId);
    if (!s.ok) {
      window.location.assign(PLAN_NEEDED_URL);
      throw new Error("offers_limit");
    }
    return createProposal(projectId);
  })().finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, run);
  return run;
}
