// lib/marketplace.js — the installer marketplace's rules (docs/MARKETPLACE.md):
// who is verified, how a homeowner's request is matched to installers, how an
// offer moves, and what a rating says. Pure; no I/O.
//
// Matching is rule-based so an installer can be told why a request reached
// them or not: verified with a licence and insurance in date, published and
// taking requests, working in the request's district, and a size range that
// holds the system. Among those, a score from the rating (shrunk toward the
// average while there are few), the share of requests answered in time, and
// how many requests are already waiting on them.

const DAY = 864e5;

// ---- verification ----------------------------------------------------------

/**
 * Where an installer's verification stands today.
 * @returns {{ state: "none"|"pending"|"verified"|"expired"|"rejected", expiresOn: string|null, soon: boolean }}
 *   verified: checked by the platform and both documents still in date
 *   expired:  checked, but the licence or the insurance has run out
 *   soon:     a document runs out within 30 days
 */
export function verificationState(p, today = new Date().toISOString().slice(0, 10)) {
  if (!p) return { state: "none", expiresOn: null, soon: false };
  const dates = [p.licence_valid_to, p.insurance_valid_to].filter(Boolean).map((d) => String(d).slice(0, 10)).sort();
  const expiresOn = dates[0] || null;
  if (p.verification !== "verified") return { state: p.verification || "none", expiresOn, soon: false };
  if (dates.length < 2 || expiresOn < today) return { state: "expired", expiresOn, soon: false };
  const soon = (Date.parse(expiresOn) - Date.parse(today)) / DAY <= 30;
  return { state: "verified", expiresOn, soon };
}

/** What the installer still has to give before asking for verification. */
export function verificationMissing(p) {
  const miss = [];
  if (!String(p?.licence_no || "").trim()) miss.push("licence_no");
  if (!p?.licence_valid_to) miss.push("licence_valid_to");
  if (!p?.licence_doc) miss.push("licence_doc");
  if (!String(p?.insurer || "").trim()) miss.push("insurer");
  if (!p?.insurance_valid_to) miss.push("insurance_valid_to");
  if (!p?.insurance_doc) miss.push("insurance_doc");
  if (!Array.isArray(p?.regions) || !p.regions.length) miss.push("regions");
  return miss;
}

/** A URL-safe public name from the company's: "SolarTech Chișinău SRL" -> "solartech-chisinau". */
export function slugFor(name) {
  const s = String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[ţț]/g, "t").replace(/[şș]/g, "s")
    .replace(/\b(s\.?r\.?l|s\.?a|i\.?i|srl|sa)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return s.length >= 3 ? s : `installer-${s || "x"}`.slice(0, 50);
}

// ---- ratings ---------------------------------------------------------------

const PRIOR_MEAN = 4, PRIOR_WEIGHT = 3;

/** The average shown, and the one used for ranking (shrunk toward 4 while there are few). */
export function ratingSummary(reviews) {
  const list = (reviews || []).filter((r) => !r.hidden && r.rating >= 1 && r.rating <= 5);
  const n = list.length;
  const sum = list.reduce((s, r) => s + r.rating, 0);
  return {
    count: n,
    average: n ? Math.round((sum / n) * 10) / 10 : null,
    ranking: (PRIOR_MEAN * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + n),
  };
}

/** May this homeowner rate this project: it is theirs, commissioned, and not rated yet. */
export function canReview({ project, linked, existing }) {
  if (!linked) return { ok: false, reason: "not_linked" };
  if (!project?.install_progress?.commission) return { ok: false, reason: "not_commissioned" };
  if (existing) return { ok: false, reason: "already" };
  return { ok: true };
}

/** "Ion P., Ialoveni": how a review is signed in public. */
export function reviewAuthor(name, locality = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const initial = parts[1] ? ` ${parts[1][0].toUpperCase()}.` : "";
  return `${first}${initial}${locality ? `, ${locality}` : ""}`.slice(0, 60);
}

// ---- matching --------------------------------------------------------------

/**
 * Why an installer can or cannot take a request.
 * @param {object} p      installer_profiles row
 * @param {{ raion: string, kw: number }} req
 */
