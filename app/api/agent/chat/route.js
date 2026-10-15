// app/api/agent/chat/route.js — the lead assistant on an installer's website
// (the embeddable chat at /widget/chat?c=COMPANY_ID). PUBLIC, stateless: the
// browser keeps the conversation and sends it back each time (re-capped
// here), plus a signed reference to the lead once one was saved, so the chat
// can add a survey request to it later but never touch anyone else's.
//   POST { companyId, turns: [{ role, text }], text, leadRef?, lang? }
//     -> { answer, leadRef }  or  { answer, unavailable: true } before setup
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { t, normLang, LANGS } from "../../../../lib/i18n.js";
import { signLeadRef, verifyLeadRef, MAX_TEXT } from "../../../../lib/leadAgent.js";
import { answerHomeowner } from "../../../../lib/leadAgentRun.js";
import { agentConfigured } from "../../../../lib/claudeClient.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The signing secret for lead references: server-only, always configured.
const refSecret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req) {
  const ip = clientIp(req);
  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const companyId = String(b?.companyId || "");
  const text = String(b?.text || "").trim();
  if (!UUID.test(companyId) || !text || text.length > MAX_TEXT) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Every message has a model cost behind it: per visitor, and per installer
  // so a leaked embed can't run up a bill from rotating addresses.
  if (await isRateLimited(`agent:ip:${ip}`, 20, 600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  if (await isRateLimited(`agent:co:${companyId}`, 400, 86_400_000)) return NextResponse.json({ error: "rate" }, { status: 429 });

  const db = supabaseAdmin();
  const { data: co } = await db.from("companies").select("id, name, short_name, lang, default_market").eq("id", companyId).maybeSingle();
  if (!co) return NextResponse.json({ error: "unknown_company" }, { status: 404 });
  // The page's language (it may be overridden with ?lang=) for our own
  // messages; the model itself answers in whatever language the visitor writes.
  const lang = LANGS.includes(b?.lang) ? b.lang : normLang(co.lang);
  if (!agentConfigured()) return NextResponse.json({ answer: t("agent_unavailable", lang), unavailable: true });

  const known = verifyLeadRef(b?.leadRef, companyId, refSecret());
  const state = { leadId: known?.leadId || null, surveyRequested: !!known?.surveyRequested };
  try {
    const answer = await answerHomeowner({ db, co, lang, state, turns: b?.turns, text, via: "website_chat", limitKey: ip });
    return NextResponse.json({
      answer: answer || t("agent_trouble", lang),
      leadRef: state.leadId ? signLeadRef(state.leadId, companyId, refSecret(), { surveyRequested: state.surveyRequested }) : null,
    });
  } catch (err) {
    console.error("lead assistant failed", err?.status || "", err?.message);
    return NextResponse.json({ answer: t("agent_trouble", lang), leadRef: b?.leadRef || null });
  }
}
