// app/api/extract-bill/route.js — AI energy-bill extractor.
//
// The installer uploads a photo or PDF of the client's electricity bill; a Claude
// vision model reads it and returns the annual kWh consumption (the field that's
// otherwise the most tedious manual entry) plus the meter number, supplier and any
// mention of an existing subsidy. The editor shows these for review before applying
// — we never silently overwrite the installer's inputs.
//
// Auth-gated (installers only). Degrades gracefully: with no ANTHROPIC_API_KEY set,
// it returns a clear "not configured" message instead of erroring — same pattern as
// Resend/Turnstile. Model is claude-opus-5 by default, overridable per-deployment
// with BILL_EXTRACT_MODEL (e.g. claude-haiku-4-5 to cut per-scan cost).
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "../../../lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.BILL_EXTRACT_MODEL || "claude-opus-5";
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

const PROMPT = `You are reading a residential electricity bill from Romania or Moldova. The text may be in Romanian, Russian or English.

Return ONLY a single minified JSON object (no prose, no code fences) with exactly these keys:
{"annualKwh": number|null, "monthlyKwh": number|null, "meterNumber": string|null, "supplier": string|null, "subsidy": string|null, "currency": string|null, "confidence": "high"|"medium"|"low", "notes": string}

Rules:
- annualKwh: total ANNUAL electricity consumption in kWh. Bills usually show a monthly consumption ("consum", "kWh consumat", "энергия", "потребление"). If only a monthly figure is shown, set monthlyKwh to that value and set annualKwh to monthlyKwh × 12. If an explicit 12-month / annual total is printed, use it for annualKwh and leave monthlyKwh null.
- meterNumber: the meter / POD identifier ("număr contor", "cod POD", "номер счётчика"). Do NOT guess — null if not clearly printed.
- supplier: the energy supplier's name.
- subsidy: any mention of an existing grant, subsidy, "Casa Verde", "prosumator"/"prosumer", or net-metering/net-billing status; else null.
- currency: RON, MDL or EUR if visible; else null.
- confidence: your confidence in annualKwh.
- notes: one short sentence on what you read or any caveat (e.g. "monthly 420 kWh × 12 estimated").
Use only numbers actually printed on the bill. Never invent values.`;

function extractJson(text) {
  const m = (text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function POST(req) {
  // installers only
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      error: "not_configured",
      message: "AI bill reading isn't switched on yet — add ANTHROPIC_API_KEY in Vercel to enable it.",
    }, { status: 503 });
  }

  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const file = form.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "no_file", message: "No file uploaded." }, { status: 400 });

  const mime = file.type || "";
  const isPdf = mime === "application/pdf";
  const isImg = mime.startsWith("image/");
  if (!isPdf && !isImg) {
    return NextResponse.json({ error: "unsupported_type", message: "Upload a photo (JPG/PNG) or a PDF of the bill." }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "too_large", message: "That file is over 12 MB — use a smaller photo or PDF." }, { status: 413 });
  }
  const b64 = buf.toString("base64");

  const media = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: b64 } };

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: [media, { type: "text", text: PROMPT }] }],
    });
    if (resp.stop_reason === "refusal") {
      return NextResponse.json({ error: "declined", message: "The reader declined this file. Enter the consumption manually." }, { status: 422 });
    }
    const textBlock = (resp.content || []).find(b => b.type === "text");
    const data = extractJson(textBlock?.text);
    if (!data) return NextResponse.json({ error: "parse_failed", message: "Couldn't read the numbers off that bill — try a clearer photo, or enter it manually." }, { status: 502 });

    // Derive an annual figure from a single month if the model only found that.
    const monthly = Number(data.monthlyKwh);
    let annual = Number(data.annualKwh);
    if ((!annual || annual <= 0) && monthly > 0) annual = Math.round(monthly * 12);

    return NextResponse.json({
      ok: true,
      annualKwh: annual > 0 ? annual : null,
      monthlyKwh: monthly > 0 ? monthly : null,
      meterNumber: data.meterNumber || null,
      supplier: data.supplier || null,
      subsidy: data.subsidy || null,
      currency: data.currency || null,
      confidence: ["high", "medium", "low"].includes(data.confidence) ? data.confidence : "low",
      notes: String(data.notes || "").slice(0, 240),
    });
  } catch (e) {
    const status = e?.status;
    if (status === 401) return NextResponse.json({ error: "auth", message: "The AI key was rejected — check ANTHROPIC_API_KEY." }, { status: 503 });
    if (status === 429) return NextResponse.json({ error: "rate", message: "Too many requests right now — try again in a moment." }, { status: 429 });
    return NextResponse.json({ error: "extract_failed", message: "Bill reading failed — enter the consumption manually." }, { status: 502 });
  }
}
