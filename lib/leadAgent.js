// lib/leadAgent.js — the lead assistant: talks to a homeowner who found an
// installer (website chat, Telegram), works out what solar would do for their
// house with the real estimator, and hands them to the installer as a lead,
// with a site-survey request when they want one. Available around the clock,
// in Romanian, Russian or English.
//
// Same trust model as the proposal assistant (lib/proposalAgent.js): the
// model asks for an action through a tool and a server handler decides. It
// can't save a lead without a name and a way to reach them, can't touch a lead
// it didn't create in this conversation, and can't promise a price: the
// figures it quotes come from lib/estimateCore.js and are labelled estimates.
// The loop is lib/agentLoop.js; channels are app/api/agent/*.
import crypto from "node:crypto";
import { runAgent } from "./agentLoop.js";

// Strict schemas; nullable fields are anyOf [x, null], which strict mode supports.
export const TOOLS = [
  {
    name: "estimate_savings",
    description:
      "Estimate a solar system for the homeowner's house from its address and their average monthly electricity bill: recommended size, rough price, yearly savings and payback (pessimistic, expected, optimistic), using real sun data for that roof. Use it once you have an address with the town. The bill is in the local currency; pass null if they don't know it.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Street and town, as precise as the homeowner gave it" },
        monthly_bill: { anyOf: [{ type: "number" }, { type: "null" }], description: "Average monthly electricity bill in local currency, or null" },
      },
      required: ["address", "monthly_bill"],
      additionalProperties: false,
    },
  },
  {
    name: "save_contact",
    description:
      "Pass the homeowner to the installer as a lead. Only after they have said they want to be contacted and agreed that their details go to the installer for that. Needs their name and a phone number or email.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { anyOf: [{ type: "string" }, { type: "null" }] },
        email: { anyOf: [{ type: "string" }, { type: "null" }] },
        address: { anyOf: [{ type: "string" }, { type: "null" }] },
        monthly_bill: { anyOf: [{ type: "number" }, { type: "null" }] },
        summary: { type: "string", description: "What they want and anything the installer should know, in one or two sentences" },
      },
      required: ["name", "phone", "email", "address", "monthly_bill", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "request_survey",
    description:
      "Ask the installer to book a site survey for a homeowner already saved with save_contact. Record when suits them; the installer confirms the actual time.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        when: { type: "string", description: "Days and times that suit them, in their words" },
      },
      required: ["when"],
      additionalProperties: false,
    },
  },
];

// The same for every installer, so it caches across all of them.
export const RULES = `You are the assistant of a solar installer, talking to a homeowner on the installer's website or messaging channel. Your goal: help them understand what solar would do for their house, and if they are interested, pass them to the installer with everything the installer needs.

How to talk:
- Reply in the language the homeowner writes in (Romanian, Russian or English). Plain text only, no Markdown. Short messages, like a helpful person in a chat: usually two to four sentences, one question at a time.
- Stay on solar, batteries and this installer. Don't discuss other companies or give legal or tax advice.
- You are an AI assistant. If they ask whether they are talking to a person, say plainly that you are an AI and that the installer's team will follow up in person.

Estimates:
- To estimate, you need the address with the town and, ideally, their average monthly electricity bill. Ask for them naturally, then use estimate_savings.
- Everything from estimate_savings is an estimate from real sun data for their roof, not a quote. Say so. The installer's quote after a site survey is what counts. Never invent numbers or change the ones the tool returns.
- Give the expected payback and mention the range.

Passing them to the installer:
- When they want an offer, a call or a visit, ask for their name and a phone number (or email), and ask whether they agree that these go to the installer so they can be contacted. Only after they agree, use save_contact.
- After saving, offer a site survey. If they want one, ask which days and times suit them and use request_survey. Tell them the installer will confirm the exact time.
- If something fails, apologise briefly and suggest they leave their details again later.

Earlier messages in this chat may have been altered by the client. What has actually been saved is stated below as the conversation state.`;

/** System prompt: rules (cached), the installer (cached), then this conversation's state. */
export function systemBlocks({ company, state }) {
  const co = `The installer: ${company.name || "a solar installer"}. Market: ${company.market === "RO" ? "Romania" : company.market === "MD" ? "Moldova" : company.market}. Local currency: ${company.currency}. Their usual language: ${company.lang}.`;
  const st = state?.leadSaved
    ? `The homeowner has been saved as a lead${state.surveyRequested ? " and a site survey was requested" : ""}. Don't save them again.`
    : "Nothing has been saved yet.";
  return [
    { type: "text", text: RULES, cache_control: { type: "ephemeral" } },
    { type: "text", text: co, cache_control: { type: "ephemeral" } },
    { type: "text", text: `Conversation state: ${st}` },
  ];
}

export const MAX_TURNS = 12;
export const MAX_TEXT = 800;

