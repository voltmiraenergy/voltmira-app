// lib/gridRulesStore.js — SERVER only. Loads the grid operators' rules (supabase/add-grid-connection.sql
// grid_requirements, lib/gridRules.js), falling back to the rules in code while the SQL has not run, so a file is
// checked exactly as it was before. Kept for a minute per server, like the tariffs (lib/tariffStore.js); the
// server that publishes a version forgets it at once.
import { supabaseAdmin } from "./supabase.js";
import { GRID_OPERATORS, GRID_RULES_SEED, latestGridRules } from "./gridRules.js";
import { missingTable } from "./tariffStore.js";

const TTL = 60_000;
let cache = null;

// a stored row in the shape lib/gridRules.js reads
const fromRow = (r) => ({ ...r, maxAgeDays: r.max_age_days || {}, expectedDays: r.expected_days || {} });

/** { rows, fromDb, needsDb }: every version of every operator, oldest first. */
export async function loadGridRules() {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  let value;
  try {
    const { data, error } = await supabaseAdmin().from("grid_requirements").select("*").order("operator").order("version");
    if (error) value = { rows: GRID_RULES_SEED, fromDb: false, needsDb: missingTable(error) };
    else value = { rows: data?.length ? data.map(fromRow) : GRID_RULES_SEED, fromDb: !!data?.length, needsDb: false };
  } catch {
    value = { rows: GRID_RULES_SEED, fromDb: false, needsDb: false };
  }
  cache = { at: Date.now(), value };
  return value;
}

export function forgetGridRulesCache() { cache = null; }

/** The rules in force for one operator. */
export async function gridRulesFor(operator) {
  const { rows } = await loadGridRules();
  return latestGridRules(rows, operator);
}

/** The rules in force for every operator: { premier, rednord }. */
export async function allGridRules() {
  const { rows } = await loadGridRules();
  return Object.fromEntries(GRID_OPERATORS.map((op) => [op, latestGridRules(rows, op)]));
}
