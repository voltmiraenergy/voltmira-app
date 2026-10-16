import { test } from "node:test";
import assert from "node:assert/strict";
import { staleSystems, readingAlertEmail } from "./readingAlerts.js";

const NOW = Date.parse("2026-10-16T08:00:00Z");
const won = (id, commission, o = {}) => ({ id, title: "Casa " + id, status: "won", install_progress: { commission }, ...o });

test("a commissioned system a month without a reading is listed, the freshest readings and new systems are not", () => {
  const last = new Map([["b", "2026-10-01T09:00:00Z"], ["c", "2026-08-20T09:00:00Z"]]);
  const rows = staleSystems([
    won("a", "2026-08-01"),                  // no reading since commissioning, 76 days
    won("b", "2026-03-01"),                  // read 15 days ago
    won("c", "2026-03-01"),                  // last read 57 days ago
    won("d", "2026-10-01"),                  // commissioned 15 days ago: too soon
    won("e", "2026-03-01", { status: "sent" }),
    { id: "f", status: "won", install_progress: {} },
  ], last, NOW);
  assert.deepEqual(rows.map((r) => [r.id, r.days]), [["a", 76], ["c", 56]]);
  assert.equal(rows[0].last, null);
});

test("the email names each system and says what to do, in the installer's language", () => {
  const rows = [{ id: "a", title: "Casa Rusu", commissioned: "2026-08-01", last: null, days: 76 }, { id: "c", title: "Casa Grosu", commissioned: "2026-03-01", last: "2026-08-20T09:00:00Z", days: 56 }];
  const ro = readingAlertEmail({ lang: "ro", rows, appUrl: "https://app.voltmira.com" });
  assert.equal(ro.subject, "2 sisteme nu au nicio citire de 30 de zile");
  assert.match(ro.html, /Casa Rusu/);
  assert.match(ro.html, /niciuna de la punerea în funcțiune/);
  assert.match(ro.html, /ultima citire/);
  assert.match(ro.html, /projects\?status=won/);
  const one = readingAlertEmail({ lang: "en", rows: rows.slice(0, 1), appUrl: "x", test: true });
  assert.equal(one.subject, "[Test] A system has had no reading for 30 days");
  assert.match(one.html, /This is a test from Settings/);
});
