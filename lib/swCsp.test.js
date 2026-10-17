import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCsp } from "./csp.js";

test("every host the offline worker fetches is allowed by the CSP's connect-src", () => {
  const sw = readFileSync(new URL("../public/app-sw.js", import.meta.url), "utf8");
  const connect = buildCsp().split("; ").find((d) => d.startsWith("connect-src "));
  for (const [, host] of sw.matchAll(/const \w*HOST\w* = "([^"]+)"/g)) {
    assert.ok(connect.includes(`https://${host}`), `${host} is fetched by the worker but blocked by connect-src`);
  }
});
