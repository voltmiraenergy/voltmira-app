import { test } from "node:test";
import assert from "node:assert/strict";
import { rangeFill } from "./rangeFill.js";

test("a slider's fill reaches the middle of its knob, whatever its bounds", () => {
  assert.equal(rangeFill(30)["--fill"], "calc(11px + (100% - 22px) * 0.3)");
  assert.equal(rangeFill(0)["--fill"], "calc(11px + (100% - 22px) * 0)");
  assert.equal(rangeFill(10, 1, 60)["--fill"], "calc(11px + (100% - 22px) * 0.1525)");
  assert.equal(rangeFill(500, 0, 100)["--fill"], "calc(11px + (100% - 22px) * 1)", "kept inside the track");
  assert.equal(rangeFill("x")["--fill"], "calc(11px + (100% - 22px) * 0)");
});
