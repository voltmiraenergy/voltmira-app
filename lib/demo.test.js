import { test } from "node:test";
import assert from "node:assert/strict";
import { isDemoEmail, isNonHumanAgent } from "./demo.js";

test("isDemoEmail matches only the demo domain", () => {
  assert.equal(isDemoEmail("demo-abc-owner@demo.voltmira.com"), true);
  assert.equal(isDemoEmail("Owner@Demo.VoltMira.com"), true);
  assert.equal(isDemoEmail("installer@solartech.ro"), false);
  assert.equal(isDemoEmail(null), false);
});

test("crawlers and link previews never count as a person", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "WhatsApp/2.23.20.0 A",
    "Viber/20.3 CFNetwork/1410.0.3 Darwin/22.6.0",
    "TelegramBot (like TwitterBot)",
    "Viber/20.3",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 Chrome-Lighthouse",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "",
    null,
  ]) assert.equal(isNonHumanAgent(ua), true, String(ua));
});

test("ordinary browsers still start the demo", () => {
  for (const ua of [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:129.0) Gecko/20100101 Firefox/129.0",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
    // in-app browsers: real people, even though the app is named
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Telegram-Android/10.2.1 (Google Pixel 7; Android 13; SDK 33; HIGH)",
    "Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0 Mobile Safari/537.36 Viber/21.0.1.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/23.20.79",
    "Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  ]) assert.equal(isNonHumanAgent(ua), false, ua);
});
