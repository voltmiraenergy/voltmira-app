// app/api/extract-bill/route.js — AI energy-bill extractor.
//
// The installer uploads a photo or PDF of the client's electricity bill; a Claude
// vision model reads it and returns the annual kWh consumption (the field that's
// otherwise the most tedious manual entry) plus the meter number, supplier and any
// mention of an existing subsidy. The editor shows these for review before applying
// — we never silently overwrite the installer's inputs. The reading itself lives
// in lib/billReader.js, shared with the lead assistant.
//
// Auth-gated (installers only). Degrades gracefully: with no ANTHROPIC_API_KEY set,
// it returns a clear "not configured" message instead of erroring — same pattern as
// Resend/Turnstile. Model is claude-opus-5 by default, overridable per-deployment
// with BILL_EXTRACT_MODEL (e.g. claude-haiku-4-5 to cut per-scan cost).
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "../../../lib/supabase.js";
import { readBill } from "../../../lib/billReader.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FAIL = {
  type: [415, "unsupported_type", "Upload a photo (JPG/PNG) or a PDF of the bill."],
  too_large: [413, "too_large", "That file is over 12 MB, use a smaller photo or PDF."],
  declined: [422, "declined", "The reader declined this file. Enter the consumption manually."],
  unreadable: [502, "parse_failed", "Couldn't read the numbers off that bill, try a clearer photo, or enter it manually."],
  auth: [503, "auth", "The AI key was rejected, check ANTHROPIC_API_KEY."],
  rate: [429, "rate", "Too many requests right now, try again in a moment."],
  failed: [502, "extract_failed", "Bill reading failed, enter the consumption manually."],
};

export async function POST(req) {
  // installers only
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      error: "not_configured",
      message: "AI bill reading isn't switched on yet, add ANTHROPIC_API_KEY in Vercel to enable it.",
    }, { status: 503 });
  }

  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const file = form.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "no_file", message: "No file uploaded." }, { status: 400 });

  const r = await readBill(new Anthropic(), { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type });
  if (!r.ok) {
    const [status, error, message] = FAIL[r.code] || FAIL.failed;
    return NextResponse.json({ error, message }, { status });
  }
  const b = r.bill;
  return NextResponse.json({
    ok: true,
    annualKwh: b.annualKwh, monthlyKwh: b.monthlyKwh, amountDue: b.amountDue,
    meterNumber: b.meterNumber, supplier: b.supplier, subsidy: b.subsidy,
    currency: b.currency, confidence: b.confidence, notes: b.notes,
  });
}
