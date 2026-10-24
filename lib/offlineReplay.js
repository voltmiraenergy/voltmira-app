// lib/offlineReplay.js — the server actions a queued offline tick may be sent
// with (lib/offlineQueue.js), by the name it was queued under. Only
// idempotent ones belong here.
import { setInstallStep, setGridFile } from "./actions.js";
import { saveSite } from "./jobActions.js";

export const REPLAY_ACTIONS = {
  installStep: (projectId, step, done) => setInstallStep(projectId, step, done),
  gridFile: (projectId, patch) => setGridFile(projectId, patch),
  // the on-site record: merged with what the server has by then (lib/siteRecord.js), so sending it late is safe
  siteRecord: (projectId, mine, baseVersion, base) => saveSite(projectId, mine, baseVersion, base),
};
