"use client";
// app/(app)/studio/studio-sync.js — Studio's data, saved to the workspace.
//
// Every Studio tool reads and writes through readJSON/writeJSON (jobs-data.js),
// which used to be localStorage and nothing else. They still read from
// localStorage (synchronous, instant), but it is now a cache of the workspace
// copy in the studio_state table (supabase/add-studio-cloud.sql):
//
//   hydrate()   runs once when Studio opens, before any tool renders: pulls the
//               workspace copy into the cache and reconciles it with whatever
//               this browser already had (lib/studioSyncPlan.js).
//   queue*()    every write/delete is sent to the workspace shortly after,
//               batched per key; a failed send is kept and retried.
//
// If the table doesn't exist yet (the migration hasn't been run), Studio keeps
// working exactly as before, browser-only, and says so.
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabase-browser.js";
import { planHydration, isSyncedKey, OWNER_KEY } from "../../../lib/studioSyncPlan.js";

// "loading" until hydrate() settles; then:
//   cloud    saved to the workspace
//   saving   a write is on its way
//   offline  the last send failed; changes are held here and retried
//   local    no workspace table yet: browser-only, as before
let mode = "loading";
const listeners = new Set();
function setMode(m) {
  if (m === mode) return;
  mode = m;
  listeners.forEach((fn) => fn(m));
}

/** React hook: the current sync mode, for the "where is this saved" line. */
export function useStudioSync() {
  const [m, setM] = useState(mode);
  useEffect(() => {
    setM(mode);
    listeners.add(setM);
    return () => listeners.delete(setM);
  }, []);
  return m;
}

const MAX_VALUE_CHARS = 1_800_000;   // mirrors the table's size check
const pending = new Map();           // key -> value, or undefined for a delete
let timer = null;
let retryMs = 4000;
let hydration = null;

const isMissingTable = (e) =>
  e?.code === "42P01" || e?.code === "PGRST205" || /studio_state|does not exist|schema cache/i.test(e?.message || "");

function localSyncedEntries() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!isSyncedKey(k)) continue;
      try { out.push([k, JSON.parse(localStorage.getItem(k))]); } catch { /* unparsable: leave it */ }
    }
  } catch { /* storage disabled */ }
  return out;
}

async function upsert(sb, rows) {
  const now = new Date().toISOString();
  const ok = rows.filter((r) => JSON.stringify(r.value ?? null).length < MAX_VALUE_CHARS);
  if (ok.length < rows.length) console.warn("studio: a value too large to save to the workspace stayed in this browser");
  if (!ok.length) return;
  const { error } = await sb.from("studio_state")
    .upsert(ok.map((r) => ({ key: r.key, value: r.value ?? null, updated_at: now })), { onConflict: "company_id,key" });
  if (error) throw error;
}

/** Pull the workspace copy into this browser. Resolves with the mode it settled on.
 *  Runs every time Studio opens, so changes made on another device show up;
 *  concurrent calls share one fetch. */
export function hydrate() {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const sb = supabaseBrowser();
      const [{ data: rows, error }, { data: co }] = await Promise.all([
        sb.from("studio_state").select("key, value"),
        sb.from("companies").select("id").maybeSingle(),
      ]);
      if (error) { setMode(isMissingTable(error) ? "local" : "offline"); return mode; }
      const companyId = co?.id || null;
      let cacheOwner = null;
      try { cacheOwner = localStorage.getItem(OWNER_KEY); } catch { /* storage disabled */ }

      const plan = planHydration(rows || [], localSyncedEntries(), { companyId, cacheOwner });
      try {
        for (const k of plan.removeLocal) localStorage.removeItem(k);
        // An edit still waiting to be sent is newer than the workspace copy.
        for (const [k, v] of plan.writeLocal) if (!pending.has(k)) localStorage.setItem(k, JSON.stringify(v));
        if (companyId) localStorage.setItem(OWNER_KEY, companyId);
      } catch { /* quota / storage disabled: the tools fall back to their defaults */ }
      if (plan.upload.length) await upsert(sb, plan.upload);
      setMode("cloud");
    } catch (e) {
      setMode(isMissingTable(e) ? "local" : "offline");
    }
    if (pending.size && mode !== "local") schedule(200);
    return mode;
  })().finally(() => { hydration = null; });
  return hydration;
}

async function flush() {
  timer = null;
  if (mode === "local" || !pending.size) { if (mode === "local") pending.clear(); return; }
  const batch = [...pending.entries()];
  pending.clear();
  setMode("saving");
  try {
    const sb = supabaseBrowser();
    const ups = batch.filter(([, v]) => v !== undefined).map(([key, value]) => ({ key, value }));
    const dels = batch.filter(([, v]) => v === undefined).map(([k]) => k);
    if (ups.length) await upsert(sb, ups);
    if (dels.length) {
      const { error } = await sb.from("studio_state").delete().in("key", dels);
      if (error) throw error;
    }
    retryMs = 4000;
    setMode(pending.size ? "saving" : "cloud");
    if (pending.size) schedule(300);
  } catch (e) {
    if (isMissingTable(e)) { setMode("local"); return; }
    // Keep what failed, unless something newer was written meanwhile.
    for (const [k, v] of batch) if (!pending.has(k)) pending.set(k, v);
    setMode("offline");
    schedule(retryMs);
    retryMs = Math.min(retryMs * 2, 60_000);
  }
}

function schedule(ms = 500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

/** A Studio value changed: send it to the workspace shortly. */
export function queueWrite(key, value) {
  if (!isSyncedKey(key) || mode === "local") return;
  pending.set(key, value);
  if (mode !== "loading") schedule();
}

/** A Studio value was removed: remove it from the workspace too. */
export function queueDelete(key) {
  if (!isSyncedKey(key) || mode === "local") return;
  pending.set(key, undefined);
  if (mode !== "loading") schedule();
}

// Leaving the tab: send what's waiting now rather than in half a second.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pending.size && mode !== "local") flush();
  });
}
