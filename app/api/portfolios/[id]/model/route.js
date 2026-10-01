// app/api/portfolios/[id]/model/route.js — the portfolio's financial model as an
// Excel workbook with live formulas (lib/portfolioExport.js buildWorkbook).
import { NextResponse } from "next/server";
import { buildWorkbook } from "../../../../../lib/portfolioExport.js";
import { authorizePortfolio, safeName } from "../../../../../lib/portfolioRoute.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req, props) {
  const { id } = await props.params;
  const auth = await authorizePortfolio(req, id, { limitKey: "pfxlsx", limit: 60 });
  if (auth instanceof NextResponse) return auth;
  const bytes = buildWorkbook(auth.model, auth.lang, { generatedAt: new Date().toISOString().slice(0, 10) });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${safeName(auth.d.portfolio.name)}-financial-model.xlsx"`,
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}
