// app/api/credits/route.js — the caller's credits, for the Settings plan tab
// (app/(app)/settings/CreditsPanel.jsx): the balance, the offers sent this
// month against the free 5, the recent movements, and whether credits are
// charged yet (CREDITS_PAYWALL). Read with the service role for the caller's
// own company only (lib/apiCaller.js).
import { NextResponse } from "next/server";
import { caller } from "../../../lib/apiCaller.js";
import { creditsPaywallOn, FREE_OFFERS_PER_MONTH } from "../../../lib/credits.js";
import { creditBalance, creditHistory, offersThisMonth } from "../../../lib/creditAccess.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: co } = await me.admin.from("companies").select("plan").eq("id", me.companyId).maybeSingle();
  const [balance, history, sent] = await Promise.all([creditBalance(me.companyId, me.admin), creditHistory(me.companyId, 6, me.admin), offersThisMonth(me.companyId, me.admin)]);
  return NextResponse.json({
    on: creditsPaywallOn(), plan: co?.plan || "free", balance, history, sent, freeOffers: FREE_OFFERS_PER_MONTH,
  }, { headers: { "cache-control": "no-store" } });
}
