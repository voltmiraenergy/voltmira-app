// lib/portfolioRoute.js — the shared front of the portfolio download routes
// (report PDF, teaser, Excel model, data room, a plant's bank pack): who may call, which language,
// the model, and the session cookies the headless browser replays. Server-only.
import { NextResponse } from "next/server";
import { loadPortfolio } from "./portfolioLoad.js";
import { buildModel } from "./portfolioModel.js";
import { isRateLimited, clientIp } from "./ratelimit.js";
import { requestOrigin } from "./renderProposalPdf.js";
import { loadPortfolioAccess, lockedBody } from "./packAccess.js";
import { currentUser } from "./session.js";

export const DOC_LANGS = ["en", "uk", "ro", "ru"];

/** Only the Supabase auth cookies are replayed to the headless browser. */
export function authCookies(req) {
  return req.cookies.getAll().filter((c) => c.name.startsWith("sb-")).map((c) => ({ name: c.name, value: c.value }));
}

/**
 * Shared guard. Returns { d, model, lang } for a signed-in caller who may see
 * this portfolio, or a NextResponse to send back.
 */
export async function authorizePortfolio(req, id, { limitKey, limit = 20 } = {}) {
  if (limitKey && (await isRateLimited(`${limitKey}:${clientIp(req)}`, limit, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }
  const d = await loadPortfolio(id);
  if (d.state === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (d.state === "needs_db") return NextResponse.json({ error: "needs_db" }, { status: 503 });
  if (d.state !== "ok") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const asked = new URL(req.url).searchParams.get("lang");
  const lang = DOC_LANGS.includes(asked) ? asked : "en";
  const model = buildModel({ portfolio: d.portfolio, projects: d.quotes, E: d.E, schemeLimitKw: d.schemeLimitKw });
  if (!model.assets.length) return NextResponse.json({ error: "empty_portfolio" }, { status: 422 });
  return { d, model, lang };
}

/** The display currency a download asked for (MDL or UAH), or "" for EUR. */
export function askedCurrency(req) {
  const c = new URL(req.url).searchParams.get("cur");
  return c === "MDL" || c === "UAH" ? c : "";
}

export function reportUrl(req, id, lang, cur = "", doc = "report", plantId = "") {
  // the caller's own host: the render replays THEIR session cookies
  const base = requestOrigin(req);
  const page = doc === "teaser" ? "teaser" : doc === "bank" ? "bank" : "report";
  // pdf=1 hides the on-screen toolbar; the PDF is driven through CDP, not window.print()
  return `${base}/portfolios/${id}/${page}?pdf=1&lang=${lang}${cur ? `&cur=${cur}` : ""}${plantId ? `&plant=${encodeURIComponent(plantId)}` : ""}`;
}

export const safeName = (s) => String(s || "portfolio").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "portfolio";

/**
 * The pack gate for a portfolio's own documents (report, teaser, Excel model,
 * data room): null when the caller may download, else the 402 to answer, with
 * the price and the plant to pay for (lib/packAccess.js loadPortfolioAccess).
 */
export async function gatePortfolio(auth) {
  const user = await currentUser();
  const access = await loadPortfolioAccess({ portfolio: auth.d.portfolio, email: user?.email });
  return access.open ? null : NextResponse.json({ ...lockedBody(access), plant: access.payPlantId }, { status: 402 });
}
