// app/api/portfolios/[id]/report/route.js — the bankability report as a PDF.
// Headless Chromium renders /portfolios/[id]/report?pdf=1 with the CALLER's own
// session cookies (the page is auth-scoped and RLS-filtered), so it can never
// render more than they may see. Same renderer as the proposal and the invoice.
import { NextResponse } from "next/server";
import { renderPdf } from "../../../../../lib/renderProposalPdf.js";
import { authorizePortfolio, authCookies, reportUrl, safeName, askedCurrency } from "../../../../../lib/portfolioRoute.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, props) {
  const { id } = await props.params;
  const auth = await authorizePortfolio(req, id, { limitKey: "pfpdf" });
  if (auth instanceof NextResponse) return auth;
  const cur = askedCurrency(req);
  try {
    const { pdf, timings } = await renderPdf(reportUrl(req, id, auth.lang, cur), { cookies: authCookies(req), ready: "article.rp" });
    return new NextResponse(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${safeName(auth.d.portfolio.name)}-bankability-report.pdf"`,
        "cache-control": "private, max-age=0, must-revalidate",
        "server-timing": Object.entries(timings).map(([k, v]) => `${k};dur=${v}`).join(", "),
      },
    });
  } catch (e) {
    console.error("[portfolio-pdf] failed:", e?.message || e);
    // Never leave the caller on raw JSON: open the same report as a printable
    // page, which says the server PDF was not available and offers Print.
    return NextResponse.redirect(`${reportUrl(req, id, auth.lang, cur).replace("pdf=1&", "")}&fallback=1`, 303);
  }
}
