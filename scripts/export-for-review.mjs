// scripts/export-for-review.mjs — bundles every real source file in the repo
// into one plain-text file, each preceded by a path header, for handing to
// an external reviewer (e.g. pasting into another AI's chat). Not part of
// the app itself; run manually, never imported.
import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, relative, extname } from "path";

const ROOT = process.cwd();
const OUT = join(ROOT, "voltmira-full-source.txt");

const EXCLUDE_DIRS = new Set([
  "node_modules", ".next", ".git", ".vercel", ".claude",
  "voltmira-studio", "studio-package",
]);
const EXCLUDE_FILES = new Set([
  "package-lock.json", "voltmira-full-source.txt",
]);
const INCLUDE_EXT = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".css", ".sql", ".json", ".md",
]);

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (EXCLUDE_FILES.has(name)) continue;
    if (!INCLUDE_EXT.has(extname(name))) continue;
    files.push(full);
  }
}
walk(ROOT);
files.sort();

let out = `VoltMira — full real source export, generated ${new Date().toISOString()}\n`;
out += `${files.length} files. Excludes node_modules, .next, .git, .vercel, package-lock.json, and the Studio preview surfaces (voltmira-studio/, studio-package/ — app/(app)/studio/ IS included since it's inside the app tree, but is a preview/demo surface, not production).\n`;
out += "=".repeat(80) + "\n\n";

for (const f of files) {
  const rel = relative(ROOT, f).split("\\").join("/");
  let content;
  try { content = readFileSync(f, "utf-8"); } catch { continue; }
  out += `\n===== FILE: ${rel} =====\n`;
  out += content;
  if (!content.endsWith("\n")) out += "\n";
}

writeFileSync(OUT, out, "utf-8");
console.log(`Wrote ${OUT} (${files.length} files, ${(out.length / 1024 / 1024).toFixed(2)} MB)`);
