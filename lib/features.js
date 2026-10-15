// lib/features.js — one definition of which plan unlocks which feature, same
// spirit as lib/plans.js (seats). Before this file, plan-gating was a single
// hand-rolled `co.plan === "free"` check on the PDF footer — every other
// feature in the app was reachable on every plan, including the ones sold as
// Team/Enterprise differentiators (custom document templates, the CRM
// webhook). This is the one place that answers "does this plan get X" for
// both the UI (show an upsell instead of the control) and the server
// (silently refuse to persist a flip the plan doesn't allow — never trust
// the client alone, same as saveCompany's owner-only engine fields).
export const PLAN_FEATURES = {
  free:       { crmWebhook: false, customTemplates: false },
  pro:        { crmWebhook: true,  customTemplates: false },
  team:       { crmWebhook: true,  customTemplates: true },
  enterprise: { crmWebhook: true,  customTemplates: true },
};

export function hasFeature(plan, key) {
  return !!(PLAN_FEATURES[plan] || PLAN_FEATURES.free)[key];
}

/** The lowest plan that actually grants this feature — for the upsell copy. */
export function planFor(key) {
  return Object.keys(PLAN_FEATURES).find((p) => PLAN_FEATURES[p][key]) || "enterprise";
}
