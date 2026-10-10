// app/api/plant-study/route.js — read an energy yield study for a plant.
//
// The browser has already read the PDF and picked the pages with the results
// (lib/studyPages.js), so this receives only their text; for a scan, a small
// PDF of the pages the user chose. lib/studyReader.js asks Claude for each
// figure with its page and quote and checks every one; the plant editor
// shows them for review and applies only what the user ticks. Nothing is
// stored here.
//
// Signed-in users only, rate limited. With no ANTHROPIC_API_KEY it answers a
// clear "not configured", like the bill reader. The model is claude-opus-5 by
// default, overridable with STUDY_EXTRACT_MODEL.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "../../../lib/supabase.js";
import { isRateLimited } from "../../../lib/ratelimit.js";
import { readStudy } from "../../../lib/studyReader.js";
import { MAX_PAGES, MAX_PAGE_CHARS } from "../../../lib/studyPages.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS = { not_study: 422, no_p50: 422, declined: 422, unreadable: 502, too_large: 413, auth: 503, rate: 429, failed: 502 };
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return bad("unauthorized", 401);
  if (!process.env.ANTHROPIC_API_KEY) return bad("not_configured", 503);
  if (await isRateLimited(`study:${user.id}`, 20, 60 * 60 * 1000)) return bad("rate", 429);

  let b;
  try { b = await req.json(); } catch { return bad("bad_request"); }
  const kind = b?.kind === "solar" ? "solar" : b?.kind === "wind" ? "wind" : null;
  if (!kind) return bad("bad_request");
  const fileName = String(b.fileName || "").slice(0, 160);
  const plant = { mw: Number(b.plant?.mw) > 0 ? Number(b.plant.mw) : null };
  const lang = ["en", "ro", "ru", "uk"].includes(b.lang) ? b.lang : "en";

  let pages = null, pdf = null, pageMap = null;
  if (Array.isArray(b.pages)) {
    pages = b.pages.slice(0, MAX_PAGES)
      .filter((p) => Number.isInteger(p?.n) && p.n > 0 && typeof p.text === "string")
      .map((p) => ({ n: p.n, text: p.text.slice(0, MAX_PAGE_CHARS) }));
    if (!pages.length) return bad("bad_request");
  } else if (typeof b.pdf === "string" && /^[A-Za-z0-9+/=]+$/.test(b.pdf.slice(0, 200))) {
    pdf = b.pdf;
    pageMap = Array.isArray(b.pageMap) ? b.pageMap.filter((n) => Number.isInteger(n) && n > 0).slice(0, 20) : null;
  } else {
    return bad("bad_request");
  }

  const r = await readStudy(new Anthropic({ timeout: 55_000, maxRetries: 1 }), { kind, pages, pdf, pageMap, fileName, plant, lang });
  if (!r.ok) return bad(r.code, STATUS[r.code] || 502);
  return NextResponse.json({ ok: true, study: r.study });
}
