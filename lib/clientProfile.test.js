import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanClientProfile } from "./clientProfile.js";

test("the profile keeps only known answers, in their shape", () => {
  assert.deepEqual(cleanClientProfile({ vatPayer: "yes", netMetering: "no", loanMdl: "150 000", documentsHave: ["battery_invoice", "Battery_Invoice", "x y", "net_metering_contract"] }),
    { vatPayer: true, netMetering: false, loanMdl: 150000, documentsHave: ["battery_invoice", "net_metering_contract"] });
  assert.deepEqual(cleanClientProfile({ vatPayer: "unknown", netMetering: null, loanMdl: "", documentsHave: "not a list" }), {}, "nothing known yet");
  assert.deepEqual(cleanClientProfile(undefined), {});
  assert.equal(cleanClientProfile({ loanMdl: 9e12 }).loanMdl, 1_000_000_000, "capped");
});
