// app/api/pay/[token]/proof/route.js — the client sends the proof of a transfer from the pay page: an image or a PDF
// of up to 8 MB, kept in the private bucket pay-proofs under the installer's folder, the installer told in Activity.
// Public, by the page's token; rate-limited per address and per token. The installer still marks the stage received
// once the money is in the account: a proof is not a payment.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { logActivity } from "../../../../../lib/activity.js";
import { pt } from "../../../../../lib/payText.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX = 8 * 1024 * 1024;

export async function POST(req, ctx) {
  const { token } = await ctx.params;
  if (!TOKEN.test(String(token || ""))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (await isRateLimited(`payproof:${clientIp(req)}`, 10, 3_600_000) || await isRateLimited(`payproof:t:${token}`, 5, 3_600_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const db = supabaseAdmin();
  const { data: m } = await db.from("pay_milestones").select("id, company_id, project_id, status, invoice_no").eq("pay_token", token).maybeSingle();
  if (!m || m.status !== "issued") return NextResponse.json({ error: "not_found" }, { status: 404 });
  let file;
  try { file = (await req.formData()).get("file"); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!EXT[file.type]) return NextResponse.json({ error: "type" }, { status: 415 });
  if (file.size > MAX) return NextResponse.json({ error: "too_big" }, { status: 413 });
  const path = `${m.company_id}/${m.id}/${Date.now()}.${EXT[file.type]}`;
  const up = await db.storage.from("pay-proofs").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (up.error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  await db.from("pay_milestones").update({ proof_path: path, proof_at: new Date().toISOString() }).eq("id", m.id);
  const { data: p } = await db.from("projects").select("title, client_name").eq("id", m.project_id).maybeSingle();
  const client = p?.client_name || p?.title || "";
  await logActivity(db, { companyId: m.company_id, kind: "sys", key: "act_ms_proof", params: { b: client, n: m.invoice_no }, text: pt("own_proof", "en", { client, no: m.invoice_no }), link: "/jobs?view=cash" });
  return NextResponse.json({ ok: true });
}
