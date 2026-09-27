// app/api/agent/telegram/[id]/route.js — Telegram delivers messages sent to an
// installer's bot here (registered by app/api/agent/channels). Every update
// must carry the secret header only Telegram and this server know, derived
// per channel (lib/telegram.js). The conversation lives in
// agent_conversations, since a Telegram chat has no browser to hold it.
//
// Always answers 200 once the update is genuine: a non-200 makes Telegram
// retry the same update, and a homeowner would get the same reply twice.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited } from "../../../../../lib/ratelimit.js";
import { t, normLang } from "../../../../../lib/i18n.js";
import { keyFromEnv, open } from "../../../../../lib/secretBox.js";
import { parseUpdate, secretMatches, sendText, tgCall, webhookServerSecret } from "../../../../../lib/telegram.js";
import { answerHomeowner } from "../../../../../lib/leadAgentRun.js";
import { agentConfigured } from "../../../../../lib/claudeClient.js";
import { MAX_TURNS } from "../../../../../lib/leadAgent.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OK = () => NextResponse.json({ ok: true });

export async function POST(req, { params }) {
  const channelId = String(params.id || "");
  const secret = webhookServerSecret();
  if (!secret || !secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), channelId, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let update; try { update = await req.json(); } catch { return OK(); }
  const msg = parseUpdate(update);
  if (!msg) return OK();
  // Telegram redelivers an update it thinks went unanswered, even while the
  // first delivery is still being answered: claim each update_id once.
  const updateId = Number(update.update_id) || null;
  if (updateId && await isRateLimited(`tg:upd:${channelId}:${updateId}`, 1, 86_400_000)) return OK();
  if (await isRateLimited(`tg:${channelId}:${msg.chatId}`, 30, 600_000)) return OK();

  const db = supabaseAdmin();
  const { data: ch } = await db.from("agent_channels").select("id, company_id").eq("id", channelId).maybeSingle();
  if (!ch) return OK();
  const { data: sec } = await db.from("agent_channel_secrets").select("ciphertext").eq("channel_id", ch.id).maybeSingle();
  let token;
  try { token = open(sec?.ciphertext, keyFromEnv())?.token; } catch { token = null; }
  if (!token) {
    await db.from("agent_channels").update({ status: "error", last_error: "The saved bot token can't be read on this server. Connect the bot again." }).eq("id", ch.id);
    return OK();
  }
  const { data: co } = await db.from("companies").select("id, name, short_name, lang, default_market").eq("id", ch.company_id).maybeSingle();
  if (!co) return OK();
  const lang = normLang(co.lang);
  const say = async (text) => { try { await sendText(token, msg.chatId, text); } catch (e) { console.error("telegram send failed", e?.code, e?.message); } };

  if (msg.isStart) { await say(t("agent_hello", lang, { who: co.short_name || co.name || t("agent_installer", lang) })); return OK(); }
  if (msg.nonText) { await say(t("agent_text_only", lang)); return OK(); }
  if (!agentConfigured()) { await say(t("agent_unavailable_tg", lang)); return OK(); }

  const { data: conv } = await db.from("agent_conversations")
    .select("id, turns, lead_id, survey_requested, last_update_id").eq("channel_id", ch.id).eq("chat_id", msg.chatId).maybeSingle();
  if (updateId && conv?.last_update_id && updateId <= Number(conv.last_update_id)) return OK();   // an old redelivery

  const turns = Array.isArray(conv?.turns) ? conv.turns : [];
  const state = { leadId: conv?.lead_id || null, surveyRequested: !!conv?.survey_requested };
  try { await tgCall(token, "sendChatAction", { chat_id: msg.chatId, action: "typing" }); } catch { /* cosmetic */ }

  let answer = null;
  try {
    answer = await answerHomeowner({ db, co, lang, state, turns, text: msg.text, via: "telegram", limitKey: `tg:${msg.chatId}` });
  } catch (err) {
    console.error("telegram lead assistant failed", err?.status || "", err?.message);
  }
  const reply = answer || t("agent_trouble", lang);
  await say(reply);

  const next = [...turns, { role: "user", text: msg.text }, { role: "assistant", text: reply }].slice(-MAX_TURNS);
  await db.from("agent_conversations").upsert({
    channel_id: ch.id, company_id: co.id, chat_id: msg.chatId, turns: next,
    lead_id: state.leadId, survey_requested: state.surveyRequested,
    last_update_id: updateId, updated_at: new Date().toISOString(),
  }, { onConflict: "channel_id,chat_id" });
  return OK();
}