export function eligibility(p, req, today) {
  const v = verificationState(p, today);
  if (v.state !== "verified") return { ok: false, reason: "not_verified" };
  if (!p.published) return { ok: false, reason: "not_published" };
  if (!p.accepting) return { ok: false, reason: "paused" };
  const regions = Array.isArray(p.regions) ? p.regions : [];
  if (!regions.includes("all") && !regions.includes(req.raion)) return { ok: false, reason: "region" };
  const kw = Number(req.kw) || 0;
  if (kw < Number(p.min_kw) || kw > Number(p.max_kw)) return { ok: false, reason: "size" };
  return { ok: true };
}

/**
 * A score from 0 to 100: rating 50, answering in time 35, free capacity 15.
 * @param {{ ranking: number }} rating  ratingSummary()
 * @param {{ offered: number, answered: number, waiting: number }} stats  the last 90 days
 */
export function matchScore(rating, stats = {}) {
  const r = Math.max(0, Math.min(1, ((rating?.ranking ?? PRIOR_MEAN) - 1) / 4));
  const offered = stats.offered || 0;
  // a newcomer is treated as answering 80 % until there is a record
  const answerRate = offered >= 3 ? (stats.answered || 0) / offered : 0.8;
  const load = Math.max(0, 1 - (stats.waiting || 0) / 5);
  return Math.round(r * 50 + answerRate * 35 + load * 15);
}

/**
 * Who a request goes to, best first.
 * @param {object} req          { raion, kw }
 * @param {object[]} profiles   installer_profiles rows
 * @param {Map<string, {rating, stats}>} facts  per company
 * @param {string[]} exclude    companies already offered this request
 * @param {number} n
 * @returns {Array<{ company_id, score }>}
 */
export function rankInstallers(req, profiles, facts = new Map(), { exclude = [], n = 3, today } = {}) {
  const out = [];
  for (const p of profiles || []) {
    if (exclude.includes(p.company_id)) continue;
    if (!eligibility(p, req, today).ok) continue;
    const f = facts.get(p.company_id) || {};
    out.push({ company_id: p.company_id, score: matchScore(f.rating, f.stats) });
  }
  // ties: the company id, so the order never depends on the database's
  return out.sort((a, b) => b.score - a.score || (a.company_id < b.company_id ? -1 : 1)).slice(0, n);
}

/** When an offer must be answered by: the installer's own SLA, in hours. */
export const respondBy = (offeredAt, slaHours = 24) => new Date(Date.parse(offeredAt) + Math.max(2, Math.min(168, slaHours)) * 3600e3).toISOString();

export const OFFER_STATUSES = ["offered", "accepted", "declined", "expired", "withdrawn"];
const OFFER_NEXT = { offered: ["accepted", "declined", "expired", "withdrawn"], accepted: [], declined: [], expired: [], withdrawn: [] };

export function nextOfferStatus(from, to) {
  if (!OFFER_STATUSES.includes(to)) return { ok: false, error: "unknown_status" };
  if (from === to) return { ok: true, same: true };
  return OFFER_NEXT[from]?.includes(to) ? { ok: true } : { ok: false, error: "bad_transition" };
}

/** Offers past their answer time, still waiting. */
export const overdueOffers = (offers, now = Date.now()) =>
  (offers || []).filter((o) => o.status === "offered" && Date.parse(o.respond_by) <= now);

/** How many more installers a request should be offered to: up to `target` answering ones. */
export function backfillCount(offers, target = 3) {
  const live = (offers || []).filter((o) => o.status === "offered" || o.status === "accepted").length;
  return Math.max(0, target - live);
}

/** A request's own status from its offers. */
export function requestStatus(offers, { exhausted = false } = {}) {
  if ((offers || []).some((o) => o.status === "accepted")) return "accepted";
  if ((offers || []).some((o) => o.status === "offered")) return "open";
  return exhausted ? "unmatched" : "open";
}

/** Time left to answer, for the installer's timer: { hours, minutes, overdue }. */
export function timeLeft(respondByIso, now = Date.now()) {
  const ms = Date.parse(respondByIso) - now;
  const m = Math.max(0, Math.floor(ms / 60000));
  return { hours: Math.floor(m / 60), minutes: m % 60, overdue: ms <= 0 };
}

