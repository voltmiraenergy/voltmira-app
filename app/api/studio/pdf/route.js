// app/api/studio/pdf/route.js — clean, stamp-free PDF for the Studio documents.
//
// The Studio surfaces (connection request, technical annex, P50/P90 bankability,
// payments invoice) render their document live on the client from the Client &
// System bar. window.print() would let Chrome stamp every page with its own
// title / URL / date header; instead the client posts the rendered document here
// and headless Chromium renders it with displayHeaderFooter:false.
//
// This is a STATIC render of trusted-shape markup: the caller is authenticated,
// <script> and inline handlers are stripped, remote <img> is dropped, every
// network request inside Chromium is blocked, and Inter is injected as base64.
import { NextResponse } from "next/server";
import { renderHtmlPdf } from "../../../../lib/renderProposalPdf.js";
import { isRateLimited, clientIp } from "../../../../lib/ratelimit.js";
import { supabaseServer } from "../../../../lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Palette tokens the document CSS references (mirrors AppTheme.jsx), so the
// off-page render resolves --line / --green / etc. without the app stylesheet.
const TOKENS = ":root{--line:#E3E1D6;--green:#1E6B4E;--amber:#E89B2D;--ink:#14211b;--muted:#66756C;--paper:#F6F5F0;--paper-2:#ffffff;--red:#C4543B;--font-d:Inter,system-ui,sans-serif;--font-m:ui-monospace,monospace}";

export async function POST(req) {
  // Studio lives behind the app shell — authenticated callers only.
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  if (await isRateLimited(`studiopdf:${clientIp(req)}`, 40, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const rawHtml = String(b.html || "");
  const rawCss = String(b.css || "");
  if (!rawHtml || rawHtml.length > 500_000 || rawCss.length > 300_000) {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }

  // Static render only: drop scripts, inline event handlers, and any non-data:
  // image so nothing fetches or executes.
  const html = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/<img\b(?![^>]*\bsrc\s*=\s*["']data:)[^>]*>/gi, "");
  const css = rawCss.replace(/<\/?style[^>]*>/gi, "");

  let filename = (String(b.filename || "voltmira-document").replace(/[^\w.-]+/g, "-").slice(0, 60)) || "voltmira-document";
  if (!/\.pdf$/i.test(filename)) filename += ".pdf";

  const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(b.title || "VoltMira")}</title>
<style>
  @page{size:A4;margin:16mm}
  html,body{background:#fff;margin:0;padding:0}
  body{font-family:Inter,system-ui,sans-serif;color:#14211b;font-size:11.8px;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  ${TOKENS}
  ${css}
  /* the on-screen card chrome becomes a plain full-page document */
  .pv-doc{max-width:none!important;margin:0!important;border:none!important;border-radius:0!important;box-shadow:none!important;padding:0!important;background:#fff!important;font-size:11.8px!important;line-height:1.4!important}
  /* Tighter print rhythm than the screen so a long doc (the annex) packs into
     full pages instead of spilling a couple of trailing lines + the signature
     onto a near-empty extra page. */
  .pv-doc h1{margin:0 0 3px!important}
  .pv-doc h2{margin:12px 0 5px!important;font-size:12.5px!important}
  .pv-doc h3{margin:9px 0 4px!important}
  .pv-doc p{margin:0 0 5px!important}
  .pv-doc table{margin:2px 0 4px!important;font-size:10.8px!important}
  .pv-doc td,.pv-doc th{padding:4px 7px!important}
  .pv-doc .doc-kv{padding:3px 0!important}
  .pv-doc .doc-sign{margin-top:14px!important}
  .pv-doc table,.pv-doc tr,.pv-doc .doc-kv,.pv-doc .doc-grid{break-inside:avoid}
  .pv-doc .doc-sign > div{break-inside:avoid}
  .pv-doc h2,.pv-doc h3{break-after:avoid}
  svg{max-width:100%}
  /* the single-line diagram is the tallest block — cap it so it never eats a
     third of a page and push the following sections up */
  .pv-doc .sld-svg{max-width:600px!important;display:block;margin:0 auto}
</style></head><body>${html}</body></html>`;

  try {
    const pdf = await renderHtmlPdf(full);
    return new NextResponse(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    console.error("[studio-pdf] generation failed:", e?.message || e);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }
}
