// app/api/admin/subsidies/route.js — publish a new version of a support
// programme, or a new programme (docs/TARIFFS_AND_SUBSIDIES.md). Platform
// admins only; anyone else gets a 404. Checked and converted on the server
// (lib/adminValidate.js); the version is the server's; a publish identical to
// the latest version returns it. Every publish writes an audit row.
//   POST { code, kind, name, ... }  -> { ok, program }
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { validateSubsidyInput } from "../../../../lib/adminValidate.js";
import { writeAudit } from "../../../../lib/audit.js";
import { forgetTariffCache, missingTable } from "../../../../lib/tariffStore.js";

export const dynamic = "force-dynamic";

const SAME = ["kind", "name", "provider", "eligibility", "estimate", "required_documents", "valid_from", "valid_to", "active", "source_url"];
const same = (a, b) => SAME.every((k) => JSON.stringify(a?.[k] ?? null) === JSON.stringify(b?.[k] ?? null));

export async function POST(req) {
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let body = {};
  try { body = await req.json(); } catch { /* empty body: refused below */ }
  const v = validateSubsidyInput(body);
  if (!v.ok) return NextResponse.json({ error: "invalid", fields: v.errors }, { status: 400 });

  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: rows, error } = await db.from("subsidy_programs").select("*").eq("code", v.row.code);
    if (error) return NextResponse.json({ error: missingTable(error) ? "needs_db" : "load_failed" }, { status: missingTable(error) ? 503 : 500 });
    const prev = (rows || []).reduce((a, r) => (!a || r.version > a.version ? r : a), null);
    if (prev && same(prev, v.row)) return NextResponse.json({ ok: true, program: prev, unchanged: true });
    const version = 1 + Math.max(0, ...(rows || []).map((r) => r.version));
    const { data: program, error: insErr } = await db.from("subsidy_programs").insert({ ...v.row, version, created_by: user.email }).select().single();
    if (insErr?.code === "23505") continue;
    if (insErr) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    await writeAudit(db, { companyId: null, actor: { id: user.id, email: user.email }, action: "subsidy.publish", entity: "subsidy_program", entityId: program.id, before: prev, after: program });
    forgetTariffCache();
    return NextResponse.json({ ok: true, program });
  }
  return NextResponse.json({ error: "busy" }, { status: 409 });
}
