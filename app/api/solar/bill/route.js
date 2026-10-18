// app/api/solar/bill/route.js — the funnel's bill photo: the year's
// consumption read from a homeowner's electricity bill (lib/billReader.js).
// Only while AI is switched on (lib/featureFlags.js; proxy.js answers 404
// otherwise) and with ANTHROPIC_API_KEY set. Public, so tightly rate-limited;
// the file is read and forgotten, never stored.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { readBill, BILL_MAX_BYTES } from "../../../../lib/billReader.js";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  if (await isRateLimited(`solar-bill:${clientIp(req)}`, 4, 60 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const file = form.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size > BILL_MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const r = await readBill(new Anthropic(), { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type });
  if (!r.ok || !(r.bill?.annualKwh > 0)) return NextResponse.json({ error: "unreadable" }, { status: 422 });
  return NextResponse.json({ ok: true, annualKwh: Math.round(r.bill.annualKwh) });
}
