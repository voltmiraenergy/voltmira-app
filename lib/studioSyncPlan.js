// lib/studioSyncPlan.js — how Studio's browser cache and its workspace copy
// (the studio_state table) are reconciled when Studio opens.
//
// Pure, so the rules are testable without a browser or a database:
//   - The workspace copy wins for any key both sides have.
//   - A key only this browser has is uploaded (data saved before Studio moved
//     to the workspace, or while offline), except when this browser's cache
//     belongs to a DIFFERENT workspace: then it is dropped, never uploaded.
//     Demo accounts and a real account can share one browser, and one
//     company's jobs must never end up in another's.
//   - The job list is merged by job id rather than replaced, so jobs created
//     on two devices before the move both survive. The workspace's version of
//     a job wins when both have it.
//   - Except for a key this browser changed and never managed to send (made
//     with no signal, then Studio was closed): this browser's copy is newer, so
//     it wins and is uploaded, and a key it removed is removed from the
//     workspace too. Edits made on a roof are never lost to an older copy.

export const SYNC_PREFIX = "voltmira_studio_";
export const JOBS_KEY = "voltmira_studio_jobs_v2";
/** Marks which workspace this browser's cache belongs to. Never synced. */
export const OWNER_KEY = "voltmira_studio__owner";
/** The keys this browser changed and has not sent yet. Never synced. */
export const DIRTY_KEY = "voltmira_studio__dirty";

// Per-person UI state, not workspace data.
const LOCAL_ONLY = new Set([
  "voltmira_studio_active_job",   // which job this person had open
  "voltmira_studio_client",       // pre-jobs single-client key, migrated once locally
]);

/** True for keys that belong in the workspace copy. */
export function isSyncedKey(key) {
  return typeof key === "string"
    && key.startsWith(SYNC_PREFIX)
    && !key.startsWith("voltmira_studio__")
    && !LOCAL_ONLY.has(key);
}

/** Union of two job lists by id; `primary`'s copy wins, its order comes first. */
export function mergeJobs(primary, secondary) {
  const a = Array.isArray(primary) ? primary : [];
  const b = Array.isArray(secondary) ? secondary : [];
  const seen = new Set(a.map((j) => j && j.id));
  return [...a, ...b.filter((j) => j && j.id && !seen.has(j.id))];
}

/**
 * @param {{key:string, value:any}[]} serverRows  what studio_state holds
 * @param {[string, any][]} localEntries          this browser's synced keys, parsed
 * @param {{ companyId: string, cacheOwner: string|null, dirty?: string[] }} who
 * @returns {{ writeLocal: [string, any][], removeLocal: string[], upload: {key:string, value:any}[], removeRemote: string[] }}
 */
export function planHydration(serverRows, localEntries, { companyId, cacheOwner, dirty = [] }) {
  const server = new Map((serverRows || []).filter((r) => isSyncedKey(r.key)).map((r) => [r.key, r.value]));
  const local = new Map((localEntries || []).filter(([k]) => isSyncedKey(k)));
  // Another workspace's cache: throw it away rather than leak it.
  const foreign = !!cacheOwner && !!companyId && cacheOwner !== companyId;

  const writeLocal = [];
  const removeLocal = [];
  const upload = [];
  const removeRemote = [];
  const unsent = new Set(foreign ? [] : (dirty || []).filter(isSyncedKey));

  for (const [k, v] of server) {
    if (unsent.has(k)) {
      // this browser's unsent change is the newer one
      if (!local.has(k)) { removeRemote.push(k); continue; }
      const mine = k === JOBS_KEY ? mergeJobs(local.get(k), v) : local.get(k);
      if (k === JOBS_KEY) writeLocal.push([k, mine]);
      upload.push({ key: k, value: mine });
      continue;
    }
    if (k === JOBS_KEY && !foreign && local.has(k)) {
      const merged = mergeJobs(v, local.get(k));
      writeLocal.push([k, merged]);
      if (merged.length !== (Array.isArray(v) ? v.length : 0)) upload.push({ key: k, value: merged });
    } else {
      writeLocal.push([k, v]);
    }
  }
  for (const [k, v] of local) {
    if (server.has(k)) continue;
    if (foreign) removeLocal.push(k);
    else upload.push({ key: k, value: v });
  }
  return { writeLocal, removeLocal, upload, removeRemote };
}
