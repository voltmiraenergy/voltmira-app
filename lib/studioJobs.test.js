import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENT_PRESETS, pruneUntouchedPresets, blankJob } from "../app/(app)/studio/jobs-data.js";

test("a real workspace drops only the sample clients nobody touched", () => {
  const untouched = { ...CLIENT_PRESETS[0] };
  const edited = { ...CLIENT_PRESETS[1], kw: 9 };
  const withData = { ...CLIENT_PRESETS[2] };
  const own = blankJob();
  const kept = pruneUntouchedPresets([untouched, edited, withData, own], (id) => id === withData.id);
  assert.deepEqual(kept.map((j) => j.id), [edited.id, withData.id, own.id]);
});

test("a blank job names no client and invents nothing", () => {
  const j = blankJob();
  assert.equal(j.name, "");
  assert.equal(j.address, "");
  assert.match(j.id, /^job-/);
});
