// app/api/admin/tariffs/route.js — publish a new tariff rule version
// (docs/TARIFFS_AND_SUBSIDIES.md). Platform admins only (PLATFORM_ADMIN_EMAILS);
// anyone else gets a 404. The form is checked and converted to integer minor
// units here (lib/adminValidate.js), the version number is the server's, and a
// publish identical to the latest version returns that version instead of
// adding a copy. Every publish writes an audit row with the version before it.
//   POST { operator, effective_from, ... }  -> { ok, rule, diff }
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { validateTariffInput } from "../../../../lib/adminValidate.js";
import { nextVersion, diffRules } from "../../../../lib/tariffRules.js";
import { writeAudit } from "../../../../lib/audit.js";
import { forgetTariffCache, missingTable } from "../../../../lib/tariffStore.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let body = {};
  try { body = await req.json(); } catch { /* empty body: refused below */ }
  const v = validateTariffInput(body);
  if (!v.ok) return NextResponse.json({ error: "invalid", fields: v.errors }, { status: 400 });

  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: rows, error } = await db.from("tariff_rules").select("*").eq("market", "MD").eq("operator", v.row.operator);
    if (error) return NextResponse.json({ error: missingTable(error) ? "needs_db" : "load_failed" }, { status: missingTable(error) ? 503 : 500 });
    const prev = (rows || []).reduce((a, r) => (!a || r.version > a.version ? r : a), null);
    if (prev && diffRules(prev, v.row).length === 0) return NextResponse.json({ ok: true, rule: prev, diff: [], unchanged: true });
    const version = nextVersion(rows, { operator: v.row.operator });
    const { data: rule, error: insErr } = await db.from("tariff_rules").insert({ ...v.row, version, created_by: user.email }).select().single();
    if (insErr?.code === "23505") continue;   // another admin took this number a moment ago: count again
    if (insErr) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    await writeAudit(db, { companyId: null, actor: { id: user.id, email: user.email }, action: "tariff.publish", entity: "tariff_rule", entityId: rule.id, before: prev, after: rule });
    forgetTariffCache();
    return NextResponse.json({ ok: true, rule, diff: diffRules(prev, rule) });
  }
  return NextResponse.json({ error: "busy" }, { status: 409 });
}
