// lib/leadAgentRun.js — answer one homeowner message for an installer, on any
// channel (app/api/agent/chat for the website, app/api/agent/telegram for
// Telegram). Wires the lead assistant's tools to the real estimator and lead
// list, and to Claude. Server-only. Channels own the conversation storage.
import { isRateLimited } from "./ratelimit.js";
import { estimateSavings, MARKET_CFG } from "./estimateCore.js";
import { captureLead, appendLeadNote } from "./leadCapture.js";
import { leadHandlers, runLeadAgent } from "./leadAgent.js";
import { agentCall, DEFAULT_MODEL } from "./claudeClient.js";

const MODEL = process.env.LEAD_AGENT_MODEL || DEFAULT_MODEL;

/**
 * @param {object} a
 * @param {object} a.db     service-role client
 * @param {{ id, name, short_name?, default_market? }} a.co  the installer
 * @param {string} a.lang   the channel's language, for the installer's details
 * @param {{ leadId, surveyRequested }} a.state  mutated when a lead is saved or a survey requested
 * @param {object[]} a.turns  earlier turns [{ role, text }]
 * @param {string} a.text   the new message
 * @param {"website_chat"|"telegram"} a.via
 * @param {string} a.limitKey  who is asking, for the estimate rate limit
 * @returns {Promise<string|null>} the answer, or null when none could be produced
 */
export async function answerHomeowner({ db, co, lang, state, turns, text, via, limitKey }) {
  const market = co.default_market || "MD";
  const handlers = leadHandlers({
    state,
    estimate: async ({ address, bill }) => {
      // Each estimate geocodes and reads sun data; keep a chat from looping on it.
      if (await isRateLimited(`agent:est:${limitKey}`, 6, 600_000)) { const e = new Error("rate"); e.code = "rate"; throw e; }
      return estimateSavings({ address, bill, country: market, admin: db });
    },
    saveLead: (lead) => captureLead(db, { ...lead, companyId: co.id, via, channel: via === "telegram" ? "telegram" : "website" }),
    addNote: (leadId, line) => appendLeadNote(db, { companyId: co.id, leadId, line }),
  });
  const { create, params } = agentCall({ model: MODEL });
  const r = await runLeadAgent({
    create, params, state, handlers, turns, text,
    company: { name: co.short_name || co.name, market, currency: (MARKET_CFG[market] || MARKET_CFG.RO).currency, lang },
  });
  return r.answer;
}
