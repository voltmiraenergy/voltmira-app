// lib/packAdmin.js — the bank packs waiting to be paid by bank transfer, for
// VoltMira's own team (the Traction page and app/api/admin/packs). Server-only;
// the caller checks the platform admin first.
import { supabaseAdmin } from "./supabase.js";

/** The open requests with each company's name, oldest first; [] without the table. */
export async function openPackRequests() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("pack_requests")
    .select("id, company_id, portfolio_id, plant_id, plant_name, tier, amount_eur, billing, requested_by, created_at")
    .eq("status", "open").order("created_at", { ascending: true }).limit(100);
  if (error || !data?.length) return [];
  const ids = [...new Set(data.map((r) => r.company_id))];
  const { data: cos } = await db.from("companies").select("id, name").in("id", ids);
  const name = Object.fromEntries((cos || []).map((c) => [c.id, c.name]));
  return data.map((r) => ({ ...r, company: name[r.company_id] || "" }));
}

