// app/api/fees/route.js — the caller's pay-per-signed-job statement
// (lib/successFees.js, lib/feeData.js): every signed job with its fee, every
// month, this month with monitoring, and what the next signed job costs. For
// the Plan tab, a job's fee card and the invoice prompt. The caller's own
// workspace only (lib/apiCaller.js). Answers 404 while the model is off,
// which is always in a production build.
import { NextResponse } from "next/server";
import { caller } from "../../../lib/apiCaller.js";
import { successFeesOn } from "../../../lib/successFees.js";
import { companyFees } from "../../../lib/feeData.js";
import { FREE_SYSTEMS, EUR_PER_SYSTEM } from "../../../lib/monitoringPricing.js";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!successFeesOn()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await companyFees(me.companyId);
    return NextResponse.json({ ...data, monitoringRules: { freeSystems: FREE_SYSTEMS, eurPerSystem: EUR_PER_SYSTEM } }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[fees]", e?.message || e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
