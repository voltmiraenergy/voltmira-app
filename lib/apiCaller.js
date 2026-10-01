// lib/apiCaller.js — who is calling a workspace API route (inverter portals,
// lead-assistant channels).
// Resolved on the server from the session, never from the request body, so a
// route can't be pointed at another company's accounts.
import { currentUser } from "./session.js";
import { supabaseAdmin } from "./supabase.js";
import { canManageIntegrations } from "./rbac.js";

export async function caller() {
  const user = await currentUser();
  if (!user) return null;
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from("profiles").select("id, role, title, company_id").eq("id", user.id).maybeSingle();
  if (!prof?.company_id) return null;
  const { data: co } = await admin.from("companies").select("*").eq("id", prof.company_id).maybeSingle();
  return {
    user, admin, companyId: prof.company_id, profile: prof,
    canManage: canManageIntegrations(prof, !!co?.rbac_enabled),
  };
}
