// lib/agentLoop.js — the tool-use loop behind VoltMira's client-facing
// assistants (lib/proposalAgent.js on a proposal, lib/leadAgent.js on the
// website chat and Telegram). The model asks for an action through a tool; a
// server handler decides whether it happens. Bounded in model calls and tool
// executions, and every way a turn can end badly ends in "no answer", which
// callers turn into an honest hand-off to a person.
//
// The Messages API call is passed in (`create`), so tests can script it.

export const MAX_STEPS = 4;          // model calls per turn
export const MAX_TOOL_CALLS = 3;     // tool executions per turn
export const MAX_ANSWER_LEN = 1500;

// eslint-disable-next-line no-control-regex
export const sanitizeAnswer = (s) => String(s || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/\*\*|__|^#+\s*/gm, "").slice(0, MAX_ANSWER_LEN).trim();

/**
 * After a server-side fallback mid-output, blocks before the last `fallback`
 * marker that aren't text must not be sent back (the fallback model never
 * produced them). Otherwise the turn is echoed unchanged.
 */
export function echoable(content) {
  const last = content.map((b) => b.type).lastIndexOf("fallback");
  if (last < 0) return content;
  return [...content.slice(0, last).filter((b) => b.type === "text"), ...content.slice(last + 1)];
}

/**
 * Run one turn through the model and its tools.
 * @param {object} a
 * @param {(params: object) => Promise<object>} a.create  calls the Messages API
 * @param {object[]} a.tools  tool definitions; each needs a handler
 * @param {Record<string, (input: object) => Promise<object>>} a.handlers  one per tool name
 * @returns {Promise<{ answer: string|null, stop: string, actions: object[] }>}
 */
export async function runAgent({ create, params, system, tools, messages, handlers, maxSteps = MAX_STEPS, maxToolCalls = MAX_TOOL_CALLS }) {
  const convo = [...messages];
  const actions = [];
  let toolCalls = 0;
  for (let step = 0; step < maxSteps; step++) {
    const res = await create({ ...params, system, tools, messages: convo });
    if (res.stop_reason === "refusal") return { answer: null, stop: "refusal", actions };
    const text = sanitizeAnswer(res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"));
    const uses = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) {
      return { answer: text || null, stop: res.stop_reason || "end_turn", actions };
    }
    convo.push({ role: "assistant", content: echoable(res.content) });
    const results = [];
    for (const u of uses) {
      let out, isError = false;
      if (++toolCalls > maxToolCalls) {
        out = { ok: false, reason: "too_many_actions" };
        isError = true;
      } else if (!handlers[u.name]) {
        out = { ok: false, reason: "unknown_tool" };
        isError = true;
      } else {
        try { out = await handlers[u.name](u.input || {}); }
        catch { out = { ok: false, reason: "failed" }; isError = true; }
      }
      actions.push({ tool: u.name, input: u.input, result: out });
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out), ...(isError ? { is_error: true } : {}) });
    }
    // Every result in one message, so parallel calls stay paired.
    convo.push({ role: "user", content: results });
  }
  return { answer: null, stop: "max_steps", actions };
}
