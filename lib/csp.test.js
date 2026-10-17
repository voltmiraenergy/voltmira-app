import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildCsp, scriptHash, inlineScriptsOf, makeNonce } from "./csp.js";
import { renderLanding, landingCsp, LANGS } from "./landing.js";
import { APP_INLINE_SCRIPTS } from "./inlineScripts.js";

const directive = (csp, name) => csp.split("; ").find((d) => d.startsWith(name + " ")) || "";
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("production scripts: no 'unsafe-inline', no 'unsafe-eval'; the nonce and hashes are there", () => {
  const csp = buildCsp({ nonce: "abc", hashes: ["sha256-xyz"] });
  const script = directive(csp, "script-src");
  assert.ok(!script.includes("'unsafe-inline'"), script);
  assert.ok(!script.includes("'unsafe-eval'"), script);
  assert.ok(script.includes("'nonce-abc'") && script.includes("'sha256-xyz'"));
  assert.equal(directive(csp, "script-src-attr"), "script-src-attr 'none'");
  assert.equal(directive(csp, "object-src"), "object-src 'none'");
  assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  assert.ok(directive(buildCsp({ dev: true }), "script-src").includes("'unsafe-eval'"), "next dev needs eval");
  assert.equal(directive(buildCsp({ frameAncestors: "*" }), "frame-ancestors"), "frame-ancestors *");
});

test("a nonce is fresh, 128 bits", () => {
  const a = makeNonce(), b = makeNonce();
  assert.notEqual(a, b);
  assert.equal(Buffer.from(a, "base64").length, 16);
});

test("the Web Crypto hash matches Node's, as the browser computes it", async () => {
  const t = "document.documentElement.lang=\"ro\";";
  assert.equal(await scriptHash(t), "sha256-" + createHash("sha256").update(t).digest("base64"));
});

test("the homepage allows exactly its own inline scripts, in every language", () => {
  for (const lang of LANGS) {
    const html = renderLanding(lang);
    const csp = landingCsp(html, false);
    const script = directive(csp, "script-src");
    const inline = inlineScriptsOf(html);
    assert.ok(inline.length >= 2, `${lang}: the theme and page scripts`);
    assert.ok(!html.includes("\r"), `${lang}: served with LF only, as hashed`);
    for (const t of inline) {
      const h = "sha256-" + createHash("sha256").update(t, "utf8").digest("base64");
      assert.ok(script.includes(`'${h}'`), `${lang}: an inline script is not allowed by hash`);
    }
    assert.ok(!script.includes("'unsafe-inline'") && !script.includes("'unsafe-eval'"), script);
    assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, "")), `${lang}: an on...= handler would be blocked`);
  }
});

test("inline data blocks (JSON-LD) are not treated as scripts", () => {
  const html = '<script type="application/ld+json">{"a":1}</script><script>run()</script><script src="/x.js"></script>';
  assert.deepEqual(inlineScriptsOf(html), ["run()"]);
  assert.deepEqual(inlineScriptsOf("<script>a()\r\nb()</script>"), ["a()\nb()"], "hashed as the browser reads it");
});

test("the app writes no inline script except the hashed ones", () => {
  // Any other <script dangerouslySetInnerHTML> would be blocked in production.
  const allowed = /<script dangerouslySetInnerHTML=\{\{ __html: (NO_FLASH|htmlLangScript\(l, persist\)) \}\} \/>/;
  const files = [];
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { if (n !== "node_modules" && !n.startsWith(".")) walk(p); }
      else if (/\.(jsx|js)$/.test(n) && !/\.test\./.test(n)) files.push(p);
    }
  };
  for (const d of ["app", "components", "lib"]) walk(join(ROOT, d));
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/<script\b[^>]*dangerouslySetInnerHTML[^>]*>/g)) {
      assert.match(m[0], allowed, `${f}: an inline script the policy does not allow`);
    }
  }
  assert.equal(new Set(APP_INLINE_SCRIPTS).size, APP_INLINE_SCRIPTS.length);
});

test("the offline page has no inline script or handler, and the worker keeps its script", () => {
  const html = readFileSync(join(ROOT, "public", "offline.html"), "utf8");
  assert.deepEqual(inlineScriptsOf(html), []);
  assert.ok(!/\son[a-z]+\s*=/i.test(html));
  const sw = readFileSync(join(ROOT, "public", "app-sw.js"), "utf8");
  assert.ok(sw.includes('"/offline.js"'));
});

test("the old policy is gone from next.config: one sender per response", () => {
  const cfg = readFileSync(join(ROOT, "next.config.mjs"), "utf8");
  assert.ok(!/key: "Content-Security-Policy"/.test(cfg));
});
