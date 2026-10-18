// app/api/home/claim/route.js — the client opens their account from their
// signed offer (ClientAfter.jsx). The offer's code is the capability, as for
// the rest of the offer; only the email the quote holds gets a link, and the
// answer is the same either way.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { linkHomeowner } from "../../../../lib/homeownerFlow.js";
import { homeIo, appBase } from "../../../../lib/homeServer.js";

export async function POST(req) {
  if (await isRateLimited(`home-claim:${clientIp(req)}`, 8, 60 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const code = String(body.code || "");
  if (!/^[a-z0-9]{6,16}$/i.test(code)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals").select("project_id, company_id, accepted_at").eq("code", code).maybeSingle();
  if (!prop?.accepted_at) return NextResponse.json({ error: "not_signed" }, { status: 409 });
  const [{ data: project }, { data: co }] = await Promise.all([
    db.from("projects").select("id, company_id, client_email").eq("id", prop.project_id).maybeSingle(),
    db.from("companies").select("name, short_name, lang").eq("id", prop.company_id).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const r = await linkHomeowner(db, { project, email: body.email, via: "claim", base: appBase(req), lang: co?.lang || "ro", company: co?.short_name || co?.name || "", io: homeIo() });
  if (!r.ok && r.error === "email") return NextResponse.json({ error: "email" }, { status: 400 });
  if (!r.ok && r.error === "installer_account") return NextResponse.json({ error: "installer_account" }, { status: 409 });
  if (!r.ok && r.error === "needs_db") return NextResponse.json({ error: "needs_db" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
