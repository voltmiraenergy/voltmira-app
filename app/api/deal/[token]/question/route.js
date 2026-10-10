// app/api/deal/[token]/question/route.js — a bank asks a question on one
// checklist item through its link. The link must be open; the question is
// checked (lib/dealRoom.js cleanQuestion), stored for the installer under that
// item, and logged. Limited per visitor and per link.
import { NextResponse, after } from "next/server";
import { openDeal, logView } from "../../../../../lib/dealLoad.js";
import { notifyDealQuestion } from "../../../../../lib/dealNotify.js";
import { cleanQuestion } from "../../../../../lib/dealRoom.js";
import { plt } from "../../../../../lib/plantText.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req, props) {
  const { token } = await props.params;
  if (await isRateLimited(`dealq:${clientIp(req)}`, 20, 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const o = await openDeal(token);
  if (o.state !== "active") return NextResponse.json({ error: "closed" }, { status: 404 });
  const { link, sb } = o;
  if (await isRateLimited(`dealq-link:${link.id}`, 60, 24 * 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const q = cleanQuestion(body || {});
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: 400 });
  const { data, error } = await sb.from("deal_questions").insert({
    company_id: link.company_id, portfolio_id: link.portfolio_id, plant_id: link.plant_id, link_id: link.id,
    item_id: q.item, asked_by: q.name, body: q.body,
  }).select("id, item_id, asked_by, body, answer, answer_doc_id, answered_at, created_at").single();
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  await logView(link, "question", plt("pm_" + q.item, link.lang), req.headers);
  after(() => notifyDealQuestion(link, data));
  return NextResponse.json({ ok: true, question: data });
}
