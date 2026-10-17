"use server";
// lib/gridActions.js — the same client's applicant details from an earlier
// quote, so a second quote's grid file fills itself (GridDetails.jsx). The
// client is matched by email, else by name, inside this company only (the
// session client, so row security decides what is visible).
import { supabaseServer } from "./supabase.js";
import { reuseApplicant } from "./gridDetails.js";

/** @returns {Promise<{ details: object, from: string } | null>} */
export async function knownApplicant(projectId) {
  const sb = await supabaseServer();
  const { data: p } = await sb.from("projects").select("id, company_id, client_name, client_email, address").eq("id", projectId).maybeSingle();
  if (!p || !(p.client_email || p.client_name)) return null;
  let q = sb.from("projects").select("id, title, client_name, client_email, install_progress, updated_at").eq("company_id", p.company_id).neq("id", p.id);
  q = p.client_email ? q.eq("client_email", p.client_email) : q.ilike("client_name", p.client_name);
  const { data: rows } = await q.order("updated_at", { ascending: false }).limit(20);
  const prev = (rows || []).find((r) => r.install_progress?.gridFile?.details);
  if (!prev) return null;
  return { details: reuseApplicant(prev.install_progress.gridFile.details, p.address), from: prev.title || prev.client_name || "" };
}
