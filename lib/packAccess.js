// lib/packAccess.js — whether a bank pack (or a portfolio's data room) may be
// downloaded, read on the server: the company's paid unlocks
// (supabase/add-pack-pricing.sql) put through lib/packPricing.js packAccess().
// The rows are read with the service role, never through the browser; a
// database without the table yet has no unlocks, which only matters once the
// gate is on (PACK_PAYWALL), and the gate is turned on after the SQL is run.
// Server-only.
import { supabaseAdmin } from "./supabase.js";
import { packAccess, paywallOn, localSwitch } from "./packPricing.js";
import { PLANTS_KEY } from "./portfolioModel.js";
import { isPlatformAdmin } from "./platformAdmin.js";

/** The company's unlocks for one portfolio; [] when there are none or no table. */
export async function loadUnlocks(companyId, portfolioId, db = null) {
  if (!companyId || !portfolioId) return [];
  try {
    const { data, error } = await (db || supabaseAdmin()).from("pack_unlocks")
      .select("portfolio_id, plant_id, tier, expires_at, source, unlocked_at")
      .eq("company_id", companyId).eq("portfolio_id", portfolioId);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/** The open invoice request for this pack, if one is waiting. */
export async function openRequest(companyId, portfolioId, plantId, db = null) {
  try {
    let q = (db || supabaseAdmin()).from("pack_requests").select("id, created_at, amount_eur, tier")
      .eq("company_id", companyId).eq("portfolio_id", portfolioId).eq("status", "open");
    q = plantId ? q.eq("plant_id", plantId) : q.is("plant_id", null);
    const { data } = await q.order("created_at", { ascending: false }).limit(1);
    return data?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * The access to one pack, for a route.
 * @param {object} a
 * @param {string} a.companyId
 * @param {string} a.portfolioId
 * @param {object|null} a.plant   the stored plant, or null for the data room
 * @param {string} [a.email]      the caller's verified address (a platform admin is never locked out)
 */
export async function loadPackAccess({ companyId, portfolioId, plant = null, email = "", db = null }) {
  // with the gate off, nothing is read
  if (!paywallOn()) return packAccess({ plant, portfolioId, unlocks: [] });
  const unlocks = await loadUnlocks(companyId, portfolioId, db);
  return packAccess({ plant, portfolioId, unlocks, admin: isPlatformAdmin(email) });
}

/** The 402 a route answers for a locked pack: what it costs and how to pay. */
export function lockedBody(access) {
  return { error: "pack_locked", tier: access.tier, priceEur: access.priceEur, renewal: access.renewal };
}

/**
 * The access to a portfolio's own documents (the bankability report and the
 * investor teaser as PDF, the Excel model, the data room):
 *   no real plant (rooftop quotes, or samples)  free, as it always was
 *   one plant                                    that plant's pack opens them: one project, one payment
 *   several plants                               the portfolio pack
 * @param {object} a
 * @param {object} a.portfolio  the portfolio row (assets, company_id, id)
 * @returns {Promise<object>}  packAccess() plus { payPlantId, plantCount }: the plant to pay for, or null for the portfolio pack
 */
export async function loadPortfolioAccess({ portfolio, email = "", db = null }) {
  const plants = Array.isArray(portfolio?.assets?.[PLANTS_KEY]) ? portfolio.assets[PLANTS_KEY].filter((p) => p && p.id) : [];
  const counted = localSwitch("PACK_LOCK_SAMPLES") ? plants : plants.filter((p) => !p.sample);
  const portfolioId = portfolio.id;
  if (!counted.length) return { ...packAccess({ plant: null, portfolioId, unlocks: [] }), open: true, reason: "free", payPlantId: null, plantCount: 0 };
  if (!paywallOn()) return { ...packAccess({ plant: null, portfolioId, unlocks: [] }), payPlantId: null, plantCount: counted.length };
  const unlocks = await loadUnlocks(portfolio.company_id, portfolioId, db);
  const admin = isPlatformAdmin(email);
  const room = packAccess({ plant: null, portfolioId, unlocks, admin });
  if (room.open || counted.length > 1) return { ...room, payPlantId: null, plantCount: counted.length };
  const one = packAccess({ plant: counted[0], portfolioId, unlocks, admin });
  return { ...one, payPlantId: String(counted[0].id), plantCount: 1 };
}
