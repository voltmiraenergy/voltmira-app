// app/api/admin/grid-rules/route.js — publish a new version of what a grid operator asks for (lib/gridRules.js,
// supabase/add-grid-connection.sql). Platform admins only (PLATFORM_ADMIN_EMAILS); anyone else gets a 404. The
// form is checked here, the version number is the server's, and a publish identical to the latest version returns
// that version instead of adding a copy. Every publish writes an audit row with the version before it.
//   POST { operator, docs, custom, maxAgeDays, expectedDays, note }  -> { ok, rule, diff }
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { validateGridRules, diffGridRules } from "../../../../lib/gridRules.js";
import { writeAudit } from "../../../../lib/audit.js";
import { missingTable } from "../../../../lib/tariffStore.js";
import { forgetGridRulesCache } from "../../../../lib/gridRulesStore.js";

export const dynamic = "force-dynamic";

const shaped = (r) => r && ({ ...r, maxAgeDays: r.max_age_days || {}, expectedDays: r.expected_days || {} });

export async function POST(req) {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let body = {};
  try { body = await req.json(); } catch { /* empty body: refused below */ }
  const v = validateGridRules(body);
  if (!v.ok) return NextResponse.json({ error: "invalid", fields: v.errors }, { status: 400 });

  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: rows, error } = await db.from("grid_requirements").select("*").eq("operator", v.row.operator);
    if (error) return NextResponse.json({ error: missingTable(error) ? "needs_db" : "load_failed" }, { status: missingTable(error) ? 503 : 500 });
    const prev = (rows || []).reduce((a, r) => (!a || r.version > a.version ? r : a), null);
    const next = shaped(v.row);
    if (prev && diffGridRules(shaped(prev), next).length === 0) return NextResponse.json({ ok: true, rule: prev, diff: [], unchanged: true });
    const version = (prev?.version || 0) + 1;
    const { data: rule, error: insErr } = await db.from("grid_requirements").insert({ ...v.row, version, created_by: user.email }).select().single();
    if (insErr?.code === "23505") continue;   // another admin took this number a moment ago: count again
    if (insErr) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    await writeAudit(db, { companyId: null, actor: { id: user.id, email: user.email }, action: "grid_rules.publish", entity: "grid_requirement", entityId: rule.id, before: prev, after: rule });
    forgetGridRulesCache();
    return NextResponse.json({ ok: true, rule, diff: diffGridRules(shaped(prev), shaped(rule)) });
  }
  return NextResponse.json({ error: "busy" }, { status: 409 });
}
