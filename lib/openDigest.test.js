import { test } from "node:test";
import assert from "node:assert/strict";
import { inQuietHours, openNow, pendingOpens, openDigestEmail } from "./openDigest.js";

test("quiet hours are 21:00 to 08:00 in Chișinău", () => {
  assert.equal(inQuietHours(Date.parse("2026-10-16T19:30:00Z")), true);   // 22:30 there
  assert.equal(inQuietHours(Date.parse("2026-10-16T04:30:00Z")), true);   // 07:30
  assert.equal(inQuietHours(Date.parse("2026-10-16T06:00:00Z")), false);  // 09:00
});

test("an open is emailed at once only when chosen and outside quiet hours", () => {
  const day = Date.parse("2026-10-16T09:00:00Z"), night = Date.parse("2026-10-16T20:00:00Z");
  assert.equal(openNow({}, day), true);
  assert.equal(openNow({ notify_open_mode: "digest" }, day), false);
  assert.equal(openNow({ notify_quiet: true }, day), true);
  assert.equal(openNow({ notify_quiet: true }, night), false);
  assert.equal(openNow({ notify_open: false }, day), false);
});

test("the morning email lists each offer once, without what was already emailed", () => {
  const ev = [
    { code: "a", created_at: "2026-10-15T10:00:00Z" }, { code: "a", created_at: "2026-10-15T21:00:00Z" },
    { code: "b", created_at: "2026-10-15T09:00:00Z" }, { code: "c", created_at: "2026-10-15T08:00:00Z" },
  ];
  const props = new Map([["b", { notify_last_at: "2026-10-15T09:30:00Z" }], ["c", { notify_last_at: "2026-10-15T07:00:00Z" }]]);
  assert.deepEqual(pendingOpens(ev, props).map((r) => [r.code, r.opens]), [["a", 2], ["c", 1]]);
  const { subject, html } = openDigestEmail({ lang: "ro", rows: [{ code: "a", title: "Casa Rusu", opens: 2, last: "2026-10-15T21:00:00Z", projectId: "p1" }], appUrl: "https://x" });
  assert.equal(subject, "O ofertă a fost citită ieri");
  assert.match(html, /Casa Rusu/);
  assert.match(html, /de 2 ori/);
  assert.match(html, /https:\/\/x\/projects\/p1/);
});
