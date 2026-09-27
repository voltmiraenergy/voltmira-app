// lib/proposalOffers.js — what the proposal assistant has agreed on a
// proposal, read and written with the service-role client. The checks live in
// lib/negotiation.js; this file only stores what already passed them.
// Degrades to "nothing recorded, nothing recordable" before
// supabase/add-proposal-agent.sql has run.
import { offerStanding, priceWithOffer } from "./negotiation.js";

const missing = (e) => e?.code === "42P01" || e?.code === "PGRST205" || /proposal_offers|does not exist|schema cache/i.test(e?.message || "");

/** Open offers on a proposal: the standing discount and the chosen option.
 *  With `signed`, the ones that were accepted with it instead (they don't expire). */
export async function loadOffers(db, code, now = Date.now(), { signed = false } = {}) {
  const { data, error } = await db.from("proposal_offers")
    .select("id, kind, pct, option_no, detail, status, created_at")
    .eq("code", code).eq("status", signed ? "accepted" : "open").order("created_at", { ascending: false });
  // A missing table means offers can't be recorded yet; any other error is
  // treated the same way for this request, so nothing is agreed unrecorded.
  if (error) return { available: false, discount: null, option: null, migrated: !missing(error) };
  const discount = (data || []).find((o) => o.kind === "discount" && (signed || offerStanding(o.created_at, now))) || null;
  const option = (data || []).find((o) => o.kind === "option") || null;
  return { available: true, discount, option };
}

/**
 * Figures for a price shown to the client with the open discount applied.
 * The percentage comes off the contract value (grossCost); the client's own
 * outlay (cost, after any grant) drops by the same amount of euros.
 */
export function offerFigures({ grossEur, costEur }, discount) {
  const { discountEur, pct } = priceWithOffer(grossEur, discount);
  return { pct, discountEur, grossEur: Math.round((grossEur - discountEur) * 100) / 100, costEur: Math.max(0, Math.round((costEur - discountEur) * 100) / 100) };
}

/** One line for the assistant's system prompt: what is on record right now. */
export function describeRecorded(state, options = []) {
  const parts = [];
  if (state.discount) parts.push(`a ${Number(state.discount.pct)}% discount, offered on ${String(state.discount.created_at).slice(0, 10)} and standing for 14 days from then`);
  if (state.option) {
    const o = options.find((x) => x.number === state.option.option_no);
    parts.push(`the client chose option ${state.option.option_no}${o?.label ? ` (${o.label})` : ""}`);
  }
  return parts.join("; ");
}

async function closeOpen(db, code, kind, status = "replaced") {
  await db.from("proposal_offers").update({ status }).eq("code", code).eq("kind", kind).eq("status", "open");
}

export async function recordDiscount(db, { code, companyId, pct, detail }) {
  await closeOpen(db, code, "discount");
  const { error } = await db.from("proposal_offers").insert({ code, company_id: companyId, kind: "discount", pct, detail });
  if (error) throw error;
}

export async function recordOption(db, { code, companyId, optionNo, detail }) {
  await closeOpen(db, code, "option");
  const { error } = await db.from("proposal_offers").insert({ code, company_id: companyId, kind: "option", option_no: optionNo, detail });
  if (error) throw error;
}

export async function recordEscalation(db, { code, companyId, detail }) {
  const { error } = await db.from("proposal_offers").insert({ code, company_id: companyId, kind: "escalation", status: "closed", detail });
  if (error && !missing(error)) throw error;
}

/** On acceptance: the open discount and option become part of what was signed. */
export async function acceptOffers(db, code, now = Date.now()) {
  const state = await loadOffers(db, code, now);
  if (!state.available) return state;
  const ids = [state.discount?.id, state.option?.id].filter(Boolean);
  if (ids.length) await db.from("proposal_offers").update({ status: "accepted" }).in("id", ids);
  return state;
}
