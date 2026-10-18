// lib/adminValidate.js — what the platform admin may publish as a new tariff
// rule or support programme version (app/api/admin/tariffs, /subsidies). The
// form speaks lei/kWh and lei; the table stores integer minor units, so the
// conversion happens here, on the server, never in the browser. Pure: returns
// { ok: true, row } or { ok: false, errors: [field keys] }.
import { toMinorPerMwh } from "./tariffRules.js";

const LANGS = ["en", "ro", "ru", "uk"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const okDate = (s) => DATE.test(String(s || "")) && !Number.isNaN(Date.parse(s));
const text = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const url = (v) => { const s = text(v, 500); return !s || /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null; };

/** A price in lei/kWh from the form: empty is "not set" (null), else 0 to 100. */
function rate(v, errors, key) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) { errors.push(key); return null; }
  return toMinorPerMwh(n);
}

export const TARIFF_OPERATORS = ["premier", "rednord"];

/**
 * @param {object} b  the form: { operator, effective_from, effective_to?, retail_day, retail_night,
 *                    retail_flat?, export_monthly: [12], export_flat?, prosumer_max_kw?, source_title, source_url?, note? }
 */
export function validateTariffInput(b = {}) {
  const errors = [];
  if (!TARIFF_OPERATORS.includes(b.operator)) errors.push("operator");
  if (!okDate(b.effective_from)) errors.push("effective_from");
  const to = b.effective_to ? String(b.effective_to) : null;
  if (to && (!okDate(to) || to <= String(b.effective_from))) errors.push("effective_to");
  const months = Array.isArray(b.export_monthly) ? b.export_monthly.slice(0, 12) : [];
  const export_monthly = Array.from({ length: 12 }, (_, m) => rate(months[m], errors, `export_monthly.${m}`));
  const row = {
    market: "MD", operator: b.operator, effective_from: b.effective_from, effective_to: to, currency: "MDL",
    retail_flat_minor_per_mwh: rate(b.retail_flat, errors, "retail_flat"),
    retail_day_minor_per_mwh: rate(b.retail_day, errors, "retail_day"),
    retail_night_minor_per_mwh: rate(b.retail_night, errors, "retail_night"),
    export_monthly: export_monthly.some((v) => v != null) ? export_monthly : null,
    export_flat_minor_per_mwh: rate(b.export_flat, errors, "export_flat"),
    prosumer_max_kw: null,
    source_title: text(b.source_title, 300), source_url: url(b.source_url), note: text(b.note, 1000),
  };
  if (b.prosumer_max_kw !== "" && b.prosumer_max_kw != null) {
    const kw = Number(b.prosumer_max_kw);
    if (!Number.isFinite(kw) || kw <= 0 || kw > 100000) errors.push("prosumer_max_kw"); else row.prosumer_max_kw = kw;
  }
  if (!row.source_title) errors.push("source_title");
  if (row.source_url === null) errors.push("source_url");
  if (row.export_monthly == null && row.export_flat_minor_per_mwh == null) errors.push("export_price");
  return errors.length ? { ok: false, errors } : { ok: true, row };
}

const KINDS = ["tax", "duty", "grant", "guarantee", "loan"];
const CLIENT_KINDS = ["household", "sme", "company"];
const ESTIMATES = ["info", "pct_of", "fixed", "vat_in_battery"];
const BASES = ["battery", "system", "loan"];

function names(o, errors, key) {
  const out = {};
  for (const l of LANGS) { out[l] = text(o?.[l], 200); if (!out[l]) errors.push(`${key}.${l}`); }
  return out;
}
const lei = (v) => (v === "" || v == null ? null : Math.round(Number(String(v).replace(",", ".")) * 100));

/**
 * @param {object} b the form: { code, kind, name:{4}, provider, clientKinds[], requiresBattery, vatPayer,
 *   netMetering, loan, minKw?, maxKw?, estimateType, pct?, base?, upTo?, capLei?, amountLei?, fromPct?, toPct?,
 *   documents:[{id, name:{4}}], valid_from?, valid_to?, active, source_url? }
 */
export function validateSubsidyInput(b = {}) {
  const errors = [];
  const code = text(b.code, 40).toLowerCase();
  if (!/^[a-z0-9_]{2,40}$/.test(code)) errors.push("code");
  if (!KINDS.includes(b.kind)) errors.push("kind");
  const name = names(b.name, errors, "name");
  const eligibility = {};
  const kinds = (Array.isArray(b.clientKinds) ? b.clientKinds : []).filter((k) => CLIENT_KINDS.includes(k));
  if (!kinds.length) errors.push("clientKinds"); else eligibility.clientKinds = kinds;
  for (const k of ["requiresBattery", "vatPayer", "netMetering", "loan"]) if (b[k] === true) eligibility[k] = true;
  for (const k of ["minKw", "maxKw"]) {
    if (b[k] === "" || b[k] == null) continue;
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < 0) errors.push(k); else eligibility[k] = n;
  }
  if (eligibility.minKw != null && eligibility.maxKw != null && eligibility.minKw > eligibility.maxKw) errors.push("maxKw");

  let estimate = { type: "info" };
  if (!ESTIMATES.includes(b.estimateType)) errors.push("estimateType");
  else if (b.estimateType === "pct_of") {
    const pct = Number(b.pct);
    if (!(pct > 0 && pct <= 100)) errors.push("pct");
    if (!BASES.includes(b.base)) errors.push("base");
    estimate = { type: "pct_of", base: b.base, pct, ...(b.upTo ? { upTo: true } : {}) };
    const cap = lei(b.capLei);
    if (cap != null) { if (!(cap >= 0)) errors.push("capLei"); else Object.assign(estimate, { capMinor: cap, currency: "MDL" }); }
  } else if (b.estimateType === "fixed") {
    const amt = lei(b.amountLei);
    if (!(amt > 0)) errors.push("amountLei");
    estimate = { type: "fixed", amountMinor: amt, currency: "MDL", ...(b.upTo ? { upTo: true } : {}) };
  } else if (b.estimateType === "vat_in_battery") estimate = { type: "vat_in_battery" };
  else if (b.fromPct !== "" && b.fromPct != null) estimate = { type: "info", fromPct: Number(b.fromPct) || 0, toPct: Number(b.toPct) || 0 };

  const required_documents = [];
  for (const d of Array.isArray(b.documents) ? b.documents.slice(0, 20) : []) {
    const id = text(d?.id, 40).toLowerCase();
    if (!/^[a-z0-9_]{2,40}$/.test(id)) { errors.push("documents"); continue; }
    required_documents.push({ id, name: names(d.name, errors, `documents.${id}`) });
  }
  const vf = b.valid_from || null, vt = b.valid_to || null;
  if (vf && !okDate(vf)) errors.push("valid_from");
  if (vt && (!okDate(vt) || (vf && vt < vf))) errors.push("valid_to");
  const source_url = url(b.source_url);
  if (source_url === null) errors.push("source_url");
  const row = {
    code, market: "MD", kind: b.kind, name, provider: text(b.provider, 200), eligibility, estimate, required_documents,
    valid_from: vf, valid_to: vt, active: b.active !== false, source_url: source_url || "",
  };
  return errors.length ? { ok: false, errors } : { ok: true, row };
}
