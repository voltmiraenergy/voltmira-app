import { test } from "node:test";
import assert from "node:assert/strict";
import { findByReferral } from "./referral.js";

// a stand-in for the client: a table with or without the referral_token column
const db = (rows, hasToken) => ({
  from: () => ({
    select: () => ({
      eq: (col, v) => ({
        maybeSingle: async () => {
          if (col === "referral_token" && !hasToken) return { data: null, error: { message: 'column "referral_token" does not exist' } };
          return { data: rows.find((r) => r[col] === v) || null, error: null };
        },
      }),
    }),
  }),
});
const rows = [{ code: "abcd1234", referral_token: "f00dfacefeed0123456789abcdef0123", accepted_at: "2026-10-01" }];

test("with the column, only the token opens a recommendation, never the offer's code", async () => {
  assert.equal((await findByReferral(db(rows, true), "f00dfacefeed0123456789abcdef0123", "code"))?.code, "abcd1234");
  assert.equal(await findByReferral(db(rows, true), "abcd1234", "code"), null);
});

test("before the column exists the offer's code still works, so nothing breaks in between", async () => {
  assert.equal((await findByReferral(db(rows, false), "abcd1234", "code"))?.code, "abcd1234");
});

test("a malformed key is refused before any lookup", async () => {
  for (const bad of ["", "ab", "../etc", "a b c d e f", "x".repeat(60), null])
    assert.equal(await findByReferral(db(rows, true), bad, "code"), null);
});
