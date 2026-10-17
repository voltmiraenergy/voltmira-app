// lib/financingSeed.js — the sample lenders and offers of
// supabase/add-financing.sql, in code: what a demo workspace's offer page
// shows before the SQL has run (applying then answers that the database is
// not ready). Placeholders, marked is_sample; the rates and limits are
// illustrative, not the banks'. lib/financingSeed.test.js checks they equal
// the SQL seed.

export const LENDER_SEED = [
  { id: "seed-maib", code: "maib", name: "MAIB", adapter: "mock", contact_email: "", commission_type: "percent", commission_bps: 100, commission_flat_minor: 0, currency: "MDL", is_sample: true, active: true },
  { id: "seed-micb", code: "micb", name: "Moldindconbank", adapter: "mock", contact_email: "", commission_type: "percent", commission_bps: 75, commission_flat_minor: 0, currency: "MDL", is_sample: true, active: true },
  { id: "seed-otp", code: "otp", name: "OTP Bank", adapter: "mock", contact_email: "", commission_type: "flat", commission_bps: 0, commission_flat_minor: 150000, currency: "MDL", is_sample: true, active: true },
];

export const OFFER_SEED = [
  { id: "seed-offer-maib", lender_id: "seed-maib", product_name: { en: "Green home loan (sample)", ro: "Credit verde pentru casă (exemplu)", ru: "Зелёный кредит для дома (пример)", uk: "Зелений кредит для дому (приклад)" },
    currency: "MDL", rate_bps: 990, term_min_months: 12, term_max_months: 84, fee_bps: 100, fee_flat_minor: 0, min_amount_minor: 3000000, max_amount_minor: 50000000, eligibility: { markets: ["MD"], clientKinds: ["household"] }, is_sample: true, active: true },
  { id: "seed-offer-micb", lender_id: "seed-micb", product_name: { en: "Solar loan (sample)", ro: "Credit solar (exemplu)", ru: "Солнечный кредит (пример)", uk: "Сонячний кредит (приклад)" },
    currency: "MDL", rate_bps: 1050, term_min_months: 12, term_max_months: 120, fee_bps: 0, fee_flat_minor: 50000, min_amount_minor: 2000000, max_amount_minor: 80000000, eligibility: { markets: ["MD"] }, is_sample: true, active: true },
  { id: "seed-offer-otp", lender_id: "seed-otp", product_name: { en: "Energy efficiency loan (sample)", ro: "Credit pentru eficiență energetică (exemplu)", ru: "Кредит на энергоэффективность (пример)", uk: "Кредит на енергоефективність (приклад)" },
    currency: "MDL", rate_bps: 1150, term_min_months: 6, term_max_months: 60, fee_bps: 150, fee_flat_minor: 0, min_amount_minor: 1000000, max_amount_minor: 30000000, eligibility: { markets: ["MD"] }, is_sample: true, active: true },
];
