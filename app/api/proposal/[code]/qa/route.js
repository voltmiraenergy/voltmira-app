// app/api/proposal/[code]/qa/route.js — the client-facing Q&A widget's
// backend. This app NEVER holds the LLM call itself: it assembles a real,
// verified grounding context for one specific proposal, relays the client's
// question to a Make.com webhook (configured by the installer's own org, see
// docs/MAKE_AUTOMATIONS.md), and returns whatever answer comes back — capped,
// type-checked, and rendered as plain text only by the frontend. Make.com's
// LLM step is instructed to answer ONLY from this context; this route's job
// is making sure that context can never contain anything the client
// shouldn't see (BOM cost/margin, a signature image) or a number that
// disagrees with what's printed on the same page.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { quote, amortizedMonthlyPayment } from "@voltmira/engine";
import { snapshotEngine } from "../../../../../lib/engineSettings.js";
import { findWarrantyInfo } from "../../../../../lib/supplierCatalog.js";
import { t, normLang } from "../../../../../lib/i18n.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const MAKE_TIMEOUT_MS = 17_000; // stays under maxDuration with room for our own overhead
const MAX_QUESTION_LEN = 500;
const MAX_TURN_LEN = 500;
const MAX_TURNS = 6;
const MAX_ANSWER_LEN = 1500;

/** Server-side trust boundary for the client-supplied conversation history:
 *  the browser already caps this, but that's advisory only — a modified
 *  request could send an unbounded array to pad the prompt (cost/DoS) or
 *  attempt prompt injection through old turns. Re-cap here regardless. */
function sanitizeTurns(turns) {
  if (!Array.isArray(turns)) return [];
  return turns.slice(-MAX_TURNS).map((turn) => ({
    q: String(turn?.q || "").slice(0, MAX_TURN_LEN),
    a: String(turn?.a || "").slice(0, MAX_TURN_LEN),
  }));
}

function fallbackAnswer(lang, preparedBy) {
  const who = preparedBy?.name ? preparedBy.name : t("qa_fallback_installer", lang);
  return t("qa_fallback", lang, { who });
}

export async function POST(req, { params }) {
  const ip = clientIp(req);
  const code = params.code;

  // Two limiters, not one: ip+code stops one visitor hammering the box, a
  // separate code-only ceiling stops the same LEAKED link being hit from
  // many rotating IPs — each call has real LLM cost behind it on the other
  // side of the Make.com webhook.
  if (await isRateLimited(`qa:ipc:${ip}:${code}`, 8, 600_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });
  if (await isRateLimited(`qa:code:${code}`, 50, 86_400_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const question = String(body?.question || "").trim();
  if (!question || question.length > MAX_QUESTION_LEN)
    return NextResponse.json({ error: "bad_question" }, { status: 400 });
  const priorTurns = sanitizeTurns(body?.priorTurns);

  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals").select("*").eq("code", code).single();
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: co } = await db.from("companies")
    .select("name, lang, install_warranty_years").eq("id", prop.company_id).single();
  const lang = normLang(co?.lang);

  let preparedBy = prop.snapshot?.preparedBy || null;
  if (!preparedBy && prop.project_id) {
    const { data: proj } = await db.from("projects").select("owner_id").eq("id", prop.project_id).maybeSingle();
    if (proj?.owner_id) {
      const { data: pf } = await db.from("profiles").select("*").eq("id", proj.owner_id).maybeSingle();
      if (pf?.name) preparedBy = { name: pf.name, phone: pf.phone || "" };
    }
  }

  const webhookUrl = process.env.MAKE_QA_WEBHOOK_URL;
  const automationKey = process.env.AUTOMATION_API_KEY;
  if (!webhookUrl) {
    // Not configured yet — degrade to the same honest fallback a timeout
    // would give, never a raw 500 the widget has to explain.
    return NextResponse.json({ answer: fallbackAnswer(lang, preparedBy) });
  }

  // MUST use the FROZEN quote — the SAME numbers already printed on this
  // page (snapshotEngine, not companyEngine's live recompute). Grounding the
  // chat on live rates while the page shows frozen ones would let the widget
  // contradict the document it's sitting on.
  const E = snapshotEngine(prop.snapshot.engine, co);
  const q = quote(prop.snapshot, E);
  const cost = q.e.cost;
  const financeRate = Number(E.financeRatePct);
  const financeTerm = Number(E.financeTermYears);
  const hasFinance = financeRate >= 0 && financeTerm > 0;
  const monthlyPayment = hasFinance ? amortizedMonthlyPayment(cost, financeRate, financeTerm) : null;

  // Real BOM lines only — kind/brand/model/spec/qty and (where verified)
  // real warranty + a real manufacturer link. NEVER unit_price/cost_price:
  // that's the installer's purchase cost and margin, and must never reach
  // the client on ANY surface, this one included — same boundary the public
  // GET /api/proposal/[code] route and PrintSheet.jsx both already enforce.
  const bom = (Array.isArray(prop.snapshot.bom) ? prop.snapshot.bom : [])
    .filter((l) => (Number(l.qty) || 0) > 0)
    .map((l) => {
      const w = findWarrantyInfo(l.brand, l.model);
      return {
        kind: l.kind, brand: l.brand, model: l.model, spec: l.spec, qty: Number(l.qty),
        warrantyYears: w?.warrantyYears ?? null,
        warrantyNote: w?.warrantyNote ?? null,
        productUrl: w?.productUrl ?? null,
      };
    });

  const context = {
    companyName: co?.name || "",
    preparedBy: preparedBy ? { name: preparedBy.name, phone: preparedBy.phone || "" } : null,
    installWarrantyYears: co?.install_warranty_years || null,
    lang,
    system: {
      kw: Number(prop.snapshot.kw) || 0,
      hasBattery: !!prop.snapshot.batt,
      batteryKwh: prop.snapshot.batt ? (Number(prop.snapshot.battKwh) || 10) : 0,
    },
    money: {
      totalCost: cost,
      currency: co?.currency || "EUR",
      year1Savings: q.e.year1,
      hasFinance, financeRatePct: hasFinance ? financeRate : null,
      financeTermYears: hasFinance ? financeTerm : null,
      monthlyPayment,
    },
    scenarios: {
      pessimistic: { paybackYears: q.p.payback, roiPct: q.p.roi },
      expected: { paybackYears: q.e.payback, roiPct: q.e.roi },
      optimistic: { paybackYears: q.o.payback, roiPct: q.o.roi },
      horizonYears: q.e.horizon,
    },
    assumptions: {
      yieldPerKwp: prop.snapshot.yieldOverride || E.baseYield,
      opexPct: E.opexPct, degradationBands: E.bands, inflationBands: E.bands,
    },
    bom,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAKE_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(automationKey ? { "X-VoltMira-Key": automationKey } : {}),
      },
      body: JSON.stringify({ question, context, priorTurns }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`make_${res.status}`);
    const data = await res.json().catch(() => null);
    let answer = typeof data?.answer === "string" ? data.answer : null;
    if (!answer) throw new Error("bad_shape");
    // Never trust the shape/length of a third-party response before it
    // reaches a client — same discipline as generate-bom re-resolving every
    // returned catalog id before trusting it.
    // eslint-disable-next-line no-control-regex
    answer = answer.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").slice(0, MAX_ANSWER_LEN).trim();
    if (!answer) throw new Error("empty_after_sanitize");
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("qa webhook failed", err?.message);
    return NextResponse.json({ answer: fallbackAnswer(lang, preparedBy) });
  } finally {
    clearTimeout(timer);
  }
}
