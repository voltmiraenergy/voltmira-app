// lib/tariffStore.js — SERVER only. Loads the versioned tariff rules and
// support programmes (supabase/add-tariffs-subsidies.sql), falling back to the
// code seeds (lib/tariffSeed.js, lib/subsidySeed.js) while the SQL has not run,
// so the app computes exactly as it did before. Kept for a minute per server:
// a new version is picked up within that minute everywhere, at once by the
// server that published it (forgetTariffCache).
import { supabaseAdmin } from "./supabase.js";
import { TARIFF_SEED } from "./tariffSeed.js";
import { SUBSIDY_SEED } from "./subsidySeed.js";
import { pickRule, ruleQuoteInputs } from "./tariffRules.js";

const TTL = 60_000;
const cache = { tariffs: null, programs: null };

/** The table does not exist yet: the SQL has not run. */
export const missingTable = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache|relation/i.test(e.message || ""));

async function load(key, table, order, seed) {
  const hit = cache[key];
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value;
  try {
    const { data, error } = await supabaseAdmin().from(table).select("*").order(order[0], { ascending: true }).order(order[1], { ascending: true });
    if (error) value = { rows: seed, fromDb: false, needsDb: missingTable(error) };
    else value = { rows: data?.length ? data : seed, fromDb: !!data?.length, needsDb: false };
  } catch {
    value = { rows: seed, fromDb: false, needsDb: false };
  }
  cache[key] = { at: Date.now(), value };
  return value;
}

/** { rows, fromDb, needsDb } of tariff_rules. */
export const loadTariffRules = () => load("tariffs", "tariff_rules", ["operator", "version"], TARIFF_SEED);
/** { rows, fromDb, needsDb } of subsidy_programs. */
export const loadSubsidyPrograms = () => load("programs", "subsidy_programs", ["code", "version"], SUBSIDY_SEED);

/** After publishing a new version. */
export function forgetTariffCache() { cache.tariffs = null; cache.programs = null; }

/**
 * What a Moldovan quote's tariff rule hands the engine on a date (null for
 * other markets): see lib/tariffRules.js ruleQuoteInputs.
 */
export async function tariffFor({ market, operator, date }) {
  if (market !== "MD") return null;
  const { rows } = await loadTariffRules();
  return ruleQuoteInputs(pickRule(rows, { market, operator: operator || "premier", date }));
}
