// app/api/qsign/return/route.js — the client is back from MSign (or the
// simulation): read the result, check it against the offer's hash, accept the
// offer at the qualified level, and send the client to their offer with the
// outcome. Safe to reload: a request already finished answers the same.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { qsignAdapterFor } from "../../../../lib/qsign.js";
import { finishQualified } from "../../../../lib/qsignFlow.js";
import { acceptProposal } from "../../../../lib/acceptProposal.js";
import { acceptIo } from "../../../../lib/acceptIo.js";

export async function GET(req) {
  const url = new URL(req.url);
  const ip = clientIp(req);
  if (await isRateLimited(`qsign:return:${ip}`, 30, 60_000)) return new NextResponse("Too many requests", { status: 429 });
  const requestId = String(url.searchParams.get("r") || "");
  if (!/^QS-[0-9a-f]{24}$/.test(requestId)) return new NextResponse("Not found", { status: 404 });

  const db = supabaseAdmin();
  const adapter = qsignAdapterFor({ baseUrl: url.origin });
  const r = await finishQualified(db, {
    requestId, adapter, ip: ip || null, ua: String(req.headers.get("user-agent") || "").slice(0, 300) || null,
    accept: (prop, sig) => acceptProposal(db, prop, sig, acceptIo),
  });
  if (!r.code) return new NextResponse("Not found", { status: 404 });
  const outcome = r.ok ? r.outcome : "invalid";
  return NextResponse.redirect(`${url.origin}/p/${encodeURIComponent(r.code)}?qsign=${outcome}#accept`, 303);
}
