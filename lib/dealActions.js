"use server";
// lib/dealActions.js — the installer's side of the deal room links: open one
// for a bank and close it. Runs on the caller's own session, so row-level
// security keeps every link inside their company; the token is made here, on
// the server, from a secure random source. Documents and answers are written
// from the browser through the same security (components/portfolio/ItemFiles.jsx).
import { randomBytes } from "node:crypto";
import { supabaseServer } from "./supabase.js";
import { isRateLimited } from "./ratelimit.js";
import { findPlant } from "./bankPack.js";
import { cleanBank, expiryFrom, LINK_LANGS } from "./dealRoom.js";

const UUID = /^[0-9a-f-]{36}$/i;
const NEEDS_DB = /deal_links|notify|schema cache|does not exist/i;

async function signedIn() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}

/** A read-only link for one bank to one plant. */
export async function createDealLink({ portfolioId, plantId, bank, days, lang, notify = true } = {}) {
  const { sb, user } = await signedIn();
  if (!user) return { ok: false, error: "auth" };
  if (!UUID.test(String(portfolioId || ""))) return { ok: false, error: "missing" };
  const name = cleanBank(bank);
  if (!name) return { ok: false, error: "bank" };
  if (await isRateLimited(`deallink:${user.id}`, 30, 60 * 60 * 1000)) return { ok: false, error: "rate_limited" };
  // the plant must be saved in this portfolio, which the caller can read
  const { data: portfolio } = await sb.from("portfolios").select("id, assets").eq("id", portfolioId).maybeSingle();
  if (!portfolio || !findPlant(portfolio, plantId)) return { ok: false, error: "plant" };
  const { data, error } = await sb.from("deal_links").insert({
    portfolio_id: portfolioId, plant_id: String(plantId), token: randomBytes(24).toString("base64url"),
    bank: name, lang: LINK_LANGS.includes(lang) ? lang : "ro", expires_at: expiryFrom(days),
    // the column's default is on; it is only written when the user turned it off
    ...(notify === false ? { notify: false } : {}),
  }).select("*").single();
  if (error) return { ok: false, error: NEEDS_DB.test(error.message || "") ? "needs_db" : "save" };
  return { ok: true, link: data };
}

/** Close a link: the bank can no longer open it. The log and the questions stay. */
export async function revokeDealLink(id) {
  const { sb, user } = await signedIn();
  if (!user) return { ok: false, error: "auth" };
  if (!UUID.test(String(id || ""))) return { ok: false, error: "missing" };
  const { data, error } = await sb.from("deal_links").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null).select("*").maybeSingle();
  if (error) return { ok: false, error: "save" };
  return { ok: true, link: data };
}
