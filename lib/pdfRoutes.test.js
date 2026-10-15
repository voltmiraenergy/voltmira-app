import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHROMIUM_ROUTES, traceKey } from "./pdfRoutes.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function routeFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...routeFiles(p));
    else if (e.name === "route.js") out.push(p);
  }
  return out;
}

test("every route that launches Chromium gets the binary bundled on Vercel", () => {
  const users = routeFiles(path.join(ROOT, "app"))
    .filter((f) => /renderProposalPdf\.js/.test(fs.readFileSync(f, "utf8")))
    .map((f) => "/" + path.relative(path.join(ROOT, "app"), path.dirname(f)).split(path.sep).join("/"));
  assert.ok(users.length >= 7);
  for (const r of users) assert.ok(CHROMIUM_ROUTES.includes(r), `${r} launches Chromium but is not in lib/pdfRoutes.mjs`);
});

test("next.config.mjs builds its trace keys from the route list", () => {
  const cfg = fs.readFileSync(path.join(ROOT, "next.config.mjs"), "utf8");
  assert.match(cfg, /from "\.\/lib\/pdfRoutes\.mjs"/);
  assert.match(cfg, /CHROMIUM_ROUTES\.map\(\(r\) => \[traceKey\(r\)/);
});

test("trace keys have no [param] segment (Turbopack matches none)", () => {
  assert.equal(traceKey("/api/proposal/[code]/pdf"), "/api/proposal/*/pdf");
  assert.equal(traceKey("/api/proposal/warm"), "/api/proposal/warm");
  for (const r of CHROMIUM_ROUTES) {
    const k = traceKey(r);
    assert.ok(!/[[\]]/.test(k), `${r} -> ${k}`);
    assert.equal(k.split("/").length, r.split("/").length);
  }
});
