import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptProposal } from "./acceptProposal.js";
import { fakeDb } from "./fakeDb.testutil.js";

const io = () => {
  const calls = { activity: 0, notified: 0 };
  return {
    calls,
    acceptOffers: async () => null,
    logActivity: async () => { calls.activity++; },
    notifyAccepted: async () => { calls.notified++; },
    sendCrmWebhook: async () => {},
  };
};
const setup = (status) => fakeDb({
  proposals: [{ code: "c1", project_id: "p1", company_id: "co", accepted_at: null }],
  projects: [{ id: "p1", status, title: "Vila", client_name: "Ion" }],
  audit_log: [],
});
const prop = { code: "c1", project_id: "p1", company_id: "co" };

for (const status of ["sent", "lost", "draft"]) {
  test(`a client's signature wins a quote marked ${status}`, async () => {
    const db = setup(status), x = io();
    const r = await acceptProposal(db, prop, { signature: "data:image/png;base64,AAAA", signerName: "Ion Popescu" }, x);
    assert.equal(r.ok, true);
    assert.equal(db.T.projects[0].status, "won");
    assert.ok(db.T.proposals[0].accepted_at);
    assert.equal(x.calls.notified, 1);
  });
}

test("a second signature changes nothing and tells nobody again", async () => {
  const db = setup("sent"), x = io();
  await acceptProposal(db, prop, { signature: "data:image/png;base64,AAAA", signerName: "Ion Popescu" }, x);
  const again = await acceptProposal(db, prop, { signature: "data:image/png;base64,BBBB", signerName: "Alt Nume" }, x);
  assert.equal(again.already, true);
  assert.equal(db.T.proposals[0].signer_name, "Ion Popescu");
  assert.equal(x.calls.notified, 1);
});
