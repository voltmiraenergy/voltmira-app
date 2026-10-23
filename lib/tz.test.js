import { test } from "node:test";
import assert from "node:assert/strict";

import { dayKeyOf } from "./tz.js";

test("dayKeyOf reads a timestamp on the Chisinau clock and leaves a plain date alone", () => {
  // 00:30 on 1 November (UTC+2 after the clocks go back) is still 31 October in UTC
  assert.equal(dayKeyOf("2026-10-31T22:30:00Z"), "2026-11-01");
  assert.equal(dayKeyOf("2026-07-31T21:30:00Z"), "2026-08-01");
  assert.equal(dayKeyOf("2026-10-05"), "2026-10-05");
  assert.equal(dayKeyOf(""), "");
  assert.equal(dayKeyOf("not a date"), "");
});