// ---- the installer's profile ------------------------------------------------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A profile from the form, kept to what is allowed.
 * @param {object} x      the form
 * @param {string[]} raionIds  valid district ids (lib/mdRaions.js)
 * @returns {{ ok: true, value } | { ok: false, errors: string[] }}
 */
export function cleanProfile(x = {}, raionIds = []) {
  const errors = [];
  const regions = [...new Set((Array.isArray(x.regions) ? x.regions : []).map(String))].filter((r) => r === "all" || raionIds.includes(r));
  const minKw = Number(x.min_kw), maxKw = Number(x.max_kw), sla = Math.round(Number(x.sla_hours));
  if (!(minKw > 0 && minKw <= 1000)) errors.push("min_kw");
  if (!(maxKw >= minKw && maxKw <= 5000)) errors.push("max_kw");
  if (!(sla >= 2 && sla <= 168)) errors.push("sla_hours");
  const day = (v, k) => { if (v == null || v === "") return null; if (!DAY_RE.test(String(v)) || Number.isNaN(Date.parse(v))) { errors.push(k); return null; } return String(v); };
  const value = {
    published: !!x.published, accepting: x.accepting !== false,
    about: String(x.about || "").trim().slice(0, 1200),
    regions, min_kw: minKw, max_kw: maxKw, sla_hours: sla,
    licence_no: String(x.licence_no || "").trim().slice(0, 80),
    licence_valid_to: day(x.licence_valid_to, "licence_valid_to"),
    insurer: String(x.insurer || "").trim().slice(0, 120),
    insurance_valid_to: day(x.insurance_valid_to, "insurance_valid_to"),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** A change to what was checked sends a verified profile back for a new check. */
export function needsRecheck(before, after) {
  if (!before || before.verification !== "verified") return false;
  return ["licence_no", "licence_valid_to", "licence_doc", "insurer", "insurance_valid_to", "insurance_doc"]
    .some((k) => k in (after || {}) && String(after[k] ?? "") !== String(before[k] ?? ""));
}

/**
 * What the public profile may claim about performance: monitored systems'
 * measured production against their offers, only with enough data.
 * @param {Array<{ total: number, expectedTotal: number|null, months: number }>} systems
 */
export function performanceClaim(systems, { minSystems = 2, minMonths = 6 } = {}) {
  const ok = (systems || []).filter((s) => s.expectedTotal > 0 && s.months > 0);
  const months = ok.reduce((n, s) => n + s.months, 0);
  if (ok.length < minSystems || months < minMonths) return null;
  const pct = Math.round((ok.reduce((n, s) => n + s.total, 0) / ok.reduce((n, s) => n + s.expectedTotal, 0)) * 100);
  return { pct, systems: ok.length, months };
}

// ---- the public funnel's form ------------------------------------------------

/**
 * A request from the funnel's form, checked. The estimate shown is recomputed
 * on the server by the caller; the browser's copy is never trusted.
 * @returns {{ ok: true, value } | { ok: false, errors: string[] }}
 */
export function cleanRequestInput(x = {}) {
  const errors = [];
  const name = String(x.name || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const phone = String(x.phone || "").replace(/[^\d+()\s-]/g, "").trim().slice(0, 40);
  const email = String(x.email || "").trim().toLowerCase().slice(0, 200);
  const address = String(x.address || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (name.length < 2) errors.push("name");
  if (phone.replace(/\D/g, "").length < 8 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("contact");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("email");
  if (address.length < 3) errors.push("address");
  if (x.consent !== true) errors.push("consent");
  const key = String(x.idempotencyKey || "");
  if (key.length < 8 || key.length > 80) errors.push("idempotency_key");
  const lang = ["ro", "ru", "en", "uk"].includes(x.lang) ? x.lang : "ro";
  const bill = Number(x.monthlyBill);
  const cons = Number(x.consKwhYear);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, phone, email, address, lang, idempotencyKey: key, monthlyBill: bill > 0 ? Math.min(bill, 100000) : null, consKwhYear: cons > 0 ? Math.min(cons, 200000) : null } };
}
