// app/api/portfolios/[id]/bankpack/route.js — the bank submission pack of one
// plant (?plant=<id>) as a ZIP: the credit summary in Romanian and in English
// (headless Chromium renders /portfolios/[id]/bank with the CALLER's own
// session cookies, so it can never show more than they may see), the plant's
// Excel model, the permit checklist, the documents filed on it (read from the
// private bucket with the same session) and a manifest of what is still
// missing. A pack above what a function may answer (4.5 MB) is handed over
// through Storage with a five-minute link.
// A summary that cannot be rendered is named in the manifest, so a bank is
// never handed a package that quietly lacks it. Listed in lib/pdfRoutes.mjs so
// the Chromium binary is bundled with it.
import { NextResponse } from "next/server";
import { renderPdf } from "../../../../../lib/renderProposalPdf.js";
import { authorizePortfolio, authCookies, reportUrl } from "../../../../../lib/portfolioRoute.js";
import { buildModel, PLANTS_KEY } from "../../../../../lib/portfolioModel.js";
import { plantOnly, buildBankPack, PACK_LANGS } from "../../../../../lib/bankPack.js";
import { mdDayKey } from "../../../../../lib/tz.js";
import { supabaseServer } from "../../../../../lib/supabase.js";
import { readDocs, storePack, INLINE_LIMIT } from "../../../../../lib/dealLoad.js";
import { ITEM_IDS } from "../../../../../lib/dealRoom.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, props) {
  const { id } = await props.params;
  const auth = await authorizePortfolio(req, id, { limitKey: "pfbank", limit: 15 });
  if (auth instanceof NextResponse) return auth;
  const plantId = new URL(req.url).searchParams.get("plant") || "";
  const one = plantOnly(auth.d.portfolio, plantId);
  if (!one) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const model = buildModel({ portfolio: one, projects: [], E: auth.d.E, schemeLimitKw: auth.d.schemeLimitKw });

  const pdfs = {};
  for (const l of PACK_LANGS) {
    try {
      ({ pdf: pdfs[l] } = await renderPdf(reportUrl(req, id, l, "", "bank", plantId), { cookies: authCookies(req), ready: "article.rp-credit" }));
    } catch (e) {
      console.error(`[portfolio-bankpack] ${l} summary failed:`, e?.message || e);
      // the renderer is down: a second attempt would only spend the time limit
      break;
    }
  }
  // the documents on the checklist, through the caller's own session; a
  // database without the deal room simply has none
  const sb = await supabaseServer();
  const { data: docRows } = await sb.from("deal_documents").select("item_id, name, path, created_at")
    .eq("portfolio_id", id).eq("plant_id", plantId).order("created_at", { ascending: true });
  const { documents, failed } = await readDocs(sb.storage, (docRows || []).filter((d) => ITEM_IDS.includes(d.item_id)));
  const today = mdDayKey(Date.now());
  const pack = buildBankPack({
    model, plant: one.assets[PLANTS_KEY][0], pdfs,
    xlsxLang: PACK_LANGS.includes(auth.lang) ? auth.lang : "ro",
    company: auth.d.co?.name || "", generatedAt: today, todayKey: today, documents, docFailed: failed,
  });
  const headers = { "cache-control": "private, max-age=0, must-revalidate", "x-summaries-missing": pack.failed.join(",") || "none" };
  if (pack.bytes.length > INLINE_LIMIT) {
    const url = await storePack(sb.storage, { companyId: auth.d.portfolio.company_id, portfolioId: id, plantId, filename: pack.filename, bytes: pack.bytes });
    if (!url) return NextResponse.json({ error: "too_large" }, { status: 503 });
    return NextResponse.redirect(url, { status: 303, headers });
  }
  return new NextResponse(Buffer.from(pack.bytes), {
    headers: { ...headers, "content-type": "application/zip", "content-disposition": `attachment; filename="${pack.filename}"` },
  });
}
