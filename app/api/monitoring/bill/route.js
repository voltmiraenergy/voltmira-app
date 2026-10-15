// app/api/monitoring/bill/route.js — the caller's monitoring bill, for the
// Settings page: how many systems the workspace monitors now and what that
// is a month (lib/monitoringPricing.js). Read with the service role for the
// caller's own company only (lib/apiCaller.js); no inverter tables yet means
// no systems.
import { NextResponse } from "next/server";
import { caller } from "../../../../lib/apiCaller.js";
import { monitoredCount, monitoringBill, monitoringBilled, FREE_SYSTEMS, EUR_PER_SYSTEM } from "../../../../lib/monitoringPricing.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await caller();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await me.admin.from("inverter_stations").select("last_month").eq("company_id", me.companyId);
  const stations = error ? [] : data || [];
  return NextResponse.json({
    ...monitoringBill(monitoredCount(stations)), connected: stations.length,
    billed: monitoringBilled(), freeSystems: FREE_SYSTEMS, eurPerSystem: EUR_PER_SYSTEM,
  }, { headers: { "cache-control": "no-store" } });
}
