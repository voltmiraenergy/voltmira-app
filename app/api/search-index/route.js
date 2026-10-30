// app/api/search-index/route.js — what the Ctrl+K search (components/CommandPalette.jsx) looks through,
// loaded once when it first opens: the caller's quotes, signed jobs and open leads. Auth: the session
// cookie; RLS keeps it to their company, and projectVisibility to the quotes their role may see.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";
import { projectVisibility } from "../../../lib/projectAccess.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const [{ data: projects }, { data: leads }, co] = await Promise.all([
    sb.from("projects").select("id, title, client_name, address, status, owner_id").order("updated_at", { ascending: false }).limit(800),
    sb.from("leads").select("id, name, phone, email, status").neq("status", "archived").order("created_at", { ascending: false }).limit(500),
    currentCompany(),
  ]);
  const sees = await projectVisibility(user, co);
  const mine = (projects || []).filter(sees);
  const row = (p) => ({ id: p.id, title: p.title || "", client: p.client_name || "", address: p.address || "", status: p.status || "draft" });
  return NextResponse.json({
    quotes: mine.filter((p) => p.status !== "won").map(row),
    jobs: mine.filter((p) => p.status === "won").map(row),
    leads: (leads || []).map((l) => ({ id: l.id, name: l.name || "", phone: l.phone || "", email: l.email || "" })),
  }, { headers: { "cache-control": "no-store" } });
}
