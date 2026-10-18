import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fakeDb.testutil.js";
import { acceptProposal } from "./acceptProposal.js";
import { startQualified, decideMock, finishQualified, qsignMode } from "./qsignFlow.js";
import { msignMockAdapter, msignAdapter, documentHashFor } from "./qsign.js";

const PROP = { code: "abc12345", company_id: "C1", project_id: "P1", accepted_at: null };
const db0 = () => fakeDb({
  proposals: [{ ...PROP }], projects: [{ id: "P1", status: "sent", title: "Casa Popescu", client_name: "Ion Popescu" }],
  qualified_signatures: [], audit_log: [],
}, { qualified_signatures: [["request_id"]] });
const calls = () => {
  const c = { activity: [], notify: [], crm: [] };
  c.io = {
    acceptOffers: async () => ({ discount: null }),
    logActivity: async (db, row) => { c.activity.push(row); },
    notifyAccepted: async (db, prop, info) => { c.notify.push(info); },
    sendCrmWebhook: async (co, ev, data) => { c.crm.push([ev, data]); },
  };
  return c;
};
const HASH = documentHashFor({ code: PROP.code, title: "Casa Popescu", kw: 8 });
const adapter = msignMockAdapter({ baseUrl: "https://app.test" });
const returnFor = (id) => `https://app.test/api/qsign/return?r=${id}`;

test("click-to-sign: one acceptance, simple level, the installer told once, audited", async () => {
  const db = db0(); const c = calls();
  const r = await acceptProposal(db, PROP, { signerName: "Ion Popescu", signature: "data:image/png;base64,AA", ip: "1.2.3.4", ua: "UA" }, c.io);
  assert.equal(r.ok, true);
  assert.equal(db.T.proposals[0].signature_level, "simple");
  assert.equal(db.T.projects[0].status, "won");
  const again = await acceptProposal(db, PROP, { signerName: "Someone else" }, c.io);
  assert.equal(again.already, true, "a second tap does not sign again");
  assert.equal(db.T.proposals[0].signer_name, "Ion Popescu");
  assert.equal(c.activity.length, 1);
  assert.equal(c.notify.length, 1);
  assert.deepEqual(db.T.audit_log.map((a) => [a.action, a.after.level]), [["proposal.signed", "simple"]]);
});

test("qualified, happy path: start, sign in the simulation, back, the offer is signed at the qualified level", async () => {
  const db = db0(); const c = calls();
  const s = await startQualified(db, { prop: PROP, documentHash: HASH, adapter, returnFor });
  assert.equal(s.ok, true);
  assert.ok(s.redirectUrl.includes(`/sign/mock/${s.requestId}`));
  assert.equal(db.T.qualified_signatures[0].status, "pending");
  assert.equal((await decideMock(db, { requestId: s.requestId, decision: "sign", signer: "Ion Popescu" })).ok, true);
  const accept = (prop, sig) => acceptProposal(db, prop, sig, c.io);
  const f = await finishQualified(db, { requestId: s.requestId, adapter, accept, ip: "5.6.7.8" });
  assert.deepEqual([f.ok, f.outcome, f.code], [true, "signed", PROP.code]);
  const p = db.T.proposals[0];
  assert.equal(p.signature_level, "qualified");
  assert.equal(p.signer_name, "Ion Popescu");
  const row = db.T.qualified_signatures[0];
  assert.equal(row.verification.valid, true);
  assert.equal(row.verification.simulated, true, "the simulation is recorded as one");
  assert.ok(row.container);
  assert.equal(c.notify[0].simulated, true);
  assert.deepEqual(db.T.audit_log.map((a) => a.action), ["qsign.start", "qsign.verified", "proposal.signed"]);
  assert.equal(db.T.audit_log[2].after.level, "qualified");
  // the return URL reloaded: same answer, nothing signed twice
  const again = await finishQualified(db, { requestId: s.requestId, adapter, accept });
  assert.equal(again.already, true);
  assert.equal(c.activity.length, 1);
});

test("qualified, failure paths: declined, a changed document, already signed, the real provider unconfigured", async () => {
  const c = calls();
  {
    const db = db0();
    const s = await startQualified(db, { prop: PROP, documentHash: HASH, adapter, returnFor });
    await decideMock(db, { requestId: s.requestId, decision: "decline" });
    const f = await finishQualified(db, { requestId: s.requestId, adapter, accept: (p, x) => acceptProposal(db, p, x, c.io) });
    assert.equal(f.outcome, "declined");
    assert.equal(db.T.proposals[0].accepted_at, null, "a declined signature signs nothing");
    assert.equal((await decideMock(db, { requestId: s.requestId, decision: "sign", signer: "Ion" })).already, true, "a decided request cannot be flipped");
  }
  {
    const db = db0();
    const s = await startQualified(db, { prop: PROP, documentHash: HASH, adapter, returnFor });
    await decideMock(db, { requestId: s.requestId, decision: "sign", signer: "Ion Popescu" });
    db.T.qualified_signatures[0].document_hash = documentHashFor({ code: PROP.code, title: "changed" });
    // the container was made over the old hash; the row now expects another
    const f = await finishQualified(db, { requestId: s.requestId, adapter, accept: (p, x) => acceptProposal(db, p, x, c.io) });
    assert.equal(f.outcome, "signed", "the mock reads its hash from the row, so it still matches");
  }
  {
    const db = db0();
    const bad = { ...adapter, result: async () => ({ ok: true, status: "signed", container: "x", signer: "Ion", documentHash: "0".repeat(64) }) };
    const s = await startQualified(db, { prop: PROP, documentHash: HASH, adapter: bad, returnFor });
    const f = await finishQualified(db, { requestId: s.requestId, adapter: bad, accept: (p, x) => acceptProposal(db, p, x, c.io) });
    assert.deepEqual([f.outcome, f.error], ["invalid", "document_changed"]);
    assert.equal(db.T.proposals[0].accepted_at, null);
    assert.equal(db.T.qualified_signatures[0].status, "failed");
  }
  {
    const db = db0();
    assert.deepEqual(await startQualified(db, { prop: { ...PROP, accepted_at: "2026-10-18" }, documentHash: HASH, adapter, returnFor }), { ok: false, error: "already_signed" });
    const r = await startQualified(db, { prop: PROP, documentHash: HASH, adapter: msignAdapter({}), returnFor });
    assert.deepEqual(r, { ok: false, error: "not_configured" });
    assert.equal(db.T.qualified_signatures[0].status, "failed");
    assert.equal((await decideMock(db, { requestId: "QS-nope", decision: "sign", signer: "Ion" })).error, "not_found");
  }
  {
    const db = fakeDb({ proposals: [{ ...PROP }], audit_log: [] });
    assert.equal((await startQualified(db, { prop: PROP, documentHash: HASH, adapter, returnFor })).error, "needs_db");
  }
});

test("the simulation is offered outside production, or when switched on; MSign once configured", () => {
  assert.equal(qsignMode({ NODE_ENV: "development" }), "mock");
  assert.equal(qsignMode({ NODE_ENV: "production" }), null);
  assert.equal(qsignMode({ NODE_ENV: "production", QSIGN_MOCK: "on" }), "mock");
  assert.equal(qsignMode({ NODE_ENV: "production", MSIGN_ENABLED: "on" }), "real");
});
