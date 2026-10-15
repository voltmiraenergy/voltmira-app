// lib/offline.js — the browser side of offline mode (public/app-sw.js).
//
// Registers the worker, asks it twice a day to save the main pages and the
// most recent quotes while there is a signal, and keeps quote edits that
// could not reach the server in an outbox on the device until they can
// (app/(app)/projects/[id]/editor.jsx). Signing out clears all of it.
// Every call is best effort: offline mode is a help, never a way to break
// the app, so nothing here throws.

const SW_URL = "/app-sw.js";
const WARM_KEY = "vm-offline-warm";
const OUTBOX = "vm-outbox:";
const WARM_EVERY_MS = 12 * 3600 * 1000;
// Saved for offline use; /projects also brings its most recent quotes.
export const OFFLINE_PAGES = ["/dashboard", "/projects", "/leads", "/documents", "/catalog", "/settings", "/studio"];

/** Register the worker (production only) and, twice a day, save the main pages. */
export async function registerAppSw({ warm = true } = {}) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    if (!warm || !navigator.onLine) return;
    let last = 0;
    try { last = Number(localStorage.getItem(WARM_KEY)) || 0; } catch { /* storage blocked */ }
    if (Date.now() - last < WARM_EVERY_MS) return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "warm", urls: OFFLINE_PAGES });
    try { localStorage.setItem(WARM_KEY, String(Date.now())); } catch { /* storage blocked */ }
  } catch { /* offline mode is optional */ }
}

/** Sign-out: delete every page and file saved for offline use, and the outbox. */
export async function clearOfflineData() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    reg?.active?.postMessage({ type: "clear" });
  } catch { /* no worker */ }
  try {
    if (typeof caches !== "undefined") for (const name of await caches.keys()) await caches.delete(name);
  } catch { /* no Cache Storage */ }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(OUTBOX) || k === WARM_KEY) localStorage.removeItem(k);
  } catch { /* storage blocked */ }
}

/** Keep a quote's latest state on the device until the server takes it. */
export function saveOutbox(id, data) {
  try { localStorage.setItem(OUTBOX + id, JSON.stringify({ at: Date.now(), data })); return true; } catch { return false; }
}

/** The state waiting for this quote, as { at, data }, or null. */
export function readOutbox(id) {
  try {
    const v = JSON.parse(localStorage.getItem(OUTBOX + id) || "null");
    return v && v.data && typeof v.data === "object" ? v : null;
  } catch { return null; }
}

export function clearOutbox(id) {
  try { localStorage.removeItem(OUTBOX + id); } catch { /* storage blocked */ }
}

/** How many quotes have edits that have not reached the server yet. */
export function pendingOutbox() {
  try { return Object.keys(localStorage).filter((k) => k.startsWith(OUTBOX)).length; } catch { return 0; }
}

/** A failure because there is no network, as opposed to one the server gave. */
export function isNetworkError(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = String(err?.message || err || "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(m);
}
