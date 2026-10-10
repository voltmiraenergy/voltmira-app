// app/api/agent/bill/route.js — a homeowner sends a photo (or PDF) of their
// electricity bill in the website chat (/widget/chat). PUBLIC, like the chat
// itself: the bill is read (lib/billReader.js) and never stored; the chat then
// passes what was read to the assistant as its next message.
//   POST multipart { companyId, lang?, file }
//     -> { facts }  or  { message } when the bill couldn't be read
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { t, normLang, LANGS } from "../../../../lib/i18n.js";
import { readBill, billFacts } from "../../../../lib/billReader.js";
import { agentConfigured } from "../../../../lib/claudeClient.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  const ip = clientIp(req);
  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const companyId = String(form.get("companyId") || "");
  const file = form.get("file");
  if (!UUID.test(companyId) || !file || typeof file === "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // A bill read is a vision call: fewer per visitor than chat messages, and
  // capped per installer so a leaked embed can't run up a bill.
  if (await isRateLimited(`agent:bill:ip:${ip}`, 5, 600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  if (await isRateLimited(`agent:bill:co:${companyId}`, 80, 86_400_000)) return NextResponse.json({ error: "rate" }, { status: 429 });

  const db = supabaseAdmin();
  const { data: co } = await db.from("companies").select("id, lang").eq("id", companyId).maybeSingle();
  if (!co) return NextResponse.json({ error: "unknown_company" }, { status: 404 });
  const lang = LANGS.includes(form.get("lang")) ? form.get("lang") : normLang(co.lang);
  if (!agentConfigured()) return NextResponse.json({ message: t("agent_unavailable", lang) }, { status: 503 });

  const r = await readBill(new Anthropic(), { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type });
  const facts = r.ok ? billFacts(r.bill) : null;
  if (!facts) {
    return NextResponse.json({ message: t(r.code === "too_large" ? "agent_bill_big" : "agent_bill_failed", lang) }, { status: 200 });
  }
  return NextResponse.json({ facts });
}
