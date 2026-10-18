import { test } from "node:test";
import assert from "node:assert/strict";
import { writeAudit } from "./audit.js";

const fakeDb = (error = null) => {
  const rows = [];
  return { rows, from: (t) => ({ insert: async (r) => { rows.push({ t, ...r }); return { error }; } }) };
};

test("an audit row carries the actor, the action and the row before and after", async () => {
  const db = fakeDb();
  const ok = await writeAudit(db, { companyId: null, actor: { id: "u1", email: "a@b.md" }, action: "tariff.publish", entity: "tariff_rule", entityId: "r2", before: { v: 1 }, after: { v: 2 } });
  assert.equal(ok, true);
  assert.deepEqual(db.rows[0], { t: "audit_log", company_id: null, actor_id: "u1", actor_email: "a@b.md", action: "tariff.publish", entity: "tariff_rule", entity_id: "r2", before: { v: 1 }, after: { v: 2 } });
});

test("a missing table never blocks the change: the write reports false", async () => {
  assert.equal(await writeAudit(fakeDb({ message: 'relation "audit_log" does not exist' }), { action: "x", entity: "y" }), false);
  const throwing = { from: () => { throw new Error("down"); } };
  assert.equal(await writeAudit(throwing, { action: "x", entity: "y" }), false);
});
