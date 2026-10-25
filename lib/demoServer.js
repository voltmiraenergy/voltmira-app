// lib/demoServer.js — SERVER only. Is a workspace a /demo one (lib/demo.js: its owner's address is at the demo
// domain)? A demo workspace is for looking only: nothing it makes reaches a real person (no offer, invoice, visit or
// grid email, no team invite, no signature on its offers, no reminder from the daily cron) and its documents say
// DEMO across every page. Without this, a demo workspace was a free way to quote, sign and paper real jobs.
import { isDemoEmail } from "./demo.js";

/** True when the workspace's owner is a demo account. */
export async function isDemoCompany(db, companyId) {
  if (!companyId) return false;
  const { data } = await db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").limit(1).maybeSingle();
  return isDemoEmail(data?.email || "");
}

/** The same answer, asked once per workspace: for a cron going through many rows. */
export function demoCompanyCheck(db) {
  const seen = new Map();
  return (companyId) => {
    if (!seen.has(companyId)) seen.set(companyId, isDemoCompany(db, companyId).catch(() => false));
    return seen.get(companyId);
  };
}
