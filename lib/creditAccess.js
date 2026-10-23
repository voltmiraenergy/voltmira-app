// lib/creditAccess.js — the database side of VoltMira credits
// (supabase/add-credits.sql), read and written with the service role, never
// from the browser. The rules themselves are in lib/credits.js. A database
// without the table yet has a balance of 0 and spends nothing; that only
// matters once CREDITS_PAYWALL is on, which is switched on after the SQL runs.
// Server-only.
import { supabaseAdmin } from "./supabase.js";
import { mdDayKey, atLocal } from "./tz.js";
import { monthStart } from "./credits.js";

/** Credits left; 0 when there are none or no table yet. */
export async function creditBalance(companyId, db = null) {
  if (!companyId) return 0;
  try {
    const { data, error } = await (db || supabaseAdmin()).from("credit_ledger").select("delta").eq("company_id", companyId);
    if (error) return 0;
    return Math.max(0, (data || []).reduce((s, r) => s + (Number(r.delta) || 0), 0));
  } catch {
    return 0;
  }
}

/** The movements, newest first, for the plan page. */
export async function creditHistory(companyId, limit = 8, db = null) {
  try {
    const { data, error } = await (db || supabaseAdmin()).from("credit_ledger")
      .select("delta, reason, ref, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(limit);
    return error ? [] : data || [];
  } catch {
    return [];
  }
}

/** Offers this workspace created since the 1st of this month (Moldova time). */
export async function offersThisMonth(companyId, db = null) {
  try {
    // midnight on the 1st by the Chișinău clock, which is 21:00 or 22:00 UTC the evening before, by the season
    const from = atLocal(monthStart(mdDayKey(Date.now())), "00:00").toISOString();
    const { count, error } = await (db || supabaseAdmin()).from("proposals")
      .select("code", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", from);
    return error ? 0 : count || 0;
  } catch {
    return 0;
  }
}

/** Whether this reference (a quote's grid file) was already paid for with a credit. */
export async function paidBefore(companyId, reason, ref, db = null) {
  try {
    const { data } = await (db || supabaseAdmin()).from("credit_ledger").select("id")
      .eq("company_id", companyId).eq("reason", reason).eq("ref", ref).lt("delta", 0).limit(1).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Spend credits, atomically (spend_credits() in the database). True when the
 * credits were taken, or already had been for this reference; false when the
 * balance is too low or the function is not installed yet.
 */
export async function spendCredits(companyId, n, reason, ref = null, db = null) {
  try {
    const { data, error } = await (db || supabaseAdmin()).rpc("spend_credits", { p_company: companyId, p_n: n, p_reason: reason, p_ref: ref });
    return !error && data === true;
  } catch {
    return false;
  }
}
