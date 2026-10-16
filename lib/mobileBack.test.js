import { test } from "node:test";
import assert from "node:assert/strict";
import { parentPath, isInner } from "./navPaths.js";

test("the back bar shows below the main sections only, and goes up one level without history", () => {
  for (const p of ["/dashboard", "/projects", "/portfolios", "/settings", "/studio", "/"]) assert.equal(isInner(p), false, p);
  for (const p of ["/projects/abc", "/portfolios/x/report", "/studio/jobs/j1/configure", "/profile"]) assert.equal(isInner(p), true, p);
  assert.equal(parentPath("/projects/abc/invoice"), "/projects/abc");
  assert.equal(parentPath("/portfolios/x/report?lang=ro"), "/portfolios/x");
  assert.equal(parentPath("/profile"), "/dashboard");
});
