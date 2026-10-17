import { test } from "node:test";
import assert from "node:assert/strict";
import { sendDeadlineDigests } from "./deadlineRun.js";
import { PLANTS_KEY } from "./portfolioModel.js";

const NOW = Date.parse("2026-10-12T06:00:00Z"); // a Monday
const late = { id: "a", name: "Sud", wind: { mw: 10 }, permits: { urbanism: { status: "todo", due: "2026-10-01" } } };
const quiet = { id: "b", name: "Nord", wind: { mw: 10 }, permits: { urbanism: { status: "todo", due: "2027-06-01" } } };

// a tiny stand-in for the Supabase client: tables are arrays, eq() filters
function fakeDb(tables) {
  return {
    from(name) {
      let rows = [...tables[name]];
      const q = {
        select() { return q; }, order() { return q; }, not() { return q; }, limit() { return q; },
        eq(k, v) { rows = rows.filter((r) => r[k] === v); return q; },
        range(a, b) { rows = rows.slice(a, b + 1); return q; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then(res) { return Promise.resolve({ data: rows, error: null }).then(res); },
      };
      return q;
    },
  };
}

async function withEmail(fn) {
  const sent = [];
  const realFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "re_test";
  globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, text: async () => "" }; };
  try { await fn(sent); } finally { globalThis.fetch = realFetch; delete process.env.RESEND_API_KEY; }
}

test("one email per company that has something late or due, none for the quiet, the opted out or the demo", async () => {
  const db = fakeDb({
    portfolios: [
      { id: "p1", company_id: "c1", name: "F1", assets: { [PLANTS_KEY]: [late] } },
      { id: "p2", company_id: "c2", name: "F2", assets: { [PLANTS_KEY]: [quiet] } },
      { id: "p3", company_id: "c3", name: "F3", assets: { [PLANTS_KEY]: [late] } },
      { id: "p4", company_id: "c4", name: "F4", assets: { [PLANTS_KEY]: [late] } },
    ],
    projects: [],
    companies: [{ id: "c1", lang: "ro" }, { id: "c2", lang: "en" }, { id: "c3", lang: "en", notify_deadlines: false }, { id: "c4", lang: "en" }],
    profiles: [
      { company_id: "c1", role: "owner", email: "ion@firma.md" }, { company_id: "c2", role: "owner", email: "x@y.md" },
      { company_id: "c3", role: "owner", email: "z@y.md" }, { company_id: "c4", role: "owner", email: "demo-123@demo.voltmira.com" },
    ],
  });
  await withEmail(async (sent) => {
    const t = await sendDeadlineDigests(db, { now: NOW });
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ["ion@firma.md"]);
    assert.equal(sent[0].subject, "Avize și termene: întârziate 1");
    assert.deepEqual([t.companies, t.sent, t.skipped, t.failed], [4, 1, 3, 0]);
  });
});

test("without an email service nothing is read or sent", async () => {
  delete process.env.RESEND_API_KEY;
  const r = await sendDeadlineDigests(fakeDb({ portfolios: [], projects: [], companies: [], profiles: [] }), { now: NOW });
  assert.equal(r.off, true);
  assert.equal(r.sent, 0);
});

test("a won quote waiting on the grid operator is in the email, even with no portfolio", async () => {
  const db = fakeDb({
    portfolios: [],
    projects: [
      // applied 20 days ago: the approval is 10 days late (chase after 10)
      { id: "q1", company_id: "c9", title: "Casa Rusu", status: "won", market: "MD", install_progress: { gridFile: { operator: "rednord", stages: { applied: "2026-09-22" } } } },
      // finished: nothing to chase
      { id: "q2", company_id: "c9", title: "Casa Done", status: "won", market: "MD", install_progress: { gridFile: { stages: { applied: "2026-08-01", approval: "2026-08-05", installed: "2026-08-20", meter: "2026-09-01", contract: "2026-09-10" } } } },
      // not won: not ours to chase
      { id: "q3", company_id: "c9", title: "Casa Sent", status: "sent", market: "MD", install_progress: { gridFile: { stages: { applied: "2026-09-22" } } } },
    ],
    companies: [{ id: "c9", lang: "ro" }],
    profiles: [{ company_id: "c9", role: "owner", email: "ana@firma.md" }],
  });
  await withEmail(async (sent) => {
    const t = await sendDeadlineDigests(db, { now: NOW });
    assert.equal(t.sent, 1);
    assert.equal(sent[0].subject, "Avize și termene: întârziate 1");
    assert.match(sent[0].html, /Casa Rusu/);
    assert.match(sent[0].html, /Dosarul de racordare: Avizul de racordare primit/);
    assert.match(sent[0].html, /RED Nord/);
    assert.doesNotMatch(sent[0].html, /Casa Done|Casa Sent/);
  });
});
