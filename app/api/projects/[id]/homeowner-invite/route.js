// app/api/projects/[id]/homeowner-invite/route.js — the installer invites the
// client (or a second owner) to their own account (docs/MARKETPLACE.md).
// POST { email }: the installer's own project only.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { billingGuard } from "../../../../../lib/invoiceServer.js";
import { linkHomeowner } from "../../../../../lib/homeownerFlow.js";
import { homeIo, appBase } from "../../../../../lib/homeServer.js";

export async function POST(req, props) {
  const { id } = await props.params;
  if (await isRateLimited(`home-invite:${clientIp(req)}`, 20, 60 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await billingGuard(id);
  if (g instanceof Response) return g;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const { co, project, user } = g;
  const r = await linkHomeowner(supabaseAdmin(), {
    project, email: body.email, via: "invite", base: appBase(req), lang: co.lang || "ro",
    company: co.short_name || co.name || "", actor: { id: user.id, email: user.email }, io: homeIo(),
  });
  const status = r.ok ? 200 : r.error === "email" ? 400 : r.error === "installer_account" ? 409 : r.error === "needs_db" ? 503 : 500;
  return NextResponse.json(r, { status });
}
