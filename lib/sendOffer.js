"use client";
// lib/sendOffer.js — the browser's way to create (or reopen) an offer link: createProposal, once per quote at a time.
// Offers are free and unlimited (VoltMira's one charge is a fee per won project, lib/jobFees.js).
import { createProposal } from "./actions.js";

// One call in flight per quote: a double tap on "Generate proposal" or "Download PDF" joins the first
// instead of starting a second (two links for one quote).
const inFlight = new Map();

// A workspace held for an unpaid VoltMira statement gets an answer, not a link (lib/feeHold.js): the app's banner
// is told (components/FeeHoldBanner.jsx) and the caller's catch runs as for any failure.
export function feeHoldAnswer(r) {
  if (r && typeof r === "object" && r.error) {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vm-fee-hold", { detail: r }));
    throw new Error(r.error);
  }
  return r;
}

export function sendOffer(projectId) {
  if (inFlight.has(projectId)) return inFlight.get(projectId);
  const run = createProposal(projectId).then(feeHoldAnswer).finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, run);
  return run;
}
