// lib/features.js — which plan unlocks which feature. Since 2026-10-24 VoltMira has no plans: every feature is on
// for every workspace, and the one charge is a fee per won project (lib/jobFees.js). Kept so older call sites keep
// a single answer: yes.
export const PLAN_FEATURES = {
  free: { crmWebhook: true, customTemplates: true },
  pro: { crmWebhook: true, customTemplates: true },
  team: { crmWebhook: true, customTemplates: true },
  enterprise: { crmWebhook: true, customTemplates: true },
};

export function hasFeature(plan, key) {
  return !!(PLAN_FEATURES[plan] || PLAN_FEATURES.free)[key];
}