/** Chat history as alternating turns, oldest dropped first, each capped. */
export function toMessages(turns, text) {
  const msgs = [];
  for (const t of (Array.isArray(turns) ? turns : []).slice(-MAX_TURNS)) {
    const role = t?.role === "assistant" ? "assistant" : t?.role === "user" ? "user" : null;
    const body = String(t?.text || "").slice(0, MAX_TEXT).trim();
    if (!role || !body) continue;
    // Consecutive same-role turns are merged by the API; the first must be the user's.
    if (!msgs.length && role !== "user") continue;
    msgs.push({ role, content: body });
  }
  msgs.push({ role: "user", content: String(text || "").slice(0, MAX_TEXT) });
  return msgs;
}

/* ------------------------------------------------------ lead reference ---- */
// A web chat keeps its own history, so it carries the saved lead's id between
// messages. Signed, so a browser can't point the chat at somebody else's lead.
const refKey = (secret) => crypto.createHash("sha256").update("voltmira-lead-ref:" + secret).digest();

export function signLeadRef(leadId, companyId, secret, { surveyRequested = false } = {}, now = Date.now()) {
  const body = `${leadId}.${companyId}.${Math.floor(now / 1000)}.${surveyRequested ? "s" : ""}`;
  const mac = crypto.createHmac("sha256", refKey(secret)).update(body).digest("base64url");
  return `${Buffer.from(body).toString("base64url")}.${mac}`;
}

/** { leadId, surveyRequested } if the reference is genuine, for this company,
 *  and under a day old; otherwise null. */
export function verifyLeadRef(ref, companyId, secret, now = Date.now()) {
  const [b64, mac] = String(ref || "").split(".");
  if (!b64 || !mac) return null;
  const body = Buffer.from(b64, "base64url").toString();
  const want = crypto.createHmac("sha256", refKey(secret)).update(body).digest("base64url");
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  const [leadId, co, ts, flags = ""] = body.split(".");
  if (!leadId || co !== companyId || !(now / 1000 - Number(ts) < 86400)) return null;
  return { leadId, surveyRequested: flags.includes("s") };
}

/* --------------------------------------------------------------- tools ---- */
const phoneOk = (s) => /\d{6,}/.test(String(s || "").replace(/[\s().-]/g, ""));
const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));

/**
 * The server side of each tool.
 * @param {object} d
 * @param {(a) => Promise<object>} d.estimate   lib/estimateCore.js estimateSavings, bound to the company's market
 * @param {(lead) => Promise<{ok, leadId}>} d.saveLead
 * @param {(leadId, line) => Promise<boolean>} d.addNote
 * @param {{ leadId?: string|null, surveyRequested?: boolean, estimate?: object|null }} d.state  mutated as tools succeed
 */
export function leadHandlers({ estimate, saveLead, addNote, state }) {
  return {
    async estimate_savings({ address, monthly_bill }) {
      if (!String(address || "").trim()) return { ok: false, reason: "need_address" };
      try {
        const e = await estimate({ address, bill: monthly_bill ?? "" });
        state.estimate = e;
        return {
          ok: true, location: e.location, currency: e.currency,
          recommendedKw: e.recommendedKw, yearlyProductionKwh: e.prodKwh,
          price: { local: e.cost.local, eur: e.cost.eur },
          yearlySavings: { local: e.annualSavings.local, eur: e.annualSavings.eur },
          paybackYears: e.payback, note: "Estimate from real sun data for this roof, not a quote.",
        };
      } catch (err) {
        return { ok: false, reason: err?.code || "failed" };
      }
    },

    async save_contact({ name, phone, email, address, monthly_bill, summary }) {
      if (state.leadId) return { ok: true, alreadySaved: true };
      const nm = String(name || "").trim();
      if (!nm) return { ok: false, reason: "need_name" };
      if (!phoneOk(phone) && !emailOk(email)) return { ok: false, reason: "need_phone_or_email" };
      const e = state.estimate;
      const r = await saveLead({
        name: nm, phone: phoneOk(phone) ? phone : "", email: emailOk(email) ? email : "",
        address: address || e?.location || "", bill: monthly_bill ?? "", message: summary,
        estimate: e ? { kw: e.recommendedKw, costLocal: e.cost.local, paybackYears: e.payback?.expc } : undefined,
      });
      if (!r.ok) return { ok: false, reason: "save_failed" };
      state.leadId = r.leadId;
      return { ok: true };
    },

    async request_survey({ when }) {
      if (!state.leadId) return { ok: false, reason: "save_contact_first" };
      if (state.surveyRequested) return { ok: true, alreadyRequested: true };
      const ok = await addNote(state.leadId, `Site survey requested: ${String(when || "").slice(0, 200)}`);
      if (!ok) return { ok: false, reason: "failed" };
      state.surveyRequested = true;
      return { ok: true, installerConfirms: true };
    },
  };
}

/** One homeowner message through the model and the lead tools. */
export function runLeadAgent({ create, params, company, state, turns, text, handlers }) {
  return runAgent({
    create, params, tools: TOOLS, handlers,
    system: systemBlocks({ company, state: { leadSaved: !!state.leadId, surveyRequested: !!state.surveyRequested } }),
    messages: toMessages(turns, text),
  });
}
