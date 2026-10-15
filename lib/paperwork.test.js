import { test } from "node:test";
import assert from "node:assert/strict";
import { paperworkFor, paperworkTotals, REQUIRED } from "./paperwork.js";

const P = (o = {}) => ({ id: o.id || "p1", status: "sent", market: "MD", install_progress: {}, ...o });

test("a draft has nothing missing and nothing sent", () => {
  const { docs, missing } = paperworkFor(P({ status: "draft" }));
  assert.equal(docs.proposal.state, "todo");
  assert.equal(docs.signed.state, "todo");
  assert.deepEqual(missing, []);
});

test("a sent proposal waits on the client, not on the installer", () => {
  const { docs } = paperworkFor(P(), { code: "abc", created_at: "2026-09-01" });
  assert.equal(docs.proposal.state, "done");
  assert.equal(docs.signed.state, "waiting");
});

test("a won job lists what is still missing, in working order", () => {
  const { missing } = paperworkFor(P({ status: "won" }), { code: "abc", created_at: "2026-09-01" });
  assert.deepEqual(missing, REQUIRED);
});

test("signature, invoice and checklist steps each clear their item", () => {
  const p = P({
    status: "won", invoice_no: "PF-2026-0003", invoiced_at: "2026-09-10",
    install_progress: { permit: "2026-09-12", grid: "2026-09-20" },
  });
  const { docs, missing } = paperworkFor(p, { code: "abc", accepted_at: "2026-09-05", signer_name: "Ion Popescu" });
  assert.equal(docs.signed.by, "Ion Popescu");
  assert.equal(docs.invoice.no, "PF-2026-0003");
  assert.deepEqual(missing, ["commissioning"]);
});

test("commissioned_at counts as commissioning done even without the checklist tick", () => {
  const { missing } = paperworkFor(P({ status: "won", invoice_no: "X", commissioned_at: "2026-09-25",
    install_progress: { permit: "a", grid: "b" } }), { code: "c", accepted_at: "d" });
  assert.deepEqual(missing, []);
});

test("totals count won jobs with paperwork left", () => {
  const projects = [
    P({ id: "a", status: "won" }),
    P({ id: "b", status: "won", invoice_no: "X", commissioned_at: "2026-01-01", install_progress: { permit: "a", grid: "b" } }),
    P({ id: "c", status: "sent" }),
  ];
  const props = new Map([["b", { code: "b", accepted_at: "2026-01-01" }], ["c", { code: "c" }]]);
  const t = paperworkTotals(projects, props);
  assert.deepEqual(t, { won: 2, signed: 1, invoiced: 1, connected: 1, commissioned: 1, toFinish: 1 });
});
