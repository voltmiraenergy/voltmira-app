"use server";
// lib/portfolioActions.js — server actions for portfolios beyond create and
// delete (those live in lib/actions.js). RLS scopes every row to the caller's
// company, and company_id defaults to theirs in the database, so a copy can
// never land in, or be read from, another company.
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase.js";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Copy a portfolio (its quotes, terms, base case, registers and screening) to
 * try another structure without touching the original.
 * @param {string} id     the portfolio to copy
 * @param {string} name   the copy's name, already in the user's language
 * @returns {Promise<{id?:string, error?:string}>}
 */
export async function duplicatePortfolio(id, name) {
  if (!UUID.test(String(id))) return { error: "bad_id" };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "unauthorized" };
  const { data: src, error } = await sb.from("portfolios")
    .select("name, market, project_ids, finance, scenario, assets, es").eq("id", id).maybeSingle();
  if (error || !src) return { error: "not_found" };
  const copy = {
    name: String(name || src.name || "Portfolio").trim().slice(0, 160) || "Portfolio",
    market: src.market,
    project_ids: src.project_ids || [],
    finance: src.finance || {},
    scenario: src.scenario || {},
    assets: src.assets || {},
    es: src.es || {},
  };
  const { data, error: insErr } = await sb.from("portfolios").insert(copy).select("id").single();
  if (insErr || !data) return { error: "insert_failed" };
  revalidatePath("/portfolios");
  return { id: data.id };
}
