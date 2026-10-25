// lib/estimateLead.js — what a visitor sends from the installer's estimate page (/estimate/[slug]) when they ask for
// a proposal, checked on the server. A name, a phone that is a real number in the installer's country (+373 in
// Moldova), the address, and the visitor's consent are required; an email, when given, must look like one.
// Pure, no I/O.
import { toIntlPhone } from "./phone.js";
import { TIMELINES } from "./leadScore.js";

const COUNTRY_CODE = { MD: "373", RO: "40", UA: "380" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v, n) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, n);
const pos = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * @param {object} b  the request body
 * @param {{market?: string}} [o]  the installer's market: the phone must be from that country
 * @returns {{ ok: true, lead: object } | { ok: false, errors: string[] }}
 */
export function validateEstimateLead(b, { market = "MD" } = {}) {
  const errors = [];
  const name = str(b?.name, 120);
  if (name.length < 2) errors.push("name");
  const intl = toIntlPhone(b?.phone, market);
  const cc = COUNTRY_CODE[market] || COUNTRY_CODE.MD;
  if (!intl || !intl.startsWith(cc)) errors.push("phone");
  const email = str(b?.email, 120).toLowerCase();
  if (email && !EMAIL_RE.test(email)) errors.push("email");
  const address = str(b?.address, 200);
  if (address.length < 5) errors.push("address");
  if (b?.consent !== true) errors.push("consent");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    lead: {
      name, phone: "+" + intl, email, address,
      bill: pos(b?.bill), kwh: pos(b?.kwh),
      timeline: TIMELINES.includes(b?.timeline) ? b.timeline : null,
      wantsFinancing: b?.wantsFinancing === true,
      message: str(b?.message, 500),
    },
  };
}
