// lib/offlineDrafts.js — a new quote started with no signal. The quote editor
// is drawn by the server, so with no network a quote starts as a draft on the
// device instead (app/(app)/projects/draft, a page the offline worker keeps),
// under a temporary id ("local-..."). When the signal is back the draft
// becomes a real quote (lib/draftActions.js) and the temporary id is swapped
// for the real one: the draft page then opens the real quote. Signing out asks
// first while a draft waits (signout.jsx counts them through lib/offline.js),
// then clears them. Nothing here throws.

export const DRAFT_PREFIX = "vm-draft:";
const SYNCED_PREFIX = "vm-draft-synced:";

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
// the "changes waiting" count (OfflineReady.jsx) listens for this
const changed = () => { try { window.dispatchEvent(new Event("vm-queue-change")); } catch { /* no window */ } };

/** A fresh draft's id: "local-" and a random part, never a real quote's uuid. */
export function newDraftId() {
  const r = (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 16);
  return `local-${r}`;
}

export const isDraftId = (id) => /^local-[a-z0-9]{8,32}$/i.test(String(id || ""));

/** Start a draft on the device; returns its id. */
export function startDraft(lang = "ro") {
  const id = newDraftId();
  write(DRAFT_PREFIX + id, { id, lang, created: new Date().toISOString(), title: "", client_name: "", client_email: "", phone: "", address: "", kw: 5, cons: "", batt_kwh: "", notes: "" });
  changed();
  return id;
}

export const readDraft = (id) => (isDraftId(id) ? read(DRAFT_PREFIX + id) : null);
export const saveDraft = (id, data) => isDraftId(id) && write(DRAFT_PREFIX + id, { ...data, id });

/** Every draft waiting on this device, oldest first. */
export function listDrafts() {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(DRAFT_PREFIX)).map((k) => read(k)).filter(Boolean)
      .sort((a, b) => String(a.created).localeCompare(String(b.created)));
  } catch { return []; }
}

/** The draft became quote `realId`: it is gone, and its id now points there. */
export function markSynced(tempId, realId) {
  try { localStorage.removeItem(DRAFT_PREFIX + tempId); } catch { /* storage blocked */ }
  write(SYNCED_PREFIX + tempId, realId);
  changed();
}

/** The real quote a synced draft became, or null. */
export const syncedId = (tempId) => read(SYNCED_PREFIX + tempId);

/** The fields a draft sends to the server: only what the quote holds, trimmed. */
export function draftPayload(d) {
  const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const num = (v, max) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null; };
  return {
    title: clip(d?.title, 120), client_name: clip(d?.client_name, 120), client_email: clip(d?.client_email, 120),
    phone: clip(d?.phone, 30).replace(/[^\d+()\s-]/g, ""), address: clip(d?.address, 300),
    kw: num(d?.kw, 5000), cons: num(d?.cons, 1e8), batt_kwh: num(d?.batt_kwh, 10000), notes: String(d?.notes ?? "").trim().slice(0, 2000),
  };
}
