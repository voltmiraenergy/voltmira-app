// app/api/portfolios/[id]/dataroom/route.js — the data room as one ZIP: the
// bankability report (PDF), the Excel model, and the registers as CSV, with a
// manifest that says what is NOT in it. If the PDF cannot be rendered right now
// the archive is still built, and the manifest says the report is missing, so a
// lender is never handed a package that quietly lacks its main document.
// A portfolio that holds plants sells its documents with the pack
// (lib/packAccess.js loadPortfolioAccess): once the gate is on, it answers 402
// until paid. A portfolio of rooftop quotes only keeps its data room as before.
import { NextResponse } from "next/server";
import { renderPdf } from "../../../../../lib/renderProposalPdf.js";
import { buildDataRoom } from "../../../../../lib/portfolioExport.js";
import { authorizePortfolio, authCookies, reportUrl, gatePortfolio } from "../../../../../lib/portfolioRoute.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, props) {
  const { id } = await props.params;
  const auth = await authorizePortfolio(req, id, { limitKey: "pfroom", limit: 15 });
  if (auth instanceof NextResponse) return auth;
  // a portfolio with plants: the pack pays for its documents (lib/packAccess.js)
  const locked = await gatePortfolio(auth);
  if (locked) return locked;
  let pdf = null;
  try {
    ({ pdf } = await renderPdf(reportUrl(req, id, auth.lang), { cookies: authCookies(req), ready: "article.rp" }));
  } catch (e) {
    console.error("[portfolio-dataroom] report PDF failed:", e?.message || e);
  }
  const room = buildDataRoom(auth.model, {
    lang: auth.lang, pdf, company: auth.d.co?.name || "", generatedAt: new Date().toISOString().slice(0, 10),
  });
  return new NextResponse(Buffer.from(room.bytes), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${room.filename}"`,
      "cache-control": "private, max-age=0, must-revalidate",
      "x-report-included": pdf ? "yes" : "no",
    },
  });
}
