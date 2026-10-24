"use client";
// lib/sendOffer.js — the browser's way to create (or reopen) an offer link: createProposal, once per quote at a time.
// Offers are free and unlimited (VoltMira's one charge is a fee per won project, lib/jobFees.js).
import { createProposal } from "./actions.js";

// One call in flight per quote: a double tap on "Generate proposal" or "Download PDF" joins the first
// instead of starting a second (two links for one quote).
const inFlight = new Map();

export function sendOffer(projectId) {
  if (inFlight.has(projectId)) return inFlight.get(projectId);
  const run = createProposal(projectId).finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, run);
  return run;
}
