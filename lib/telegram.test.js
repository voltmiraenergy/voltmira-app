// Telegram adapter: which updates the assistant answers, how a forged update
// is told apart, and how Bot API errors surface. Fixtures are invented.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validToken, parseUpdate, webhookSecret, secretMatches, tgCall, TelegramError } from "./telegram.js";

const TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw1";

test("only BotFather-shaped tokens are accepted", () => {
  assert.equal(validToken(TOKEN), true);
  assert.equal(validToken(" " + TOKEN + " "), true);
  for (const bad of ["", "abc", "123:short", "https://evil.example/", "12345:" + "a".repeat(29)]) assert.equal(validToken(bad), false);
});

test("a private text message is read; everything else is ignored", () => {
  const msg = (over = {}) => ({ message: { chat: { id: 42, type: "private" }, from: { first_name: "Ion", is_bot: false }, text: "Bună ziua", ...over } });
  assert.deepEqual(parseUpdate(msg()), { chatId: "42", text: "Bună ziua", firstName: "Ion", isStart: false, nonText: false });
  assert.equal(parseUpdate(msg({ text: "/start" })).isStart, true);
  assert.equal(parseUpdate(msg({ text: undefined, photo: [{}] })).nonText, true);
  assert.equal(parseUpdate(msg({ chat: { id: 1, type: "group" } })), null);
  assert.equal(parseUpdate(msg({ from: { is_bot: true } })), null);
  assert.equal(parseUpdate({ edited_message: {} }), null);
  assert.equal(parseUpdate(msg({ text: "x".repeat(2000) })).text.length, 800);
});

test("the webhook secret is per channel, Telegram-safe, and checked in constant time", () => {
  const s = webhookSecret("chan-1", "server");
  assert.match(s, /^[A-Za-z0-9_-]{1,256}$/);
  assert.equal(secretMatches(s, "chan-1", "server"), true);
  assert.equal(secretMatches(s, "chan-2", "server"), false);
  assert.equal(secretMatches(s, "chan-1", "other"), false);
  assert.equal(secretMatches("", "chan-1", "server"), false);
});

test("Bot API errors become typed errors; a bad token is never sent", async () => {
  let called = 0;
  const f = (status, body) => async () => { called++; return new Response(JSON.stringify(body), { status }); };
  await assert.rejects(tgCall("nope", "getMe", {}, f(200, { ok: true })), (e) => e instanceof TelegramError && e.code === "auth");
  assert.equal(called, 0);
  await assert.rejects(tgCall(TOKEN, "getMe", {}, f(401, { ok: false })), (e) => e.code === "auth");
  await assert.rejects(tgCall(TOKEN, "setWebhook", {}, f(400, { ok: false, description: "Bad Request: bad webhook: HTTPS url must be provided" })), (e) => e.code === "refused" && /HTTPS/.test(e.message));
  await assert.rejects(tgCall(TOKEN, "getMe", {}, async () => { throw new Error("offline"); }), (e) => e.code === "network");
  assert.deepEqual(await tgCall(TOKEN, "getMe", {}, f(200, { ok: true, result: { username: "SolarTechBot" } })), { username: "SolarTechBot" });
});
