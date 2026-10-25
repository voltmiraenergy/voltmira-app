import { test } from "node:test";
import assert from "node:assert/strict";
import { issueInvoiceFor } from "./invoiceIssue.js";
import { freezeInvoice, readFrozen } from "./invoiceFreeze.js";
import { invoiceAmounts } from "./invoiceMath.js";

const amounts = invoiceAmounts({ grossEur: 11300, fx: 19.8, vatRatePct: 20, depositPct: 30 });
const inv = { amounts, cur: "MDL", fx: 19.8, fxInfo: { live: true, source: "BNM", asOf: "2026-10-22" } };
const project = { id: "p1", title: "Casa Sirbu", client_name: "Sirbu", kw: 6, batt: true, batt_kwh: 10, invoice_no: null };
const co = { id: "c1", invoice_prefix: "PF" };
const NOW = new Date("2026-10-22T10:00:00Z");

// a stand-in for the signed-in client: records what is written, and says how many rows the guarded update hit
function fakeSb({ seq = 7, hit = true, failColumns = [], current = null } = {}) {
  const calls = { writes: [], rpc: 0 };
  return {
    calls,
    rpc: async () => { calls.rpc++; return { data: seq }; },
    from: () => ({
      update: (cols) => ({
        eq: () => ({ is: () => ({ select: async () => {
          calls.writes.push(cols);
          const bad = failColumns.find((c) => c in cols);
          if (bad) return { data: null, error: { message: `column "${bad}" does not exist` } };
          return { data: hit ? [{ invoice_no: cols.invoice_no }] : [], error: null };
        } }) }),
      }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current }) }) }),
    }),
  };
}

test("issuing draws the number once, writes it with its date and figures, and fires the hook once", async () => {
  const sb = fakeSb();
  const hooks = [];
  const r = await issueInvoiceFor({ sb, co, project, inv, now: NOW, webhook: async (e, p) => hooks.push([e, p]) });
  assert.deepEqual([r.ok, r.invoiceNo, r.fresh], [true, "PF-2026-0007", true]);
  assert.equal(sb.calls.writes.length, 1);
  assert.equal(sb.calls.writes[0].invoiced_at, NOW.toISOString());
  assert.equal(sb.calls.writes[0].invoice_amounts.gross, amounts.gross);
  assert.equal(hooks.length, 1);
  assert.equal(hooks[0][0], "invoice.created");
  assert.equal(hooks[0][1].gross, amounts.gross);
});

test("an invoice that already has its number is returned as it is: nothing is drawn, nothing fires", async () => {
  const sb = fakeSb();
  const hooks = [];
  const r = await issueInvoiceFor({ sb, co, project: { ...project, invoice_no: "PF-2026-0003" }, inv, now: NOW, webhook: async () => hooks.push(1) });
  assert.deepEqual([r.ok, r.invoiceNo, r.fresh], [true, "PF-2026-0003", false]);
  assert.equal(sb.calls.rpc, 0);
  assert.equal(hooks.length, 0);
});

test("when another request issued it first, theirs stands and the hook does not fire again", async () => {
  const sb = fakeSb({ hit: false, current: { invoice_no: "PF-2026-0006" } });
  const hooks = [];
  const r = await issueInvoiceFor({ sb, co, project, inv, now: NOW, webhook: async () => hooks.push(1) });
  assert.deepEqual([r.ok, r.invoiceNo, r.fresh], [true, "PF-2026-0006", false]);
  assert.equal(hooks.length, 0);
});

test("the year is the Chisinau one just after midnight on 1 January", async () => {
  const sb = fakeSb();
  const r = await issueInvoiceFor({ sb, co, project, inv, now: new Date("2026-12-31T22:30:00Z") });
  assert.equal(r.invoiceNo, "PF-2027-0007");
});

test("a database without the newer columns still takes the number", async () => {
  const sb = fakeSb({ failColumns: ["invoice_amounts"] });
  const r = await issueInvoiceFor({ sb, co, project, inv, now: NOW });
  assert.equal(r.ok, true);
  assert.equal(sb.calls.writes.length, 2);
  assert.equal("invoice_amounts" in sb.calls.writes[1], false);
  const old = fakeSb({ failColumns: ["invoice_amounts", "invoiced_at"] });
  const r2 = await issueInvoiceFor({ sb: old, co, project, inv, now: NOW });
  assert.deepEqual(old.calls.writes[2], { invoice_no: "PF-2026-0007" });
  assert.equal(r2.ok, true);
});

test("without the number sequence nothing is issued", async () => {
  const sb = fakeSb({ seq: null });
  assert.deepEqual(await issueInvoiceFor({ sb, co, project, inv, now: NOW }), { ok: false, error: "no_sequence" });
  assert.equal(sb.calls.writes.length, 0);
});

test("a hook that fails does not undo the number", async () => {
  const r = await issueInvoiceFor({ sb: fakeSb(), co, project, inv, now: NOW, webhook: async () => { throw new Error("down"); } });
  assert.equal(r.ok, true);
});

test("frozen figures read back exactly, and a stored invoice with none (or a damaged one) reads as null", () => {
  const f = readFrozen(freezeInvoice({ ...inv, project }));
  assert.deepEqual(f.amounts, { gross: amounts.gross, net: amounts.net, vat: amounts.vat, rate: 20, showVat: true, depositPct: 30, deposit: amounts.deposit, balance: amounts.balance });
  assert.equal(f.cur, "MDL");
  assert.equal(f.fx, 19.8);
  assert.deepEqual(f.fxInfo, { live: true, source: "BNM", asOf: "2026-10-22" });
  assert.equal(f.kw, 6);
  assert.equal(f.battKwh, 10);
  assert.equal(readFrozen(null), null);
  assert.equal(readFrozen({}), null);
  assert.equal(readFrozen({ ...freezeInvoice({ ...inv, project }), cur: "USD" }), null);
  assert.equal(readFrozen({ ...freezeInvoice({ ...inv, project }), gross: "x" }), null);
});

test("a repeat of the same invoice at another rate keeps the frozen amounts", () => {
  const frozen = freezeInvoice({ ...inv, project });
  const later = invoiceAmounts({ grossEur: 11300, fx: 19.9, vatRatePct: 20 });
  assert.notEqual(later.gross, frozen.gross);
  assert.equal(readFrozen(frozen).amounts.gross, amounts.gross);
});
