/* public/sw.js — KILL SWITCH.
 *
 * The PWA/installable-app work was reverted. Nothing registers a service worker
 * any more, but browsers that loaded the site while it was live still hold a
 * registration, and a registration outlives the code that created it. This file
 * exists purely so those browsers unregister themselves on their next update
 * check, then reload once into the normal, worker-free site.
 *
 * Safe to delete this file entirely once you're confident no client still has
 * the old worker (a few weeks is plenty — browsers re-check sw.js roughly daily).
 */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Drop any caches, then remove this worker for good.
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
    await self.registration.unregister();
    // Reload open tabs so they continue un-controlled by any worker.
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      try { client.navigate(client.url); } catch { /* ignore */ }
    }
  })());
});
