// lib/dealLoad.js — the bank's side of the deal room, on the server: a link
// is looked up by its token with the service role (the bank has no account),
// checked (open, not expired, not revoked), and only then is the one plant it
// names read: the live model, the documents on file and this link's own
// questions. Every read and write is scoped to the link's company, portfolio
// and plant. Also: the access log, and reading documents from Storage for a
// pack. Server-only.
import { createHmac } from "node:crypto";
import { supabaseAdmin } from "./supabase.js";
import { companyEngine } from "./engineSettings.js";
import { getFxRates } from "./fx.js";
import { buildModel } from "./portfolioModel.js";
import { plantOnly } from "./bankPack.js";
import { isToken, linkState, DEAL_BUCKET, ITEM_IDS } from "./dealRoom.js";

const DOC_COLS = "id, item_id, name, path, size_bytes, mime, created_at";

/** The link behind a token, and whether it is open. */
export async function openDeal(token) {
  if (!isToken(token)) return { state: "missing" };
  const sb = supabaseAdmin();
  const { data: link, error } = await sb.from("deal_links").select("*").eq("token", token).maybeSingle();
  if (error || !link) return { state: "missing" };
  return { state: linkState(link), link, sb };
}

/**
 * An open link with everything its page shows: the company, the plant alone
 * with the portfolio's terms, the model, the documents and this link's
 * questions. { state } alone when the link is not open.
 */
export async function loadDeal(token, { model: withModel = true } = {}) {
  const o = await openDeal(token);
  if (o.state !== "active") return { state: o.state };
  const { link, sb } = o;
  const [{ data: portfolio }, { data: co }] = await Promise.all([
    sb.from("portfolios").select("*").eq("id", link.portfolio_id).eq("company_id", link.company_id).maybeSingle(),
    sb.from("companies").select("*").eq("id", link.company_id).maybeSingle(),
  ]);
  const one = portfolio ? plantOnly(portfolio, link.plant_id) : null;
  if (!one || !co) return { state: "missing" };
  const scope = (q) => q.eq("company_id", link.company_id).eq("portfolio_id", link.portfolio_id).eq("plant_id", link.plant_id);
  const [{ data: docs }, { data: questions }] = await Promise.all([
    scope(sb.from("deal_documents").select(DOC_COLS)).order("created_at", { ascending: true }),
    // a bank sees its own questions, not another bank's
    scope(sb.from("deal_questions").select("id, item_id, asked_by, body, answer, answer_doc_id, answered_at, created_at")).eq("link_id", link.id).order("created_at", { ascending: false }),
  ]);
  const E = { ...(await companyEngine(co)), subsidyAmountRon: Number(co.subsidy_amount_ron ?? 20000) };
  let fx = { rates: { EUR: 1, MDL: Number(E.fx?.MDL) || null, UAH: Number(E.fx?.UAH) || null }, meta: {} };
  try {
    const live = await getFxRates();
    fx = { rates: live.rates, meta: live.meta };
  } catch { /* the engine's rates stand */ }
  const schemeLimitKw = { MD: Number(co.prosumer_limit_kw ?? 10.8) };
  const model = withModel ? buildModel({ portfolio: one, projects: [], E, schemeLimitKw, include: { sensitivity: false, structures: false } }) : null;
  if (withModel && !model.assets.length) return { state: "missing" };
  return {
    state: "active", link, sb, co, portfolio: one, E, fx, schemeLimitKw, model,
    docs: (docs || []).filter((d) => ITEM_IDS.includes(d.item_id)), questions: questions || [],
  };
}

/** One visitor told from another without keeping the address: a keyed hash of the address and the browser. */
export function visitorOf(headers) {
  const ip = headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "";
  const ua = headers.get("user-agent") || "";
  const key = process.env.DEAL_LOG_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "voltmira-deal-room";
  return createHmac("sha256", key).update(`${ip}|${ua}`).digest("hex").slice(0, 32);
}

/** The browser in a few words, for the log: "Chrome on Windows". */
export function agentOf(headers) {
  const ua = headers.get("user-agent") || "";
  const b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [b, os].filter(Boolean).join(" / ").slice(0, 120);
}

/** A line in the access log. A failed write never blocks the bank. */
export async function logView(link, what, detail, headers) {
  try {
    await supabaseAdmin().from("deal_views").insert({
      company_id: link.company_id, link_id: link.id, portfolio_id: link.portfolio_id, plant_id: link.plant_id,
      what, detail: String(detail || "").slice(0, 200), visitor: visitorOf(headers), agent: agentOf(headers),
    });
  } catch (e) {
    console.error("[deal-room] log failed:", e?.message || e);
  }
}

/**
 * The documents' bytes from Storage, for a pack. A file that cannot be read
 * is named in `failed`, so the manifest can say so.
 * @param {object} storage  a Supabase client's storage (the caller's session, or the service role for a link)
 */
export async function readDocs(storage, docs = []) {
  const documents = [];
  const failed = [];
  for (const d of docs) {
    const { data, error } = await storage.from(DEAL_BUCKET).download(d.path);
    if (error || !data) { failed.push(d.name); continue; }
    documents.push({ item_id: d.item_id, name: d.name, data: new Uint8Array(await data.arrayBuffer()) });
  }
  return { documents, failed };
}

/** Above this a response is handed over through Storage: a function answers at most 4.5 MB. */
export const INLINE_LIMIT = 4 * 1024 * 1024;

/**
 * Where a large pack is put for download, and a short-lived link to it.
 * @returns {Promise<string|null>} the signed URL, or null when it could not be stored
 */
export async function storePack(storage, { companyId, portfolioId, plantId, filename, bytes, key = "" }) {
  const safe = String(plantId).replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 80) || "plant";
  const path = `${companyId}/${portfolioId}/${safe}/_packs/${key ? key + "-" : ""}${filename}`;
  const up = await storage.from(DEAL_BUCKET).upload(path, bytes, { upsert: true, contentType: "application/zip" });
  if (up.error) return null;
  const { data, error } = await storage.from(DEAL_BUCKET).createSignedUrl(path, 300, { download: filename });
  return error ? null : data.signedUrl;
}
