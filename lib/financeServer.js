// lib/financeServer.js — SERVER only. What a client's offer page gets for
// green financing (docs/FINANCING.md): the lenders' offers that fit the quote,
// the numbers the calculator starts from, and the applications already sent
// from this offer. Nothing a lender agreed with VoltMira (commission, portal)
// leaves the server.
import { listOffersFor, CONSENT_VERSION } from "./loanFlow.js";
import { offerFinanceBasis } from "./offerFinance.js";
import { termOptions } from "./loanMath.js";
import { isDemoEmail } from "./demo.js";
import { batteryEur } from "./greenSupport.js";

/** Sample offers may show: a demo workspace, or FINANCING_SAMPLES=on (local tests). */
export async function samplesAllowed(db, companyId) {
  if (process.env.FINANCING_SAMPLES === "on") return true;
  const { data } = await db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").limit(1).maybeSingle();
  return isDemoEmail(data?.email || "");
}

/**
 * @returns {Promise<object|null>} null outside Moldova or when no offer fits
 */
export async function offerFinancing(db, { prop, snapshot, E, clientKind = null }) {
  if (snapshot?.market !== "MD") return null;
  const battery = batteryEur({ batt: snapshot.batt, battKwh: snapshot.battKwh, batteryCostPerKwh: E?.batteryCostPerKwh }) > 0;
  const samples = await samplesAllowed(db, prop.company_id);
  const { offers, needsDb } = await listOffersFor(db, { market: "MD", clientKind, battery, samples });
  if (!offers.length) return null;
  const basis = offerFinanceBasis(snapshot, E);
  let applications = [];
  if (!needsDb) {
    const { data } = await db.from("loan_applications").select("id, status, lender_id, amount_minor, term_months, monthly_minor, created_at")
      .eq("proposal_code", prop.code).order("created_at", { ascending: false }).limit(5);
    const names = new Map(offers.map((o) => [o.lender.id, o.lender.name]));
    applications = (data || []).map((a) => ({ status: a.status, lender: names.get(a.lender_id) || "", amountMinor: a.amount_minor, termMonths: a.term_months, monthlyMinor: a.monthly_minor, at: a.created_at }));
  }
  return {
    needsDb, consentVersion: CONSENT_VERSION, ...basis,
    offers: offers.map((o) => ({
      id: o.id, lender: o.lender.name, name: o.product_name, sample: !!o.is_sample, currency: o.currency,
      rateBps: o.rate_bps, feeBps: o.fee_bps, feeFlatMinor: o.fee_flat_minor,
      minMinor: o.min_amount_minor, maxMinor: o.max_amount_minor, terms: termOptions(o),
      termMin: o.term_min_months, termMax: o.term_max_months,
    })),
    applications,
  };
}
