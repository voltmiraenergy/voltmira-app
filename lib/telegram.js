// lib/telegram.js — the little of the Telegram Bot API the lead assistant
// uses: check a token, point the bot at VoltMira, receive messages, reply.
// Built to https://core.telegram.org/bots/api. Server-only.
//
// Each installer connects their OWN bot (made with @BotFather), so homeowners
// talk to "@SolarTechBot", not to VoltMira. Updates arrive on
// /api/agent/telegram/<channel id> with a secret header only Telegram and
// this server know (webhookSecret), so a forged update is rejected.
import crypto from "node:crypto";

const API = "https://api.telegram.org";

/** A BotFather token: "<bot id>:<secret>". Checked before it is ever sent anywhere. */
export const validToken = (t) => /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/.test(String(t || "").trim());

export class TelegramError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** Call a Bot API method. Throws TelegramError(auth | network | refused). */
export async function tgCall(token, method, body = {}, fetchImpl = fetch) {
  if (!validToken(token)) throw new TelegramError("auth", "That doesn't look like a bot token from @BotFather.");
  let res;
  try {
    res = await fetchImpl(`${API}/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TelegramError("network", "Telegram didn't answer. Try again in a minute.");
  }
  const json = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 404) throw new TelegramError("auth", "Telegram didn't accept this bot token.");
  if (!json?.ok) throw new TelegramError("refused", json?.description || `Telegram refused ${method}.`);
  return json.result;
}

/** The server-side secret the per-channel webhook secrets derive from: the
 *  credentials key, so rotating it also retires every registered webhook. */
export const webhookServerSecret = () => process.env.CREDENTIALS_SECRET_KEY || process.env.INVERTER_SECRET_KEY || "";

/**
 * The secret Telegram sends back with every update, derived per channel so it
 * never has to be stored. Telegram allows 1-256 characters of A-Z a-z 0-9 _ -.
 */
export function webhookSecret(channelId, serverSecret) {
  return crypto.createHmac("sha256", "voltmira-tg:" + serverSecret).update(String(channelId)).digest("base64url");
}

export function secretMatches(given, channelId, serverSecret) {
  const want = webhookSecret(channelId, serverSecret);
  const g = String(given || "");
  return g.length === want.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(want));
}

/**
 * What the assistant needs from an update: a private text message.
 * Group chats, channels, edits and non-text messages are left alone
 * (the bot is a one-to-one assistant).
 * @returns {{ chatId: string, text: string, firstName: string, isStart: boolean, nonText: boolean } | null}
 */
export function parseUpdate(update) {
  const m = update?.message;
  if (!m || m.chat?.type !== "private" || m.from?.is_bot) return null;
  const text = typeof m.text === "string" ? m.text.trim() : "";
  return {
    chatId: String(m.chat.id),
    text: text.slice(0, 800),
    firstName: String(m.from?.first_name || "").slice(0, 60),
    isStart: /^\/start\b/.test(text),
    nonText: !text,
  };
}

/** Telegram caps a message at 4096 characters; answers are far shorter, but never exceed it. */
export const sendText = (token, chatId, text, fetchImpl) =>
  tgCall(token, "sendMessage", { chat_id: chatId, text: String(text).slice(0, 4000) }, fetchImpl);
