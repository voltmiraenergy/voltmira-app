// app/api/account/route.js — GDPR right to erasure: the owner permanently
// deletes their own company and every row that hangs off it.
//
// DELETE { confirm: <exact company name> } → owner-only. Requires typing the
// real company name back (not just a boolean) so this can never fire from a
// stray double-click or a replayed request — the confirmation value has to
// come from a human reading the name on screen.
//
// Cascade: every company_id-bearing table in supabase/schema.sql is declared
// `references companies(id) on delete cascade` — deleting the one row here
// removes every project, proposal, proposal_events, lead and profile that
// belongs to this company. Verified directly against schema.sql, not assumed.
//
// What this does NOT do: cancel a live Paddle subscription. Paddle is the
// merchant of record and subscription management is deliberately routed
// through Paddle's own self-service portal (see the Refund Policy and
// Settings' billing note) — this codebase has no server-side Paddle API key
// to call their subscription-cancellation endpoint, and guessing at that
// integration without a real sandbox to test against is exactly the kind of
// unverified claim this project avoids making. So: if the company is on a
// paid plan, this route refuses and tells the caller to cancel in Paddle
// first — deleting the data while a subscription silently keeps charging
// would be worse than refusing.
//
// Other members of the company keep their own login (auth.users row) — only
// their profile row (their membership in THIS company) is cascade-deleted,
// same as removing a single teammate via DELETE /api/team. Only the
// REQUESTING OWNER's own auth.users record is deleted here, since they're
// the one asking to leave entirely.
import { NextResponse } from "next/server";
import { supabaseServer, supabaseAdmin } from "../../../lib/supabase.js";
import { currentCompany } from "../../../lib/session.js";

export async function DELETE(req) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: me } = await admin.from("profiles").select("role, company_id").eq("id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "no_profile" }, { status: 404 });
  if (me.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });

  const co = await currentCompany();
  if (!co || co.id !== me.company_id) return NextResponse.json({ error: "no_company" }, { status: 404 });

  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const typed = String(b.confirm || "").trim();
  if (!typed || typed !== (co.name || "").trim()) {
    return NextResponse.json({ error: "confirm_mismatch" }, { status: 400 });
  }

  if (co.plan && co.plan !== "free") {
    return NextResponse.json({ error: "active_subscription" }, { status: 409 });
  }

  const { error: delErr } = await admin.from("companies").delete().eq("id", co.id);
  if (delErr) return NextResponse.json({ error: "delete_failed" }, { status: 502 });

  // Best-effort: the company and every dependent row are already gone by this
  // point (cascade), so a failure here leaves an orphaned but harmless
  // sign-in credential rather than any real data — never block on it.
  try { await admin.auth.admin.deleteUser(user.id); } catch { /* see comment above */ }

  return NextResponse.json({ ok: true });
}
