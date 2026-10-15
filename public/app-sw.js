/* public/app-sw.js — offline mode for installers in the field.
 *
 * An engineer on a roof or in a village with no signal still needs the quote
 * they are standing in front of. This worker keeps a copy of the app pages
 * they have opened (and, once every 12 hours, the main pages plus their most
 * recent quotes), so those open without a network. The quote engine runs in
 * the browser, so a quote still recalculates offline; edits wait on the
 * device (lib/offline.js) and save when the signal comes back.
 *
 * Deliberately careful, because an earlier installable-app attempt was pulled
 * (public/sw.js is its kill switch):
 *   - pages are ALWAYS fetched from the network first; the saved copy is only
 *     used when the network fails or takes longer than 8 seconds, so a deploy
 *     never leaves anyone on an old page while they are online;
 *   - only Next's content-hashed files (/_next/static/) are cached for good;
 *     their names change with every build, so they can never go stale;
 *   - only signed-in app pages are kept: never the client proposal (/p/), the
 *     API, sign-in, the demo or the landing page; a redirect (an expired
 *     session) is never stored;
 *   - signing out deletes everything this worker saved (lib/offline.js).
 * Registered from app/(app)/OfflineReady.jsx, in production builds only.
 */
const PAGES = "vm-pages-v1";
const STATIC = "vm-static-v1";
const OFFLINE_URL = "/offline.html";
const APP = /^\/(dashboard|leads|projects|documents|activity|catalog|settings|team|guide|studio|profile|traction)(\/|$)/;
const STATIC_RE = /^\/_next\/static\//;
const PROJECT_LINK = /href="(\/projects\/[0-9a-f-]{36})"/g;
const MAX_PAGES = 150;
const MAX_STATIC = 800;
const MAX_WARM_PROJECTS = 25;
const NET_TIMEOUT_MS = 8000;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PAGES);
    await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Anything this origin cached before (the old app's caches included).
    const keep = [PAGES, STATIC];
    for (const name of await caches.keys()) if (!keep.includes(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (STATIC_RE.test(url.pathname)) { event.respondWith(cacheFirst(req)); return; }
  if (req.mode === "navigate" && APP.test(url.pathname)) { event.respondWith(networkFirst(req, url)); return; }
  // Everything else (RSC requests, the API, /p/, sign-in) goes to the network
  // untouched. Offline, a failed in-app link makes Next fall back to a full
  // page load, which lands in networkFirst above.
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "warm" && Array.isArray(msg.urls)) event.waitUntil(warm(msg.urls));
  if (msg.type === "clear") event.waitUntil(clearAll());
});

const isHtml = (res) => (res.headers.get("content-type") || "").includes("text/html");
const keyOf = (url) => url.origin + url.pathname + url.search;

async function networkFirst(req, url) {
  const cache = await caches.open(PAGES);
  const network = fetch(req).then(async (res) => {
    if (res.ok && res.type === "basic" && !res.redirected && isHtml(res)) {
      await cache.put(keyOf(url), res.clone());
      trim(cache, MAX_PAGES);
    }
    return res;
  });
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NET_TIMEOUT_MS)),
    ]);
  } catch {
    const hit = (await cache.match(keyOf(url))) || (await cache.match(keyOf(url), { ignoreSearch: true }));
    if (hit) return hit;
    // A slow network that does answer beats the offline page.
    try { return await network; } catch { /* truly offline */ }
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") {
    cache.put(req, res.clone()).then(() => trim(cache, MAX_STATIC));
  }
  return res;
}

// Save these pages, and the scripts and styles each one needs, while there is
// a signal. The projects list also brings its most recent quotes.
async function warm(urls) {
  const pages = await caches.open(PAGES);
  const queue = urls.slice(0, 20);
  const seen = new Set();
  let projects = 0;
  while (queue.length) {
    const url = new URL(queue.shift(), self.location.origin);
    if (url.origin !== self.location.origin || !APP.test(url.pathname) || seen.has(url.pathname)) continue;
    seen.add(url.pathname);
    let res;
    try {
      res = await fetch(url.href, { credentials: "same-origin", headers: { accept: "text/html" } });
    } catch { return; } // the signal went: stop quietly
    if (!res.ok || res.redirected || !isHtml(res)) continue;
    const html = await res.clone().text();
    await pages.put(keyOf(url), res);
    await cacheAssets(html);
    if (url.pathname === "/projects") {
      for (const m of html.matchAll(PROJECT_LINK)) {
        if (projects >= MAX_WARM_PROJECTS) break;
        if (!seen.has(m[1]) && !queue.includes(m[1])) { queue.push(m[1]); projects++; }
      }
    }
  }
  trim(pages, MAX_PAGES);
}

async function cacheAssets(html) {
  const cache = await caches.open(STATIC);
  const paths = new Set(html.match(/\/_next\/static\/[^"'\s)\\<>]+/g) || []);
  for (const path of paths) {
    if (await cache.match(path, { ignoreSearch: true })) continue;
    try {
      const res = await fetch(path);
      if (res.ok) await cache.put(path, res);
    } catch { return; }
  }
  trim(cache, MAX_STATIC);
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) {
    if (keys[i].url.endsWith(OFFLINE_URL)) continue;
    await cache.delete(keys[i]);
  }
}

// Signing out: nothing of this workspace stays on the device, only the
// "no signal" page.
async function clearAll() {
  for (const name of await caches.keys()) await caches.delete(name);
  try { await (await caches.open(PAGES)).add(new Request(OFFLINE_URL, { cache: "reload" })); } catch { /* offline */ }
}
