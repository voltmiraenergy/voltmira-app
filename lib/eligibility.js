// lib/eligibility.js — which support programmes a quote may get, how much,
// and which documents are still missing (docs/TARIFFS_AND_SUBSIDIES.md).
// Pure: programmes come in as rows of subsidy_programs (or lib/subsidySeed.js),
// money goes in and out as integer minor units with its currency.
//
// Every amount is an estimate from the programme's published rule, never a
// decision: the programme decides. A condition the homeowner has not
// confirmed yet (VAT registration, a net-metering contract, a loan) makes a
// programme "conditional" rather than eligible; a condition they have said
// no to makes it "not_eligible".

export const STATUS = ["eligible", "conditional", "not_eligible"];

/** The latest active version of each programme code. */
export function latestPrograms(programs) {
  const by = new Map();
  for (const p of programs || []) {
    if (p.active === false) continue;
    const cur = by.get(p.code);
    if (!cur || Number(p.version) > Number(cur.version)) by.set(p.code, p);
  }
  return [...by.values()];
}

const day = (d) => String(d || "").slice(0, 10);
const int = (n) => Math.max(0, Math.round(Number(n) || 0));

/**
 * @param {object[]} programs  subsidy_programs rows
 * @param {object} q
 * @param {string} q.market          "MD"
 * @param {string|null} q.clientKind "household" | "sme" | "company" | null (not chosen)
 * @param {number} q.kw
 * @param {number} q.systemMinor     the system's price, VAT included, in minor units of `currency`
 * @param {number} q.batteryMinor    the battery's part of it (0 = no battery)
 * @param {number} [q.loanMinor]     the loan for the job
 * @param {number} [q.vatRatePct]    VAT on the installer's invoice
 * @param {string} [q.currency]      "MDL"
 * @param {string} [q.date]          when the offer is issued, YYYY-MM-DD
 * @param {object} [profile]         { vatPayer, netMetering, documentsHave: [] }
 * @returns {object[]} one result per programme, latest version only
 */
export function checkEligibility(programs, q, profile = {}) {
  const on = day(q.date) || day(new Date().toISOString());
  const have = new Set(Array.isArray(profile?.documentsHave) ? profile.documentsHave : []);
  const battery = int(q.batteryMinor) > 0;
  const out = [];

  for (const p of latestPrograms(programs)) {
    const e = p.eligibility || {};
    const reasons = [];   // why it is not (yet) eligible, as stable keys
    let blocked = false, open = false;

    if (p.market && p.market !== q.market) { blocked = true; reasons.push("market"); }
    if (p.valid_from && day(p.valid_from) > on) { blocked = true; reasons.push("not_started"); }
    if (p.valid_to && day(p.valid_to) < on) { blocked = true; reasons.push("ended"); }
    if (Array.isArray(e.clientKinds)) {
      if (!q.clientKind) { open = true; reasons.push("client_kind"); }
      else if (!e.clientKinds.includes(q.clientKind)) { blocked = true; reasons.push("client_kind"); }
    }
    if (e.requiresBattery && !battery) { blocked = true; reasons.push("battery"); }
    if (e.minKw != null && Number(q.kw) < Number(e.minKw)) { blocked = true; reasons.push("min_kw"); }
    if (e.maxKw != null && Number(q.kw) > Number(e.maxKw)) { blocked = true; reasons.push("max_kw"); }
    for (const [cond, key] of [["vatPayer", "vat_payer"], ["netMetering", "net_metering"]]) {
      if (!e[cond]) continue;
      if (profile?.[cond] === false) { blocked = true; reasons.push(key); }
      else if (profile?.[cond] !== true) { open = true; reasons.push(key); }
    }
    if (e.loan && int(q.loanMinor) <= 0) { open = true; reasons.push("loan"); }

    const est = estimateOf(p.estimate || {}, q);
    const required = Array.isArray(p.required_documents) ? p.required_documents : [];
    out.push({
      code: p.code, version: Number(p.version) || 1, kind: p.kind, name: p.name, provider: p.provider || "",
      status: blocked ? "not_eligible" : open ? "conditional" : "eligible",
      reasons,
      ...est,
      requiredDocs: required,
      missingDocs: required.filter((d) => !have.has(d.id)),
      validTo: p.valid_to ? day(p.valid_to) : null,
      sourceUrl: p.source_url || "",
    });
  }
  return out;
}

/** The estimate of one programme for a quote, in minor units of the quote's currency. */
export function estimateOf(est, q) {
  const currency = est.currency || q.currency || "MDL";
  switch (est.type) {
    case "vat_in_battery": {
      // the VAT included in the battery's price, at the installer's rate
      const rate = Math.max(0, Number(q.vatRatePct) || 0);
      return { estimateMinor: rate > 0 ? Math.round((int(q.batteryMinor) * rate) / (100 + rate)) : 0, currency, upTo: false, basis: "battery", ratePct: rate };
    }
    case "pct_of": {
      const base = est.base === "loan" ? int(q.loanMinor) : est.base === "system" ? int(q.systemMinor) : int(q.batteryMinor);
      const raw = Math.round((base * (Number(est.pct) || 0)) / 100);
      const cap = est.capMinor != null ? int(est.capMinor) : null;
      return {
        estimateMinor: cap != null ? Math.min(raw, cap) : raw, currency, upTo: !!est.upTo,
        basis: est.base || "battery", pct: Number(est.pct) || 0, capped: cap != null && raw > cap, capMinor: cap,
        ...(est.feePctYear != null ? { feePctYear: Number(est.feePctYear) } : {}),
        ...(est.maxMonths != null ? { maxMonths: Number(est.maxMonths) } : {}),
      };
    }
    case "fixed":
      return { estimateMinor: int(est.amountMinor), currency, upTo: !!est.upTo, basis: "fixed" };
    default:
      return { estimateMinor: null, currency, upTo: false, basis: "info", ...(est.fromPct != null ? { fromPct: Number(est.fromPct), toPct: Number(est.toPct) } : {}) };
  }
}

/**
 * What the client may receive in money (grants and tax back), summed for the
 * financing line: eligible ones as estimates, conditional ones as "up to".
 * A guarantee is not money received, and an info line has no amount.
 */
export function supportTotals(results) {
  let sure = 0, upTo = 0;
  for (const r of results || []) {
    if (r.status === "not_eligible" || r.estimateMinor == null || r.kind === "guarantee" || r.kind === "loan") continue;
    if (r.status === "eligible" && !r.upTo) sure += r.estimateMinor;
    else upTo += r.estimateMinor;
  }
  return { sureMinor: sure, upToMinor: sure + upTo };
}
