// lib/aiLimits.js — what keeps the AI features' cost in hand now that there are no plans or credits (VoltMira's one
// charge is a fee per won project, lib/jobFees.js): a cap per workspace, per minute and per day, across every AI
// route (the lead assistant, the proposal Q&A, the bill of materials, the plant study). Upstash Redis through
// lib/ratelimit.js; platform admins are not counted. Server only.
import { isRateLimited } from "./ratelimit.js";
import { isPlatformAdmin } from "./platformAdmin.js";

export const AI_PER_MINUTE = 20;
export const AI_PER_DAY = 400;

/** True when this workspace has used its AI calls for the minute or the day. */
export async function aiWorkspaceLimited(companyId, { email = "" } = {}) {
  if (!companyId || isPlatformAdmin(email)) return false;
  if (await isRateLimited(`ai:min:${companyId}`, AI_PER_MINUTE, 60_000)) return true;
  return isRateLimited(`ai:day:${companyId}`, AI_PER_DAY, 86_400_000);
}
