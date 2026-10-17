import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AUTH_COOKIE_DAYS, AUTH_COOKIE_MAX_AGE, isAuthCookie } from "./authCookie.js";

test("a device stays signed in for 30 days", () => {
  assert.equal(AUTH_COOKIE_DAYS, 30);
  assert.equal(AUTH_COOKIE_MAX_AGE, 2592000);
});

test("only Supabase's session cookies are renewed", () => {
  assert.ok(isAuthCookie("sb-abcdef-auth-token"));
  assert.ok(isAuthCookie("sb-abcdef-auth-token.0"));
  assert.ok(isAuthCookie("sb-abcdef-auth-token.1"));
  assert.ok(!isAuthCookie("sb-abcdef-auth-token-code-verifier"));
  assert.ok(!isAuthCookie("voltmira_lang"));
  assert.ok(!isAuthCookie(""));
});

test("every Supabase client uses the one lifetime", () => {
  for (const f of ["lib/supabase.js", "lib/supabase-browser.js", "proxy.js", "app/demo/route.js"]) {
    const src = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.ok(src.includes("AUTH_COOKIE_MAX_AGE"), f);
    assert.ok(!/60 \* 60 \* 24 \* 400/.test(src), `${f} still has its own 400 days`);
  }
});
