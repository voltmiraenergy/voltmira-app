// lib/offlineQueue.js — ticks made with no signal: an install-checklist step,
// a grid-file stage, a step on the job rail. Each is kept on the device, in
// order, and sent when the signal comes back (app/(app)/OfflineReady.jsx, with
// the actions in lib/offlineReplay.js). Every action queued here is
// idempotent (it sets a date or a value, it never adds), so sending one twice
// does no harm. Signing out asks first while anything waits (signout.jsx), and
// clears it (lib/offline.js). Nothing here throws.

export const QUEUE_KEY = "vm-queue";
const EVENT = "vm-queue-change";

function read() {
  try { const v = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write(list) {
  try {
    if (list.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(list)); else localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch { return false; }
}

/** Keep one call for later. @returns {boolean} whether it was kept */
export function queueAction(name, args) {
  return write([...read(), { name, args, at: Date.now() }]);
}

/** How many calls wait. */
export function queuedCount() {
  return read().length;
}

/** Call `fn` on every change to the queue (this tab and others); returns the unsubscribe. */
export function onQueueChange(fn) {
  if (typeof window === "undefined") return () => {};
  const h = () => fn(queuedCount());
  const s = (e) => { if (e.key === QUEUE_KEY) h(); };
  window.addEventListener(EVENT, h);
  window.addEventListener("storage", s);
  return () => { window.removeEventListener(EVENT, h); window.removeEventListener("storage", s); };
}

/**
 * Send what waits, oldest first. A call that fails for want of a network
 * stays, with everything after it (order matters); one the server refuses is
 * dropped, since sending it again would only fail again.
 * @param {Record<string, Function>} actions  name -> the function to call
 * @param {(e:any)=>boolean} isNetworkError
 * @returns {Promise<{ sent: number, dropped: number, left: number }>}
 */
export async function flushQueue(actions, isNetworkError) {
  let list = read(), sent = 0, dropped = 0;
  while (list.length) {
    const [item, ...rest] = list;
    const fn = actions[item.name];
    if (!fn) { dropped++; list = rest; write(list); continue; }
    try {
      await fn(...(item.args || []));
      sent++;
    } catch (e) {
      if (isNetworkError(e)) break;
      dropped++;
    }
    list = rest;
    write(list);
  }
  return { sent, dropped, left: list.length };
}
