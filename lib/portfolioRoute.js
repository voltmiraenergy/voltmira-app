// lib/portfolioRoute.js — the shared front of the three portfolio download
// routes (report PDF, Excel model, data room): who may call, which language,
// the model, and the session cookies the headless browser replays. Server-only.
import { NextResponse } from "next/server";
import { loadPortfolio } from "./portfolioLoad.js";
import { buildModel } from "./portfolioModel.js";
import { isRateLimited, clientIp } from "./ratelimit.js";

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

export function reportUrl(req, id, lang) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  // pdf=1 hides the on-screen toolbar; the PDF is driven through CDP, not window.print()
  return `${base}/portfolios/${id}/report?pdf=1&lang=${lang}`;
}

export const safeName = (s) => String(s || "portfolio").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "portfolio";
