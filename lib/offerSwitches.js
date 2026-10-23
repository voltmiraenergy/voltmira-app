// lib/offerSwitches.js - two sections of the client's offer that are built but not yet in use: the partner banks'
// loans (with applying to one) and the support programmes the quote may qualify for. Both are off until switched on
// with an environment variable, so the offer, its PDF and the loan route say nothing about them.
export const offerFinancingOn = (env = process.env) => env.OFFER_FINANCING === "on";
export const offerSupportOn = (env = process.env) => env.OFFER_SUPPORT === "on";
