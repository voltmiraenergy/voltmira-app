// lib/projectAccess.js — which quotes the signed-in person may see when the owner has turned access
// control on (lib/rbac.js, companies.rbac_enabled): a Sales title sees only the quotes it owns. The
// database lets every member of a company read all of its rows, so each route that reads quotes
// outside the quotes list and the editor has to apply the rule itself: exports, invoices, payments, the
// connection application. Server only.
import { supabaseAdmin } from "./supabase.js";
import { canViewAllProjects } from "./rbac.js";

/**
 * @param {{ id: string }} user
 * @param {{ rbac_enabled?: boolean }|null} co  the company row (select("*"), as currentCompany gives)
 * @returns {Promise<(project: { owner_id?: string|null }) => boolean>} whether this person may see a quote
 */
export async function projectVisibility(user, co) {
  if (!co?.rbac_enabled) return () => true;
  const { data: me, error } = await supabaseAdmin().from("profiles").select("role, title").eq("id", user.id).maybeSingle();
  // a profile that could not be read is not a licence to see every quote: only the person's own, this request
  if (error) return (p) => !!p && p.owner_id === user.id;
  if (canViewAllProjects(me || null, true)) return () => true;
  return (p) => !!p && p.owner_id === user.id;
}
