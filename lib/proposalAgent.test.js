// The assistant's loop against a scripted model: tools run through the
// server's handlers, their results go back paired, and every way a turn can
// end badly ends in "no answer" (the route then shows the human fallback).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runProposalAgent, systemBlocks, buildMessages, echoable, sanitizeAnswer, TOOLS, MAX_TOOL_CALLS } from "./proposalAgent.js";

/** A fake Messages API that returns scripted responses in order and records requests. */
function scripted(...responses) {
  const calls = [];
  const create = async (params) => {
    calls.push(structuredClone(params));
    const r = responses[calls.length - 1];
    if (!r) throw new Error("no more scripted responses");
    return r;
  };
  create.calls = calls;
  return create;
}
const text = (t, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "text", text: t }] });
const use = (id, name, input, extra = []) => ({ stop_reason: "tool_use", content: [...extra, { type: "tool_use", id, name, input }] });

test("a plain question is one call and a plain answer", async () => {
  const create = scripted(text("Payback is about 6.5 years in the expected case."));
  const r = await runProposalAgent({ create, params: { model: "m" }, system: [], messages: buildMessages([], "Payback?"), handlers: {} });
  assert.equal(r.answer, "Payback is about 6.5 years in the expected case.");
  assert.equal(create.calls.length, 1);
  assert.deepEqual(create.calls[0].tools.map((t) => t.name), TOOLS.map((t) => t.name));
});

test("a tool call runs the server's handler and the result goes back paired", async () => {
  const create = scripted(
    use("t1", "offer_discount", { percent: 3, reason: "Competitor quote" }),
    text("I can take 3% off: the new total is €9,700."),
  );
  const seen = [];
  const handlers = { offer_discount: async (input) => { seen.push(input); return { ok: true, pct: 3, newTotalEur: 9700 }; } };
  const r = await runProposalAgent({ create, params: {}, system: [], messages: buildMessages([], "Too expensive"), handlers });
  assert.deepEqual(seen, [{ percent: 3, reason: "Competitor quote" }]);
  assert.equal(r.answer, "I can take 3% off: the new total is €9,700.");
  const second = create.calls[1].messages;
  assert.equal(second.at(-2).role, "assistant");
  assert.deepEqual(second.at(-1), { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ ok: true, pct: 3, newTotalEur: 9700 }) }] });
  assert.equal(r.actions.length, 1);
});

test("a refused concession is reported as refused, not as an error", async () => {
  const create = scripted(use("t1", "offer_discount", { percent: 20, reason: "x" }), text("I can't go that far; I'll pass this to Ion."));
  const handlers = { offer_discount: async () => ({ ok: false, reason: "above_limit" }) };
  const r = await runProposalAgent({ create, params: {}, system: [], messages: buildMessages([], "20% off?"), handlers });
  assert.equal(r.actions[0].result.reason, "above_limit");
  assert.equal(create.calls[1].messages.at(-1).content[0].is_error, undefined);
});

test("a refusal from the model means no answer", async () => {
  const create = scripted({ stop_reason: "refusal", content: [] });
  const r = await runProposalAgent({ create, params: {}, system: [], messages: buildMessages([], "?"), handlers: {} });
  assert.deepEqual(r, { answer: null, stop: "refusal", actions: [] });
});

test("tool calls are capped per question, and the loop is bounded", async () => {
  const many = Array.from({ length: 5 }, (_, i) => use("t" + i, "escalate_to_human", { reason: "other", summary: "s" }));
  const create = scripted(...many);
  let runs = 0;
  const r = await runProposalAgent({ create, params: {}, system: [], messages: buildMessages([], "?"), handlers: { escalate_to_human: async () => { runs++; return { ok: true }; } } });
  assert.equal(runs, MAX_TOOL_CALLS);
  assert.equal(r.stop, "max_steps");
  assert.equal(r.answer, null);
});

test("an unknown tool or a throwing handler is an error result, not a crash", async () => {
  const create = scripted(use("t1", "wire_money", {}), use("t2", "offer_discount", { percent: 1, reason: "r" }), text("OK"));
  const r = await runProposalAgent({ create, params: {}, system: [], messages: buildMessages([], "?"), handlers: { offer_discount: async () => { throw new Error("db down"); } } });
  assert.equal(r.answer, "OK");
  assert.equal(create.calls[1].messages.at(-1).content[0].is_error, true);
  assert.equal(create.calls[2].messages.at(-1).content[0].is_error, true);
});

test("history from the browser becomes alternating turns; half-turns are dropped", () => {
  assert.deepEqual(buildMessages([{ q: "a", a: "b" }, { q: "c", a: "" }], "d"), [
    { role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "d" },
  ]);
});

test("the system prompt caches rules and proposal, and keeps the live state last", () => {
  const s = systemBlocks({ context: { kw: 8 }, policy: { enabled: true, maxDiscountPct: 5, allowOptions: true }, recorded: "a 3% discount" });
  assert.equal(s.length, 3);
  assert.ok(s[0].cache_control && s[1].cache_control && !s[2].cache_control);
  assert.match(s[1].text, /at most 5%/);
  assert.match(s[2].text, /3% discount/);
  assert.match(systemBlocks({ context: {}, policy: { enabled: false }, recorded: "" })[1].text, /not enabled/);
});

test("after a mid-output fallback, only text before the marker is echoed", () => {
  const content = [{ type: "thinking", thinking: "" }, { type: "text", text: "Part" }, { type: "fallback" }, { type: "tool_use", id: "x" }];
  assert.deepEqual(echoable(content), [{ type: "text", text: "Part" }, { type: "tool_use", id: "x" }]);
  const plain = [{ type: "thinking", thinking: "" }, { type: "text", text: "a" }];
  assert.equal(echoable(plain), plain);
});

test("answers are plain text and capped", () => {
  assert.equal(sanitizeAnswer("## Title\n**bold** text\u0007"), "Title\nbold text");
  assert.equal(sanitizeAnswer("x".repeat(3000)).length, 1500);
});
