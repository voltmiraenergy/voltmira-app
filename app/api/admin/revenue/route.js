// app/api/admin/revenue/route.js — one month of VoltMira's revenue under the
// pay-per-signed-job model as a CSV, one row per installer, for invoicing
// (lib/feeData.js revenueMonth, lib/successFees.js revenueCsv). Platform admins
// only; 404 for anyone else and while the model is off.
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { successFeesOn, revenueCsv, periodOf } from "../../../../lib/successFees.js";
import { revenueMonth, lastMonths } from "../../../../lib/feeData.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!successFeesOn()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await currentUser();
  if (!isPlatformAdmin(user?.email)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const current = periodOf(new Date().toISOString());
  const wanted = new URL(req.url).searchParams.get("month") || "";
  const period = lastMonths(current).includes(wanted) ? wanted : current;
  const data = await revenueMonth(period);
  return new NextResponse(revenueCsv(data.rows, period), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="voltmira-revenue-${period}.csv"`,
      "cache-control": "no-store",
    },
  });
}
