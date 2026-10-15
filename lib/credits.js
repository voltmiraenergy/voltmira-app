// lib/credits.js — VoltMira credits: what the free plan includes, what a credit
// pays for, the two packs, and the rules that turn a plan, a monthly count and
// a balance into "allowed, and does it cost a credit". Pure; no I/O. The
// database side is lib/creditAccess.js (server-only) and supabase/add-credits.sql.
//
// THE MODEL (decided 2026-10-13)
//   Free    5 sent offers a month, unlimited drafts, the widget
//   Credits for what the free plan does not include: an offer beyond the 5,
//           the filled grid-connection application, and three clean PDF
//           documents of a job: the technical annex, the handover certificate
//           and the monitoring performance report. 10 for 25 EUR, 50 for 99 EUR
//   Pro, Team, Enterprise: unlimited offers, grid file included; credits are never spent
//
// OFF BY DEFAULT. Nothing is limited or charged until CREDITS_PAYWALL is "on"
// (Vercel env), which is set after the Paddle prices exist and
// supabase/add-credits.sql has run: same pattern as PACK_PAYWALL and
// MONITORING_BILLING. Drafts and opening an offer already sent are never gated.

export const FREE_OFFERS_PER_MONTH = 5;

/** What one credit pays for, in credits. */
export const CREDIT_COSTS = { offer: 1, grid_file: 1, annex: 1, protocol: 1, performance: 1 };

/** The Studio documents a credit pays for on the free plan (a paid plan has them all), by the kind the browser names. */
export const DOC_KINDS = ["annex", "protocol", "performance"];

export const CREDIT_PACKS = {
  c10: { id: "c10", credits: 10, eur: 25 },
  c50: { id: "c50", credits: 50, eur: 99 },
};
export const PACK_IDS = Object.keys(CREDIT_PACKS);

export const creditsPaywallOn = (env = process.env) => String(env.CREDITS_PAYWALL || "").toLowerCase() === "on";

/** The Paddle one-time price id of a credit pack (read by name so Next.js inlines it in the browser). */
export function creditPriceId(packId, env = process.env) {
  if (packId === "c10") return env.NEXT_PUBLIC_PADDLE_PRICE_CREDITS_10 || null;
  if (packId === "c50") return env.NEXT_PUBLIC_PADDLE_PRICE_CREDITS_50 || null;
  return null;
}

const paid = (plan) => plan === "pro" || plan === "team" || plan === "enterprise";

/**
 * May this workspace send one more offer, and does it cost a credit?
 * @param {object} a
 * @param {string} a.plan           companies.plan
 * @param {number} a.sentThisMonth  offers created this calendar month
 * @param {number} a.balance        credits left
 * @returns {{ allowed: boolean, spend: number, reason: "off"|"plan"|"included"|"credit"|"blocked", left: number|null }}
 */
export function offerDecision({ plan, sentThisMonth = 0, balance = 0, on = creditsPaywallOn() }) {
  if (!on) return { allowed: true, spend: 0, reason: "off", left: null };
  if (paid(plan)) return { allowed: true, spend: 0, reason: "plan", left: null };
  if (sentThisMonth < FREE_OFFERS_PER_MONTH) return { allowed: true, spend: 0, reason: "included", left: FREE_OFFERS_PER_MONTH - sentThisMonth - 1 };
  if (balance >= CREDIT_COSTS.offer) return { allowed: true, spend: CREDIT_COSTS.offer, reason: "credit", left: 0 };
  return { allowed: false, spend: 0, reason: "blocked", left: 0 };
}

/**
 * May the grid-connection application of one quote be filled? A paid plan
 * always; the free plan pays one credit per quote, once: downloading the
 * same quote's file again costs nothing (`paidBefore`).
 */
export function gridFileDecision({ plan, balance = 0, paidBefore = false, on = creditsPaywallOn() }) {
  if (!on) return { allowed: true, spend: 0, reason: "off" };
  if (paid(plan)) return { allowed: true, spend: 0, reason: "plan" };
  if (paidBefore) return { allowed: true, spend: 0, reason: "paid" };
  if (balance >= CREDIT_COSTS.grid_file) return { allowed: true, spend: CREDIT_COSTS.grid_file, reason: "credit" };
  return { allowed: false, spend: 0, reason: "blocked" };
}

/**
 * May this job's document (a DOC_KINDS entry) be downloaded as a clean PDF? A
 * paid plan always; the free plan pays one credit per document per job, once:
 * downloading the same document of the same job again costs nothing.
 */
export function docDecision({ plan, kind, balance = 0, paidBefore = false, on = creditsPaywallOn() }) {
  if (!DOC_KINDS.includes(kind)) return { allowed: true, spend: 0, reason: "free" };
  if (!on) return { allowed: true, spend: 0, reason: "off" };
  if (paid(plan)) return { allowed: true, spend: 0, reason: "plan" };
  if (paidBefore) return { allowed: true, spend: 0, reason: "paid" };
  if (balance >= CREDIT_COSTS[kind]) return { allowed: true, spend: CREDIT_COSTS[kind], reason: "credit" };
  return { allowed: false, spend: 0, reason: "blocked" };
}

/**
 * The ledger row a completed Paddle transaction pays for, or why it pays for
 * none. custom_data comes from the browser, so the pack is taken from the
 * PRICE that was paid, never from the pack the checkout names.
 * @returns {{ row?: object, error?: string }}
 */
export function creditsFromTransaction({ data, env = process.env }) {
  const c = data?.custom_data || {};
  if (c.kind !== "credits") return { error: "not_credits" };
  if (!data?.id) return { error: "no_txn" };
  if (!c.company_id) return { error: "no_company" };
  const ids = (data.items || []).map((it) => it?.price?.id || it?.price_id).filter(Boolean);
  const pack = PACK_IDS.map((k) => CREDIT_PACKS[k]).find((p) => creditPriceId(p.id, env) && ids.includes(creditPriceId(p.id, env)));
  if (!pack) return { error: "price" };
  // a transaction with the pack twice in it pays for both
  const qty = Math.max(1, ...((data.items || []).filter((it) => (it?.price?.id || it?.price_id) === creditPriceId(pack.id, env)).map((it) => Number(it.quantity) || 1)));
  return {
    row: { company_id: String(c.company_id), delta: pack.credits * qty, reason: "purchase", ref: pack.id, paddle_txn_id: String(data.id) },
  };
}

/** The first day of this month in Moldova ("2026-10-01"), where the monthly count restarts. */
export const monthStart = (dayKey) => `${String(dayKey).slice(0, 7)}-01`;
