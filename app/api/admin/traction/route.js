// app/api/admin/traction/route.js — the traction numbers for a deck or a
// spreadsheet. Platform admins only (PLATFORM_ADMIN_EMAILS).
//   GET              -> JSON (totals, rolling 30 days, weekly series, workspaces)
//   GET ?format=csv  -> the weekly series as CSV
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/session.js";
import { isPlatformAdmin } from "../../../../lib/platformAdmin.js";
import { loadTraction } from "../../../../lib/tractionData.js";
import { tractionCsv } from "../../../../lib/traction.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const user = await currentUser();
  // 404, not 403: the route shouldn't confirm it exists to anyone else.
  if (!isPlatformAdmin(user?.email)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const weeks = Math.min(104, Math.max(4, Number(new URL(req.url).searchParams.get("weeks")) || 12));
  const data = await loadTraction({ weeks });
  if (new URL(req.url).searchParams.get("format") === "csv") {
    return new NextResponse(tractionCsv(data.series), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="voltmira-traction-${data.series.at(-1)?.week || "latest"}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
