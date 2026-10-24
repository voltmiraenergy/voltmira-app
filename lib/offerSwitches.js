// lib/offerSwitches.js - two sections of the client's offer that are built but not yet in use: the partner banks'
// loans (with applying to one) and the support programmes the quote may qualify for. Both are off until switched on
// with an environment variable, so the offer, its PDF and the loan route say nothing about them.
export const offerFinancingOn = (env = process.env) => env.OFFER_FINANCING === "on";
export const offerSupportOn = (env = process.env) => env.OFFER_SUPPORT === "on";

// Phase 1, "quote in 10 minutes" (docs/features/phase1.md): the installer's public estimate page, the nearby systems'
// production on the offer, and the reading time per section of the offer. Each off until switched on.
export const estimatePageOn = (env = process.env) => env.ESTIMATE_PAGE === "on";
export const offerNearbyOn = (env = process.env) => env.OFFER_NEARBY === "on";
export const offerTrackingOn = (env = process.env) => env.OFFER_TRACKING === "on";
