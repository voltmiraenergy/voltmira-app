// lib/claudeClient.js — how VoltMira's client-facing assistants call Claude
// (lib/proposalAgent.js, lib/leadAgent.js). Server-only; reads
// ANTHROPIC_API_KEY. Returns the Messages API call and its base parameters for
// lib/agentLoop.js, so the loop itself never touches the SDK.
import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-opus-5";

export const agentConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/**
 * @param {object} [o]
 * @param {string} [o.model]   defaults to claude-opus-5; per-deployment env vars override it
 * @param {string} [o.effort]  chat answers rarely need deep deliberation
 */
export function agentCall({ model = DEFAULT_MODEL, effort = "low", maxTokens = 8000, timeoutMs = 40_000 } = {}) {
  const client = new Anthropic({ timeout: timeoutMs, maxRetries: 1 });
  // Server-side refusal fallback (Opus 5 / Fable tier): a declined request is
  // re-run on the model Anthropic recommends for that category, inside the
  // same call, instead of leaving the homeowner without an answer.
  const fallbacks = /^claude-(opus-5|fable-5)/.test(model);
  const create = (p) => client.beta.messages.create(fallbacks
    ? { ...p, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }
    : p);
  const params = {
    model,
    max_tokens: maxTokens,
    // Haiku takes no effort setting.
    ...(/^claude-haiku/.test(model) ? {} : { output_config: { effort } }),
  };
  return { create, params };
}
