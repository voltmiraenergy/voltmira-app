// app/api/portfolios/[id]/teaser/route.js — the investor teaser as a PDF: two
// pages for a first contact with a fund. Same renderer, same rules as the
// report: headless Chromium renders /portfolios/[id]/teaser?pdf=1 with the
// CALLER's own session cookies, so it can never show more than they may see.
// Listed in lib/pdfRoutes.mjs so the Chromium binary is bundled with it.
import { NextResponse } from "next/server";
import { renderPdf } from "../../../../../lib/renderProposalPdf.js";
import { authorizePortfolio, authCookies, reportUrl, safeName, askedCurrency } from "../../../../../lib/portfolioRoute.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, props) {
  const { id } = await props.params;
  const auth = await authorizePortfolio(req, id, { limitKey: "pfteaser" });
  if (auth instanceof NextResponse) return auth;
  const cur = askedCurrency(req);
  const url = reportUrl(req, id, auth.lang, cur, "teaser");
  try {
    const { pdf, timings } = await renderPdf(url, { cookies: authCookies(req), ready: "article.rp-teaser" });
    return new NextResponse(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${safeName(auth.d.portfolio.name)}-investor-teaser.pdf"`,
        "cache-control": "private, max-age=0, must-revalidate",
        "server-timing": Object.entries(timings).map(([k, v]) => `${k};dur=${v}`).join(", "),
      },
    });
  } catch (e) {
    console.error("[portfolio-teaser] failed:", e?.message || e);
    // like the report: open the printable page instead of answering raw JSON
    return NextResponse.redirect(`${url.replace("pdf=1&", "")}&fallback=1`, 303);
  }
}
