/**
 * lib/safeRedirect.test.js — safeNext() decides where an AUTHENTICATION
 * endpoint redirects to. Get this wrong and /demo becomes an open redirect: a
 * link like /demo?next=https://evil.example signs a visitor into a real demo
 * session and then bounces them off-site, which is exactly the shape of a
 * phishing setup.
 *
 * Run: node --test lib/safeRedirect.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safeRedirect.js";

test("a plain root-relative path is allowed through unchanged", () => {
  assert.equal(safeNext("/catalog"), "/catalog");
  assert.equal(safeNext("/projects/abc-123"), "/projects/abc-123");
  assert.equal(safeNext("/leads?tab=new"), "/leads?tab=new");
});

test("no next at all, or an empty string, falls back to null (caller defaults to /dashboard)", () => {
  assert.equal(safeNext(null), null);
  assert.equal(safeNext(undefined), null);
  assert.equal(safeNext(""), null);
});

test("a protocol-relative '//host' is rejected — the classic open-redirect shape", () => {
  assert.equal(safeNext("//evil.example"), null);
  assert.equal(safeNext("//evil.example/catalog"), null);
});

test("an absolute URL with any scheme is rejected, not just http(s)", () => {
  for (const bad of [
    "https://evil.example",
    "http://evil.example/catalog",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://evil.example",
  ]) {
    assert.equal(safeNext(bad), null, `must reject ${bad}`);
  }
});

test("a backslash variant a browser might still treat as '//' is rejected", () => {
  assert.equal(safeNext("/\\evil.example"), null);
});

test("a path with no leading slash is rejected, not silently prefixed", () => {
  assert.equal(safeNext("catalog"), null);
  assert.equal(safeNext("evil.example"), null);
});

test("non-string input never throws", () => {
  assert.equal(safeNext(123), null);
  assert.equal(safeNext({}), null);
  assert.equal(safeNext(["/catalog"]), null);
  assert.doesNotThrow(() => safeNext(Symbol("x")));
});

test("a same-origin path that merely CONTAINS a scheme-like string in its query is still fine", () => {
  // the rejection is about where the PATH starts, not about banning the
  // substring "http" from ever appearing anywhere in a legitimate query string
  assert.equal(safeNext("/projects?ref=https://example.com"), "/projects?ref=https://example.com");
});
