// Telegram adapter: which updates the assistant answers, how a forged update
// is told apart, and how Bot API errors surface. Fixtures are invented.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validToken, parseUpdate, webhookSecret, secretMatches, tgCall, getFileBytes, TelegramError } from "./telegram.js";

const TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw1";

test("only BotFather-shaped tokens are accepted", () => {
  assert.equal(validToken(TOKEN), true);
  assert.equal(validToken(" " + TOKEN + " "), true);
  for (const bad of ["", "abc", "123:short", "https://evil.example/", "12345:" + "a".repeat(29)]) assert.equal(validToken(bad), false);
});

test("a private text message is read; everything else is ignored", () => {
  const msg = (over = {}) => ({ message: { chat: { id: 42, type: "private" }, from: { first_name: "Ion", is_bot: false }, text: "Bună ziua", ...over } });
  assert.deepEqual(parseUpdate(msg()), { chatId: "42", text: "Bună ziua", firstName: "Ion", isStart: false, nonText: false, file: null });
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

test("a bill sent as a photo or a PDF is picked up, with its caption", () => {
  const msg = (over = {}) => ({ message: { chat: { id: 7, type: "private" }, from: { first_name: "Ana", is_bot: false }, ...over } });
  const photo = parseUpdate(msg({ photo: [{ file_id: "small", file_size: 900 }, { file_id: "big", file_size: 90000 }], caption: "factura mea" }));
  assert.deepEqual(photo.file, { id: "big", mime: "image/jpeg", size: 90000 });
  assert.equal(photo.text, "factura mea");
  assert.equal(photo.nonText, false);
  const pdf = parseUpdate(msg({ document: { file_id: "d1", mime_type: "application/pdf", file_size: 5000 } }));
  assert.equal(pdf.file.mime, "application/pdf");
  // anything that isn't a picture or a PDF is still "not something I read"
  const zip = parseUpdate(msg({ document: { file_id: "z", mime_type: "application/zip" } }));
  assert.equal(zip.file, null);
  assert.equal(zip.nonText, true);
});

test("a sent file is downloaded through the bot, and a huge one is refused first", async () => {
  const calls = [];
  const fake = (size) => async (url) => {
    calls.push(url);
    if (url.endsWith("/getFile")) return { status: 200, json: async () => ({ ok: true, result: { file_path: "photos/f.jpg", file_size: size } }) };
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const buf = await getFileBytes(TOKEN, "big", { fetchImpl: fake(3) });
  assert.equal(buf.length, 3);
  assert.match(calls[1], /\/file\/bot123456789:[^/]+\/photos\/f\.jpg$/);
  await assert.rejects(getFileBytes(TOKEN, "big", { fetchImpl: fake(50 * 1024 * 1024) }), (e) => e instanceof TelegramError && e.code === "too_large");
});
