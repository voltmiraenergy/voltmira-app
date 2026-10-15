// app/api/proposal/[code]/qa/route.js — the client-facing Q&A widget's
// backend on a live proposal.
//
// Two ways to answer, picked by configuration:
//   * Native (ANTHROPIC_API_KEY set): VoltMira's own assistant
//     (lib/proposalAgent.js). Works for every installer with no setup, and can
//     negotiate within the limits the installer set in Settings: a discount up
//     to their ceiling, a switch to an option they attached, or a hand-off to a
//     person. Every concession is checked here (lib/negotiation.js) and stored
//     (lib/proposalOffers.js) before the model may tell the client about it.
//   * Make.com relay (MAKE_QA_WEBHOOK_URL set, no API key): the original path,
//     answer-only, run by the installer's own Make scenario.
// With neither, the widget gets the honest "ask {who}" fallback.
//
// Either way the grounding context is assembled here from the proposal's
// FROZEN snapshot, the same figures printed on the page, and never contains
// anything the client shouldn't see (BOM purchase cost/margin, a signature).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { quote, amortizedMonthlyPayment } from "@voltmira/engine";
import { snapshotEngine } from "../../../../../lib/engineSettings.js";
import { bomHasBattery } from "../../../../../lib/quoteInput.js";
import { rateFor } from "../../../../../lib/money.js";
import { effectiveOfferCurrency } from "../../../../../lib/offerCurrency.js";
import { findWarrantyInfo } from "../../../../../lib/supplierCatalog.js";
import { t, normLang } from "../../../../../lib/i18n.js";
import { logActivity } from "../../../../../lib/activity.js";
import { escapeHtml } from "../../../../../lib/safe.js";
import { sendEmail, emailConfigured } from "../../../../../lib/email.js";
import { normalizePolicy, evaluateDiscount, evaluateOption, OFFER_VALID_DAYS } from "../../../../../lib/negotiation.js";
import { loadOffers, offerFigures, describeRecorded, recordDiscount, recordOption, recordEscalation } from "../../../../../lib/proposalOffers.js";
import { runProposalAgent, systemBlocks, buildMessages } from "../../../../../lib/proposalAgent.js";
import { agentCall, agentConfigured, DEFAULT_MODEL } from "../../../../../lib/claudeClient.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAKE_TIMEOUT_MS = 17_000;
const MAX_QUESTION_LEN = 500;
const MAX_TURN_LEN = 500;
const MAX_TURNS = 6;
const MAX_ANSWER_LEN = 1500;

// Same default as the bill reader (extract-bill), overridable per deployment.
const MODEL = process.env.PROPOSAL_QA_MODEL || DEFAULT_MODEL;
// A chat answer rarely needs deep deliberation; raise it if answers fall short.
const EFFORT = process.env.PROPOSAL_QA_EFFORT || "low";

/** Server-side trust boundary for the browser-supplied history: re-cap it
 *  regardless of what the widget sends (cost, and injection through old turns). */
function sanitizeTurns(turns) {
  if (!Array.isArray(turns)) return [];
  return turns.slice(-MAX_TURNS).map((turn) => ({
    q: String(turn?.q || "").slice(0, MAX_TURN_LEN),
    a: String(turn?.a || "").slice(0, MAX_TURN_LEN),
  }));
}

function fallbackAnswer(lang, preparedBy) {
  const who = preparedBy?.name ? preparedBy.name : t("qa_fallback_installer", lang);
  return t("qa_fallback", lang, { who });
}

const round = (n) => Math.round(Number(n) || 0);

