// app/api/deal/[token]/pack/route.js — the bank downloads the full pack of
// the plant through its link: the credit summary in Romanian and English
// (headless Chromium renders /d/[token]/summary, which shows only what the
// link shows), the Excel model, the checklist and every document on file, one
// folder per item. The same pack as the installer's (lib/bankPack.js). A pack
// above what a function may answer is handed over through Storage. Logged.
// Listed in lib/pdfRoutes.mjs so the Chromium binary is bundled with it.
import { NextResponse, after } from "next/server";
import { renderPdf, requestOrigin } from "../../../../../lib/renderProposalPdf.js";
import { loadDeal, logView, readDocs, storePack, INLINE_LIMIT } from "../../../../../lib/dealLoad.js";
import { notifyDealActivity } from "../../../../../lib/dealNotify.js";
import { buildBankPack, PACK_LANGS } from "../../../../../lib/bankPack.js";
import { PLANTS_KEY } from "../../../../../lib/portfolioModel.js";
import { isRateLimited, clientIp } from "../../../../../lib/ratelimit.js";
import { mdDayKey } from "../../../../../lib/tz.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, props) {
  const { token } = await props.params;
  if (await isRateLimited(`dealpack:${clientIp(req)}`, 10, 60 * 60 * 1000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const d = await loadDeal(token);
  if (d.state !== "active") return NextResponse.json({ error: "closed" }, { status: 404 });
  const { link, sb } = d;

  const pdfs = {};
  for (const l of PACK_LANGS) {
    try {
      ({ pdf: pdfs[l] } = await renderPdf(`${requestOrigin(req)}/d/${token}/summary?pdf=1&lang=${l}`, { ready: "article.rp-credit" }));
    } catch (e) {
      console.error(`[deal-pack] ${l} summary failed:`, e?.message || e);
      break;
    }
  }
  const { documents, failed } = await readDocs(sb.storage, d.docs);
  const today = mdDayKey(Date.now());
  const pack = buildBankPack({
    model: d.model, plant: d.portfolio.assets[PLANTS_KEY][0], pdfs, xlsxLang: link.lang,
    company: d.co?.name || "", generatedAt: today, todayKey: today, documents, docFailed: failed,
  });
  await logView(link, "pack", "", req.headers);
  after(() => notifyDealActivity(link, "pack"));

  const headers = { "cache-control": "no-store", "x-summaries-missing": pack.failed.join(",") || "none" };
  if (pack.bytes.length > INLINE_LIMIT) {
    const url = await storePack(sb.storage, { companyId: link.company_id, portfolioId: link.portfolio_id, plantId: link.plant_id, filename: pack.filename, bytes: pack.bytes, key: link.id.slice(0, 8) });
    if (!url) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    return NextResponse.redirect(url, { status: 303, headers: { ...headers, "referrer-policy": "no-referrer" } });
  }
  return new NextResponse(Buffer.from(pack.bytes), {
    headers: { ...headers, "content-type": "application/zip", "content-disposition": `attachment; filename="${pack.filename}"` },
  });
}
