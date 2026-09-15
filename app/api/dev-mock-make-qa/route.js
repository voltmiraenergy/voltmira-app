// app/api/dev-mock-make-qa/route.js — TEMPORARY local stand-in for the real
// Make.com webhook (docs/MAKE_AUTOMATIONS.md), so the Q&A flow can be seen
// working end-to-end without a real Make.com account or LLM key. This is a
// crude keyword-match, not an AI — it exists purely to demonstrate that the
// REAL grounding context (warranty, payback, financing, etc.) reaches this
// point correctly. Safe to delete once you've built the real Make.com
// scenario; it changes nothing else in the app and isn't linked from
// anywhere except whatever MAKE_QA_WEBHOOK_URL you point at it.
import { NextResponse } from "next/server";

export async function POST(req) {
  const { question, context } = await req.json().catch(() => ({}));
  const q = String(question || "").toLowerCase();
  const bom = Array.isArray(context?.bom) ? context.bom : [];
  let answer;

  if (q.includes("warrant")) {
    const withWarranty = bom.filter((l) => l.warrantyYears);
    answer = withWarranty.length
      ? withWarranty.map((l) => `${l.brand} ${l.model}: ${l.warrantyYears} years${l.warrantyNote ? " (" + l.warrantyNote + ")" : ""}.`).join(" ")
      : "None of the listed equipment has a verified warranty term on file — ask your installer directly.";
  } else if (q.includes("optimist") || q.includes("pessimist") || q.includes("scenario")) {
    const s = context?.scenarios;
    answer = s
      ? `Pessimistic: ${s.pessimistic.paybackYears} yr payback (${Math.round(s.pessimistic.roiPct)}% ROI). Expected: ${s.expected.paybackYears} yr (${Math.round(s.expected.roiPct)}%). Optimistic: ${s.optimistic.paybackYears} yr (${Math.round(s.optimistic.roiPct)}%) — the difference comes from how fast electricity prices actually rise over ${s.horizonYears} years.`
      : "I don't have scenario data for this proposal.";
  } else if (q.includes("month") || q.includes("financ") || q.includes("pay")) {
    const m = context?.money;
    answer = m?.hasFinance
      ? `At ${m.financeRatePct}% over ${m.financeTermYears} years, the estimated monthly payment is about ${m.monthlyPayment?.toFixed(0)} ${m.currency}. Total system cost is ${m.totalCost} ${m.currency}.`
      : `This proposal doesn't have financing terms set — the total cost is ${m?.totalCost} ${m?.currency}.`;
  } else if (q.includes("battery") || q.includes("backup")) {
    answer = context?.system?.hasBattery
      ? `Yes — this system includes a ${context.system.batteryKwh} kWh battery.`
      : "This particular system doesn't include a battery.";
  } else {
    answer = `(Mock answer — a real Make.com scenario would ground this in the full context.) For a ${context?.system?.kw ?? "?"} kW system, year-1 savings are about ${context?.money?.year1Savings ?? "?"} ${context?.money?.currency ?? ""}, expected payback is ${context?.scenarios?.expected?.paybackYears ?? "?"} years. Ask about warranty, financing, or the scenarios for more specific answers.`;
  }

  return NextResponse.json({ answer });
}
