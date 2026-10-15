// lib/greenSupport.js — what support may apply to one Moldovan quote, and how
// much, from the programmes in lib/greenData.js. Pure: no I/O, no language.
// The quote's support card (components/SupportCard.jsx) words it.
//
// Rules, as the programmes state them:
//   Casa Verde (CNED)      households: 50% of the eligible works, at most
//                          200,000 lei, for PV WITH battery storage and only
//                          once the house is thermally insulated.
//   Law 112/2026, VAT      a VAT payer recovers the VAT paid on a battery
//                          (refund, offset against tax due, or carried forward).
//   Law 112/2026, customs  the duty on battery storage went from 8% to 0%.
//   FACEM / programme 373  small businesses with net metering: grants of up to
//                          30% and preferential loans for battery storage.
//   BESS loan guarantee    the state guarantees up to 50% of the LOAN, at most
//                          30 million lei of guarantee per beneficiary, for up
//                          to 120 months, 1% a year. A bigger project is not
//                          refused: only the guarantee stops at the cap.
//
// Every amount is an estimate from the published rules, never a decision: the
// programme decides. The card says so next to every figure.
import { PROGRAMS } from "./greenData.js";

export const CLIENT_KINDS = ["household", "sme", "company"];

const round = (n) => Math.round(Number(n) || 0);
const prog = (id) => PROGRAMS.find((p) => p.id === id);

/**
 * @param {object} a
 * @param {string} a.market        the quote's market; only "MD" has programmes here
 * @param {string|null} a.clientKind  "household" | "sme" | "company" | null (not chosen yet)
 * @param {number} a.costMdl       the system's full price in lei, VAT included (what the client is invoiced)
 * @param {number} a.batteryMdl    the battery's share of that price in lei (0 = no battery)
 * @param {number} [a.vatRatePct]  VAT on the installer's invoices, % (0 = not VAT-registered)
 * @param {boolean|null} [a.insulated]  the house is (or will be) insulated; null = not said
 * @param {number|null} [a.loanMdl]     the loan for the job in lei, for the guarantee
 * @returns {{ market: boolean, needsKind: boolean, items: object[], tags: string[], hint: object|null }}
 */
export function supportFor({ market, clientKind = null, costMdl = 0, batteryMdl = 0, vatRatePct = 0, insulated = null, loanMdl = null }) {
  const out = { market: market === "MD", needsKind: false, items: [], tags: [], hint: null };
  if (market !== "MD") return out;
  if (!CLIENT_KINDS.includes(clientKind)) { out.needsKind = true; return out; }
  const battery = Number(batteryMdl) > 0;
  const cost = Math.max(0, Number(costMdl) || 0);
  // the battery is part of the price, never more than all of it
  const batt = Math.min(Math.max(0, Number(batteryMdl) || 0), cost > 0 ? cost : Infinity);

  // ---- Casa Verde: households, PV with battery, after insulation
  if (clientKind === "household") {
    const p = prog("casa_verde");
    const half = (cost * p.sharePct) / 100;
    const capped = half > p.cap.amount;
    const grant = round(Math.min(half, p.cap.amount));
    if (battery) {
      out.items.push({
        id: p.id, state: insulated === false ? "blocked" : insulated === true ? "applies" : "conditional",
        amountMdl: insulated === false ? 0 : grant, capped, halfMdl: round(half), capMdl: p.cap.amount, sharePct: p.sharePct,
        // the rounded price minus the grant, so the two add up to what the client sees
        clientPaysMdl: insulated === false ? round(cost) : round(cost) - grant,
        needs: ["insulation"],
      });
    } else {
      // without a battery the panels alone are not covered: say what one would unlock
      out.hint = { id: "add_battery", programme: p.id, sharePct: p.sharePct, capMdl: p.cap.amount };
    }
  }

  // ---- Law 112: VAT on the battery, for a VAT payer
  if (battery && (clientKind === "sme" || clientKind === "company")) {
    const p = prog("law112_vat");
    const rate = Math.max(0, Number(vatRatePct) || 0);
    const vat = rate > 0 ? round((batt * rate) / (100 + rate)) : 0;
    out.items.push({ id: p.id, state: rate > 0 ? "conditional" : "none_on_invoice", amountMdl: vat, ratePct: rate, baseMdl: round(batt), needs: ["vat_payer"], law: p.law });
  }

  // ---- Law 112: 0% customs on battery storage (whoever imports it)
  if (battery) {
    const p = prog("law112_customs");
    out.items.push({ id: p.id, state: "info", fromPct: p.dutyFromPct, toPct: p.dutyToPct, law: p.law });
  }

  // ---- FACEM / 373: small businesses with net metering
  if (battery && clientKind === "sme") {
    const p = prog("facem_373");
    out.items.push({ id: p.id, state: "conditional", upToMdl: round((batt * p.upToPct) / 100), upToPct: p.upToPct, baseMdl: round(batt), needs: ["net_metering"] });
  }

  // ---- the state guarantee on a battery loan
  if (battery && (clientKind === "sme" || clientKind === "company")) {
    const p = prog("bess_guarantee");
    const loan = Math.max(0, Number(loanMdl) || 0);
    const half = (loan * p.sharePct) / 100;
    out.items.push({
      id: p.id, state: loan > 0 ? "conditional" : "needs_loan",
      amountMdl: round(Math.min(half, p.cap.amount)), capped: half > p.cap.amount, capMdl: p.cap.amount,
      sharePct: p.sharePct, maxMonths: p.maxMonths, feePctYear: p.feePctYear, validUntil: p.validUntil, loanMdl: round(loan),
      needs: ["loan"],
    });
  }

  if (!battery && clientKind !== "household") out.hint = { id: "battery_programmes" };

  out.tags = tagsFor(out.items, battery);
  return out;
}

/** The topic tags a quote carries (the brief's taxonomy), from what applies to it. */
export function tagsFor(items, battery) {
  const T = { casa_verde: "#Casa_Verde", law112_vat: "#VAT_reimbursement", law112_customs: "#customs_0", facem_373: "#FACEM", bess_guarantee: "#BESS_guarantee" };
  const tags = battery ? ["#BESS"] : [];
  for (const it of items) if (T[it.id] && it.state !== "blocked" && it.state !== "none_on_invoice") tags.push(T[it.id]);
  return tags;
}

/**
 * The battery's part of a quote, in EUR: its installed price at the
 * workspace's EUR per kWh (the same estimate the editor shows under the
 * battery size). 0 when the quote has no battery.
 */
export function batteryEur({ batt, battKwh, batteryCostPerKwh }) {
  if (!batt) return 0;
  return Math.max(0, Number(battKwh) || 0) * (Number(batteryCostPerKwh) || 500);
}
