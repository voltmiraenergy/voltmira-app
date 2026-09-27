// app/api/agent/channels/[id]/route.js — disconnect a Telegram bot: tell
// Telegram to stop delivering to VoltMira, then forget the token and the
// bot's conversations (leads it created stay in the lead list).
import { NextResponse } from "next/server";
import { caller } from "../../../../../lib/apiCaller.js";
import { keyFromEnv, open } from "../../../../../lib/secretBox.js";
import { tgCall } from "../../../../../lib/telegram.js";

export const dynamic = "force-dynamic";

export async function DELETE(_req, { params }) {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: ch } = await me.admin.from("agent_channels").select("id").eq("id", params.id).eq("company_id", me.companyId).maybeSingle();
  if (!ch) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Best effort: if the token is unreadable or already revoked, the webhook
  // just fails its secret check from now on, because the channel is gone.
  try {
    const { data: sec } = await me.admin.from("agent_channel_secrets").select("ciphertext").eq("channel_id", ch.id).maybeSingle();
    const token = open(sec?.ciphertext, keyFromEnv())?.token;
    if (token) await tgCall(token, "deleteWebhook", { drop_pending_updates: true });
  } catch { /* see above */ }

  // Cascades to agent_channel_secrets and agent_conversations.
  const { error } = await me.admin.from("agent_channels").delete().eq("id", ch.id);
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
