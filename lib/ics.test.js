import test from "node:test";
import assert from "node:assert/strict";
import { visitIcs, icsStamp } from "./ics.js";

const base = {
  uid: "lead-abc@voltmira.com",
  start: "2026-10-02T07:00:00.000Z",
  title: "Vizită tehnică: Ion Bivol",
  now: Date.parse("2026-09-29T08:00:00Z"),
};

test("a visit becomes one event in UTC, an hour long, with a reminder", () => {
  const s = visitIcs(base);
  assert.match(s, /^BEGIN:VCALENDAR\r\n/);
  assert.match(s, /\r\nDTSTART:20261002T070000Z\r\n/);
  assert.match(s, /\r\nDTEND:20261002T080000Z\r\n/);
  assert.match(s, /\r\nDTSTAMP:20260929T080000Z\r\n/);
  assert.match(s, /\r\nTRIGGER:-PT1H\r\n/);
  assert.equal((s.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(s.endsWith("END:VCALENDAR\r\n"));
});

test("commas, semicolons, backslashes and new lines are escaped", () => {
  const s = visitIcs({ ...base, location: "Str. Codru 12, Codru; poarta verde", description: "Tel: +373 68 512 003\nCasă cu 2 etaje \\ acoperiș" });
  assert.match(s, /LOCATION:Str\. Codru 12\\, Codru\\; poarta verde/);
  assert.match(s, /DESCRIPTION:Tel: \+373 68 512 003\\nCasă cu 2 etaje \\\\ acoperiș/);
});

test("long lines fold at 75 bytes without splitting a letter", () => {
  const s = visitIcs({ ...base, description: "Șțăîâ ".repeat(40) });
  for (const line of s.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  // unfolding gives the text back
  const unfolded = s.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("DESCRIPTION:" + "Șțăîâ ".repeat(40).trimEnd()));
});

test("empty location and description are left out", () => {
  const s = visitIcs(base);
  assert.ok(!s.includes("LOCATION:"));
  assert.ok(!/\r\nDESCRIPTION:(?!Vizită)/.test(s));
});

test("icsStamp drops separators and milliseconds", () => {
  assert.equal(icsStamp("2026-01-05T09:30:12.345Z"), "20260105T093012Z");
});
