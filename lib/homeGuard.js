// lib/homeGuard.js — a homeowner route's check: signed in as a homeowner, and
// the project is linked to them. Returns { user, project, co } or a Response.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase.js";
import { currentHomeowner } from "./homeServer.js";

export async function homeGuard(projectId) {
  const user = await currentHomeowner();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(String(projectId || ""))) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const db = supabaseAdmin();
  const { data: link } = await db.from("homeowner_links").select("company_id").eq("user_id", user.id).eq("project_id", projectId).maybeSingle();
  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [{ data: project }, { data: co }] = await Promise.all([
    db.from("projects").select("id, company_id, title, client_name, client_email, address, install_progress").eq("id", projectId).maybeSingle(),
    db.from("companies").select("id, name, short_name, lang").eq("id", link.company_id).maybeSingle(),
  ]);
  if (!project || !co) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return { user, project, co, db };
}
