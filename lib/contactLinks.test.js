import { test } from "node:test";
import assert from "node:assert/strict";
import { waNumber, waLink, googleCalUrl } from "./contactLinks.js";

test("WhatsApp only for an international number", () => {
  assert.equal(waNumber("+373 69 122 145"), "37369122145");
  assert.equal(waNumber("0037369122145"), "37369122145");
  assert.equal(waNumber("069122145"), "", "a local number is not guessed into a country");
  assert.equal(waLink("+373 69 122 145"), "https://wa.me/37369122145");
  assert.equal(waLink("+37369122145", "Bună ziua"), "https://wa.me/37369122145?text=Bun%C4%83%20ziua");
  assert.equal(waLink("069122145"), null);
});

test("a Google Calendar event, an hour long by default, in UTC", () => {
  const u = new URL(googleCalUrl({ title: "Vizită tehnică: Ion Bivol", start: "2026-10-30T19:00:00.000Z", location: "Str. Costiujeni 14, Codru" }));
  assert.equal(u.searchParams.get("action"), "TEMPLATE");
  assert.equal(u.searchParams.get("dates"), "20261030T190000Z/20261030T200000Z");
  assert.equal(u.searchParams.get("location"), "Str. Costiujeni 14, Codru");
  assert.equal(googleCalUrl({ title: "x", start: "not a date" }), null);
});
