import { test } from "node:test";
import assert from "node:assert/strict";
import { daysBetween, plantDeadlines, collectDeadlines, SOON_DAYS } from "./deadlines.js";
import { deadlineEmail, itemName, EMAIL_ROWS } from "./deadlineEmail.js";
import { DLT, dlt, whenText } from "./deadlineText.js";
import { PLANTS_KEY } from "./portfolioModel.js";

const TODAY = "2026-10-08";
const plant = (id, name, permits) => ({ id, name, wind: { mw: 10 }, permits });
const P = (plants) => [{ id: "pf1", name: "Fond", assets: { [PLANTS_KEY]: plants } }];

test("days between two dates", () => {
  assert.equal(daysBetween("2026-10-08", "2026-10-08"), 0);
  assert.equal(daysBetween("2026-10-08", "2026-11-07"), 30);
  assert.equal(daysBetween("2026-10-08", "2026-10-01"), -7);
  assert.equal(daysBetween("2026-10-08", ""), null);
});

test("late and soon: dated, unfinished items only, inside the window", () => {
  const d = plantDeadlines(plant("a", "Sud", {
    land: { status: "done", due: "2026-09-01" },                 // done: never listed
    urbanism: { status: "todo", due: "2026-10-01", by: "Ion", ref: "CU-1" }, // 7 days late
    eia: { status: "in_progress", due: "2026-10-20" },           // in 12 days
    licence: { status: "todo", due: "2026-12-30" },              // beyond the window
    contract: { status: "na", due: "2026-10-09" },               // not needed
    om: { status: "todo" },                                      // no date
  }), TODAY);
  assert.deepEqual(d.rows.map((r) => [r.item, r.days, r.overdue]), [["urbanism", -7, true], ["eia", 12, false]]);
  assert.equal(d.rows[0].by, "Ion");
  assert.ok(d.undated >= 1);
  assert.ok(SOON_DAYS === 30);
});

test("the grid item is listed by its steps, each with its own date", () => {
  const d = plantDeadlines(plant("a", "Sud", {
    grid: { status: "todo", due: "2026-10-02", steps: {
      request: { status: "done", due: "2026-09-01" },
      approval: { status: "in_progress", due: "2026-10-05", ref: "ATR-9" },
      contract: { status: "todo", due: "2026-10-25" },
      works: { status: "todo" },
    } },
  }), TODAY);
  const grid = d.rows.filter((r) => r.item === "grid");
  assert.deepEqual(grid.map((r) => [r.step, r.days]), [["approval", -3], ["contract", 17]]);
  assert.ok(!d.rows.some((r) => r.item === "grid" && r.step === null), "the item's own date is not listed beside its steps");
});

test("across portfolios and plants: sorted by date, counted", () => {
  const rows = collectDeadlines([
    ...P([plant("a", "Sud", { urbanism: { status: "todo", due: "2026-10-20" } }), plant("b", "Nord", { eia: { status: "todo", due: "2026-10-01" } })]),
    { id: "pf2", name: "Alt", assets: {} },
    { id: "pf3", name: "Fără", assets: null },
  ], TODAY);
  assert.deepEqual(rows.rows.map((r) => r.plantName), ["Nord", "Sud"]);
  assert.equal(rows.late, 1);
  assert.equal(rows.soon, 1);
  assert.equal(rows.rows[0].portfolioId, "pf1");
});

test("the weekly email: subject by what exists, safe text, capped rows", () => {
  const mk = (n, due) => Array.from({ length: n }, (_, i) => ({ plantName: `Parc <${i}>`, item: "grid", step: "approval", due, days: -2, overdue: true, by: "Ana", ref: "R&D" }));
  const e = deadlineEmail({ lang: "ro", rows: mk(20, "2026-10-06"), late: 20, soon: 0, url: "https://x/y" });
  assert.equal(e.subject, "Avize și termene: întârziate 20");
  assert.ok(e.html.includes("Parc &lt;0&gt;") && !e.html.includes("<0>"));
  assert.ok(e.html.includes("R&amp;D"));
  assert.ok(e.html.includes("și încă 5 pe pagină"));
  assert.equal((e.html.match(/<b>Parc/g) || []).length, EMAIL_ROWS);
  assert.equal(deadlineEmail({ lang: "en", rows: [], late: 1, soon: 2, url: "u" }).subject, "Permits and deadlines: 1 late, 2 due soon");
  assert.equal(deadlineEmail({ lang: "en", rows: [], late: 0, soon: 3, url: "u" }).subject, "Permits and deadlines: 3 due soon");
  assert.equal(itemName({ item: "grid", step: "approval" }, "en").startsWith("Grid connection: "), true);
});

test("the words: four languages, same placeholders, no banned punctuation, informal Romanian", () => {
  for (const [k, e] of Object.entries(DLT)) {
    for (const l of ["en", "ro", "ru", "uk"]) {
      assert.ok(typeof e[l] === "string" && e[l].length > 0, `${k} missing ${l}`);
      assert.ok(!/[—–·✓✔]/.test(e[l]), `${k} ${l} has a dash, middle dot or tick`);
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const l of ["ro", "ru", "uk"]) assert.equal(vars(e[l]), vars(e.en), `${k} ${l} placeholders differ`);
    assert.ok(!/[ыэёъ]/i.test(e.uk), `${k} uk has a Russian letter`);
  }
  assert.equal(whenText(-1, "en"), "1 day late");
  assert.equal(whenText(-5, "ro"), "5 zile întârziere");
  assert.equal(whenText(0, "en"), "Today");
  assert.equal(whenText(1, "en"), "tomorrow");
  assert.equal(whenText(12, "uk"), "через 12 дн.");
  assert.equal(dlt("undated", "en", { n: 1 }).startsWith("1 open item has"), true);
});
