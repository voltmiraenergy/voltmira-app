// app/api/agent/channels/route.js — where the company's lead assistant talks
// to homeowners.
//   GET   the website chat's embed link, connected Telegram bots, and what's
//         still missing on the server (API key, encryption key, public URL)
//   POST  connect a Telegram bot: { token } from @BotFather. The token is
//         checked with Telegram, stored encrypted, and the bot is pointed at
//         /api/agent/telegram/<id>. It never comes back out of this route.
import { NextResponse } from "next/server";
import { caller } from "../../../../lib/apiCaller.js";
import { keyFromEnv, seal } from "../../../../lib/secretBox.js";
import { isRateLimited } from "../../../../lib/ratelimit.js";
import { agentConfigured } from "../../../../lib/claudeClient.js";
import { validToken, tgCall, webhookSecret, webhookServerSecret, TelegramError } from "../../../../lib/telegram.js";

export const dynamic = "force-dynamic";

const missing = (e) => e?.code === "42P01" || e?.code === "PGRST205" || /agent_channels|does not exist|schema cache/i.test(e?.message || "");
const appUrl = () => String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

export async function GET() {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await me.admin.from("agent_channels")
    .select("id, kind, bot_username, status, last_error, created_at").eq("company_id", me.companyId).order("created_at");
  return NextResponse.json({
    agentConfigured: agentConfigured(),
    keyConfigured: !!keyFromEnv(),
    publicUrl: /^https:\/\//.test(appUrl()),
    migrated: !(error && missing(error)),
    canManage: me.canManage,
    chatUrl: `${appUrl() || ""}/widget/chat?c=${me.companyId}`,
    channels: error ? [] : (data || []),
  });
}

export async function POST(req) {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isRateLimited(`agent-connect:${me.companyId}`, 10, 3600_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const token = String(b?.token || "").trim();
  const key = keyFromEnv();
  if (!key) return NextResponse.json({ error: "no_secret_key" }, { status: 503 });
  // Telegram only delivers to a public HTTPS address.
  if (!/^https:\/\//.test(appUrl())) return NextResponse.json({ error: "needs_https" }, { status: 503 });
  if (!validToken(token)) return NextResponse.json({ error: "bad_token" }, { status: 400 });

  let bot;
  try { bot = await tgCall(token, "getMe"); }
  catch (e) { return NextResponse.json({ error: e instanceof TelegramError ? e.code : "network" }, { status: 422 }); }

  const { data: ch, error } = await me.admin.from("agent_channels").insert({
    company_id: me.companyId, kind: "telegram", bot_username: String(bot?.username || "").slice(0, 64), created_by: me.user.id,
  }).select("id, kind, bot_username, status, last_error, created_at").single();
  if (error) return NextResponse.json({ error: missing(error) ? "not_migrated" : "db" }, { status: missing(error) ? 503 : 500 });

  const undo = () => me.admin.from("agent_channels").delete().eq("id", ch.id);
  const { error: e2 } = await me.admin.from("agent_channel_secrets").insert({ channel_id: ch.id, ciphertext: seal({ token }, key) });
  if (e2) { await undo(); return NextResponse.json({ error: "db" }, { status: 500 }); }

  try {
    await tgCall(token, "setWebhook", {
      url: `${appUrl()}/api/agent/telegram/${ch.id}`,
      secret_token: webhookSecret(ch.id, webhookServerSecret()),
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
  } catch (e) {
    await undo();
    return NextResponse.json({ error: "webhook", message: e?.message || "" }, { status: 422 });
  }
  return NextResponse.json({ channel: ch });
}
