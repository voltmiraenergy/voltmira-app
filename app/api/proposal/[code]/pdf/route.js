// app/api/proposal/[code]/pdf/route.js — server-side PDF download.
//
// The proposal PDF used to be made by the CLIENT's browser: /p/<code>?print=1
// rendered HTML and AutoPrint called window.print(). That put the most
// important document in the product outside our control:
//
//   1. Chrome stamped its own header on every page — the page title and the raw
//      proposal URL — which silently undid the white-labelling Pro/Team is sold on.
//   2. Paper size was whatever the exporter's print dialog defaulted to. The
//      original export measured 612x792pt (US Letter) in an A4 market, and
//      @page only sets the dialog's default; it can still be overridden.
//   3. Nothing server-side could attach the PDF to an email, because the file
//      only existed after a human clicked through a dialog.
//
// The actual rendering lives in lib/renderProposalPdf.js so the emailed copy is
// byte-for-byte what the installer downloads.
import { NextResponse } from "next/server";
import { renderProposalPdf } from "../../../../../lib/renderProposalPdf.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";

// Chromium needs a real filesystem and ~1GB of RAM: Node runtime, never Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, { params }) {
  // Generating a PDF costs a browser launch; cap it well below abuse level but
  // far above what a real installer exporting quotes would ever hit.
  if (await isRateLimited(`pdf:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }
  const code = params.code;
  if (!/^[a-z0-9]{4,32}$/i.test(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const { pdf, timings } = await renderProposalPdf(code, base);
    return new NextResponse(pdf, {
      headers: {
        "content-type": "application/pdf",
        // `inline` so a click opens the viewer; the filename still applies on save.
        "content-disposition": `inline; filename="VoltMira-proposal-${code}.pdf"`,
        "cache-control": "private, max-age=0, must-revalidate",
        // Cumulative phase marks, so a slow export can be diagnosed from the
        // response instead of by guessing.
        "server-timing": Object.entries(timings).map(([k, v]) => `${k};dur=${v}`).join(", "),
      },
    });
  } catch (e) {
    console.error("[pdf] generation failed:", e?.message || e);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }
}
