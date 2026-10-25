import { test } from "node:test";
import assert from "node:assert/strict";
import { isAiPath } from "./featureFlags.js";

test("every AI and widget page and route is caught, and nothing else", () => {
  for (const p of ["/widget", "/widget/chat", "/api/agent/chat", "/api/agent/telegram/abc", "/api/widget-lead",
    "/api/generate-bom", "/api/plant-study", "/api/proposal/ab12cd34/qa", "/studio/lead-widget"]) {
    assert.equal(isAiPath(p), true, p);
  }
  for (const p of ["/", "/widgets-guide", "/api/proposal/ab12cd34", "/api/proposal/ab12cd34/pdf", "/api/estimate", "/studio", "/studio/monitoring", "/projects/x"]) {
    assert.equal(isAiPath(p), false, p);
  }
});
