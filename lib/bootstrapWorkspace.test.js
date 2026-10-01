import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapWorkspace, isMissingFunction } from "./bootstrapWorkspace.js";

const fake = (answers) => {
  const calls = [];
  return { calls, rpc: async (fn, args) => { calls.push({ fn, args }); return answers.shift(); } };
};

test("sends the sign-up language when the new function exists", async () => {
  const sb = fake([{ data: "cid", error: null }]);
  const res = await bootstrapWorkspace(sb, { company: "SolarTech", lang: "ru" });
  assert.equal(res.data, "cid");
  assert.deepEqual(sb.calls, [{ fn: "bootstrap_company", args: { company_name: "SolarTech", user_name: "", company_lang: "ru" } }]);
});

test("falls back to the two-argument function when the migration has not run", async () => {
  const sb = fake([{ data: null, error: { code: "PGRST202", message: "Could not find the function public.bootstrap_company(company_lang, company_name, user_name)" } }, { data: "cid", error: null }]);
  const res = await bootstrapWorkspace(sb, { company: "SolarTech", lang: "ro" });
  assert.equal(res.data, "cid");
  assert.equal(sb.calls.length, 2);
  assert.deepEqual(sb.calls[1].args, { company_name: "SolarTech", user_name: "" });
});

test("a real error is returned, not retried", async () => {
  const sb = fake([{ data: null, error: { code: "42501", message: "permission denied" } }]);
  const res = await bootstrapWorkspace(sb, { lang: "en" });
  assert.equal(res.error.code, "42501");
  assert.equal(sb.calls.length, 1);
});

test("an unknown language goes straight to the table default", async () => {
  const sb = fake([{ data: "cid", error: null }]);
  await bootstrapWorkspace(sb, { lang: "de" });
  assert.deepEqual(sb.calls[0].args, { company_name: "", user_name: "" });
  assert.equal(isMissingFunction(null), false);
});
