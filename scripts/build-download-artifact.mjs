// scripts/build-download-artifact.mjs — turns voltmira-full-source.txt into
// a standalone HTML page (base64-embedded) that offers it as a download via
// the Artifact `downloads` capability. Run after export-for-review.mjs.
import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, extname } from "path";

const ROOT = process.cwd();
const SRC_TXT = join(ROOT, "voltmira-full-source.txt");
const OUT_HTML = process.argv[2] || join(ROOT, "voltmira-source-download.html");

const text = readFileSync(SRC_TXT, "utf-8");
const bytes = Buffer.byteLength(text, "utf-8");
const b64 = Buffer.from(text, "utf-8").toString("base64");

// Real per-extension counts, for an honest content detail on the page.
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", ".claude", "voltmira-studio", "studio-package"]);
const counts = {};
let fileCount = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (name === "package-lock.json") continue;
    const ext = extname(name);
    if (![".js", ".jsx", ".ts", ".tsx", ".mjs", ".css", ".sql", ".json", ".md"].includes(ext)) continue;
    counts[ext] = (counts[ext] || 0) + 1;
    fileCount++;
  }
}
walk(ROOT);
const extRows = Object.entries(counts).sort((a, b) => b[1] - a[1])
  .map(([ext, n]) => `<div class="ext-row"><span class="ext-name">${ext}</span><span class="ext-bar"><span style="width:${Math.round((n / fileCount) * 100)}%"></span></span><span class="ext-n">${n}</span></div>`)
  .join("\n");

const mb = (bytes / 1024 / 1024).toFixed(2);

const html = `<title>VoltMira Codebase</title>
<style>
:root{
  --bg:#0D1117; --panel:#111823; --panel-2:#161B22; --border:#242C38;
  --ink:#E6EDF3; --muted:#8B949E; --accent:#3FB950; --accent-dim:#2EA043;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    --bg:#F6F8FA; --panel:#FFFFFF; --panel-2:#F0F3F6; --border:#D0D7DE;
    --ink:#1F2328; --muted:#59636E; --accent:#1A7F37; --accent-dim:#116329;
  }
}
:root[data-theme="light"]{
  --bg:#F6F8FA; --panel:#FFFFFF; --panel-2:#F0F3F6; --border:#D0D7DE;
  --ink:#1F2328; --muted:#59636E; --accent:#1A7F37; --accent-dim:#116329;
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;
  margin:0;padding-inline:16px;padding-block:48px;display:flex;justify-content:center;min-height:100%}
.wrap{width:100%;max-width:560px}
.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 10px;font-weight:600}
h1{font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;font-size:28px;font-weight:600;
  letter-spacing:-.01em;margin:0 0 8px;text-wrap:balance}
.sub{color:var(--muted);font-size:14px;line-height:1.6;margin:0 0 28px;max-width:52ch}
.card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:16px}
.stats{display:flex;gap:0;border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px}
.stat{flex:1;padding:16px;text-align:center;border-right:1px solid var(--border)}
.stat:last-child{border-right:none}
.stat b{display:block;font-size:22px;font-variant-numeric:tabular-nums;color:var(--ink)}
.stat span{display:block;font-size:11px;color:var(--muted);margin-top:4px;letter-spacing:.02em}
.exts{margin:0 0 20px;display:flex;flex-direction:column;gap:6px}
.ext-row{display:grid;grid-template-columns:52px 1fr 28px;align-items:center;gap:10px;font-size:12px}
.ext-name{color:var(--muted)}
.ext-bar{height:6px;background:var(--panel-2);border-radius:99px;overflow:hidden}
.ext-bar span{display:block;height:100%;background:var(--accent);border-radius:99px}
.ext-n{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
button.dl{width:100%;font-family:inherit;font-size:15px;font-weight:600;color:#04150A;background:var(--accent);
  border:none;border-radius:10px;padding:15px;cursor:pointer;transition:background .15s;display:flex;
  align-items:center;justify-content:center;gap:8px}
button.dl:hover{background:var(--accent-dim)}
button.dl:disabled{opacity:.6;cursor:default}
.status{font-size:12.5px;color:var(--muted);margin-top:12px;text-align:center;min-height:16px}
.excl{font-size:12px;color:var(--muted);line-height:1.7;margin:0}
.excl code{background:var(--panel-2);border:1px solid var(--border);border-radius:5px;padding:1px 6px;font-size:11.5px}
.footline{font-size:11px;color:var(--muted);text-align:center;margin-top:22px;line-height:1.6}
</style>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">

<div class="wrap">
  <p class="eyebrow">Source export</p>
  <h1>VoltMira Codebase</h1>
  <p class="sub">Every real source file in the repo, concatenated into one plain-text file with a path header before each one — ready to hand to another AI for review.</p>

  <div class="stats">
    <div class="stat"><b>${fileCount}</b><span>FILES</span></div>
    <div class="stat"><b>${mb} MB</b><span>SIZE</span></div>
    <div class="stat"><b>.txt</b><span>FORMAT</span></div>
  </div>

  <div class="card">
    <div class="exts">
${extRows}
    </div>
    <button class="dl" id="dlBtn" type="button">⬇ Download voltmira-full-source.txt</button>
    <p class="status" id="status"></p>
  </div>

  <p class="excl">Excludes <code>node_modules</code>, <code>.next</code>, <code>.git</code>, <code>.vercel</code>, <code>package-lock.json</code>, and the separate Studio preview folders. <code>app/(app)/studio/*</code> is included (it's inside the app tree) but is a demo/preview surface, not production.</p>

  <p class="footline">No secrets included — .env files were never part of this export.</p>
</div>

<script id="src-b64" type="text/plain">${b64}</script>
<script>
(function(){
  const btn = document.getElementById("dlBtn");
  const status = document.getElementById("status");
  function b64ToBlob(b64, mime){
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  btn.addEventListener("click", async function(){
    btn.disabled = true;
    status.textContent = "Preparing…";
    try {
      const downloads = await window.claude?.use?.("downloads");
      const b64 = document.getElementById("src-b64").textContent;
      const blob = b64ToBlob(b64, "text/plain");
      if (downloads) {
        const r = await downloads.save({ filename: "voltmira-full-source.txt", data: blob });
        status.textContent = r.status === "saved" ? "Saved." : "Delivered.";
      } else {
        // Fallback for a context without the downloads capability (e.g. a
        // direct browser open of the published file): a normal same-origin
        // download still works there, just not inside the sandboxed viewer.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "voltmira-full-source.txt";
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        status.textContent = "Saved.";
      }
    } catch (e) {
      status.textContent = (e && e.code === "declined") ? "Cancelled." : "Couldn't save — try again.";
    } finally {
      btn.disabled = false;
    }
  });
})();
</script>
`;

writeFileSync(OUT_HTML, html, "utf-8");
console.log(`Wrote ${OUT_HTML} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