export async function POST(req, props) {
  const params = await props.params;
  const ip = clientIp(req);
  const code = params.code;

  // ip+code stops one visitor hammering the box; code-only stops a leaked link
  // being hit from rotating IPs. Every call has a real model cost behind it.
  if (await isRateLimited(`qa:ipc:${ip}:${code}`, 8, 600_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });
  if (await isRateLimited(`qa:code:${code}`, 50, 86_400_000))
    return NextResponse.json({ error: "rate" }, { status: 429 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const question = String(body?.question || "").trim();
  if (!question || question.length > MAX_QUESTION_LEN)
    return NextResponse.json({ error: "bad_question" }, { status: 400 });
  const priorTurns = sanitizeTurns(body?.priorTurns);

  const db = supabaseAdmin();
  const { data: prop } = await db.from("proposals").select("*").eq("code", code).single();
  if (!prop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // negotiation needs add-proposal-agent.sql; read without it if absent.
  let { data: co, error: coErr } = await db.from("companies")
    .select("name, lang, currency, install_warranty_years, negotiation").eq("id", prop.company_id).single();
  if (coErr) ({ data: co } = await db.from("companies").select("name, lang, currency, install_warranty_years").eq("id", prop.company_id).single());
  const lang = normLang(co?.lang);

  let preparedBy = prop.snapshot?.preparedBy || null;
  let ownerId = null;
  if (prop.project_id) {
    const { data: proj } = await db.from("projects").select("owner_id").eq("id", prop.project_id).maybeSingle();
    ownerId = proj?.owner_id || null;
    if (!preparedBy && ownerId) {
      const { data: pf } = await db.from("profiles").select("*").eq("id", ownerId).maybeSingle();
      if (pf?.name) preparedBy = { name: pf.name, phone: pf.phone || "" };
    }
  }

  const native = agentConfigured();
  const webhookUrl = process.env.MAKE_QA_WEBHOOK_URL;
  if (!native && !webhookUrl) return NextResponse.json({ answer: fallbackAnswer(lang, preparedBy) });

  // The FROZEN quote: the same numbers already printed on this page
  // (snapshotEngine, and the BOM battery flag exactly as the page's GET sets it).
  const E = snapshotEngine(prop.snapshot.engine, co);
  const snap = { ...prop.snapshot, bomHasBattery: bomHasBattery(prop.snapshot.bom) };
  const q = quote(snap, E);
  const cost = q.e.cost;
  const financeRate = Number(E.financeRatePct);
  const financeTerm = Number(E.financeTermYears);
  const hasFinance = financeRate >= 0 && financeTerm > 0;
  const monthlyPayment = hasFinance ? amortizedMonthlyPayment(cost, financeRate, financeTerm) : null;
  // The page shows money in the OFFER's currency at the rate frozen with it.
  // The model gets those same figures, already converted: handing it euro
  // amounts labelled "MDL" made it quote euro numbers as lei.
  const cur = effectiveOfferCurrency(snap.offerCurrency, co?.currency, snap.market);
  const fxRate = rateFor(cur, E.fx);
  const inCur = (eur) => (eur == null ? null : Math.round((Number(eur) || 0) * fxRate));

  // Real BOM lines only. NEVER unit_price/cost_price: the installer's purchase
  // cost and margin must not reach the client on any surface.
  const bom = (Array.isArray(snap.bom) ? snap.bom : [])
    .filter((l) => (Number(l.qty) || 0) > 0)
    .map((l) => {
      const w = findWarrantyInfo(l.brand, l.model);
      return {
        kind: l.kind, brand: l.brand, model: l.model, spec: l.spec, qty: Number(l.qty),
        warrantyYears: w?.warrantyYears ?? null, warrantyNote: w?.warrantyNote ?? null, productUrl: w?.productUrl ?? null,
      };
    });

  // The alternatives the installer attached, priced the way the page prices them
  // and numbered the way the page labels them: the recommended system is
  // option 1, the alternatives "Option 2" and "Option 3".
  const options = (Array.isArray(snap.options) ? snap.options : []).slice(0, 3)
    .filter((o) => Number(o?.kw) > 0)
    .map((o, i) => {
      const kw = Number(o.kw), battKwh = Math.max(0, Number(o.battKwh) || 0);
      const oq = quote({ ...snap, kw, batt: battKwh > 0, battKwh }, E).e;
      return { number: i + 2, label: String(o.label || "").slice(0, 40), kw, batteryKwh: battKwh,
        priceEur: round(oq.cost), contractValueEur: round(oq.grossCost), year1SavingsEur: round(oq.year1), paybackYears: oq.payback };
    });
  // what the model reads: the page's own currency, no euro figures to misread
  const optionShown = (o) => ({ number: o.number, label: o.label, kw: o.kw, batteryKwh: o.batteryKwh,
    price: inCur(o.priceEur), contractValue: inCur(o.contractValueEur), year1Savings: inCur(o.year1SavingsEur), paybackYears: o.paybackYears });

  const context = {
    companyName: co?.name || "",
    preparedBy: preparedBy ? { name: preparedBy.name, phone: preparedBy.phone || "" } : null,
    installWarrantyYears: co?.install_warranty_years || null,
    lang,
    alreadyAccepted: !!prop.accepted_at,
    proposalSentOn: String(prop.created_at || "").slice(0, 10),
    system: {
      kw: Number(snap.kw) || 0,
      hasBattery: !!snap.batt,
      batteryKwh: snap.batt ? (Number(snap.battKwh) || 10) : 0,
    },
    money: {
      currency: cur,
      note: `Every amount in this proposal is in ${cur}, exactly as the page shows it.`,
      totalCost: inCur(cost),
      contractValue: inCur(q.e.grossCost),
      year1Savings: inCur(q.e.year1),
      hasFinance, financeRatePct: hasFinance ? financeRate : null,
      financeTermYears: hasFinance ? financeTerm : null,
      monthlyPayment: inCur(monthlyPayment),
    },
    scenarios: {
      pessimistic: { paybackYears: q.p.payback, roiPct: q.p.roi },
      expected: { paybackYears: q.e.payback, roiPct: q.e.roi },
      optimistic: { paybackYears: q.o.payback, roiPct: q.o.roi },
      horizonYears: q.e.horizon,
    },
    assumptions: {
      yieldPerKwp: snap.yieldOverride || E.baseYield,
      opexPct: E.opexPct, degradationBands: E.bands, inflationBands: E.bands,
    },
    options: options.map(optionShown),
    bom,
  };

  if (native) {
    try {
      return NextResponse.json(await answerNatively({ db, prop, co, lang, preparedBy, ownerId, q, options, context, question, priorTurns, cur, inCur, optionShown }));
    } catch (err) {
      console.error("qa assistant failed", err?.status || "", err?.message);
      return NextResponse.json({ answer: fallbackAnswer(lang, preparedBy) });
    }
  }
  return NextResponse.json(await answerViaMake({ webhookUrl, question, context, priorTurns, lang, preparedBy }));
}

/* ------------------------------------------------------------ native ---- */
async function answerNatively({ db, prop, co, lang, preparedBy, ownerId, q, options, context, question, priorTurns, cur, inCur, optionShown }) {
  const code = prop.code;
  const state = await loadOffers(db, code);
  // Nothing may be agreed that can't be recorded, and nothing after signing.
  const base = normalizePolicy(co?.negotiation);
  const policy = state.available && !prop.accepted_at ? base : { ...base, enabled: false, allowOptions: false };
  const money = { grossEur: q.e.grossCost, costEur: q.e.cost };
  const current = () => (state.discount ? offerFigures(money, state.discount) : null);

  const recordedLine = () => {
    const d = current();
    const line = describeRecorded(state, options);
    return d ? `${line}. With it the client pays ${inCur(d.costEur)} ${cur} (contract value ${inCur(d.grossEur)} ${cur})` : line;
  };

  const { data: proj } = prop.project_id
    ? await db.from("projects").select("title, client_name").eq("id", prop.project_id).maybeSingle()
    : { data: null };
  const who = proj?.client_name || proj?.title || code;
  const link = prop.project_id ? `/projects/${prop.project_id}` : "";

  const handlers = {
    async offer_discount({ percent, reason }) {
      if (await isRateLimited(`qa:offer:${code}`, 5, 86_400_000)) return { ok: false, reason: "too_many_offers" };
      const r = evaluateDiscount({ policy, requestedPct: percent, totalEur: q.e.grossCost, currentPct: Number(state.discount?.pct) || 0 });
      if (!r.ok) return r;
      const fig = offerFigures(money, { pct: r.pct });
      await recordDiscount(db, {
        code, companyId: prop.company_id, pct: r.pct,
        detail: { reason: String(reason || "").slice(0, 300), discountEur: fig.discountEur, priceEur: fig.costEur, contractValueEur: fig.grossEur },
      });
      state.discount = { pct: r.pct, created_at: new Date().toISOString() };
      await logActivity(db, {
        companyId: prop.company_id, kind: "proposal", key: "act_ai_discount",
        params: { b: who, n: r.pct },
        text: `The proposal assistant offered <b>${escapeHtml(who)}</b> a ${r.pct}% discount`,
        link,
      });
      return { ok: true, percent: r.pct, currency: cur, discount: inCur(fig.discountEur), newPrice: inCur(fig.costEur), newContractValue: inCur(fig.grossEur),
        validDays: OFFER_VALID_DAYS, appliesWhen: "the client accepts the proposal on this page" };
    },

    async select_option({ option_number }) {
      const r = evaluateOption({ policy, index: Number(option_number) - 2, options });
      if (!r.ok) return r;
      const o = r.option;
      await recordOption(db, { code, companyId: prop.company_id, optionNo: o.number, detail: { label: o.label, kw: o.kw, batteryKwh: o.batteryKwh, priceEur: o.priceEur } });
      state.option = { option_no: o.number };
      await logActivity(db, {
        companyId: prop.company_id, kind: "proposal", key: "act_ai_option",
        params: { b: who, n: o.label || o.number },
        text: `<b>${escapeHtml(who)}</b> chose option ${escapeHtml(o.label || String(o.number))} through the proposal assistant`,
        link,
      });
      return { ok: true, option: { ...optionShown(o), currency: cur }, appliesWhen: "the client accepts the proposal on this page" };
    },

    async escalate_to_human({ reason, summary }) {
      if (await isRateLimited(`qa:esc:${code}`, 3, 86_400_000)) return { ok: true, alreadyPassedOn: true };
      const text = String(summary || "").slice(0, 400);
      await db.from("leads").insert({
        company_id: prop.company_id, project_id: prop.project_id,
        name: (proj?.client_name || "Client via proposal").slice(0, 120),
        note: `Proposal assistant: ${text}`, hot: true, source: "proposal",
      });
      await recordEscalation(db, { code, companyId: prop.company_id, detail: { reason, summary: text } });
      await logActivity(db, {
        companyId: prop.company_id, kind: "lead", key: "act_ai_escalated",
        params: { b: who, title: text.slice(0, 160) },
        text: `<b>${escapeHtml(who)}</b> needs a person on their proposal: ${escapeHtml(text.slice(0, 160))}`,
        link,
      });
      await notifyOwner(db, { companyId: prop.company_id, ownerId, who, summary: text, link });
      return { ok: true, personName: preparedBy?.name || null };
    },
  };

  const { create, params } = agentCall({ model: MODEL, effort: EFFORT });
  const result = await runProposalAgent({
    create,
    params,
    system: systemBlocks({ context, policy, recorded: recordedLine() }),
    messages: buildMessages(priorTurns, question),
    handlers,
  });

  const d = current();
  return {
    answer: result.answer || fallbackAnswer(lang, preparedBy),
    // What's on record now, so the page can show an agreed price without a reload.
    offer: d ? { pct: d.pct, priceEur: d.costEur, discountEur: d.discountEur } : null,
    option: state.option ? { number: state.option.option_no } : null,
  };
}

/** Tell the person who prepared the quote (else the owner) that a client needs them. */
async function notifyOwner(db, { companyId, ownerId, who, summary, link }) {
  try {
    if (!emailConfigured()) return;
    let to = null;
    if (ownerId) {
      const { data } = await db.from("profiles").select("email").eq("id", ownerId).maybeSingle();
      to = data?.email || null;
    }
    if (!to) {
      const { data } = await db.from("profiles").select("email").eq("company_id", companyId).eq("role", "owner").limit(1).maybeSingle();
      to = data?.email || null;
    }
    if (!to) return;
    const url = (process.env.NEXT_PUBLIC_APP_URL || "") + link;
    await sendEmail({
      to,
      subject: `${who} needs a person on their proposal`,
      html: `<p><b>${escapeHtml(who)}</b> asked the proposal assistant for something it can't agree to on its own:</p>`
        + `<blockquote>${escapeHtml(summary)}</blockquote>`
        + (link ? `<p><a href="${escapeHtml(url)}">Open the quote</a></p>` : ""),
    });
  } catch (err) {
    console.error("qa escalation email failed", err?.message);
  }
}

/* -------------------------------------------------------------- make ---- */
async function answerViaMake({ webhookUrl, question, context, priorTurns, lang, preparedBy }) {
  const automationKey = process.env.AUTOMATION_API_KEY;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAKE_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(automationKey ? { "X-VoltMira-Key": automationKey } : {}) },
      body: JSON.stringify({ question, context, priorTurns }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`make_${res.status}`);
    const data = await res.json().catch(() => null);
    let answer = typeof data?.answer === "string" ? data.answer : null;
    if (!answer) throw new Error("bad_shape");
    // Never trust a third-party response's shape or length before it reaches a client.
    // eslint-disable-next-line no-control-regex
    answer = answer.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").slice(0, MAX_ANSWER_LEN).trim();
    if (!answer) throw new Error("empty_after_sanitize");
    return { answer };
  } catch (err) {
    console.error("qa webhook failed", err?.message);
    return { answer: fallbackAnswer(lang, preparedBy) };
  } finally {
    clearTimeout(timer);
  }
}
