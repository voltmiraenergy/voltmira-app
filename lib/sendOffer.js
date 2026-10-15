"use client";
// lib/sendOffer.js — the browser's way to create (or reopen) an offer link:
// ask first whether the workspace may send one more (lib/actions.js
// offerStatus), and if it has used its free offers and has no credits, go to
// the plan page where it can buy credits or upgrade, instead of failing
// silently. Where nothing is limited (CREDITS_PAYWALL off, a paid plan, a link
// already sent) it is exactly createProposal.
import { createProposal, offerStatus } from "./actions.js";

export const PLAN_NEEDED_URL = "/settings?tab=plan&need=offers";

export async function sendOffer(projectId) {
  const s = await offerStatus(projectId);
  if (!s.ok) {
    window.location.assign(PLAN_NEEDED_URL);
    throw new Error("offers_limit");
  }
  return createProposal(projectId);
}
