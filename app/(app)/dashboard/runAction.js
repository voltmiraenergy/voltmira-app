// app/(app)/dashboard/runAction.js — one place that runs a dashboard button:
// the "to do" rows (NextMoves.jsx) and the jobs under a phase (Phases.jsx)
// carry the same action shapes as the quote's rail (lib/workflow.js), and run
// them through the same server actions the rest of the app uses. Plain links
// (link, tel) and the invoice chooser are rendered by the caller; this runs
// everything that writes.
import { setLeadStatus, createProjectFromLead, setInstallStep, setGridFile, createProposal, markProjectWon } from "../../../lib/actions.js";
import { mdDayKey } from "../../../lib/tz.js";

/**
 * @returns {Promise<{ go?: string, copied?: string }>} where to navigate, or the
 *   proposal link that was put on the clipboard
 */
export async function runAction(a) {
  switch (a.type) {
    case "lead_quote": {
      const pid = await createProjectFromLead(a.id);
      return pid ? { go: `/projects/${pid}` } : {};
    }
    case "lead_contacted":
      await setLeadStatus(a.id, "contacted");
      return {};
    case "step":
      await setInstallStep(a.projectId, a.step, a.done !== false);
      return {};
    case "grid":
      await setGridFile(a.projectId, a.clear
        ? { stage: a.stage, date: null }
        : { stage: a.stage, date: mdDayKey(Date.now()), ...(a.operator ? { operator: a.operator } : {}) });
      return {};
    case "won":
      await markProjectWon(a.projectId);
      return {};
    case "send":
    case "copy_link": {
      const code = await createProposal(a.projectId);
      const url = `${window.location.origin}/p/${code}`;
      try { await navigator.clipboard?.writeText(url); } catch { /* the link is shown either way */ }
      return { copied: url };
    }
    case "portfolio":
      return { go: `/projects/${a.projectId}#portfolio` };
    default:
      return {};
  }
}

/** The actions this module runs (the rest are links the caller renders). */
export const RUNNABLE = new Set(["lead_quote", "lead_contacted", "step", "grid", "won", "send", "copy_link", "portfolio"]);
