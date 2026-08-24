// app/api/proposal/warm/route.js — pre-launch the PDF browser.
//
// Chromium's cold launch is ~3.5s and dominates the first export of any idle
// container. Nothing can make that launch faster, but it can be moved off the
// critical path: the editor pings this the moment the share modal opens, so the
// launch overlaps with the installer reading the link and typing an address.
// By the time they press "Email the PDF" the container is warm and the render
// takes ~1s instead of ~7s.
//
// Signed-in only. Launching a browser is a real resource cost, so it isn't
// something an anonymous caller should be able to trigger.
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { warmBrowser } from "../../../../lib/renderProposalPdf.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await isRateLimited(`warm:${clientIp(req)}`, 60, 60 * 60 * 1000)) {
    // Already warm enough — this is a hint, not an operation worth erroring over.
    return NextResponse.json({ ok: true, skipped: true });
  }
  try {
    const ms = await warmBrowser();
    return NextResponse.json({ ok: true, ms });
  } catch (e) {
    // A failed warm-up must never surface to the user: the export path will
    // launch its own browser and report properly if that fails too.
    console.error("[warm] failed:", e?.message || e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
