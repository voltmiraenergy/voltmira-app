// app/api/marketplace/doc/route.js — the installer's licence or insurance
// document, stored in the private verify-docs bucket (docs/MARKETPLACE.md).
// POST multipart { kind: "licence"|"insurance", file }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { installerGuard } from "../../../../lib/marketGuard.js";
import { attachDoc } from "../../../../lib/profileFlow.js";

export const runtime = "nodejs";

export async function POST(req) {
  if (await isRateLimited(`mp-doc:${clientIp(req)}`, 20, 60 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const g = await installerGuard({ manage: true });
  if (g instanceof Response) return g;
  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const file = form.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "size" }, { status: 400 });
  const admin = supabaseAdmin();
  const r = await attachDoc(admin, admin.storage, {
    companyId: g.co.id, kind: String(form.get("kind") || ""),
    file: { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type },
    actor: { id: g.user.id, email: g.user.email },
  });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "needs_db" ? 503 : 400 });
}
