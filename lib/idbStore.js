// lib/idbStore.js — a small key-value store in the browser's IndexedDB, for
// what is too big for localStorage's few megabytes: Studio's site photos
// (app/(app)/studio/photos.js). Every call resolves, never throws: with no
// IndexedDB (a private window on some browsers) a read gives null and a write
// gives false, and the caller keeps working without the device copy.

const DB = "voltmira", STORE = "kv";
let opening = null;

function db() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!opening) {
    opening = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return opening;
}

function run(mode, fn) {
  return db().then((d) => new Promise((resolve) => {
    if (!d) { resolve(undefined); return; }
    try {
      const tx = d.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : true);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  }));
}

/** The value under `key`, or null. */
export async function idbGet(key) {
  const v = await run("readonly", (s) => s.get(key));
  return v === undefined ? null : v;
}

/** Store `value` under `key`. @returns {Promise<boolean>} */
export async function idbSet(key, value) {
  return (await run("readwrite", (s) => { s.put(value, key); return null; })) === true;
}

export async function idbDel(key) {
  return (await run("readwrite", (s) => { s.delete(key); return null; })) === true;
}

/** Every [key, value] whose key starts with `prefix`. */
export async function idbEntries(prefix) {
  const keys = (await run("readonly", (s) => s.getAllKeys())) || [];
  const out = [];
  for (const k of keys) if (typeof k === "string" && k.startsWith(prefix)) out.push([k, await idbGet(k)]);
  return out;
}

/** Sign-out: everything this store holds. */
export async function idbClear() {
  return (await run("readwrite", (s) => { s.clear(); return null; })) === true;
}
