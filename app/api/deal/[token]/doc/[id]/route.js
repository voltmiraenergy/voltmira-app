// app/api/deal/[token]/doc/[id]/route.js — a bank downloads one document
// through its link. The link must be open and the document must belong to
// the link's plant; the download is logged, then the bank is sent to a
// signed address valid for one minute, so the file never passes through here.
import { NextResponse } from "next/server";
import { openDeal, logView } from "../../../../../../lib/dealLoad.js";
import { DEAL_BUCKET } from "../../../../../../lib/dealRoom.js";
import { isRateLimited, clientIp } from "../../../../../../lib/ratelimit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req, props) {
  const { token, id } = await props.params;
  if (await isRateLimited(`dealdoc:${clientIp(req)}`, 120, 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const o = await openDeal(token);
  if (o.state !== "active" || !UUID.test(String(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { link, sb } = o;
  const { data: doc } = await sb.from("deal_documents").select("id, name, path")
    .eq("id", id).eq("company_id", link.company_id).eq("portfolio_id", link.portfolio_id).eq("plant_id", link.plant_id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data, error } = await sb.storage.from(DEAL_BUCKET).createSignedUrl(doc.path, 60, { download: doc.name });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  await logView(link, "document", doc.name, req.headers);
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
