// lib/marketGuard.js — a marketplace route's check (docs/MARKETPLACE.md):
// signed in to a workspace; for the public profile and its documents, a
// member who may manage the company's integrations (lib/rbac.js).
// Returns { user, co } or a Response.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase.js";
import { currentUser, currentCompany } from "./session.js";
import { canManageIntegrations } from "./rbac.js";

export async function installerGuard({ manage = false } = {}) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: "no_company" }, { status: 403 });
  if (manage) {
    const { data: me } = await supabaseAdmin().from("profiles").select("role, title").eq("id", user.id).maybeSingle();
    if (!canManageIntegrations(me, co.rbac_enabled)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return { user, co };
}
