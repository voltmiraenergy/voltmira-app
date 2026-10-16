import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("every host the offline worker fetches is allowed by the CSP's connect-src", () => {
  const sw = readFileSync(new URL("../public/app-sw.js", import.meta.url), "utf8");
  const cfg = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
  const connect = cfg.match(/"connect-src ([^"]+)"/)[1];
  for (const [, host] of sw.matchAll(/const \w*HOST\w* = "([^"]+)"/g)) {
    assert.ok(connect.includes(`https://${host}`), `${host} is fetched by the worker but blocked by connect-src`);
  }
});
