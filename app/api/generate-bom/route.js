// app/api/generate-bom/route.js — Auto-BOM Builder (AI + catalog).
//
// The installer types a plain-language ask ("full BOM for a 6 kW system with
// battery") and a Claude model maps it to the company's OWN product catalog:
// it picks the best-fitting panels (enough to reach the target kW), a matching
// inverter, a battery when asked, plus mounting/extras, and returns quantities.
//
// The model may ONLY choose from the productIds we send it — it never invents a
// product or a price. We resolve every returned id back to the real catalog row
// on the client, so labels and prices always come from the catalog, not the LLM.
//
// Auth-gated. Degrades gracefully with no ANTHROPIC_API_KEY (same pattern as the
// bill extractor). Model is claude-opus-5 by default, overridable per-deployment
// with BOM_GENERATE_MODEL (e.g. claude-haiku-4-5 to cut per-draft cost).
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "../../../lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.BOM_GENERATE_MODEL || "claude-opus-5";

const SYSTEM = `You are a solar-PV estimator building a bill of materials for a residential installer in Romania or Moldova. You are given the installer's OWN product catalog and a target system. Choose real products from that catalog only.

Return ONLY a single minified JSON object (no prose, no code fences):
{"lines":[{"id":"<product id from the catalog>","qty":<integer>}],"kw":<number>,"notes":"<one short sentence>"}

Rules:
- Pick PANELS whose combined wattage reaches (and may slightly exceed) the target kW. Panel wattage is in its "spec" (e.g. "550 W"). qty = ceil(targetKw * 1000 / panelWatts). Prefer one panel model; pick the best value/spec fit.
- Pick exactly ONE inverter sized at or just above the array kW (inverter "spec" is like "8 kW"). If no inverter fits exactly, pick the closest one at or above.
- Include a BATTERY only if the request asks for one; size it to the requested kWh if given, else pick a sensible single battery. Battery "spec" is like "10 kWh".
- Include mounting/other items if the catalog has them and they are clearly needed (e.g. one mounting kit).
- Use ONLY ids that appear in the provided catalog. Never invent ids, products, prices or quantities.
- "kw" in your output = the actual array size from the panels you chose (panelWatts * qty / 1000), rounded to one decimal.
- If the catalog has no suitable panels or is empty, return {"lines":[],"kw":0,"notes":"why"}.`;

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
      message: "AI BOM builder isn't switched on yet — add ANTHROPIC_API_KEY in Vercel to enable it.",
    }, { status: 503 });
  }

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }

  const prompt = String(body?.prompt || "").slice(0, 500).trim();
  const kwHint = Number(body?.kw) || 0;
  const market = ["RO", "MD"].includes(body?.market) ? body.market : "MD";

  // Trust nothing from the client for pricing — but we DO pass the catalog to the
  // model so it can pick. We re-validate every returned id against this list.
  const catalog = Array.isArray(body?.catalog) ? body.catalog : [];
  if (catalog.length === 0) {
    return NextResponse.json({ error: "empty_catalog", message: "Add products to your catalog first — the builder picks from your own equipment." }, { status: 400 });
  }
  // Slim, id-keyed view for the model. Cap to keep the prompt bounded.
  const slim = catalog.slice(0, 200).map(c => ({
    id: String(c.id),
    kind: c.kind,
    brand: c.brand || "",
    model: c.model || "",
    spec: c.spec || "",
    price: Number(c.unit_price) || 0,
  }));

  const userText = `Target system: ${kwHint > 0 ? kwHint + " kW" : "(size it from the request)"} · market ${market}.
Installer request: "${prompt || "full recommended system"}"

Catalog (choose only from these ids):
${JSON.stringify(slim)}`;

  try {
    const client = new Anthropic();
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    if (resp.stop_reason === "refusal") {
      return NextResponse.json({ error: "declined", message: "The builder declined this request — add the lines manually." }, { status: 422 });
    }
    const textBlock = (resp.content || []).find(b => b.type === "text");
    const data = extractJson(textBlock?.text);
    if (!data || !Array.isArray(data.lines)) {
      return NextResponse.json({ error: "parse_failed", message: "Couldn't draft that BOM — try rephrasing, or add the lines manually." }, { status: 502 });
    }

    // Resolve every id back to the REAL catalog row; drop anything hallucinated.
    const byId = new Map(catalog.map(c => [String(c.id), c]));
    const lines = [];
    for (const l of data.lines) {
      const prod = byId.get(String(l?.id));
      const qty = Math.max(1, Math.round(Number(l?.qty) || 0));
      if (prod && qty > 0) lines.push({ product: prod, qty });
    }
    if (lines.length === 0) {
      return NextResponse.json({ error: "no_match", message: String(data.notes || "No catalog products fit that request — add or adjust your catalog.").slice(0, 240) }, { status: 200, headers: {} });
    }

    return NextResponse.json({
      ok: true,
      lines,
      kw: Number(data.kw) > 0 ? Math.round(Number(data.kw) * 10) / 10 : 0,
      notes: String(data.notes || "").slice(0, 240),
    });
  } catch (e) {
    const status = e?.status;
    if (status === 401) return NextResponse.json({ error: "auth", message: "The AI key was rejected — check ANTHROPIC_API_KEY." }, { status: 503 });
    if (status === 429) return NextResponse.json({ error: "rate", message: "Too many requests right now — try again in a moment." }, { status: 429 });
    return NextResponse.json({ error: "generate_failed", message: "BOM builder failed — add the lines manually." }, { status: 502 });
  }
}
